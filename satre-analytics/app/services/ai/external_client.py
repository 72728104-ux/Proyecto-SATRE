"""Cliente asíncrono de Google Gemini (SATRE TOBE-3 §4.1 / §6.1).

Solo debe invocarse con payloads ya sanitizados por PrivacyGuardService.
Lee `GEMINI_API_KEY` y `AI_MODEL_NAME` desde `app.core.config`.
"""
from __future__ import annotations

import asyncio
import json
import logging
from functools import lru_cache
from typing import Any

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.services.ai.create_protocol import (
    CREATE_SYSTEM_INSTRUCTION,
    SocraticCreateTurn,
    parse_structured_turn,
    turn_to_public_dict,
)

DEFAULT_MODEL_NAME = "gemini-3.8-flash"
DEFAULT_TIMEOUT_SECONDS = 20.0
logger = logging.getLogger("satre.analytics")

SOCRATIC_SYSTEM_INSTRUCTION = CREATE_SYSTEM_INSTRUCTION


class TeacherPedagogicalPlan(BaseModel):
    """Esquema JSON forzado para el plan de acompañamiento docente."""

    summary: str = Field(description="Síntesis del plan de acompañamiento MINEDU")
    actions: list[str] = Field(
        default_factory=list,
        description="Acciones pedagógicas recomendadas",
    )
    materials: list[str] = Field(
        default_factory=list,
        description="Materiales o recursos sugeridos",
    )


def _timeout_seconds(settings: Settings) -> float:
    configured = float(settings.ai_timeout_seconds or DEFAULT_TIMEOUT_SECONDS)
    if configured <= 0:
        return DEFAULT_TIMEOUT_SECONDS
    return min(configured, DEFAULT_TIMEOUT_SECONDS)


def _http_options(timeout_seconds: float) -> types.HttpOptions:
    return types.HttpOptions(
        timeout=int(timeout_seconds * 1000),
        retry_options=types.HttpRetryOptions(attempts=1),
    )


def _build_client(settings: Settings | None = None) -> genai.Client:
    settings = settings or get_settings()
    kwargs: dict[str, Any] = {"http_options": _http_options(_timeout_seconds(settings))}
    if settings.gemini_api_key:
        kwargs["api_key"] = settings.gemini_api_key
    return genai.Client(**kwargs)


@lru_cache
def get_client() -> genai.Client:
    """Cliente oficial `google.genai.Client` (sync + `client.aio`)."""
    return _build_client()


def _unavailable(reason: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "available": False,
        "reason": reason,
        "message": message,
    }
    payload.update(extra)
    return payload


def _is_safety_blocked(response: Any) -> bool:
    feedback = getattr(response, "prompt_feedback", None)
    block_reason = getattr(feedback, "block_reason", None) if feedback else None
    if block_reason not in (
        None,
        types.BlockedReason.BLOCKED_REASON_UNSPECIFIED,
        "",
    ):
        return True

    blocked_finish = {
        types.FinishReason.SAFETY,
        types.FinishReason.BLOCKLIST,
        types.FinishReason.PROHIBITED_CONTENT,
        types.FinishReason.SPII,
        types.FinishReason.RECITATION,
    }
    for candidate in getattr(response, "candidates", None) or []:
        if getattr(candidate, "finish_reason", None) in blocked_finish:
            return True
    return False


def _history_contents(history: list | None) -> list[types.Content]:
    contents: list[types.Content] = []
    for item in history or []:
        if isinstance(item, str):
            text = item.strip()
            role = "user"
        elif isinstance(item, dict):
            text = str(item.get("content") or item.get("text") or "").strip()
            raw_role = str(item.get("role") or "user").strip().lower()
            role = "user" if raw_role in {"user", "student"} else "model"
        else:
            continue
        if not text:
            continue
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=text)])
        )
    return contents


def _serialize_context(context: dict | None) -> str:
    return json.dumps(context or {}, ensure_ascii=False, default=str)


class ExternalAIService:
    """Invocaciones asíncronas a Gemini para tutor socrático y plan docente."""

    def __init__(
        self,
        client: genai.Client | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client or _build_client(self._settings)
        self._model = (self._settings.ai_model_name or DEFAULT_MODEL_NAME).strip()
        self._timeout = _timeout_seconds(self._settings)

    async def generate_socratic_guidance(
        self,
        *,
        system_privacy: str,
        context: dict,
        sanitized_message: str,
        history: list | None = None,
    ) -> dict[str, Any]:
        prompt = (
            "Contexto académico anónimo (escala MINEDU AD/A/B/C) y fase C.R.E.A.T.E.:\n"
            f"{_serialize_context(context)}\n\n"
            "Mensaje del estudiante (ya sanitizado):\n"
            f"{sanitized_message}\n\n"
            "Responde a ESE mensaje: si el alumno se equivoca o confunde un concepto, "
            "corrige ese punto concreto con una pregunta socrática. "
            "No uses un texto genérico que ignore lo que escribió.\n\n"
            "Devuelve un único JSON C.R.E.A.T.E. con create_phase, explanation, "
            "reflection y, si aplica, quiz, diagram_mermaid o visual_resource. "
            "No marques la opción correcta del quiz."
        )
        logger.info(
            "gemini socratic request model=%s phase=%s message_chars=%s history=%s",
            self._model,
            (context or {}).get("create_phase"),
            len(sanitized_message),
            len(history or []),
        )
        contents = _history_contents(history)
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
        )
        instruction = "\n\n".join(
            part.strip()
            for part in (SOCRATIC_SYSTEM_INSTRUCTION, system_privacy)
            if part and part.strip()
        )
        config = types.GenerateContentConfig(
            system_instruction=instruction,
            response_mime_type="application/json",
            response_schema=SocraticCreateTurn,
            http_options=_http_options(self._timeout),
        )
        result = await self._generate(contents, config)
        logger.info(
            "gemini socratic response available=%s reason=%s",
            result.get("available"),
            result.get("reason"),
        )
        if not result["available"]:
            result.setdefault(
                "guidance",
                "No pude completar la guía ahora. Reformula tu duda en una "
                "pregunta concreta y volvamos a intentarlo; no compartas datos personales.",
            )
            return result
        try:
            turn = parse_structured_turn(result.get("response"), result.get("text"))
        except (TypeError, ValueError, json.JSONDecodeError):
            return _unavailable(
                "invalid_response",
                "La IA no devolvió un turno socrático estructurado.",
                guidance=result.get("text") or "",
            )
        return turn_to_public_dict(turn)

    async def generate_teacher_recommendation(self, *, context: dict) -> dict[str, Any]:
        prompt = (
            "Genera un plan de acompañamiento docente según el estándar MINEDU "
            "(escala cualitativa AD, A, B, C) para este perfil anónimo. "
            "No uses nombres, DNI ni identificadores reales.\n"
            f"{_serialize_context(context)}"
        )
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TeacherPedagogicalPlan,
            http_options=_http_options(self._timeout),
        )
        result = await self._generate(prompt, config)
        empty = {"summary": None, "actions": [], "materials": []}
        if not result["available"]:
            return {**empty, **result}

        try:
            plan = self._parse_teacher_plan(result.get("response"), result.get("text"))
        except (TypeError, ValueError, json.JSONDecodeError):
            return _unavailable(
                "invalid_response",
                "La IA no devolvió un plan docente estructurado.",
                **empty,
            )
        return {
            "available": True,
            "summary": plan.summary,
            "actions": plan.actions,
            "materials": plan.materials,
        }

    def _parse_teacher_plan(
        self,
        response: Any,
        text: str | None,
    ) -> TeacherPedagogicalPlan:
        parsed = getattr(response, "parsed", None) if response is not None else None
        if isinstance(parsed, TeacherPedagogicalPlan):
            return parsed
        if isinstance(parsed, dict):
            return TeacherPedagogicalPlan.model_validate(parsed)
        raw = (text or "").strip()
        return TeacherPedagogicalPlan.model_validate_json(raw)

    async def _generate(
        self,
        contents: Any,
        config: types.GenerateContentConfig,
    ) -> dict[str, Any]:
        if not self._settings.gemini_api_key:
            logger.warning("gemini skipped: GEMINI_API_KEY no está configurada")
            return _unavailable(
                "not_configured",
                "GEMINI_API_KEY no está configurada.",
            )
        try:
            logger.info("gemini generate_content model=%s timeout=%s", self._model, self._timeout)
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self._model,
                    contents=contents,
                    config=config,
                ),
                timeout=self._timeout,
            )
        except TimeoutError:
            logger.warning("gemini timeout model=%s", self._model)
            return _unavailable("timeout", "La API de IA no respondió a tiempo.")
        except errors.APIError as exc:
            logger.warning(
                "gemini APIError model=%s code=%s status=%s",
                self._model,
                getattr(exc, "code", None),
                getattr(exc, "status", None),
            )
            return self._from_api_error(exc)
        except Exception:
            logger.exception("gemini unexpected error model=%s", self._model)
            return _unavailable("api_error", "No se pudo completar la llamada a Gemini.")

        if _is_safety_blocked(response):
            return _unavailable(
                "safety_blocked",
                "La respuesta fue bloqueada por los filtros de seguridad.",
            )

        text = (getattr(response, "text", None) or "").strip()
        return {"available": True, "text": text, "response": response}

    @staticmethod
    def _from_api_error(exc: errors.APIError) -> dict[str, Any]:
        code = getattr(exc, "code", None)
        status = str(getattr(exc, "status", "") or "").upper()
        if code == 429 or status == "RESOURCE_EXHAUSTED":
            return _unavailable(
                "quota_exhausted",
                "La cuota de la API de IA está agotada.",
            )
        if code in {408, 504} or status in {"DEADLINE_EXCEEDED", "CANCELLED"}:
            return _unavailable("timeout", "La API de IA no respondió a tiempo.")
        if code in {500, 502, 503} or status in {"UNAVAILABLE", "INTERNAL"}:
            return _unavailable(
                "api_unavailable",
                "La API de IA no está disponible temporalmente.",
            )
        return _unavailable("api_error", "La API de IA devolvió un error.")


def generate_content(contents: str, *, model: str | None = None) -> str:
    """Invocación síncrona de compatibilidad con `AI_MODEL_NAME` de `app.core.config`."""
    settings = get_settings()
    model_name = (model or settings.ai_model_name or DEFAULT_MODEL_NAME).strip()
    response = get_client().models.generate_content(model=model_name, contents=contents)
    return (getattr(response, "text", None) or "").strip()

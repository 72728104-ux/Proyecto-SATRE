"""Cliente asíncrono de Google Gemini (SATRE TOBE-3 §4.1 / §6.1).

Solo debe invocarse con payloads ya sanitizados por PrivacyGuardService.
Carga `GEMINI_API_KEY` con python-dotenv antes de instanciar Google GenAI.
"""
from __future__ import annotations

import asyncio
import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import dotenv_values, load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

from app.config import (
    STABLE_AI_FALLBACK_MODEL_NAME,
    STABLE_AI_MODEL_NAME,
    ensure_gemini_api_key,
    resolve_ai_model_name,
)
from app.core.config import Settings, get_settings
from app.services.ai.create_protocol import (
    CREATE_SYSTEM_INSTRUCTION,
    SocraticCreateTurn,
    parse_structured_turn,
    turn_to_public_dict,
)

_ANALYTICS_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE = _ANALYTICS_ROOT / ".env"

DEFAULT_MODEL_NAME = STABLE_AI_MODEL_NAME
DEFAULT_FALLBACK_MODEL_NAME = STABLE_AI_FALLBACK_MODEL_NAME
DEFAULT_TIMEOUT_SECONDS = 30.0
RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504]
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


class TeacherAssistantReply(BaseModel):
    """Turno conversacional del asistente pedagógico (SATRE TOBE-5 §3)."""

    text: str = Field(description="Respuesta conversacional al docente en español")
    summary: str = Field(description="Síntesis del plan de intervención")
    actions: list[str] = Field(
        default_factory=list,
        description="Estrategias de intervención o actividades remediales",
    )
    materials: list[str] = Field(
        default_factory=list,
        description="Materiales o recursos sugeridos",
    )
    criterion_focus: str | None = Field(
        default=None,
        description="Criterio evaluativo A, B, C o D si aplica",
    )


TEACHER_ASSISTANT_SYSTEM_INSTRUCTION = (
    "Eres el asistente pedagógico SATRE para docentes. "
    "Recomiendas intervenciones diferenciadas según la escala Minedu vigesimal "
    "(0–20, aprobatorio ≥ 11) y su letra cualitativa AD/A/B/C, y según los "
    "criterios evaluativos A, B, C y D. "
    "Sugiere actividades remediales concretas para riesgo ALTO o MEDIO. "
    "Puedes redactar resúmenes ejecutivos para reuniones con apoderados o tutores. "
    "Responde en español, sin nombres, DNI ni identificadores reales."
)

TEACHER_ASSISTANT_FALLBACK_MODEL = STABLE_AI_FALLBACK_MODEL_NAME


def _load_gemini_key_from_dotenv(env_file: Path | None = None) -> str | None:
    """Fuerza python-dotenv ANTES de instanciar `google.genai.Client`."""
    path = env_file or _ENV_FILE
    load_dotenv(path, override=False)
    key = ensure_gemini_api_key(path)
    if key:
        return key
    if path.is_file():
        file_key = (dotenv_values(path).get("GEMINI_API_KEY") or "").strip()
        if file_key:
            return file_key
    return None


def _attach_gemini_key(settings: Settings, key: str | None) -> None:
    if not key or getattr(settings, "gemini_api_key", None):
        return
    try:
        settings.gemini_api_key = key
    except (AttributeError, TypeError, ValueError):
        try:
            object.__setattr__(settings, "gemini_api_key", key)
        except (AttributeError, TypeError):
            pass


def _timeout_seconds(settings: Settings) -> float:
    configured = float(settings.ai_timeout_seconds or DEFAULT_TIMEOUT_SECONDS)
    if configured <= 0:
        return DEFAULT_TIMEOUT_SECONDS
    return min(configured, DEFAULT_TIMEOUT_SECONDS)


def _http_options(timeout_seconds: float) -> types.HttpOptions:
    return types.HttpOptions(
        timeout=int(timeout_seconds * 1000),
        retry_options=types.HttpRetryOptions(
            attempts=3,
            initial_delay=1.0,
            max_delay=6.0,
            http_status_codes=RETRY_STATUS_CODES,
        ),
    )


def _disable_afc() -> types.AutomaticFunctionCallingConfig:
    return types.AutomaticFunctionCallingConfig(disable=True)


def _sanitize_error_text(detail: str, secret: str | None) -> str:
    text = (detail or "").strip()
    if secret:
        text = text.replace(secret, "[REDACTED]")
    return text


def _log_provider_error(
    exc: BaseException,
    *,
    model: str,
    stage: str,
    secret: str | None = None,
) -> str:
    """Imprime el error real de google-genai en la consola de Uvicorn."""
    detail = _sanitize_error_text(f"{type(exc).__name__}: {exc}", secret)
    code = getattr(exc, "code", None)
    status = getattr(exc, "status", None)
    line = (
        f"[satre-analytics] Gemini {stage} model={model} "
        f"code={code} status={status} error={detail}"
    )
    print(line, flush=True)
    logger.error(line)
    logger.error(exc)
    return detail


def _build_client(settings: Settings | None = None) -> genai.Client:
    api_key = _load_gemini_key_from_dotenv()
    settings = settings or get_settings()
    _attach_gemini_key(settings, api_key)
    kwargs: dict[str, Any] = {"http_options": _http_options(_timeout_seconds(settings))}
    key = api_key or settings.gemini_api_key
    if key:
        kwargs["api_key"] = key
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
            role = "user" if raw_role in {"user", "student", "teacher"} else "model"
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
        loaded_key = _load_gemini_key_from_dotenv()
        self._settings = settings or get_settings()
        _attach_gemini_key(self._settings, loaded_key)
        self._client = client or _build_client(self._settings)
        self._model = resolve_ai_model_name(
            getattr(self._settings, "ai_model_name", None),
            fallback=DEFAULT_MODEL_NAME,
        )
        self._fallback_model = resolve_ai_model_name(
            getattr(self._settings, "ai_fallback_model_name", None),
            fallback=DEFAULT_FALLBACK_MODEL_NAME,
        )
        self._timeout = _timeout_seconds(self._settings)
        logger.info(
            "gemini client ready key_present=%s key_length=%s model=%s fallback=%s timeout=%s",
            bool(getattr(self._settings, "gemini_api_key", None)),
            len(getattr(self._settings, "gemini_api_key", None) or ""),
            self._model,
            self._fallback_model,
            self._timeout,
        )

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
            automatic_function_calling=_disable_afc(),
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
            automatic_function_calling=_disable_afc(),
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

    async def generate_teacher_assistant(
        self,
        *,
        system_privacy: str,
        context: dict,
        sanitized_message: str,
        history: list | None = None,
    ) -> dict[str, Any]:
        prompt = (
            "Contexto académico anónimo del aula o alumno (escala MINEDU 0–20, "
            "aprobatorio ≥ 11, letras AD/A/B/C, criterios evaluativos A–D):\n"
            f"{_serialize_context(context)}\n\n"
            "Consulta del docente (ya sanitizada):\n"
            f"{sanitized_message}\n\n"
            "Responde a ESA consulta con estrategias de intervención pedagógica. "
            "Si pregunta por un criterio A–D, prioriza actividades remediales de "
            "esa competencia. Si pide un resumen para apoderados, sé ejecutivo. "
            "No uses nombres, DNI ni identificadores reales."
        )
        logger.info(
            "gemini teacher-assistant request model=%s message_chars=%s history=%s",
            self._model,
            len(sanitized_message),
            len(history or []),
        )
        contents = _history_contents(history)
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
        )
        instruction = "\n\n".join(
            part.strip()
            for part in (TEACHER_ASSISTANT_SYSTEM_INSTRUCTION, system_privacy)
            if part and part.strip()
        )
        config = types.GenerateContentConfig(
            system_instruction=instruction,
            response_mime_type="application/json",
            response_schema=TeacherAssistantReply,
            automatic_function_calling=_disable_afc(),
            http_options=_http_options(self._timeout),
        )
        result = await self._generate(contents, config, extra_models=[TEACHER_ASSISTANT_FALLBACK_MODEL])
        empty = {
            "text": None,
            "summary": None,
            "actions": [],
            "materials": [],
            "criterion_focus": None,
        }
        if not result["available"]:
            return {**empty, **result}
        try:
            reply = self._parse_teacher_assistant(result.get("response"), result.get("text"))
        except (TypeError, ValueError, json.JSONDecodeError):
            return _unavailable(
                "invalid_response",
                "La IA no devolvió una respuesta docente estructurada.",
                **empty,
            )
        return {
            "available": True,
            "text": reply.text,
            "summary": reply.summary,
            "actions": reply.actions,
            "materials": reply.materials,
            "criterion_focus": reply.criterion_focus,
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

    def _parse_teacher_assistant(
        self,
        response: Any,
        text: str | None,
    ) -> TeacherAssistantReply:
        parsed = getattr(response, "parsed", None) if response is not None else None
        if isinstance(parsed, TeacherAssistantReply):
            return parsed
        if isinstance(parsed, dict):
            return TeacherAssistantReply.model_validate(parsed)
        raw = (text or "").strip()
        return TeacherAssistantReply.model_validate_json(raw)

    def _models_to_try(self, extra_models: list[str] | None = None) -> list[str]:
        models = [self._model]
        if self._fallback_model and self._fallback_model != self._model:
            models.append(self._fallback_model)
        for extra in extra_models or []:
            name = (extra or "").strip()
            if name and name not in models:
                models.append(name)
        return models

    async def _generate(
        self,
        contents: Any,
        config: types.GenerateContentConfig,
        extra_models: list[str] | None = None,
    ) -> dict[str, Any]:
        key = getattr(self._settings, "gemini_api_key", None) or _load_gemini_key_from_dotenv()
        if not key:
            message = "GEMINI_API_KEY no está configurada."
            print(f"[satre-analytics] Gemini error: {message}", flush=True)
            logger.error("gemini skipped: %s", message)
            return _unavailable("not_configured", message)
        _attach_gemini_key(self._settings, key)
        last: dict[str, Any] | None = None
        models = self._models_to_try(extra_models)
        for index, model in enumerate(models):
            result = await self._generate_once(model, contents, config)
            if result["available"]:
                return result
            last = result
            can_fallback = (
                index < len(models) - 1
                and result.get("reason") in {"api_unavailable", "timeout", "api_error"}
            )
            if not can_fallback:
                return result
            logger.warning(
                "gemini %s on model=%s; trying fallback=%s",
                result.get("reason"),
                model,
                models[index + 1],
            )
        return last or _unavailable("api_error", "No se pudo completar la llamada a Gemini.")

    async def _generate_once(
        self,
        model: str,
        contents: Any,
        config: types.GenerateContentConfig,
    ) -> dict[str, Any]:
        try:
            logger.info("gemini generate_content model=%s timeout=%s", model, self._timeout)
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                ),
                timeout=self._timeout,
            )
        except TimeoutError as exc:
            detail = _log_provider_error(
                exc,
                model=model,
                stage="timeout",
                secret=self._settings.gemini_api_key,
            )
            return _unavailable("timeout", "La API de IA no respondió a tiempo.", provider_error=detail)
        except errors.APIError as exc:
            _log_provider_error(
                exc,
                model=model,
                stage="APIError",
                secret=self._settings.gemini_api_key,
            )
            return self._from_api_error(exc)
        except Exception as exc:
            detail = _log_provider_error(
                exc,
                model=model,
                stage="unexpected",
                secret=self._settings.gemini_api_key,
            )
            return _unavailable(
                "api_error",
                "No se pudo completar la llamada a Gemini.",
                provider_error=detail,
            )

        if _is_safety_blocked(response):
            return _unavailable(
                "safety_blocked",
                "La respuesta fue bloqueada por los filtros de seguridad.",
            )

        text = (getattr(response, "text", None) or "").strip()
        return {"available": True, "text": text, "response": response}

    def _from_api_error(self, exc: errors.APIError) -> dict[str, Any]:
        code = getattr(exc, "code", None)
        status = str(getattr(exc, "status", "") or "").upper()
        detail = _sanitize_error_text(
            str(getattr(exc, "message", None) or exc),
            self._settings.gemini_api_key,
        )
        extra = {
            "http_status": code,
            "provider_status": status or None,
            "provider_error": detail or None,
        }
        if code in {401, 403} or status in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
            return _unavailable(
                "auth_error",
                "La API Key de IA fue rechazada.",
                **extra,
            )
        if code == 429 or status == "RESOURCE_EXHAUSTED":
            return _unavailable(
                "quota_exhausted",
                "La cuota de la API de IA está agotada.",
                **extra,
            )
        if code in {408, 504} or status in {"DEADLINE_EXCEEDED", "CANCELLED"}:
            return _unavailable("timeout", "La API de IA no respondió a tiempo.", **extra)
        if code in {500, 502, 503} or status in {"UNAVAILABLE", "INTERNAL"}:
            return _unavailable(
                "api_unavailable",
                "La API de IA no está disponible temporalmente.",
                **extra,
            )
        if code == 404 or status == "NOT_FOUND":
            return _unavailable(
                "api_unavailable",
                "El modelo de IA no está disponible.",
                **extra,
            )
        return _unavailable("api_error", "La API de IA devolvió un error.", **extra)


def generate_content(contents: str, *, model: str | None = None) -> str:
    """Invocación síncrona de compatibilidad con `AI_MODEL_NAME` de `app.core.config`."""
    _load_gemini_key_from_dotenv()
    settings = get_settings()
    model_name = resolve_ai_model_name(
        model or settings.ai_model_name,
        fallback=DEFAULT_MODEL_NAME,
    )
    response = get_client().models.generate_content(
        model=model_name,
        contents=contents,
        config=types.GenerateContentConfig(automatic_function_calling=_disable_afc()),
    )
    return (getattr(response, "text", None) or "").strip()

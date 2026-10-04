"""Metodología C.R.E.A.T.E. para el tutor híbrido (TOBE-3 + UI interactiva).

Fases: Conectar, Recordar, Explicar, Aplicar, Transferir, Evaluar.
El payload hacia Gemini y el reply hacia Laravel/frontend comparten este esquema.
"""
from __future__ import annotations

import json
import re
from typing import Any, Literal

from pydantic import BaseModel, Field

CREATE_PHASES = (
    "conectar",
    "recordar",
    "explicar",
    "aplicar",
    "transferir",
    "evaluar",
)

CreatePhase = Literal[
    "conectar",
    "recordar",
    "explicar",
    "aplicar",
    "transferir",
    "evaluar",
]

STEP_TO_CREATE: dict[str, str] = {
    "diagnostico": "conectar",
    "pregunta_guia": "recordar",
    "pista": "explicar",
    "verificacion": "aplicar",
    "reflexion": "transferir",
    "finalizado": "evaluar",
}

CREATE_TO_STEP: dict[str, str] = {
    "conectar": "diagnostico",
    "recordar": "pregunta_guia",
    "explicar": "pista",
    "aplicar": "verificacion",
    "transferir": "reflexion",
    "evaluar": "finalizado",
}

INTENT_HINT = "hint"
INTENT_DIAGRAM = "diagram"
INTENT_QUIZ = "quiz"

_INTENT_PREFIXES: tuple[tuple[str, str], ...] = (
    ("[HINT]", INTENT_HINT),
    ("[PISTA]", INTENT_HINT),
    ("[DIAGRAM_MERMAID]", INTENT_DIAGRAM),
    ("[DIAGRAM]", INTENT_DIAGRAM),
    ("[QUIZ]", INTENT_QUIZ),
    ("[RECURSO_VISUAL]", INTENT_DIAGRAM),
)

CREATE_SYSTEM_INSTRUCTION = (
    "Eres un tutor socrático del programa SATRE. "
    "Mantén un tono pedagógico, paciente y orientador. "
    "No entregues la respuesta final ni el procedimiento completo al alumno. "
    "Guía con preguntas, pistas graduales y contraejemplos para que construya "
    "el razonamiento. Usa únicamente la escala cualitativa peruana AD, A, B y C. "
    "No pidas ni menciones nombres, DNI, correo, colegio COAR ni ubicación.\n\n"
    "Aplica ESTRICTAMENTE la metodología C.R.E.A.T.E. (una fase por turno):\n"
    "- Conectar: activa saberes previos y el propósito del tema.\n"
    "- Recordar: evoca definiciones o hechos clave que el estudiante ya debería conocer.\n"
    "- Explicar: ofrece pistas sintéticas y analogías; nunca el procedimiento completo.\n"
    "- Aplicar: propone un caso breve o un quiz de comprobación.\n"
    "- Transferir: pide aplicar la idea a un contexto nuevo o cotidiano.\n"
    "- Evaluar: solicita reflexión y verificación del propio razonamiento.\n\n"
    "Responde SOLO con JSON del esquema indicado.\n"
    "explanation: bloque de explicación o pistas sintéticas.\n"
    "quiz: solo si la fase es Aplicar o el estudiante pidió autoevaluación; "
    "opciones con id a/b/c/d; NUNCA indiques cuál es correcta.\n"
    "diagram_mermaid: sintaxis Mermaid válida (flowchart/graph) sin fences markdown, "
    "solo si aporta claridad o el estudiante pidió diagrama.\n"
    "visual_resource: recurso visual breve (título + descripción), opcional.\n"
    "reflection: siempre una petición concreta de verificación o reflexión del estudiante.\n"
    "Si pide pista, permanece en Explicar. Si pide diagrama, incluye diagram_mermaid. "
    "Si pide autoevaluación, incluye quiz.\n\n"
    "Interpreta SIEMPRE el mensaje concreto del estudiante. "
    "Si afirma un concepto incorrecto o confunde términos (por ejemplo, dice que "
    "la pendiente es «el eje»), corrige ESE concepto con una pregunta socrática. "
    "Nunca uses un texto genérico o pregrabado que ignore lo que acaba de escribir."
)


class QuizOption(BaseModel):
    id: str = Field(min_length=1, max_length=10)
    text: str = Field(min_length=1)


class QuizBlock(BaseModel):
    question: str = Field(min_length=1)
    options: list[QuizOption] = Field(default_factory=list)


class VisualResource(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""


class SocraticCreateTurn(BaseModel):
    """Respuesta estructurada del tutor (JSON forzado en Gemini)."""

    create_phase: CreatePhase
    explanation: str = Field(min_length=1)
    reflection: str = ""
    quiz: QuizBlock | None = None
    diagram_mermaid: str | None = None
    visual_resource: VisualResource | None = None
    done: bool = False


def detect_intent(message: str | None, option_id: str | None = None) -> str | None:
    raw = f"{message or ''} {option_id or ''}".strip()
    if not raw:
        return None
    upper = raw.upper()
    for prefix, intent in _INTENT_PREFIXES:
        if upper.startswith(prefix) or f" {prefix}" in f" {upper}":
            return intent
    compact = raw.strip().lower()
    if compact in {"hint", "pista"}:
        return INTENT_HINT
    if compact in {"diagram", "mermaid"}:
        return INTENT_DIAGRAM
    if compact == "quiz":
        return INTENT_QUIZ
    return None


def strip_intent_prefix(message: str | None) -> str:
    if not message:
        return ""
    text = message.strip()
    upper = text.upper()
    for prefix, _intent in _INTENT_PREFIXES:
        if upper.startswith(prefix):
            return text[len(prefix):].strip()
    return text


def next_create_phase(current: str | None, intent: str | None = None) -> str:
    if intent == INTENT_HINT:
        return "explicar"
    if intent == INTENT_DIAGRAM:
        return current if current in CREATE_PHASES else "explicar"
    if intent == INTENT_QUIZ:
        return "aplicar"
    if current not in CREATE_PHASES:
        return "conectar"
    index = CREATE_PHASES.index(current)
    return CREATE_PHASES[min(index + 1, len(CREATE_PHASES) - 1)]


def create_phase_for_step(step: str | None) -> str:
    return STEP_TO_CREATE.get(step or "", "conectar")


def step_for_create_phase(phase: str | None) -> str:
    return CREATE_TO_STEP.get(phase or "", "diagnostico")


def _public_quiz(quiz: Any) -> dict | None:
    if isinstance(quiz, QuizBlock):
        quiz = quiz.model_dump()
    if not isinstance(quiz, dict):
        return None
    question = str(quiz.get("question") or "").strip()
    options = []
    for item in quiz.get("options") or []:
        if not isinstance(item, dict):
            continue
        option_id = str(item.get("id") or "").strip()[:10]
        text = str(item.get("text") or "").strip()
        if option_id and text:
            options.append({"id": option_id, "text": text})
    if not question or not options:
        return None
    return {"question": question, "options": options}


def _public_visual(resource: Any) -> dict | None:
    if isinstance(resource, VisualResource):
        resource = resource.model_dump()
    if not isinstance(resource, dict):
        return None
    title = str(resource.get("title") or "").strip()
    if not title:
        return None
    return {
        "title": title,
        "description": str(resource.get("description") or "").strip(),
    }


def _clean_mermaid(source: str | None) -> str | None:
    if not source:
        return None
    text = source.strip()
    text = re.sub(r"^```(?:mermaid)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    if not text or len(text) > 4000:
        return None
    return text


def parse_create_markdown(text: str) -> dict[str, Any]:
    """Extrae fase y bloques [QUIZ], [DIAGRAM_MERMAID], [RECURSO_VISUAL] de Markdown."""
    payload: dict[str, Any] = {}
    fase = re.search(r"\[FASE\]\s*:?\s*([A-Za-zÁÉÍÓÚáéíóú]+)", text, re.IGNORECASE)
    if fase:
        token = fase.group(1).casefold()
        normalized = (
            token.replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
        )
        aliases = {
            "conexion": "conectar",
            "aplicacion": "aplicar",
            "verificacion": "evaluar",
        }
        candidate = aliases.get(normalized, normalized)
        if candidate in CREATE_PHASES:
            payload["create_phase"] = candidate

    mermaid = re.search(
        r"\[DIAGRAM_MERMAID\](.*?)(?:\[/DIAGRAM_MERMAID\]|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if mermaid:
        payload["diagram_mermaid"] = _clean_mermaid(mermaid.group(1))

    fence = re.search(r"```mermaid\s*(.*?)```", text, re.IGNORECASE | re.DOTALL)
    if fence and not payload.get("diagram_mermaid"):
        payload["diagram_mermaid"] = _clean_mermaid(fence.group(1))

    visual = re.search(
        r"\[RECURSO_VISUAL\](.*?)(?:\[/RECURSO_VISUAL\]|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if visual:
        body = visual.group(1).strip()
        title_match = re.search(r"t[ií]tulo\s*:\s*(.+)", body, re.IGNORECASE)
        desc_match = re.search(r"descripci[oó]n\s*:\s*(.+)", body, re.IGNORECASE)
        payload["visual_resource"] = _public_visual({
            "title": (title_match.group(1).strip() if title_match else body.splitlines()[0]),
            "description": desc_match.group(1).strip() if desc_match else "",
        })

    quiz = re.search(r"\[QUIZ\](.*?)(?:\[/QUIZ\]|$)", text, re.IGNORECASE | re.DOTALL)
    if quiz:
        body = quiz.group(1).strip()
        options = []
        for match in re.finditer(r"^([a-dA-D])[).:-]\s*(.+)$", body, re.MULTILINE):
            options.append({"id": match.group(1).lower(), "text": match.group(2).strip()})
        question_line = next(
            (line.strip() for line in body.splitlines() if line.strip() and not re.match(r"^[a-dA-D][).:-]", line.strip())),
            body.splitlines()[0] if body else "",
        )
        question_line = re.sub(r"^(pregunta|quiz)\s*:\s*", "", question_line, flags=re.IGNORECASE)
        payload["quiz"] = _public_quiz({"question": question_line, "options": options})

    cleaned = re.sub(r"\[FASE\]\s*:?\s*[A-Za-zÁÉÍÓÚáéíóú]+", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\[(QUIZ|DIAGRAM_MERMAID|RECURSO_VISUAL)\].*?(?:\[/\1\]|$)",
        "",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = re.sub(r"```mermaid.*?```", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    payload["explanation"] = cleaned.strip()
    return payload


def turn_to_public_dict(turn: SocraticCreateTurn) -> dict[str, Any]:
    quiz = _public_quiz(turn.quiz)
    visual = _public_visual(turn.visual_resource)
    payload: dict[str, Any] = {
        "available": True,
        "create_phase": turn.create_phase,
        "explanation": turn.explanation.strip(),
        "reflection": (turn.reflection or "").strip(),
        "quiz": quiz,
        "diagram_mermaid": _clean_mermaid(turn.diagram_mermaid),
        "visual_resource": visual,
        "done": bool(turn.done),
    }
    payload["guidance"] = _guidance_text(payload)
    return payload


def _guidance_text(payload: dict[str, Any]) -> str:
    parts = [payload.get("explanation") or ""]
    if payload.get("reflection"):
        parts.append(payload["reflection"])
    return "\n\n".join(part for part in parts if part).strip()


def normalize_socratic_payload(
    raw: dict[str, Any] | None,
    *,
    fallback_phase: str = "conectar",
) -> dict[str, Any]:
    """Normaliza la salida de Gemini o un dict parcial a reply CREATE."""
    data = dict(raw or {})
    if not data.get("available", True):
        guidance = str(data.get("guidance") or data.get("message") or "").strip()
        return {
            "available": False,
            "reason": data.get("reason"),
            "message": data.get("message"),
            "guidance": guidance,
            "create_phase": fallback_phase if fallback_phase in CREATE_PHASES else "conectar",
            "explanation": guidance,
            "reflection": "",
            "quiz": None,
            "diagram_mermaid": None,
            "visual_resource": None,
            "done": False,
        }

    text = str(data.get("guidance") or data.get("explanation") or data.get("text") or "").strip()
    parsed = parse_create_markdown(text) if text and "[" in text else {}
    phase = data.get("create_phase") or parsed.get("create_phase") or fallback_phase
    if phase not in CREATE_PHASES:
        phase = fallback_phase if fallback_phase in CREATE_PHASES else "conectar"

    quiz = _public_quiz(data.get("quiz") or parsed.get("quiz"))
    explanation = str(data.get("explanation") or parsed.get("explanation") or text).strip()
    reflection = str(data.get("reflection") or "").strip()
    payload = {
        "available": True,
        "create_phase": phase,
        "explanation": explanation or text,
        "reflection": reflection,
        "quiz": quiz,
        "diagram_mermaid": _clean_mermaid(data.get("diagram_mermaid") or parsed.get("diagram_mermaid")),
        "visual_resource": _public_visual(data.get("visual_resource") or parsed.get("visual_resource")),
        "done": bool(data.get("done")),
    }
    payload["guidance"] = data.get("guidance") or _guidance_text(payload)
    return payload


def reply_from_create(
    payload: dict[str, Any],
    *,
    reply_type: str | None = None,
) -> dict[str, Any]:
    """Reply compatible con /v1/socratic/next + campos CREATE."""
    quiz = payload.get("quiz")
    options = list((quiz or {}).get("options") or [])
    text = _guidance_text(payload) or str(payload.get("guidance") or "").strip()
    kind = reply_type
    if not kind:
        if payload.get("done"):
            kind = "closing"
        elif quiz:
            kind = "question"
        elif payload.get("create_phase") == "evaluar":
            kind = "reflection"
        elif payload.get("create_phase") == "explicar":
            kind = "hint"
        else:
            kind = "question"
    reply: dict[str, Any] = {
        "type": kind,
        "text": text,
        "create_phase": payload.get("create_phase") or "conectar",
        "explanation": payload.get("explanation") or text,
        "reflection": payload.get("reflection") or "",
        "quiz": quiz,
        "diagram_mermaid": payload.get("diagram_mermaid"),
        "visual_resource": payload.get("visual_resource"),
    }
    if options:
        reply["options"] = options
    return reply


def parse_structured_turn(response: Any, text: str | None) -> SocraticCreateTurn:
    parsed = getattr(response, "parsed", None) if response is not None else None
    if isinstance(parsed, SocraticCreateTurn):
        return parsed
    if isinstance(parsed, dict):
        return SocraticCreateTurn.model_validate(parsed)
    raw = (text or "").strip()
    if raw.startswith("{"):
        return SocraticCreateTurn.model_validate(json.loads(raw))
    markdown = parse_create_markdown(raw)
    markdown["create_phase"] = markdown.get("create_phase") or "explicar"
    markdown["explanation"] = markdown.get("explanation") or raw
    return SocraticCreateTurn.model_validate(markdown)

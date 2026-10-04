"""Pipeline híbrido del tutor socrático (SATRE TOBE-3 §5.3).

Orden: satre_ro → PrivacyGuard + escala MINEDU → Gemini.
El diálogo socrático no se frena por datos insuficientes: el alumno puede
estudiar un tema aunque aún no tenga 5 asistencias y 3 notas. El reporte
docente sí mantiene el freno de costo (§5.2).
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.ai.create_protocol import (
    detect_intent,
    next_create_phase,
    normalize_socratic_payload,
    reply_from_create,
    strip_intent_prefix,
)
from app.services.ai.external_client import ExternalAIService
from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.deterministic.risk_engine import calculate_student_risk
from app.services.privacy.guardrails import PrivacyGuardService

logger = logging.getLogger("satre.analytics")


def _with_minedu_grade(analytics: dict) -> dict:
    data = dict(analytics)
    vigesimal = data.get("vigesimal_score")
    if vigesimal is not None:
        data["qualitative_grade"] = PeruvianGradingScaler.to_qualitative(vigesimal)
    return data


def _sanitize_history(history: list | None) -> list:
    sanitized: list = []
    for item in history or []:
        if isinstance(item, str):
            sanitized.append(PrivacyGuardService.sanitize_student_input(item))
            continue
        if not isinstance(item, dict):
            continue
        text = item.get("content") or item.get("text") or ""
        sanitized.append({
            "role": str(item.get("role") or "user"),
            "content": PrivacyGuardService.sanitize_student_input(str(text) if text else ""),
        })
    return sanitized


class HybridSocraticService:
    def __init__(self, ai_client: ExternalAIService):
        self.ai_client = ai_client

    async def process_interaction(
        self,
        db,
        student_id: int,
        user_message: str,
        history: list | None = None,
        *,
        topic: str | None = None,
        create_phase: str | None = None,
        intent: str | None = None,
        criterion: str | None = None,
    ) -> dict[str, Any]:
        analytics = calculate_student_risk(db, student_id)
        insufficient = bool(analytics.get("insufficient_data"))
        payload = _with_minedu_grade(analytics)
        resolved_intent = intent or detect_intent(user_message)
        phase = next_create_phase(create_phase, resolved_intent)
        safe_message = PrivacyGuardService.sanitize_student_input(
            strip_intent_prefix(user_message) or user_message
        )
        safe_history = _sanitize_history(history)
        safe_context = PrivacyGuardService.build_safe_context(student_id, payload)
        if topic:
            safe_context["topic"] = PrivacyGuardService.sanitize_student_input(topic)
        if criterion:
            safe_context["criterion"] = str(criterion).strip().upper()[:1]
        safe_context["create_phase"] = phase
        if resolved_intent:
            safe_context["intent"] = resolved_intent

        logger.info(
            "socratic-hybrid invoking gemini student_hash=%s insufficient_data=%s phase=%s intent=%s message_chars=%s",
            hash(student_id) % 10000,
            insufficient,
            phase,
            resolved_intent,
            len(safe_message),
        )
        ai_response = await self.ai_client.generate_socratic_guidance(
            system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
            context=safe_context,
            sanitized_message=safe_message,
            history=safe_history,
        )
        structured = normalize_socratic_payload(ai_response, fallback_phase=phase)
        structured["create_phase"] = phase

        return {
            "insufficient_data": insufficient,
            "create_phase": phase,
            "intent": resolved_intent,
            "deterministic_metrics": {
                "risk_score": analytics["risk_score"],
                "risk_level": analytics["risk_level"],
                "minedu_grade": safe_context["qualitative_grade"],
            },
            "socratic_response": structured,
            "reply": reply_from_create(structured),
            "done": bool(structured.get("done")),
        }

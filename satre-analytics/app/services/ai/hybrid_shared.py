"""Utilidades compartidas por los pipelines híbridos (socrático y docente)."""
from __future__ import annotations

from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.privacy.guardrails import PrivacyGuardService


def with_minedu_grade(analytics: dict) -> dict:
    """Añade la letra MINEDU derivada del puntaje vigesimal, sin mutar el original."""
    data = dict(analytics)
    vigesimal = data.get("vigesimal_score")
    if vigesimal is not None:
        data["qualitative_grade"] = PeruvianGradingScaler.to_qualitative(vigesimal)
    return data


def sanitize_history(history: list | None) -> list:
    """Normaliza el historial a `[{role, content}]` y elimina datos personales."""
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

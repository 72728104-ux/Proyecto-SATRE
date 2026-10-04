"""Pipeline híbrido del dashboard docente (SATRE TOBE-3 §5.4).

Orden: satre_ro → freno de costo (§5.2) → PrivacyGuard + escala MINEDU → Gemini.
"""
from __future__ import annotations

from typing import Any

from app.services.ai.external_client import ExternalAIService
from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.deterministic.risk_engine import calculate_student_risk
from app.services.privacy.guardrails import PrivacyGuardService


def _with_minedu_grade(analytics: dict) -> dict:
    data = dict(analytics)
    vigesimal = data.get("vigesimal_score")
    if vigesimal is not None:
        data["qualitative_grade"] = PeruvianGradingScaler.to_qualitative(vigesimal)
    return data


class HybridTeacherReportService:
    def __init__(self, ai_client: ExternalAIService):
        self.ai_client = ai_client

    async def get_teacher_dashboard_data(self, db, student_id: int) -> dict[str, Any]:
        analytics = calculate_student_risk(db, student_id)

        if analytics.get("insufficient_data"):
            return {"insufficient_data": True}

        payload = _with_minedu_grade(analytics)
        safe_context = PrivacyGuardService.build_safe_context(student_id, payload)

        pedagogical_plan = await self.ai_client.generate_teacher_recommendation(
            context=safe_context,
        )

        return {
            "insufficient_data": False,
            "student_id": student_id,
            "risk_score": analytics["risk_score"],
            "risk_level": analytics["risk_level"],
            "minedu_grade": safe_context["qualitative_grade"],
            "ai_pedagogical_plan": {
                "summary": pedagogical_plan.get("summary"),
                "recommended_actions": pedagogical_plan.get("actions"),
                "suggested_materials": pedagogical_plan.get("materials"),
            },
        }

"""Pipeline híbrido del dashboard docente (SATRE TOBE-3 §5.4 / TOBE-5 §3).

Orden: satre_ro → PrivacyGuard + escala MINEDU 0–20 → Gemini.
El reporte estático (`get_teacher_dashboard_data`) mantiene el freno de costo
(§5.2). El asistente conversacional sí consulta Gemini aunque falten notas.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from app import config
from app.insights import build_insights
from app.services.ai.external_client import ExternalAIService
from app.services.ai.hybrid_shared import sanitize_history, with_minedu_grade
from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.deterministic.risk_engine import _empty_analytics, calculate_student_risk
from app.services.privacy.guardrails import PrivacyGuardService

logger = logging.getLogger("satre.analytics")


def _literal(score: Any) -> str | None:
    if score is None:
        return None
    try:
        return PeruvianGradingScaler.to_qualitative(float(score))
    except (TypeError, ValueError):
        return None


def _safe_criteria(items: list | None) -> list[dict[str, Any]]:
    safe: list[dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        mean = item.get("mean")
        safe.append({
            "criterion": str(item.get("criterion") or "").upper()[:1] or None,
            "mean_vigesimal": mean,
            "qualitative_grade": _literal(mean),
            "pct_below_passing": item.get("pct_below_4"),
        })
    return safe


def _safe_classroom_context(insights: dict, criterion: str | None) -> dict[str, Any]:
    courses = []
    for course in insights.get("courses") or []:
        if not isinstance(course, dict):
            continue
        courses.append({
            "course_name": PrivacyGuardService.sanitize_student_input(
                str(course.get("course_name") or course.get("course_code") or "")
            ),
            "criteria": _safe_criteria(course.get("criteria")),
        })

    gaps = []
    for gap in insights.get("top_gaps") or []:
        if not isinstance(gap, dict):
            continue
        gap_criterion = str(gap.get("criterion") or "").upper()[:1]
        if criterion and gap_criterion != criterion:
            continue
        methods = []
        for method in gap.get("methodologies") or []:
            if not isinstance(method, dict):
                continue
            methods.append({
                "name": PrivacyGuardService.sanitize_student_input(str(method.get("name") or "")),
                "description": PrivacyGuardService.sanitize_student_input(
                    str(method.get("description") or "")
                ),
            })
        gaps.append({
            "criterion": gap_criterion or None,
            "mean_vigesimal": gap.get("mean"),
            "qualitative_grade": _literal(gap.get("mean")),
            "pct_below_passing": gap.get("pct_below_4"),
            "methodologies": methods,
        })

    return {
        "scope": "classroom",
        "scale": "minedu_0_20",
        "passing_score": config.MINEDU_PASSING_SCORE,
        "criteria": list(config.IB_CRITERIA),
        "qualitative_letters": ["AD", "A", "B", "C"],
        "insufficient_data": bool(insights.get("insufficient_data")),
        "courses": courses,
        "top_gaps": gaps,
        "criterion_focus": criterion,
    }


class HybridTeacherReportService:
    def __init__(self, ai_client: ExternalAIService):
        self.ai_client = ai_client

    async def get_teacher_dashboard_data(self, db, student_id: int) -> dict[str, Any]:
        analytics = calculate_student_risk(db, student_id)

        if analytics.get("insufficient_data"):
            return {"insufficient_data": True}

        payload = with_minedu_grade(analytics)
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

    async def answer_teacher_query(
        self,
        db,
        classroom_id: int,
        user_message: str,
        history: list | None = None,
        *,
        student_id: int | None = None,
        criterion: str | None = None,
    ) -> dict[str, Any]:
        focus = str(criterion).strip().upper()[:1] if criterion else None
        if focus and focus not in config.IB_CRITERIA:
            focus = None

        insights, classroom_error = self._classroom_insights(db, classroom_id)
        student_metrics, student_error = self._student_metrics(db, student_id)

        insufficient = bool(insights.get("insufficient_data"))
        if student_id is not None:
            insufficient = insufficient or bool(student_metrics.get("insufficient_data"))

        safe_context = _safe_classroom_context(insights, focus)
        if student_metrics:
            safe_context["student"] = {
                "anonymous_id": student_metrics.get("anonymous_id"),
                "student_label": PrivacyGuardService.STUDENT_LABEL,
                "risk_level": student_metrics.get("risk_level"),
                "risk_score": student_metrics.get("risk_score"),
                "qualitative_grade": student_metrics.get("qualitative_grade"),
                "vigesimal_score": student_metrics.get("vigesimal_score"),
            }
            safe_context["scope"] = "student"

        safe_message = PrivacyGuardService.sanitize_student_input(user_message)
        safe_history = sanitize_history(history)

        logger.info(
            "teacher-assistant invoking gemini classroom_hash=%s student=%s insufficient_data=%s criterion=%s",
            hash(classroom_id) % 10000,
            student_id is not None,
            insufficient,
            focus,
        )
        ai_response = await self.ai_client.generate_teacher_assistant(
            system_privacy=PrivacyGuardService.SYSTEM_PRIVACY_INSTRUCTION,
            context=safe_context,
            sanitized_message=safe_message,
            history=safe_history,
        )

        reply = {
            "available": bool(ai_response.get("available")),
            "text": PrivacyGuardService.sanitize_student_input(str(ai_response.get("text") or "")),
            "summary": PrivacyGuardService.sanitize_student_input(str(ai_response.get("summary") or "")),
            "recommended_actions": [
                PrivacyGuardService.sanitize_student_input(str(item))
                for item in (ai_response.get("actions") or [])
                if str(item).strip()
            ],
            "suggested_materials": [
                PrivacyGuardService.sanitize_student_input(str(item))
                for item in (ai_response.get("materials") or [])
                if str(item).strip()
            ],
            "criterion_focus": ai_response.get("criterion_focus") or focus,
        }
        if not reply["available"]:
            reply["reason"] = ai_response.get("reason")
            reply["message"] = ai_response.get("message")

        payload: dict[str, Any] = {
            "available": reply["available"],
            "insufficient_data": insufficient,
            "scope": safe_context["scope"],
            "deterministic_metrics": {
                "risk_score": student_metrics.get("risk_score") if student_metrics else None,
                "risk_level": student_metrics.get("risk_level") if student_metrics else None,
                "minedu_grade": student_metrics.get("qualitative_grade") if student_metrics else None,
                "passing_score": config.MINEDU_PASSING_SCORE,
                "criteria": list(config.IB_CRITERIA),
                "top_gaps": safe_context["top_gaps"],
            },
            "assistant_response": reply,
        }
        if classroom_error:
            payload["classroom_reason"] = classroom_error
        if student_error:
            payload["student_reason"] = student_error
        return payload

    def _classroom_insights(self, db, classroom_id: int) -> tuple[dict[str, Any], str | None]:
        empty = {"insufficient_data": True, "courses": [], "top_gaps": [], "error_matrix": []}
        try:
            classroom = db.get_classroom(classroom_id)
            if classroom is None:
                return empty, "classroom_not_found"
            period = db.get_period(classroom.get("academic_period_id"))
            if period is None:
                return empty, "period_not_found"
            return build_insights(db.classroom_grades(classroom_id, period["id"])), None
        except SQLAlchemyError:
            logger.exception(
                "teacher-assistant classroom insights fallback classroom_hash=%s",
                hash(classroom_id) % 10000,
            )
            return empty, "database_error"

    def _student_metrics(self, db, student_id: int | None) -> tuple[dict[str, Any] | None, str | None]:
        if student_id is None:
            return None, None
        try:
            analytics = calculate_student_risk(db, student_id)
        except SQLAlchemyError:
            logger.exception(
                "teacher-assistant student context fallback student_hash=%s",
                hash(student_id) % 10000,
            )
            analytics = _empty_analytics(student_id)
            return PrivacyGuardService.build_safe_context(
                student_id,
                with_minedu_grade(analytics),
            ), "database_error"

        safe = PrivacyGuardService.build_safe_context(student_id, with_minedu_grade(analytics))
        return safe, None

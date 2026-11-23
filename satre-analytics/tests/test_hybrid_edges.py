"""Helpers compartidos híbridos y ramas de error de los pipelines socrático/docente."""
from __future__ import annotations

import pandas as pd
import pytest
from sqlalchemy.exc import OperationalError

from app.services.ai import socratic_hybrid, teacher_hybrid
from app.services.ai.hybrid_shared import sanitize_history, with_minedu_grade
from app.services.ai.socratic_hybrid import HybridSocraticService
from app.services.ai.teacher_hybrid import (
    HybridTeacherReportService,
    _literal,
    _safe_classroom_context,
    _safe_criteria,
)
from tests.conftest import FakeRepository, attendance_rows, grade_rows


def _student_frame(student_id: int = 1) -> pd.DataFrame:
    return pd.DataFrame([{"student_id": student_id, "classroom_id": 7, "is_boarder": 1}])


def sufficient_repo(student_id: int = 1) -> FakeRepository:
    return FakeRepository(
        students=_student_frame(student_id),
        attendance=attendance_rows(student_id, present=8),
        grades=grade_rows(student_id, [16], max_score=20),
    )


# --- hybrid_shared -----------------------------------------------------------


def test_with_minedu_grade_adds_letter_without_mutating_input():
    analytics = {"vigesimal_score": 16.0, "risk_level": "BAJO"}
    enriched = with_minedu_grade(analytics)
    assert enriched["qualitative_grade"] == "A"
    assert enriched["risk_level"] == "BAJO"
    assert "qualitative_grade" not in analytics

    untouched = with_minedu_grade({"vigesimal_score": None})
    assert untouched == {"vigesimal_score": None}
    assert with_minedu_grade({"risk_score": 10}) == {"risk_score": 10}


def test_sanitize_history_normalizes_and_skips_noise():
    history = [
        "Hola, mi DNI es 74839201",
        {"role": "student", "content": "Soy Ana Pérez Rojas"},
        {"role": None, "text": "texto alterno"},
        {"role": "tutor", "content": ""},
        123,
        object(),
    ]
    sanitized = sanitize_history(history)
    assert len(sanitized) == 4
    assert "[DNI_PROTEGIDO]" in sanitized[0]
    assert sanitized[1]["role"] == "student"
    assert "[ESTUDIANTE_ANONIMO]" in sanitized[1]["content"]
    assert sanitized[2] == {"role": "user", "content": "texto alterno"}
    assert sanitized[3] == {"role": "tutor", "content": ""}
    assert sanitize_history(None) == []


# --- socratic_hybrid ---------------------------------------------------------


class SocraticRecordingAI:
    def __init__(self):
        self.calls = []

    async def generate_socratic_guidance(self, **kwargs):
        self.calls.append(kwargs)
        return {"available": True, "guidance": "¿Qué dato te falta?"}


@pytest.mark.asyncio
async def test_socratic_hybrid_uses_shared_helpers_end_to_end():
    ai = SocraticRecordingAI()
    result = await HybridSocraticService(ai).process_interaction(
        sufficient_repo(),
        1,
        "Hola, soy Ana Pérez Rojas y mi DNI es 74839201",
        [{"role": "student", "content": "Mi DNI es 12345678"}],
    )
    assert result["insufficient_data"] is False
    assert result["socratic_response"]["available"] is True
    assert result["deterministic_metrics"]["minedu_grade"] == "A"

    call = ai.calls[0]
    assert "[DNI_PROTEGIDO]" in call["sanitized_message"]
    assert "[ESTUDIANTE_ANONIMO]" in call["sanitized_message"]
    assert "12345678" not in str(call["history"])
    assert call["context"]["qualitative_grade"] == "A"


@pytest.mark.asyncio
async def test_socratic_hybrid_falls_back_when_risk_engine_raises(monkeypatch):
    ai = SocraticRecordingAI()

    def boom(*_args, **_kwargs):
        raise OperationalError("SELECT 1", {}, Exception("down"))

    monkeypatch.setattr(socratic_hybrid, "calculate_student_risk", boom)
    result = await HybridSocraticService(ai).process_interaction(
        FakeRepository(),
        7,
        "[HINT] dame una pista",
        criterion="b",
        intent="quiz",
    )
    assert result["insufficient_data"] is True
    assert result["create_phase"] == "aplicar"
    assert ai.calls[0]["context"]["criterion"] == "B"
    assert ai.calls[0]["context"]["intent"] == "quiz"


# --- teacher_hybrid helpers --------------------------------------------------


def test_literal_and_safe_criteria_skip_invalid_items():
    assert _literal(None) is None
    assert _literal("abc") is None
    assert _literal(16.0) == "A"

    safe = _safe_criteria([
        "no-es-dict",
        {"criterion": "b", "mean": 15.0, "pct_below_4": 0.5},
        {"criterion": None, "mean": None},
    ])
    assert safe[0]["criterion"] == "B"
    assert safe[0]["qualitative_grade"] == "A"
    assert safe[1]["criterion"] is None
    assert safe[1]["mean_vigesimal"] is None


def test_safe_classroom_context_filters_noise_and_criterion():
    context = _safe_classroom_context(
        {
            "insufficient_data": False,
            "courses": [
                "no-es-dict",
                {
                    "course_code": "MAT",
                    "criteria": ["basura", {"criterion": "b", "mean": 15.0}],
                },
            ],
            "top_gaps": [
                "no-es-dict",
                {
                    "criterion": "a",
                    "mean": 12.0,
                    "methodologies": [
                        "basura",
                        {"name": "Taller", "description": "Practica"},
                    ],
                },
                {"criterion": "b", "mean": 9.0},
            ],
        },
        "A",
    )
    assert context["scope"] == "classroom"
    assert context["passing_score"] == 11
    assert context["criterion_focus"] == "A"
    assert context["courses"][0]["course_name"] == "MAT"
    assert len(context["top_gaps"]) == 1
    assert context["top_gaps"][0]["criterion"] == "A"
    assert context["top_gaps"][0]["methodologies"] == [
        {"name": "Taller", "description": "Practica"}
    ]


class TeacherAI:
    def __init__(self, response=None):
        self.response = response or {
            "available": True,
            "text": "Sugerencia",
            "summary": "Resumen",
            "actions": ["Acción"],
            "materials": ["Material"],
            "criterion_focus": None,
        }
        self.calls = []

    async def generate_teacher_assistant(self, **kwargs):
        self.calls.append(kwargs)
        return dict(self.response)

    async def generate_teacher_recommendation(self, **kwargs):
        return {
            "available": True,
            "summary": "Plan",
            "actions": ["Acción"],
            "materials": ["Material"],
        }


@pytest.mark.asyncio
async def test_teacher_report_uses_shared_helpers_end_to_end():
    ai = TeacherAI()
    result = await HybridTeacherReportService(ai).get_teacher_dashboard_data(sufficient_repo(), 1)
    assert result["insufficient_data"] is False
    assert result["minedu_grade"] == "A"
    assert result["ai_pedagogical_plan"]["summary"] == "Plan"


@pytest.mark.asyncio
async def test_teacher_assistant_invalid_criterion_is_ignored():
    ai = TeacherAI()
    result = await HybridTeacherReportService(ai).answer_teacher_query(
        sufficient_repo(), 7, "consulta", criterion="Z"
    )
    assert ai.calls[0]["context"]["criterion_focus"] is None
    assert result["assistant_response"]["criterion_focus"] is None


@pytest.mark.asyncio
async def test_teacher_assistant_unavailable_response_keeps_reason():
    ai = TeacherAI({"available": False, "reason": "timeout", "message": "sin respuesta"})
    result = await HybridTeacherReportService(ai).answer_teacher_query(
        sufficient_repo(), 7, "consulta"
    )
    assert result["assistant_response"]["available"] is False
    assert result["assistant_response"]["reason"] == "timeout"
    assert result["assistant_response"]["message"] == "sin respuesta"


@pytest.mark.asyncio
async def test_teacher_assistant_reports_missing_classroom():
    result = await HybridTeacherReportService(TeacherAI()).answer_teacher_query(
        FakeRepository(), 999, "consulta"
    )
    assert result["insufficient_data"] is True
    assert result["classroom_reason"] == "classroom_not_found"


@pytest.mark.asyncio
async def test_teacher_assistant_reports_missing_period():
    class NoPeriod(FakeRepository):
        def get_classroom(self, classroom_id):
            return {"id": classroom_id, "academic_period_id": 99}

    result = await HybridTeacherReportService(TeacherAI()).answer_teacher_query(
        NoPeriod(), 7, "consulta"
    )
    assert result["classroom_reason"] == "period_not_found"


@pytest.mark.asyncio
async def test_teacher_assistant_reports_classroom_database_error():
    class Down(FakeRepository):
        def get_classroom(self, classroom_id):
            raise OperationalError("SELECT 1", {}, Exception("down"))

    result = await HybridTeacherReportService(TeacherAI()).answer_teacher_query(
        Down(), 7, "consulta"
    )
    assert result["classroom_reason"] == "database_error"
    assert result["insufficient_data"] is True


@pytest.mark.asyncio
async def test_teacher_assistant_reports_student_database_error(monkeypatch):
    def boom(*_args, **_kwargs):
        raise OperationalError("SELECT 1", {}, Exception("down"))

    monkeypatch.setattr(teacher_hybrid, "calculate_student_risk", boom)
    result = await HybridTeacherReportService(TeacherAI()).answer_teacher_query(
        sufficient_repo(), 7, "consulta", student_id=1
    )
    assert result["student_reason"] == "database_error"
    assert result["scope"] == "student"

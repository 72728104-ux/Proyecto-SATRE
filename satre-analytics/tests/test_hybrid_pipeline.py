"""Pipeline híbrido: freno de costo, MINEDU y payload anónimo hacia Gemini."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest
from fastapi import HTTPException

from app import config
from app.api.dependencies import verify_internal_key
from app.services.ai.socratic_hybrid import HybridSocraticService
from app.services.ai.teacher_hybrid import HybridTeacherReportService
from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.deterministic.risk_engine import calculate_student_risk, ib_mean_to_vigesimal
from tests.conftest import FakeRepository, attendance_rows, grade_rows

STUDENT_ID = 12
PII_MESSAGE = (
    "Hola, soy Ana Pérez Rojas, DNI 74839201, "
    "mi correo es ana.perez@coar.edu.pe y no entiendo la pendiente"
)
PII_HISTORY = [
    {"role": "student", "content": "Me llamo José Luis Quispe y mi DNI es 12345678"},
    {"role": "tutor", "content": "Reformulemos el problema sin datos personales."},
]


class ForbiddenAI:
    async def generate_socratic_guidance(self, **_kwargs):
        raise AssertionError("Gemini no debe invocarse cuando insufficient_data es True")

    async def generate_teacher_recommendation(self, **_kwargs):
        raise AssertionError("Gemini no debe invocarse cuando insufficient_data es True")


class RecordingAI:
    def __init__(self):
        self.socratic_calls: list[dict] = []
        self.teacher_calls: list[dict] = []

    async def generate_socratic_guidance(self, **kwargs):
        self.socratic_calls.append(kwargs)
        return {"available": True, "guidance": "¿Qué variable puedes aislar primero?"}

    async def generate_teacher_recommendation(self, **kwargs):
        self.teacher_calls.append(kwargs)
        return {
            "available": True,
            "summary": "Acompañamiento en Logro Esperado",
            "actions": ["Retroalimentación formativa"],
            "materials": ["Ficha MINEDU de recuperación"],
        }


def _student_frame(student_id: int = STUDENT_ID) -> pd.DataFrame:
    return pd.DataFrame([{"student_id": student_id, "classroom_id": 7, "is_boarder": 1}])


def insufficient_repo(student_id: int = STUDENT_ID) -> FakeRepository:
    return FakeRepository(
        students=_student_frame(student_id),
        attendance=attendance_rows(student_id, present=2),
        grades=grade_rows(student_id, [5]),
    )


def sufficient_repo(student_id: int = STUDENT_ID, scores=None) -> FakeRepository:
    return FakeRepository(
        students=_student_frame(student_id),
        attendance=attendance_rows(student_id, present=8),
        grades=grade_rows(student_id, scores or [5, 5, 5]),
    )


def test_ib_mean_to_vigesimal_and_minedu_label():
    vigesimal = ib_mean_to_vigesimal(5.0)
    assert vigesimal == pytest.approx(14.29)
    assert PeruvianGradingScaler.to_qualitative(vigesimal) == "A"


def test_calculate_student_risk_marks_insufficient_below_min_evaluations():
    analytics = calculate_student_risk(insufficient_repo(), STUDENT_ID)
    assert analytics["insufficient_data"] is True
    assert analytics["risk_score"] is None


def test_calculate_student_risk_exposes_vigesimal_when_data_suffices():
    analytics = calculate_student_risk(sufficient_repo(), STUDENT_ID)
    assert analytics["insufficient_data"] is False
    assert analytics["vigesimal_score"] == pytest.approx(14.29)
    assert analytics["grade_mean"] == pytest.approx(5.0)


@pytest.mark.asyncio
async def test_socratic_calls_gemini_even_with_insufficient_data():
    ai = RecordingAI()
    result = await HybridSocraticService(ai).process_interaction(
        insufficient_repo(), STUDENT_ID, PII_MESSAGE, PII_HISTORY,
    )
    assert result["insufficient_data"] is True
    assert result["socratic_response"]["guidance"].startswith("¿Qué variable")
    assert len(ai.socratic_calls) == 1
    assert "74839201" not in ai.socratic_calls[0]["sanitized_message"]


@pytest.mark.asyncio
async def test_teacher_cost_brake_skips_gemini():
    result = await HybridTeacherReportService(ForbiddenAI()).get_teacher_dashboard_data(
        insufficient_repo(), STUDENT_ID,
    )
    assert result == {"insufficient_data": True}
    assert "ai_pedagogical_plan" not in result


@pytest.mark.asyncio
async def test_socratic_hybrid_returns_metrics_plus_sanitized_gemini_call():
    ai = RecordingAI()
    result = await HybridSocraticService(ai).process_interaction(
        sufficient_repo(), STUDENT_ID, PII_MESSAGE, PII_HISTORY,
    )

    assert result["insufficient_data"] is False
    metrics = result["deterministic_metrics"]
    assert metrics["risk_score"] is not None
    assert metrics["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert metrics["minedu_grade"] == "A"
    assert result["socratic_response"]["guidance"].startswith("¿Qué variable")
    assert result["create_phase"] == "conectar"
    assert result["socratic_response"]["create_phase"] == "conectar"
    assert result["reply"]["create_phase"] == "conectar"

    assert len(ai.socratic_calls) == 1
    call = ai.socratic_calls[0]
    assert "74839201" not in call["sanitized_message"]
    assert "ana.perez@coar.edu.pe" not in call["sanitized_message"]
    assert "Ana Pérez Rojas" not in call["sanitized_message"]
    assert "[DNI_PROTEGIDO]" in call["sanitized_message"]
    assert "[CORREO_PROTEGIDO]" in call["sanitized_message"]

    history_blob = str(call["history"])
    assert "12345678" not in history_blob
    assert "José Luis Quispe" not in history_blob
    assert "[DNI_PROTEGIDO]" in history_blob
    assert "[ESTUDIANTE_ANONIMO]" in history_blob

    assert "no entiendo la pendiente" in call["sanitized_message"].lower() or "pendiente" in call["sanitized_message"]
    context = call["context"]
    assert context["anonymous_id"].startswith("STUDENT_UUID_")
    assert context["anonymous_id"] != f"STUDENT_UUID_{STUDENT_ID}"
    assert context["qualitative_grade"] == "A"
    assert "student_id" not in context


@pytest.mark.asyncio
async def test_socratic_hybrid_forwards_incorrect_student_answer():
    ai = RecordingAI()
    result = await HybridSocraticService(ai).process_interaction(
        sufficient_repo(),
        STUDENT_ID,
        "el eje",
        [{"role": "tutor", "content": "¿Qué es la pendiente?"}],
        topic="Pendiente",
    )
    assert result["insufficient_data"] is False
    assert ai.socratic_calls[0]["sanitized_message"] == "el eje"
    assert ai.socratic_calls[0]["context"]["topic"] == "Pendiente"


@pytest.mark.asyncio
async def test_teacher_hybrid_returns_metrics_plus_pedagogical_plan():
    ai = RecordingAI()
    result = await HybridTeacherReportService(ai).get_teacher_dashboard_data(
        sufficient_repo(scores=[7, 7, 7]), STUDENT_ID,
    )

    assert result["insufficient_data"] is False
    assert result["student_id"] == STUDENT_ID
    assert result["risk_score"] is not None
    assert result["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert result["minedu_grade"] == "AD"
    assert result["ai_pedagogical_plan"]["summary"] == "Acompañamiento en Logro Esperado"
    assert result["ai_pedagogical_plan"]["recommended_actions"] == ["Retroalimentación formativa"]
    assert result["ai_pedagogical_plan"]["suggested_materials"] == ["Ficha MINEDU de recuperación"]

    assert len(ai.teacher_calls) == 1
    context = ai.teacher_calls[0]["context"]
    assert context["anonymous_id"].startswith("STUDENT_UUID_")
    assert context["qualitative_grade"] == "AD"
    assert "student_id" not in context
    assert "dni" not in context


# --- API FastAPI + Gemini mockeado (CI/CD sin API keys reales) ---------------

SOCRATIC_URL = "/api/v1/analytics/socratic-tutor"
TEACHER_URL = f"/api/v1/analytics/teacher-report/{STUDENT_ID}"

MOCK_GUIDANCE = "¿Qué variable puedes aislar primero?"
MOCK_TEACHER_PLAN = {
    "available": True,
    "summary": "Acompañamiento en Logro Esperado",
    "actions": ["Retroalimentación formativa"],
    "materials": ["Ficha MINEDU de recuperación"],
}


@pytest.fixture
def mock_gemini_client(monkeypatch):
    """Sustituye el cliente Gemini: cero llamadas de red ni GEMINI_API_KEY reales."""
    from app.api.dependencies import get_external_ai_service
    from app.main import app

    monkeypatch.setattr(
        "app.services.ai.external_client._build_client",
        lambda *args, **kwargs: object(),
    )
    socratic = AsyncMock(return_value={"available": True, "guidance": MOCK_GUIDANCE})
    teacher = AsyncMock(return_value=dict(MOCK_TEACHER_PLAN))
    monkeypatch.setattr(
        "app.services.ai.external_client.ExternalAIService.generate_socratic_guidance",
        socratic,
    )
    monkeypatch.setattr(
        "app.services.ai.external_client.ExternalAIService.generate_teacher_recommendation",
        teacher,
    )
    fake = SimpleNamespace(
        generate_socratic_guidance=socratic,
        generate_teacher_recommendation=teacher,
    )
    app.dependency_overrides[get_external_ai_service] = lambda: fake
    yield SimpleNamespace(socratic=socratic, teacher=teacher)
    app.dependency_overrides.pop(get_external_ai_service, None)


def test_verify_internal_key_rejects_mismatch_with_401():
    with pytest.raises(HTTPException) as exc:
        verify_internal_key("clave-que-no-coincide")
    assert exc.value.status_code == 401


def test_verify_internal_key_rejects_missing_with_401():
    with pytest.raises(HTTPException) as exc:
        verify_internal_key(None)
    assert exc.value.status_code == 401


def test_verify_internal_key_accepts_env_value():
    key = config.get_settings().internal_key
    assert verify_internal_key(key) == key


def test_socratic_api_missing_key_is_401(make_client):
    response = make_client(sufficient_repo(), key=None).post(
        SOCRATIC_URL,
        json={"student_id": STUDENT_ID, "user_message": "ayuda con la pendiente"},
    )
    assert response.status_code == 401
    assert "message" in response.json()


def test_socratic_api_wrong_key_is_401(make_client):
    response = make_client(sufficient_repo(), key="clave-incorrecta").post(
        SOCRATIC_URL,
        json={"student_id": STUDENT_ID, "user_message": "ayuda con la pendiente"},
    )
    assert response.status_code == 401


def test_teacher_api_wrong_key_is_401(make_client):
    assert make_client(sufficient_repo(), key="otra").get(TEACHER_URL).status_code == 401


def test_socratic_api_insufficient_data_still_calls_gemini(make_client, mock_gemini_client):
    response = make_client(insufficient_repo()).post(
        SOCRATIC_URL,
        json={"student_id": STUDENT_ID, "user_message": PII_MESSAGE, "history": PII_HISTORY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_data"] is True
    assert body["socratic_response"]["available"] is True
    assert body["socratic_response"]["guidance"] == MOCK_GUIDANCE
    mock_gemini_client.socratic.assert_called_once()
    mock_gemini_client.teacher.assert_not_called()


def test_teacher_api_insufficient_data_is_200_without_gemini(make_client, mock_gemini_client):
    response = make_client(insufficient_repo()).get(TEACHER_URL)
    assert response.status_code == 200
    assert response.json() == {"insufficient_data": True}
    mock_gemini_client.teacher.assert_not_called()
    mock_gemini_client.socratic.assert_not_called()


def test_socratic_api_returns_200_and_hybrid_structure(make_client, mock_gemini_client):
    response = make_client(sufficient_repo()).post(
        SOCRATIC_URL,
        json={"student_id": STUDENT_ID, "user_message": PII_MESSAGE, "history": PII_HISTORY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_data"] is False
    assert set(body["deterministic_metrics"]) == {"risk_score", "risk_level", "minedu_grade"}
    assert body["deterministic_metrics"]["risk_score"] is not None
    assert body["deterministic_metrics"]["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert body["deterministic_metrics"]["minedu_grade"] == "A"
    assert body["socratic_response"]["available"] is True
    assert body["socratic_response"]["guidance"] == MOCK_GUIDANCE
    assert body["socratic_response"]["create_phase"] == "conectar"
    assert body["socratic_response"]["explanation"] == MOCK_GUIDANCE
    assert body["reply"]["create_phase"] == "conectar"
    assert body["create_phase"] == "conectar"

    mock_gemini_client.socratic.assert_called_once()
    call = mock_gemini_client.socratic.call_args.kwargs
    assert "74839201" not in call["sanitized_message"]
    assert "ana.perez@coar.edu.pe" not in call["sanitized_message"]
    assert "[DNI_PROTEGIDO]" in call["sanitized_message"]
    assert "[CORREO_PROTEGIDO]" in call["sanitized_message"]
    assert call["context"]["anonymous_id"].startswith("STUDENT_UUID_")
    assert "student_id" not in call["context"]
    mock_gemini_client.teacher.assert_not_called()


def test_teacher_api_returns_200_and_hybrid_structure(make_client, mock_gemini_client):
    response = make_client(sufficient_repo(scores=[7, 7, 7])).get(TEACHER_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_data"] is False
    assert body["student_id"] == STUDENT_ID
    assert body["risk_score"] is not None
    assert body["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert body["minedu_grade"] == "AD"
    assert body["ai_pedagogical_plan"] == {
        "summary": MOCK_TEACHER_PLAN["summary"],
        "recommended_actions": MOCK_TEACHER_PLAN["actions"],
        "suggested_materials": MOCK_TEACHER_PLAN["materials"],
    }

    mock_gemini_client.teacher.assert_called_once()
    context = mock_gemini_client.teacher.call_args.kwargs["context"]
    assert context["anonymous_id"].startswith("STUDENT_UUID_")
    assert context["qualitative_grade"] == "AD"
    assert "student_id" not in context
    mock_gemini_client.socratic.assert_not_called()


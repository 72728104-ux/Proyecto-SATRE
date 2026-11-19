"""Ramas de error y validación de los endpoints FastAPI y del middleware."""
from __future__ import annotations

import pandas as pd
import pytest
from sqlalchemy.exc import OperationalError
from starlette.requests import Request

from app import config
from app.api import dependencies
from app.features import FEATURE_COLUMNS
from app.main import app, lifespan
from tests.conftest import FakeRepository, grade_rows


def _db_down() -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception("Can't connect to MySQL server"))


def one_student_repo(**kwargs) -> FakeRepository:
    students = pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": 1}])
    return FakeRepository(students=students, **kwargs)


# --- main internals ----------------------------------------------------------


@pytest.mark.asyncio
async def test_lifespan_initializes_settings():
    async with lifespan(app):
        assert config.get_settings() is not None


def test_period_query_parses_only_positive_digits():
    def request(query_string: str) -> Request:
        return Request({
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "query_string": query_string.encode(),
        })

    assert Request is not None
    from app.main import _period_query

    assert _period_query(request("period_id=12")) == 12
    assert _period_query(request("period_id=0")) is None
    assert _period_query(request("period_id=-3")) is None
    assert _period_query(request("period_id=abc")) is None
    assert _period_query(request("")) is None


def test_empty_risk_payload_defaults():
    from app.main import _empty_risk

    payload = _empty_risk(5, None)
    assert payload["student_id"] == 5
    assert payload["period_id"] is None
    assert payload["risk_level"] is None
    assert payload["insufficient_data"] is True


def test_chunked_post_without_content_length_is_411(make_client):
    client = make_client(FakeRepository())

    def chunks():
        yield b'{"topic": "x"}'

    response = client.post(
        "/v1/socratic/next",
        content=chunks(),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 411
    assert "Content-Length" in response.json()["message"]


# --- /v1/students/{id}/risk --------------------------------------------------


class StudentAlwaysFound(FakeRepository):
    def get_student(self, student_id):
        return {
            "id": student_id,
            "classroom_id": 7,
            "is_boarder": 1,
            "status": "active",
        }


def test_risk_without_period_returns_empty_payload(make_client):
    class NoPeriod(FakeRepository):
        def get_period(self, period_id):
            return None

    repo = NoPeriod(
        students=pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": 1}])
    )
    body = make_client(repo).get("/v1/students/1/risk").json()
    assert body["student_id"] == 1
    assert body["period_id"] is None
    assert body["insufficient_data"] is True


def test_risk_adds_student_missing_from_non_empty_cohort(make_client):
    class OtherCohort(StudentAlwaysFound):
        def period_students(self, period_id, classroom_id=None):
            return pd.DataFrame([{"student_id": 2, "classroom_id": 7, "is_boarder": 0}])

    repo = OtherCohort(grades=grade_rows(1, [16], max_score=20))
    body = make_client(repo).get("/v1/students/1/risk?period_id=3").json()
    assert body["student_id"] == 1
    assert body["insufficient_data"] is False
    assert body["risk_level"] in {"BAJO", "MEDIO", "ALTO"}


def test_risk_adds_student_when_cohort_is_empty(make_client):
    class EmptyCohort(StudentAlwaysFound):
        def period_students(self, period_id, classroom_id=None):
            return pd.DataFrame(columns=["student_id", "classroom_id", "is_boarder"])

    repo = EmptyCohort(grades=grade_rows(1, [16], max_score=20))
    body = make_client(repo).get("/v1/students/1/risk?period_id=3").json()
    assert body["student_id"] == 1
    assert body["insufficient_data"] is False


def test_risk_returns_empty_when_features_drop_the_student(make_client, monkeypatch):
    import app.main as main

    monkeypatch.setattr(
        main, "build_features", lambda *_a, **_k: pd.DataFrame(columns=FEATURE_COLUMNS)
    )
    body = make_client(one_student_repo()).get("/v1/students/1/risk?period_id=3").json()
    assert body["student_id"] == 1
    assert body["insufficient_data"] is True
    assert body["profile_cluster"] is None


# --- /v1/classrooms/{id}/insights -------------------------------------------


def test_insights_unknown_classroom_is_404(make_client):
    response = make_client(FakeRepository()).get("/v1/classrooms/999/insights")
    assert response.status_code == 404
    assert "message" in response.json()


def test_insights_without_resolvable_period_is_insufficient(make_client):
    class NoPeriod(FakeRepository):
        def get_classroom(self, classroom_id):
            return {"id": classroom_id, "academic_period_id": None}

        def get_period(self, period_id):
            return None

    body = make_client(NoPeriod()).get("/v1/classrooms/7/insights").json()
    assert body["classroom_id"] == 7
    assert body["period_id"] is None
    assert body["insufficient_data"] is True
    assert body["courses"] == []


# --- /api/v1/analytics/socratic-tutor ---------------------------------------


SOCRATIC_URL = "/api/v1/analytics/socratic-tutor"


def test_socratic_tutor_accepts_string_history(make_client):
    class EchoService:
        async def process_interaction(self, *_args, **_kwargs):
            return {"insufficient_data": False, "socratic_response": {"available": True}}

    app.dependency_overrides[dependencies.get_hybrid_socratic_service] = lambda: EchoService()
    response = make_client(one_student_repo()).post(
        SOCRATIC_URL,
        json={
            "student_id": 1,
            "user_message": "ayuda",
            "history": ["turno previo", {"role": "user", "content": "hola"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["insufficient_data"] is False


def test_socratic_tutor_database_error_returns_contract(make_client):
    class BrokenService:
        async def process_interaction(self, *_args, **_kwargs):
            raise _db_down()

    app.dependency_overrides[dependencies.get_hybrid_socratic_service] = lambda: BrokenService()
    response = make_client(one_student_repo()).post(
        SOCRATIC_URL,
        json={"student_id": 1, "user_message": "ayuda"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["reason"] == "database_error"
    assert body["insufficient_data"] is True


def test_socratic_tutor_unexpected_error_returns_contract(make_client):
    class BrokenService:
        async def process_interaction(self, *_args, **_kwargs):
            raise RuntimeError("boom")

    app.dependency_overrides[dependencies.get_hybrid_socratic_service] = lambda: BrokenService()
    response = make_client(one_student_repo()).post(
        SOCRATIC_URL,
        json={"student_id": 1, "user_message": "ayuda"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["reason"] == "internal_error"


# --- /api/v1/analytics/teacher-report ---------------------------------------


def test_teacher_report_service_database_error_returns_insufficient(make_client):
    class BrokenService:
        async def get_teacher_dashboard_data(self, *_args, **_kwargs):
            raise _db_down()

    app.dependency_overrides[dependencies.get_hybrid_teacher_service] = lambda: BrokenService()
    response = make_client(one_student_repo()).get(
        "/api/v1/analytics/teacher-report/1"
    )
    assert response.status_code == 200
    assert response.json() == {"insufficient_data": True}


# --- /api/v1/analytics/teacher-assistant ------------------------------------


ASSISTANT_URL = "/api/v1/analytics/teacher-assistant"


def test_teacher_assistant_accepts_string_history(make_client):
    class EchoService:
        async def answer_teacher_query(self, *_args, **_kwargs):
            return {
                "available": True,
                "insufficient_data": False,
                "assistant_response": {"available": True},
            }

    app.dependency_overrides[dependencies.get_hybrid_teacher_service] = lambda: EchoService()
    response = make_client(one_student_repo()).post(
        ASSISTANT_URL,
        json={
            "classroom_id": 7,
            "user_message": "consulta",
            "history": ["turno previo", {"role": "user", "content": "hola"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["available"] is True


def test_teacher_assistant_database_error_returns_contract(make_client):
    class BrokenService:
        async def answer_teacher_query(self, *_args, **_kwargs):
            raise _db_down()

    app.dependency_overrides[dependencies.get_hybrid_teacher_service] = lambda: BrokenService()
    response = make_client(one_student_repo()).post(
        ASSISTANT_URL,
        json={"classroom_id": 7, "user_message": "consulta"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["reason"] == "database_error"


def test_teacher_assistant_unexpected_error_returns_contract(make_client):
    class BrokenService:
        async def answer_teacher_query(self, *_args, **_kwargs):
            raise RuntimeError("boom")

    app.dependency_overrides[dependencies.get_hybrid_teacher_service] = lambda: BrokenService()
    response = make_client(one_student_repo()).post(
        ASSISTANT_URL,
        json={"classroom_id": 7, "user_message": "consulta"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["reason"] == "internal_error"


# --- dependencies ------------------------------------------------------------


def test_get_external_ai_service_refreshes_runtime_when_dotenv_key_found(monkeypatch):
    from types import SimpleNamespace

    calls = {"cleared": 0}
    runtime = SimpleNamespace(
        internal_key="k" * 32,
        gemini_api_key=None,
        ai_model_name="gemini-1.5-flash",
        ai_fallback_model_name="gemini-1.5-flash-8b",
        ai_timeout_seconds=5.0,
    )

    def fake_get_settings():
        return runtime

    fake_get_settings.cache_clear = lambda: calls.__setitem__("cleared", calls["cleared"] + 1)
    monkeypatch.setattr(dependencies.config, "ensure_gemini_api_key", lambda: "loaded-key")
    monkeypatch.setattr(dependencies.config, "get_settings", fake_get_settings)

    captured = {}

    class FakeAI:
        def __init__(self, settings=None):
            captured["settings"] = settings

    monkeypatch.setattr(dependencies, "ExternalAIService", FakeAI)
    service = dependencies.get_external_ai_service()
    assert isinstance(service, FakeAI)
    assert calls["cleared"] == 1
    assert captured["settings"].gemini_api_key == "loaded-key"
    assert captured["settings"].ai_fallback_model_name == "gemini-1.5-flash-8b"

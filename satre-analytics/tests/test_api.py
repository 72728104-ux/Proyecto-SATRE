import pandas as pd
import pytest
from sqlalchemy.exc import OperationalError

from app.db import get_repository
from app.main import app
from tests.conftest import FakeRepository, attendance_rows, grade_rows, incident_row

CONTRACT_KEYS = [
    "student_id", "period_id", "model_version", "insufficient_data", "data_coverage",
    "risk_level", "risk_score", "factors", "recommendation", "needs_human_review", "profile_cluster",
]

ENDPOINTS = [
    ("get", "/health", None),
    ("get", "/v1/students/1/risk", None),
    ("get", "/v1/classrooms/7/insights", None),
    ("post", "/v1/batch/risk", {"period_id": 3}),
    ("post", "/v1/socratic/next", {"topic": "pendiente"}),
]


def one_student_repo(**kwargs):
    students = pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": 1}])
    return FakeRepository(students=students, **kwargs)


# --- X-Internal-Key -----------------------------------------------------------------

@pytest.mark.parametrize("method,url,body", ENDPOINTS)
def test_missing_internal_key_is_401(make_client, method, url, body):
    client = make_client(one_student_repo(), key=None)
    response = getattr(client, method)(url, json=body) if body else getattr(client, method)(url)
    assert response.status_code == 401
    assert "message" in response.json()


@pytest.mark.parametrize("method,url,body", ENDPOINTS)
def test_wrong_internal_key_is_403(make_client, method, url, body):
    client = make_client(one_student_repo(), key="wrong-key")
    response = getattr(client, method)(url, json=body) if body else getattr(client, method)(url)
    assert response.status_code == 403


def test_unknown_route_also_requires_key(make_client):
    assert make_client(one_student_repo(), key=None).get("/ruta-inexistente").status_code == 401


@pytest.mark.parametrize("path", ["/docs", "/openapi.json", "/redoc"])
def test_public_docs_do_not_require_internal_key(make_client, path):
    response = make_client(one_student_repo(), key=None).get(path)
    assert response.status_code == 200


def test_options_preflight_is_public_and_allows_vite(make_client):
    client = make_client(one_student_repo(), key=None)
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_options_without_key_is_not_401(make_client):
    response = make_client(one_student_repo(), key=None).options("/health")
    assert response.status_code != 401


def test_health_with_key(make_client):
    response = make_client(one_student_repo()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_body_too_large_is_413(make_client):
    client = make_client(one_student_repo())
    response = client.post("/v1/socratic/next", content=b"x" * 70000, headers={"Content-Type": "application/json"})
    assert response.status_code == 413


# --- /v1/students/{id}/risk -------------------------------------------------------------

def test_risk_contract_with_insufficient_data_is_200(make_client):
    response = make_client(one_student_repo()).get("/v1/students/1/risk?period_id=3")
    assert response.status_code == 200
    body = response.json()
    assert list(body.keys()) == CONTRACT_KEYS
    assert body["insufficient_data"] is True
    assert body["risk_level"] is None
    assert body["profile_cluster"] is None
    assert body["model_version"] == "rules-1.0"


def test_risk_contract_with_data(make_client):
    repo = one_student_repo(
        attendance=attendance_rows(1, present=8, unexcused=2),
        grades=grade_rows(1, [5, 4, 4, 3]),
    )
    body = make_client(repo).get("/v1/students/1/risk?period_id=3").json()
    assert list(body.keys()) == CONTRACT_KEYS
    assert body["insufficient_data"] is False
    assert body["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert 0 <= body["risk_score"] <= 100
    assert 0 < body["data_coverage"] <= 1
    assert {"key", "label", "value", "contribution"} <= set(body["factors"][0])
    assert body["profile_cluster"] is None


def test_risk_escalation_via_endpoint(make_client):
    repo = one_student_repo(attendance=attendance_rows(1, present=10),
                            incidents=incident_row(1, "emocional", "grave", days_ago=2))
    body = make_client(repo).get("/v1/students/1/risk").json()
    assert body["risk_level"] == "ALTO"
    assert body["needs_human_review"] is True


def test_unknown_student_is_404(make_client):
    response = make_client(one_student_repo()).get("/v1/students/999/risk")
    assert response.status_code == 404
    assert "message" in response.json()


def test_unknown_period_is_404(make_client):
    assert make_client(one_student_repo()).get("/v1/students/1/risk?period_id=99").status_code == 404


def test_invalid_student_id_is_422(make_client):
    assert make_client(one_student_repo()).get("/v1/students/0/risk").status_code == 422


# --- batch / insights / socratic ----------------------------------------------------

def test_batch_risk_returns_list(make_client):
    repo = one_student_repo(attendance=attendance_rows(1, present=10))
    body = make_client(repo).post("/v1/batch/risk", json={"period_id": 3, "classroom_id": 7}).json()
    assert body["count"] == 1
    assert list(body["results"][0].keys()) == CONTRACT_KEYS


def test_batch_risk_with_empty_period_is_200(make_client):
    response = make_client(FakeRepository()).post("/v1/batch/risk", json={"period_id": 3})
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_insights_without_grades_is_insufficient_200(make_client):
    response = make_client(one_student_repo()).get("/v1/classrooms/7/insights")
    assert response.status_code == 200
    assert response.json()["insufficient_data"] is True


def _db_down() -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception("Can't connect to MySQL server"))


def test_insights_operational_error_returns_fallback_200(make_client):
    class Down(FakeRepository):
        def get_classroom(self, classroom_id):
            raise _db_down()

    response = make_client(Down()).get("/v1/classrooms/7/insights?period_id=3")
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_data"] is True
    assert body["classroom_id"] == 7
    assert body["period_id"] == 3
    assert body["courses"] == []
    assert body["top_gaps"] == []
    assert body["error_matrix"] == []
    assert "message" not in body


def test_insights_dependency_operational_error_is_fallback_200(make_client):
    client = make_client(FakeRepository())

    def boom():
        raise _db_down()

    app.dependency_overrides[get_repository] = boom
    response = client.get("/v1/classrooms/1/insights")
    assert response.status_code == 200
    body = response.json()
    assert body["classroom_id"] == 1
    assert body["period_id"] is None
    assert body["insufficient_data"] is True
    assert body["courses"] == []


def test_risk_operational_error_stays_503(make_client):
    class Down(FakeRepository):
        def get_student(self, student_id):
            raise _db_down()

    response = make_client(Down()).get("/v1/students/1/risk")
    assert response.status_code == 503
    assert "message" in response.json()


def test_socratic_endpoint_starts_session(make_client):
    body = make_client(one_student_repo()).post("/v1/socratic/next", json={"topic": "Funciones lineales"}).json()
    assert body["step"] == "diagnostico"
    assert body["state"]["scaffold_id"] == "mat-funciones-lineales"

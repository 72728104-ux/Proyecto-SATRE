"""Endpoints del motor analítico (rutas en app/main.py y app/api/v1/).

Predicción de riesgo: POST /v1/batch/risk.
IA Docente: GET /v1/classrooms/{id}/insights.
Tutor: POST /v1/socratic/next.

La clave se lee de config.get_settings() (INTERNAL_KEY). Sin header → 401.
Clave distinta → 401 (hmac.compare_digest sobre SHA-256; distinta longitud no provoca 500).
"""
import pandas as pd
import pytest

from app import config
from app.risk import level_for
from tests.conftest import FakeRepository, attendance_rows, grade_rows

POST_ENDPOINTS = [
    ("/v1/batch/risk", {"period_id": 3}),
    ("/v1/socratic/next", {"topic": "pendiente"}),
]


def scored_repo():
    students = pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": 1}])
    return FakeRepository(
        students=students,
        attendance=attendance_rows(1, present=8, unexcused=2),
        grades=grade_rows(1, [5, 4, 4, 3]),
    )


def insights_repo():
    rows = []
    for sid in range(1, 5):
        rows += [
            {"student_id": sid, "course_id": 1, "course_code": "MAT", "course_name": "Matemáticas",
             "criterion": "A", "score": 3 if sid <= 3 else 6, "max_score": 7},
            {"student_id": sid, "course_id": 1, "course_code": "MAT", "course_name": "Matemáticas",
             "criterion": "B", "score": 6, "max_score": 7},
        ]
    students = pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": 1}])
    return FakeRepository(students=students, classroom_grades=pd.DataFrame(rows))


@pytest.mark.parametrize("url,body", POST_ENDPOINTS)
def test_post_with_valid_internal_key_is_200(make_client, url, body):
    settings = config.get_settings()
    response = make_client(scored_repo(), key=settings.internal_key).post(url, json=body)
    assert response.status_code == 200
    assert response.json()


@pytest.mark.parametrize("url,body", POST_ENDPOINTS)
def test_post_without_internal_key_is_401(make_client, url, body):
    response = make_client(scored_repo(), key=None).post(url, json=body)
    assert response.status_code == 401
    assert "message" in response.json()


@pytest.mark.parametrize("url,body", POST_ENDPOINTS)
def test_post_with_wrong_internal_key_is_401(make_client, url, body):
    response = make_client(scored_repo(), key="clave-incorrecta").post(url, json=body)
    assert response.status_code == 401
    assert "message" in response.json()


def test_batch_risk_reads_model_version_and_level_thresholds(make_client, monkeypatch):
    monkeypatch.setattr(config, "MODEL_VERSION", "rules-test-2")
    response = make_client(scored_repo()).post("/v1/batch/risk", json={"period_id": 3, "classroom_id": 7})
    assert response.status_code == 200
    body = response.json()
    assert body["model_version"] == "rules-test-2"
    assert body["period_id"] == 3
    assert body["count"] == 1
    result = body["results"][0]
    assert result["student_id"] == 1
    assert result["insufficient_data"] is False
    assert result["model_version"] == "rules-test-2"
    assert result["risk_level"] == level_for(result["risk_score"])
    assert result["risk_level"] in {"BAJO", "MEDIO", "ALTO"}
    assert 0 <= result["risk_score"] <= 100


def test_socratic_message_limit_comes_from_config(make_client):
    client = make_client(scored_repo())
    ok = client.post("/v1/socratic/next", json={
        "topic": "Funciones lineales",
        "message": "x" * config.SOCRATIC_MAX_MESSAGE_CHARS,
    })
    assert ok.status_code == 200
    assert ok.json()["step"] == "diagnostico"
    assert ok.json()["meta"]["scaffold_id"] == "mat-funciones-lineales"

    too_long = client.post("/v1/socratic/next", json={
        "topic": "Funciones lineales",
        "message": "x" * (config.SOCRATIC_MAX_MESSAGE_CHARS + 1),
    })
    assert too_long.status_code == 422


def test_teacher_insights_reads_gap_limit_from_config(make_client, monkeypatch):
    monkeypatch.setattr(config, "INSIGHTS_TOP_GAPS", 1)
    monkeypatch.setattr(config, "MODEL_VERSION", "rules-insights-test")
    response = make_client(insights_repo()).get("/v1/classrooms/7/insights?period_id=3")
    assert response.status_code == 200
    body = response.json()
    assert body["model_version"] == "rules-insights-test"
    assert body["insufficient_data"] is False
    assert body["classroom_id"] == 7
    assert len(body["top_gaps"]) == 1
    gap = body["top_gaps"][0]
    assert gap["criterion"] == "A"
    assert gap["pct_below_4"] == 0.75
    assert 1 <= len(gap["methodologies"]) <= config.INSIGHTS_METHODOLOGIES_PER_GAP
    assert body["error_matrix"][0]["criteria"] == list(config.IB_CRITERIA)

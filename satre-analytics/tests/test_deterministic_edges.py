"""Ramas de error y casos límite de los módulos deterministas."""
from __future__ import annotations

from datetime import date

import pandas as pd
import pytest
from sqlalchemy import create_engine

from app import features
from app.clustering import assign_profiles
from app.db import Repository
from app.services.deterministic import risk_engine
from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.deterministic.risk_engine import calculate_student_risk
from app.services.privacy.guardrails import PrivacyGuardService
from tests.conftest import TODAY, FakeRepository, grade_rows, incident_row


def _students() -> pd.DataFrame:
    return pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": 1}])


def _empty_frames():
    return (
        pd.DataFrame(columns=["student_id", "status"]),
        pd.DataFrame(columns=[
            "student_id", "course_id", "criterion", "score", "max_score", "evaluation_date",
        ]),
        pd.DataFrame(columns=["student_id", "status"]),
        pd.DataFrame(columns=["student_id", "category", "severity", "incident_at"]),
    )


# --- features ----------------------------------------------------------------


def test_to_ib_scale_is_an_alias_of_minedu_scale():
    scaled = features.to_ib_scale(pd.Series([10.0]), pd.Series([20.0]))
    assert scaled.tolist() == [10.0]


def test_build_features_with_empty_students_returns_declared_columns():
    frame = features.build_features(
        pd.DataFrame(columns=["student_id", "classroom_id", "is_boarder"]),
        *_empty_frames(),
        TODAY,
    )
    assert frame.empty
    assert list(frame.columns) == features.FEATURE_COLUMNS


def test_incidents_outside_window_are_discarded():
    empty_attendance, empty_grades, empty_night, _ = _empty_frames()
    frame = features.build_features(
        _students(),
        empty_attendance,
        empty_grades,
        empty_night,
        incident_row(1, "salud", "grave", days_ago=90),
        TODAY,
    )
    assert frame.iloc[0]["incident_weighted_30d"] == 0
    assert bool(frame.iloc[0]["severe_wellbeing_7d"]) is False


def test_reference_date_falls_back_to_today_on_invalid_end_date():
    fixed = date(2026, 1, 15)
    assert features.reference_date({"end_date": "not-a-date"}, today=fixed) == fixed
    assert features.reference_date({"end_date": None}, today=fixed) == fixed


# --- risk_engine -------------------------------------------------------------


def test_as_repository_accepts_repository_engine_and_rejects_other_objects():
    repo = FakeRepository(students=_students())
    assert risk_engine._as_repository(repo) is repo

    engine = create_engine("sqlite:///:memory:")
    try:
        wrapped = risk_engine._as_repository(engine)
        assert isinstance(wrapped, Repository)
    finally:
        engine.dispose()

    with pytest.raises(TypeError):
        risk_engine._as_repository(object())


def test_finite_or_none_and_vigesimal_helpers():
    assert risk_engine._finite_or_none(None) is None
    assert risk_engine._finite_or_none("abc") is None
    assert risk_engine._finite_or_none(object()) is None
    assert risk_engine._finite_or_none(float("nan")) is None
    assert risk_engine._finite_or_none(float("inf")) is None
    assert risk_engine._finite_or_none("3.5") == 3.5
    assert risk_engine.ib_mean_to_vigesimal(12.346) == round(12.346, 2)
    assert risk_engine.vigesimal_score(None) is None
    assert risk_engine.vigesimal_score("abc") is None


def test_calculate_student_risk_with_missing_student_or_period():
    class NoStudent(FakeRepository):
        def get_student(self, student_id):
            return None

    class NoPeriod(FakeRepository):
        def get_period(self, period_id):
            return None

    assert calculate_student_risk(NoStudent(), 1)["insufficient_data"] is True
    assert calculate_student_risk(NoPeriod(students=_students()), 1)["insufficient_data"] is True


def test_calculate_student_risk_when_features_are_empty(monkeypatch):
    monkeypatch.setattr(risk_engine, "build_features", lambda *_a, **_k: pd.DataFrame())
    result = calculate_student_risk(FakeRepository(students=_students()), 1)
    assert result["insufficient_data"] is True
    assert result["student_id"] == 1


def test_calculate_student_risk_returns_metrics_with_grades():
    repo = FakeRepository(students=_students(), grades=grade_rows(1, [16], max_score=20))
    result = calculate_student_risk(repo, 1)
    assert result["insufficient_data"] is False
    assert result["vigesimal_score"] == pytest.approx(16.0)
    assert result["student_id"] == 1


# --- clustering --------------------------------------------------------------


def test_assign_profiles_empty_frame_returns_empty_mapping():
    assert assign_profiles(pd.DataFrame()) == {}


def test_assign_profiles_constant_matrix_stays_unlabeled():
    rows = [
        {
            "student_id": student_id,
            "attendance_count": 10,
            "grade_count": 3,
            "unexcused_rate": 0.0,
            "tardiness_rate": 0.0,
            "grade_mean": 15.0,
            "incident_weighted_30d": 0.0,
        }
        for student_id in range(1, 31)
    ]
    profiles = assign_profiles(pd.DataFrame(rows))
    assert len(profiles) == 30
    assert set(profiles.values()) == {None}


# --- guardrails --------------------------------------------------------------


def test_mask_name_allowlist_after_particles_are_removed(monkeypatch):
    monkeypatch.setattr(PrivacyGuardService, "_NAME_STOPWORDS", frozenset())
    match = PrivacyGuardService.FULL_NAME_PATTERN.search("Logro y Destacado")
    assert match is not None
    assert PrivacyGuardService._mask_name(match) == "Logro y Destacado"


def test_qualitative_from_skips_invalid_numeric_values():
    assert PrivacyGuardService._qualitative_from({"vigesimal_score": "abc"}) is None
    assert PrivacyGuardService._qualitative_from({"vigesimal_score": object()}) is None
    context = PrivacyGuardService.build_safe_context(1, {"vigesimal_score": "abc"})
    assert context["qualitative_grade"] is None


def test_qualitative_from_prefers_explicit_letter():
    assert PrivacyGuardService._qualitative_from({"qualitative_grade": " b "}) == "B"


# --- grading scaler ----------------------------------------------------------


def test_to_qualitative_handles_invalid_values():
    assert PeruvianGradingScaler.to_qualitative("abc") == "C"
    assert PeruvianGradingScaler.to_qualitative(None) == "C"
    assert PeruvianGradingScaler.to_qualitative(object()) == "C"

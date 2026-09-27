import pandas as pd
import pytest

from app import config
from app.features import build_features
from app.risk import components, level_for, score_student
from tests.conftest import TODAY, attendance_rows, grade_rows, incident_row


def features_for(attendance=None, grades=None, night=None, incidents=None, is_boarder=True):
    students = pd.DataFrame([{"student_id": 1, "classroom_id": 7, "is_boarder": is_boarder}])
    empty = pd.DataFrame
    frame = build_features(
        students,
        attendance if attendance is not None else empty(columns=["student_id", "status"]),
        grades if grades is not None else empty(
            columns=["student_id", "course_id", "criterion", "score", "max_score", "evaluation_date"]),
        night if night is not None else empty(columns=["student_id", "status"]),
        incidents if incidents is not None else empty(columns=["student_id", "category", "severity", "incident_at"]),
        TODAY,
    )
    return frame.to_dict("records")[0]


# --- insufficient_data --------------------------------------------------------

def test_insufficient_when_few_attendances_and_few_grades():
    row = features_for(attendance=attendance_rows(1, present=4), grades=grade_rows(1, [5, 6]))
    result = score_student(row)
    assert result["insufficient_data"] is True
    assert result["risk_level"] is None
    assert result["risk_score"] is None
    assert result["factors"] == []


def test_enough_attendance_alone_is_sufficient():
    row = features_for(attendance=attendance_rows(1, present=5))
    assert score_student(row)["insufficient_data"] is False


def test_enough_grades_alone_is_sufficient():
    row = features_for(grades=grade_rows(1, [5, 5, 5]))
    assert score_student(row)["insufficient_data"] is False


def test_no_data_at_all_is_insufficient():
    assert score_student(features_for())["insufficient_data"] is True


# --- renormalización ------------------------------------------------------------

def test_weights_renormalized_when_grades_and_night_missing():
    row = features_for(attendance=attendance_rows(1, present=8, unexcused=2), is_boarder=False)
    result = score_student(row)

    assert result["data_coverage"] == 0.45
    # unexcused_rate = 0.2 → componente 1.0; resto 0 → 100 × 0.25 / 0.45
    assert result["risk_score"] == pytest.approx(round(100 * 0.25 / 0.45, 1))
    assert {f["key"] for f in result["factors"]} == {"unexcused_absence", "tardiness", "incidents"}
    assert result["risk_level"] == "MEDIO"


def test_missing_grades_never_count_as_low_average():
    row = features_for(attendance=attendance_rows(1, present=10))
    result = score_student(row)
    assert "grade_level" not in {f["key"] for f in result["factors"]}
    assert result["risk_score"] == 0.0
    assert result["risk_level"] == "BAJO"


def test_full_coverage_score_matches_formula():
    night = pd.DataFrame({"student_id": [1] * 10, "status": ["present"] * 9 + ["absent"]})
    row = features_for(
        attendance=attendance_rows(1, present=16, late=2, unexcused=2),   # unexcused 0.10, late 0.10
        grades=grade_rows(1, [3, 3, 3, 3]),                               # mean 3.0, slope 0
        night=night,                                                      # night_rate 0.9
        incidents=incident_row(1, "conducta", "moderada", days_ago=5),    # weighted 2
    )
    result = score_student(row)
    expected = 100 * (
        0.25 * (0.10 / 0.20)
        + 0.25 * ((4.5 - 3.0) / 3.5)
        + 0.20 * 0.0
        + 0.15 * (2 / 6)
        + 0.10 * min(0.1 / 0.15, 1)
        + 0.05 * (0.10 / 0.25)
    )
    assert result["data_coverage"] == 1.0
    assert result["risk_score"] == pytest.approx(round(expected, 1))
    assert sum(f["contribution"] for f in result["factors"]) == pytest.approx(result["risk_score"], abs=0.3)


@pytest.mark.parametrize("score,level", [(0, "BAJO"), (34.9, "BAJO"), (35, "MEDIO"), (64.9, "MEDIO"), (65, "ALTO")])
def test_level_thresholds(score, level):
    assert level_for(score) == level


# --- escalamiento ---------------------------------------------------------------

@pytest.mark.parametrize("category", ["salud", "emocional"])
def test_severe_wellbeing_incident_within_7_days_escalates_to_alto(category):
    row = features_for(attendance=attendance_rows(1, present=10),
                       incidents=incident_row(1, category, "grave", days_ago=3))
    result = score_student(row)
    assert result["risk_score"] < config.LEVEL_ALTO_MIN
    assert result["risk_level"] == "ALTO"
    assert result["needs_human_review"] is True


@pytest.mark.parametrize("category,severity,days_ago", [
    ("conducta", "grave", 2),
    ("salud", "moderada", 2),
    ("emocional", "grave", 10),
])
def test_no_escalation_outside_rule(category, severity, days_ago):
    row = features_for(attendance=attendance_rows(1, present=10),
                       incidents=incident_row(1, category, severity, days_ago=days_ago))
    result = score_student(row)
    assert result["needs_human_review"] is False
    assert result["risk_level"] != "ALTO"


def test_escalation_applies_even_with_insufficient_data():
    row = features_for(incidents=incident_row(1, "salud", "grave", days_ago=1))
    result = score_student(row)
    assert result["insufficient_data"] is True
    assert result["risk_level"] == "ALTO"
    assert result["needs_human_review"] is True


# --- tendencia en el score ------------------------------------------------------

def test_trend_excluded_when_fewer_than_4_grades():
    row = features_for(attendance=attendance_rows(1, present=10), grades=grade_rows(1, [6, 5, 3]))
    assert "grade_trend" not in components(row)


def test_declining_trend_contributes():
    row = features_for(attendance=attendance_rows(1, present=10), grades=grade_rows(1, [7, 6, 5, 4]))
    value, component = components(row)["grade_trend"]
    assert value < 0
    assert component > 0

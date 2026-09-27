import numpy as np
import pandas as pd

from app.clustering import LABEL_ACADEMIC, LABEL_ATTENDANCE, LABEL_STABLE, assign_profiles
from app.insights import build_insights


def synthetic_features(n_per_group):
    rng = np.random.default_rng(0)
    rows, sid = [], 1
    groups = [
        (0.01, 0.02, 6.0, 0),   # estable
        (0.25, 0.20, 5.0, 1),   # asistencia irregular
        (0.02, 0.03, 2.5, 1),   # rendimiento bajo
    ]
    for unexcused, late, mean, incidents in groups:
        for _ in range(n_per_group):
            rows.append({
                "student_id": sid, "attendance_count": 20, "grade_count": 5,
                "unexcused_rate": unexcused + rng.normal(0, 0.005),
                "tardiness_rate": late + rng.normal(0, 0.005),
                "grade_mean": mean + rng.normal(0, 0.1),
                "incident_weighted_30d": float(incidents),
            })
            sid += 1
    return pd.DataFrame(rows)


def test_clustering_skipped_below_30_students():
    profiles = assign_profiles(synthetic_features(9))
    assert len(profiles) == 27
    assert set(profiles.values()) == {None}


def test_clustering_labels_by_centroid_inspection():
    profiles = assign_profiles(synthetic_features(10))
    assert profiles[1] == LABEL_STABLE
    assert profiles[11] == LABEL_ATTENDANCE
    assert profiles[21] == LABEL_ACADEMIC


def test_insights_gaps_by_criterion_with_methodologies():
    rows = []
    for sid in range(1, 5):
        rows += [
            {"student_id": sid, "course_id": 1, "course_code": "MAT", "course_name": "Matemáticas",
             "criterion": "A", "score": 3 if sid <= 3 else 6, "max_score": 7},
            {"student_id": sid, "course_id": 1, "course_code": "MAT", "course_name": "Matemáticas",
             "criterion": "B", "score": 6, "max_score": 7},
        ]
    result = build_insights(pd.DataFrame(rows))
    assert result["insufficient_data"] is False
    gap = result["top_gaps"][0]
    assert gap["criterion"] == "A"
    assert gap["pct_below_4"] == 0.75
    assert gap["methodologies"]
    assert result["error_matrix"][0]["rows"][0]["A"] == 3.0


def test_insights_ignores_grades_without_valid_criterion():
    df = pd.DataFrame([{"student_id": 1, "course_id": 1, "course_code": "MAT", "course_name": "M",
                        "criterion": None, "score": 2, "max_score": 7}] * 5)
    assert build_insights(df)["insufficient_data"] is True

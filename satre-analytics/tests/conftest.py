import os
from datetime import date, datetime, timedelta

import pandas as pd
import pytest

TEST_KEY = "test-internal-key-0123456789abcdef-xyz"
os.environ["INTERNAL_KEY"] = TEST_KEY

from fastapi.testclient import TestClient  # noqa: E402

from app.db import get_repository  # noqa: E402
from app.main import app  # noqa: E402

TODAY = date.today()


class FakeRepository:
    """Sustituye a app.db.Repository con DataFrames en memoria."""

    def __init__(self, students=None, attendance=None, grades=None, night=None, incidents=None,
                 classroom_grades=None, period=None):
        self.period = period if period is not None else {
            "id": 3, "name": "2026-I", "start_date": TODAY - timedelta(days=90),
            "end_date": TODAY + timedelta(days=90), "is_current": 1,
        }
        self.students = students if students is not None else pd.DataFrame(
            columns=["student_id", "classroom_id", "is_boarder"])
        self.attendance = attendance if attendance is not None else pd.DataFrame(columns=["student_id", "status"])
        self.grades_df = grades if grades is not None else pd.DataFrame(
            columns=["student_id", "course_id", "criterion", "score", "max_score", "evaluation_date"])
        self.night = night if night is not None else pd.DataFrame(columns=["student_id", "status"])
        self.incidents_df = incidents if incidents is not None else pd.DataFrame(
            columns=["student_id", "category", "severity", "incident_at"])
        self.classroom_grades_df = classroom_grades if classroom_grades is not None else pd.DataFrame(
            columns=["student_id", "course_id", "course_code", "course_name", "criterion", "score", "max_score"])

    def get_period(self, period_id):
        if period_id is None or period_id == self.period["id"]:
            return self.period
        return None

    def get_student(self, student_id):
        match = self.students[self.students["student_id"] == student_id]
        if match.empty:
            return None
        row = match.iloc[0].to_dict()
        return {"id": student_id, "classroom_id": row["classroom_id"], "is_boarder": row["is_boarder"], "status": "active"}

    def get_classroom(self, classroom_id):
        return {"id": classroom_id, "academic_period_id": self.period["id"]} if classroom_id == 7 else None

    def period_students(self, period_id, classroom_id=None):
        return self.students

    def _filter(self, df, ids):
        return df[df["student_id"].isin(ids)]

    def attendances(self, period_id, student_ids):
        return self._filter(self.attendance, student_ids)

    def grades(self, period_id, student_ids):
        return self._filter(self.grades_df, student_ids)

    def night_presences(self, student_ids, start, end):
        return self._filter(self.night, student_ids)

    def incidents(self, student_ids, as_of):
        return self._filter(self.incidents_df, student_ids)

    def classroom_grades(self, classroom_id, period_id):
        return self.classroom_grades_df


def attendance_rows(student_id, present=0, late=0, unexcused=0):
    statuses = ["present"] * present + ["late"] * late + ["absent_unjustified"] * unexcused
    return pd.DataFrame({"student_id": [student_id] * len(statuses), "status": statuses})


def grade_rows(student_id, scores, start=None, step_days=14, course_id=1):
    start = start or (TODAY - timedelta(days=step_days * len(scores)))
    return pd.DataFrame({
        "student_id": [student_id] * len(scores),
        "course_id": [course_id] * len(scores),
        "criterion": ["A"] * len(scores),
        "score": scores,
        "max_score": [7] * len(scores),
        "evaluation_date": [start + timedelta(days=step_days * i) for i in range(len(scores))],
    })


def incident_row(student_id, category, severity, days_ago):
    return pd.DataFrame([{"student_id": student_id, "category": category, "severity": severity,
                          "incident_at": datetime.combine(TODAY, datetime.min.time()) + timedelta(hours=10)
                          - timedelta(days=days_ago)}])


@pytest.fixture
def make_client():
    clients = []

    def _make(repo: FakeRepository, key: str | None = TEST_KEY) -> TestClient:
        app.dependency_overrides[get_repository] = lambda: repo
        client = TestClient(app)
        if key is not None:
            client.headers["X-Internal-Key"] = key
        clients.append(client)
        return client

    yield _make
    app.dependency_overrides.clear()

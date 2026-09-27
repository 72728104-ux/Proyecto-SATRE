"""Construcción de features por estudiante con Pandas (§5.3). Funciones puras: sin acceso a BD."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

import numpy as np
import pandas as pd

from app import config
from app.trend import compute_trend

FEATURE_COLUMNS = [
    "student_id", "classroom_id", "is_boarder",
    "attendance_count", "unexcused_rate", "tardiness_rate",
    "grade_count", "grade_mean", "grade_slope", "grade_r2", "grade_n",
    "night_count", "night_presence_rate",
    "incident_weighted_30d", "severe_wellbeing_7d",
]


def to_ib_scale(scores: pd.Series, max_scores: pd.Series) -> pd.Series:
    """Normaliza a escala IB 1–7. max_score nulo o 0 se asume 7."""
    score = pd.to_numeric(scores, errors="coerce")
    max_score = pd.to_numeric(max_scores, errors="coerce")
    max_score = max_score.where(max_score > 0, config.IB_MAX_SCORE).fillna(config.IB_MAX_SCORE)
    return score * config.IB_MAX_SCORE / max_score


def _attendance_features(attendance: pd.DataFrame) -> pd.DataFrame:
    if attendance.empty:
        return pd.DataFrame(columns=["attendance_count", "unexcused_rate", "tardiness_rate"])
    df = attendance.dropna(subset=["student_id"]).copy()
    df["status"] = df["status"].fillna("").astype(str).str.lower()
    df["unexcused"] = df["status"].isin(config.UNEXCUSED_STATUSES)
    df["late"] = df["status"].isin(config.LATE_STATUSES)
    grouped = df.groupby("student_id").agg(
        attendance_count=("status", "size"),
        unexcused=("unexcused", "sum"),
        late=("late", "sum"),
    )
    grouped["unexcused_rate"] = grouped["unexcused"] / grouped["attendance_count"]
    grouped["tardiness_rate"] = grouped["late"] / grouped["attendance_count"]
    return grouped[["attendance_count", "unexcused_rate", "tardiness_rate"]]


def _grade_features(grades: pd.DataFrame) -> pd.DataFrame:
    cols = ["grade_count", "grade_mean", "grade_slope", "grade_r2", "grade_n"]
    if grades.empty:
        return pd.DataFrame(columns=cols)
    df = grades.dropna(subset=["student_id"]).copy()
    df["ib"] = to_ib_scale(df["score"], df["max_score"])
    df = df.dropna(subset=["ib"])
    rows = {}
    for student_id, group in df.groupby("student_id"):
        trend = compute_trend(group["evaluation_date"], group["ib"])
        rows[student_id] = {
            "grade_count": int(len(group)),
            "grade_mean": float(group["ib"].mean()),
            "grade_slope": trend.slope,
            "grade_r2": trend.r2,
            "grade_n": trend.n,
        }
    return pd.DataFrame.from_dict(rows, orient="index", columns=cols)


def _night_features(night: pd.DataFrame) -> pd.DataFrame:
    cols = ["night_count", "night_presence_rate"]
    if night.empty:
        return pd.DataFrame(columns=cols)
    df = night.dropna(subset=["student_id"]).copy()
    df["status"] = df["status"].fillna("").astype(str).str.lower()
    df["present"] = df["status"].isin(config.NIGHT_PRESENT_STATUSES)
    df["counted"] = df["present"] | df["status"].isin(config.NIGHT_ABSENT_STATUSES)
    grouped = df[df["counted"]].groupby("student_id").agg(
        night_count=("counted", "sum"), present=("present", "sum")
    )
    grouped["night_presence_rate"] = grouped["present"] / grouped["night_count"]
    return grouped[cols]


def _incident_features(incidents: pd.DataFrame, as_of: date) -> pd.DataFrame:
    cols = ["incident_weighted_30d", "severe_wellbeing_7d"]
    if incidents.empty:
        return pd.DataFrame(columns=cols)
    df = incidents.dropna(subset=["student_id"]).copy()
    df["incident_at"] = pd.to_datetime(df["incident_at"], errors="coerce")
    df = df.dropna(subset=["incident_at"])
    until = pd.Timestamp(datetime.combine(as_of, time.max))
    since_30 = pd.Timestamp(datetime.combine(as_of - timedelta(days=config.INCIDENT_WINDOW_DAYS), time.min))
    since_7 = pd.Timestamp(datetime.combine(as_of - timedelta(days=config.ESCALATION_WINDOW_DAYS), time.min))
    df = df[(df["incident_at"] >= since_30) & (df["incident_at"] <= until)]
    if df.empty:
        return pd.DataFrame(columns=cols)

    severity = df["severity"].fillna("").astype(str).str.lower()
    category = df["category"].fillna("").astype(str).str.lower()
    df["weight"] = severity.map(config.INCIDENT_SEVERITY_WEIGHTS).fillna(0)
    df["severe_wellbeing"] = (
        (severity == config.ESCALATION_SEVERITY)
        & category.isin(config.ESCALATION_CATEGORIES)
        & (df["incident_at"] >= since_7)
    )
    grouped = df.groupby("student_id").agg(
        incident_weighted_30d=("weight", "sum"), severe_wellbeing_7d=("severe_wellbeing", "any")
    )
    return grouped[cols]


def build_features(
    students: pd.DataFrame,
    attendance: pd.DataFrame,
    grades: pd.DataFrame,
    night: pd.DataFrame,
    incidents: pd.DataFrame,
    as_of: date,
) -> pd.DataFrame:
    """Una fila por estudiante. Fuentes ausentes quedan como NaN (no como 0)."""
    if students.empty:
        return pd.DataFrame(columns=FEATURE_COLUMNS)

    base = students[["student_id", "classroom_id", "is_boarder"]].drop_duplicates("student_id").set_index("student_id")
    frame = (
        base.join(_attendance_features(attendance))
        .join(_grade_features(grades))
        .join(_night_features(night))
        .join(_incident_features(incidents, as_of))
    )
    frame["attendance_count"] = frame["attendance_count"].fillna(0).astype(int)
    frame["grade_count"] = frame["grade_count"].fillna(0).astype(int)
    frame["grade_n"] = frame["grade_n"].fillna(0).astype(int)
    frame["night_count"] = frame["night_count"].fillna(0).astype(int)
    frame["incident_weighted_30d"] = frame["incident_weighted_30d"].fillna(0).astype(float)
    frame["severe_wellbeing_7d"] = frame["severe_wellbeing_7d"].eq(True)
    frame["is_boarder"] = frame["is_boarder"].fillna(True).astype(bool)
    frame = frame.replace({np.inf: np.nan, -np.inf: np.nan})
    return frame.reset_index()[FEATURE_COLUMNS]


def reference_date(period: dict, today: date | None = None) -> date:
    """Fecha de corte: hoy, o el fin del periodo si ya terminó."""
    today = today or date.today()
    end = pd.to_datetime(period.get("end_date"), errors="coerce")
    if pd.isna(end):
        return today
    return min(today, end.date())

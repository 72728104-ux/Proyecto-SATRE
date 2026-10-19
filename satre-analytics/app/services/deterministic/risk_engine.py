"""Consulta determinista de riesgo sobre MySQL `satre_ro` (SATRE TOBE-2 §5.3).

SQLAlchemy llega a través de `app.db.Repository` (`text()` + bind params).
No invoca IA. Opera directamente sobre la escala vigesimal Minedu 0–20.
"""
from __future__ import annotations

import logging
import math
from typing import Any

import pandas as pd
from sqlalchemy.exc import SQLAlchemyError

from app.db import Repository
from app.features import build_features, reference_date
from app.risk import score_student

logger = logging.getLogger("satre.analytics")


def _as_repository(db) -> Any:
    if hasattr(db, "get_student") and hasattr(db, "grades"):
        return db
    if hasattr(db, "connect"):
        return Repository(db)
    raise TypeError("db debe ser Repository o Engine SQLAlchemy (usuario satre_ro).")


def _period_start(period: dict) -> Any:
    start = pd.to_datetime(period.get("start_date"), errors="coerce")
    return None if pd.isna(start) else start.date()


def _finite_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def vigesimal_score(grade_mean: Any) -> float | None:
    """El promedio de features ya está en 0–20; solo redondea para la capa MINEDU."""
    value = _finite_or_none(grade_mean)
    if value is None:
        return None
    return round(value, 2)


def ib_mean_to_vigesimal(grade_mean: Any) -> float | None:
    """Alias histórico: grade_mean ya no se convierte desde IB 1–7."""
    return vigesimal_score(grade_mean)


def _empty_analytics(student_id: int, period_id: int | None = None) -> dict[str, Any]:
    return {
        "insufficient_data": True,
        "risk_score": None,
        "risk_level": None,
        "data_coverage": 0.0,
        "factors": [],
        "needs_human_review": False,
        "student_id": student_id,
        "period_id": period_id,
        "grade_mean": None,
        "grade_count": 0,
        "vigesimal_score": None,
        "trend_slope": None,
        "cluster_id": None,
    }


def calculate_student_risk(db, student_id: int, period_id: int | None = None) -> dict[str, Any]:
    """Carga features del alumno desde `satre_ro` y calcula el score §5.3.

    `insufficient_data` es True solo si no hay asistencia suficiente
    (< 5) y tampoco hay al menos 1 nota Minedu 0–20.
    """
    repo = _as_repository(db)
    student_id = int(student_id)
    try:
        student = repo.get_student(student_id)
        if student is None:
            return _empty_analytics(student_id, period_id)

        period = repo.get_period(period_id)
        if period is None:
            return _empty_analytics(student_id, period_id)

        as_of = reference_date(period)
        start = _period_start(period) or as_of
        ids = [student_id]
        students = pd.DataFrame([{
            "student_id": student_id,
            "classroom_id": student.get("classroom_id"),
            "is_boarder": student.get("is_boarder", True),
        }])
        features = build_features(
            students,
            repo.attendances(period["id"], ids),
            repo.grades(period["id"], ids),
            repo.night_presences(ids, start, as_of),
            repo.incidents(ids, as_of),
            as_of,
        )
        if features.empty:
            return _empty_analytics(student_id, period["id"])

        row = features.to_dict("records")[0]
        scored = score_student(row)
        grade_count = int(row.get("grade_count") or 0)
        grade_mean = _finite_or_none(row.get("grade_mean")) if grade_count > 0 else None
        return {
            **scored,
            "student_id": student_id,
            "period_id": period["id"],
            "grade_mean": grade_mean,
            "grade_count": grade_count,
            "vigesimal_score": vigesimal_score(grade_mean),
            "trend_slope": _finite_or_none(row.get("grade_slope")),
            "cluster_id": None,
        }
    except SQLAlchemyError:
        logger.exception("academic context unavailable student_hash=%s", hash(student_id) % 10000)
        return _empty_analytics(student_id, period_id)

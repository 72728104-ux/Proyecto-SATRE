"""Acceso de solo lectura a MySQL (usuario satre_ro).

Todas las consultas son constantes `text()` con bind params. Nunca construir SQL con
f-strings ni concatenación: los valores del request viajan solo como parámetros.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import bindparam, create_engine, event, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.elements import TextClause

from app import config

logger = logging.getLogger("satre.analytics")

SQL_PERIOD = text(
    "SELECT id, name, start_date, end_date, is_current FROM academic_periods WHERE id = :period_id"
)

SQL_CURRENT_PERIOD = text(
    "SELECT id, name, start_date, end_date, is_current FROM academic_periods "
    "WHERE is_current = 1 ORDER BY id DESC LIMIT 1"
)

SQL_STUDENT = text(
    "SELECT id, classroom_id, is_boarder, status FROM students "
    "WHERE id = :student_id AND deleted_at IS NULL"
)

SQL_CLASSROOM = text("SELECT id, academic_period_id FROM classrooms WHERE id = :classroom_id")

SQL_PERIOD_STUDENTS = text(
    "SELECT DISTINCT s.id AS student_id, s.classroom_id, s.is_boarder "
    "FROM students s "
    "JOIN enrollments e ON e.student_id = s.id AND e.status = 'active' "
    "JOIN courses c ON c.id = e.course_id AND c.academic_period_id = :period_id "
    "WHERE s.status = 'active' AND s.deleted_at IS NULL "
    "AND (:classroom_id IS NULL OR s.classroom_id = :classroom_id)"
)

SQL_ATTENDANCES = text(
    "SELECT student_id, status FROM attendances "
    "WHERE academic_period_id = :period_id AND student_id IN :student_ids"
).bindparams(bindparam("student_ids", expanding=True))

SQL_GRADES = text(
    "SELECT student_id, course_id, criterion, score, max_score, "
    "COALESCE(evaluation_date, DATE(recorded_at), DATE(created_at)) AS evaluation_date "
    "FROM grades "
    "WHERE academic_period_id = :period_id AND student_id IN :student_ids "
    "AND deleted_at IS NULL"
).bindparams(bindparam("student_ids", expanding=True))

SQL_NIGHT_PRESENCES = text(
    "SELECT student_id, status FROM residential_presences "
    "WHERE check_type = :check_type AND presence_date BETWEEN :start_date AND :end_date "
    "AND student_id IN :student_ids"
).bindparams(bindparam("student_ids", expanding=True))

SQL_INCIDENTS = text(
    "SELECT student_id, category, severity, incident_at FROM incidents "
    "WHERE incident_at >= :since AND incident_at <= :until AND student_id IN :student_ids "
    "AND deleted_at IS NULL"
).bindparams(bindparam("student_ids", expanding=True))

SQL_CLASSROOM_GRADES = text(
    "SELECT g.student_id, g.course_id, c.code AS course_code, c.name AS course_name, "
    "g.criterion, g.score, g.max_score "
    "FROM grades g "
    "JOIN courses c ON c.id = g.course_id "
    "WHERE c.classroom_id = :classroom_id AND g.academic_period_id = :period_id "
    "AND g.criterion IS NOT NULL AND g.deleted_at IS NULL"
)


def _sqlite_target(settings: config.Settings) -> str | None:
    url = (settings.database_url or "").strip()
    if settings.db_connection == "sqlite":
        return url if url.startswith("sqlite") else (settings.sqlite_url or config.default_sqlite_url())
    if url.startswith("sqlite"):
        return url
    return None


def _ensure_sqlite_parent(url: str) -> None:
    prefix = "sqlite:///"
    if not url.startswith(prefix) or ":memory:" in url:
        return
    raw = url[len(prefix):]
    if not raw:
        return
    parent = Path(raw).parent
    if str(parent) not in {"", "."}:
        parent.mkdir(parents=True, exist_ok=True)


def build_sqlite_engine(url: str) -> Engine:
    _ensure_sqlite_parent(url)
    return create_engine(url, pool_pre_ping=True)


def build_mysql_engine(settings: config.Settings) -> Engine:
    url = settings.database_url if (settings.database_url or "").startswith("mysql") else URL.create(
        "mysql+pymysql",
        username=settings.db_username,
        password=settings.db_password,
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_database,
        query={"charset": "utf8mb4"},
    )
    engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800, pool_size=5, max_overflow=5)

    @event.listens_for(engine, "connect")
    def _read_only_session(dbapi_connection, _record):  # defensa adicional al GRANT SELECT
        with dbapi_connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")

    return engine


def _probe(engine: Engine) -> None:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def build_engine(settings: config.Settings) -> Engine:
    sqlite_url = _sqlite_target(settings)
    if sqlite_url is not None:
        return build_sqlite_engine(sqlite_url)

    engine = build_mysql_engine(settings)
    try:
        _probe(engine)
    except SQLAlchemyError as exc:
        logger.warning("MySQL no disponible (%s); usando SQLite de respaldo.", type(exc).__name__)
        engine.dispose()
        return build_sqlite_engine(settings.sqlite_url or config.default_sqlite_url())
    return engine


@lru_cache
def get_engine() -> Engine:
    return build_engine(config.get_settings())


class Repository:
    """Consultas de lectura. Devuelve DataFrames vacíos (con columnas) si no hay filas."""

    def __init__(self, engine: Engine):
        self.engine = engine

    def _frame(self, sql: TextClause, params: dict[str, Any], columns: list[str]) -> pd.DataFrame:
        with self.engine.connect() as conn:
            rows = conn.execute(sql, params).mappings().all()
        if not rows:
            return pd.DataFrame(columns=columns)
        return pd.DataFrame(rows, columns=columns)

    def _one(self, sql: TextClause, params: dict[str, Any]) -> dict[str, Any] | None:
        with self.engine.connect() as conn:
            row = conn.execute(sql, params).mappings().first()
        return dict(row) if row else None

    def get_period(self, period_id: int | None) -> dict[str, Any] | None:
        if period_id is None:
            return self._one(SQL_CURRENT_PERIOD, {})
        return self._one(SQL_PERIOD, {"period_id": period_id})

    def get_student(self, student_id: int) -> dict[str, Any] | None:
        return self._one(SQL_STUDENT, {"student_id": student_id})

    def get_classroom(self, classroom_id: int) -> dict[str, Any] | None:
        return self._one(SQL_CLASSROOM, {"classroom_id": classroom_id})

    def period_students(self, period_id: int, classroom_id: int | None = None) -> pd.DataFrame:
        return self._frame(
            SQL_PERIOD_STUDENTS,
            {"period_id": period_id, "classroom_id": classroom_id},
            ["student_id", "classroom_id", "is_boarder"],
        )

    def attendances(self, period_id: int, student_ids: list[int]) -> pd.DataFrame:
        cols = ["student_id", "status"]
        if not student_ids:
            return pd.DataFrame(columns=cols)
        return self._frame(SQL_ATTENDANCES, {"period_id": period_id, "student_ids": student_ids}, cols)

    def grades(self, period_id: int, student_ids: list[int]) -> pd.DataFrame:
        cols = ["student_id", "course_id", "criterion", "score", "max_score", "evaluation_date"]
        if not student_ids:
            return pd.DataFrame(columns=cols)
        return self._frame(SQL_GRADES, {"period_id": period_id, "student_ids": student_ids}, cols)

    def night_presences(self, student_ids: list[int], start: date, end: date) -> pd.DataFrame:
        cols = ["student_id", "status"]
        if not student_ids:
            return pd.DataFrame(columns=cols)
        params = {
            "check_type": config.NIGHT_CHECK_TYPE,
            "start_date": start,
            "end_date": end,
            "student_ids": student_ids,
        }
        return self._frame(SQL_NIGHT_PRESENCES, params, cols)

    def incidents(self, student_ids: list[int], as_of: date) -> pd.DataFrame:
        cols = ["student_id", "category", "severity", "incident_at"]
        if not student_ids:
            return pd.DataFrame(columns=cols)
        params = {
            "since": datetime.combine(as_of - timedelta(days=config.INCIDENT_WINDOW_DAYS), time.min),
            "until": datetime.combine(as_of, time.max),
            "student_ids": student_ids,
        }
        return self._frame(SQL_INCIDENTS, params, cols)

    def classroom_grades(self, classroom_id: int, period_id: int) -> pd.DataFrame:
        cols = ["student_id", "course_id", "course_code", "course_name", "criterion", "score", "max_score"]
        return self._frame(SQL_CLASSROOM_GRADES, {"classroom_id": classroom_id, "period_id": period_id}, cols)


def get_repository() -> Repository:
    return Repository(get_engine())

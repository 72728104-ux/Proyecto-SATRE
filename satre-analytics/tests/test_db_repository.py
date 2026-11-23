"""Cobertura directa de app.db: engines, fallback y Repository sobre SQLite."""
from __future__ import annotations

from datetime import date

import pandas as pd
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app import config, db

SCHEMA = (
    "CREATE TABLE academic_periods (id INTEGER PRIMARY KEY, name TEXT, start_date DATE, "
    "end_date DATE, is_current INTEGER)",
    "CREATE TABLE students (id INTEGER PRIMARY KEY, classroom_id INTEGER, is_boarder INTEGER, "
    "status TEXT, deleted_at TEXT)",
    "CREATE TABLE classrooms (id INTEGER PRIMARY KEY, academic_period_id INTEGER)",
    "CREATE TABLE courses (id INTEGER PRIMARY KEY, code TEXT, name TEXT, "
    "academic_period_id INTEGER, classroom_id INTEGER)",
    "CREATE TABLE enrollments (student_id INTEGER, course_id INTEGER, status TEXT)",
    "CREATE TABLE attendances (academic_period_id INTEGER, student_id INTEGER, status TEXT)",
    "CREATE TABLE grades (academic_period_id INTEGER, student_id INTEGER, course_id INTEGER, "
    "criterion TEXT, score REAL, max_score REAL, evaluation_date DATE, recorded_at TEXT, "
    "created_at TEXT, deleted_at TEXT)",
    "CREATE TABLE residential_presences (check_type TEXT, presence_date DATE, "
    "student_id INTEGER, status TEXT)",
    "CREATE TABLE incidents (incident_at TEXT, student_id INTEGER, category TEXT, "
    "severity TEXT, deleted_at TEXT)",
)

DATA = (
    "INSERT INTO academic_periods VALUES (3, '2026-I', '2026-01-01', '2026-12-31', 1)",
    "INSERT INTO students VALUES (1, 7, 1, 'active', NULL)",
    "INSERT INTO students VALUES (2, 8, 0, 'active', NULL)",
    "INSERT INTO classrooms VALUES (7, 3)",
    "INSERT INTO courses VALUES (1, 'MAT', 'Matemática', 3, 7)",
    "INSERT INTO enrollments VALUES (1, 1, 'active')",
    "INSERT INTO attendances VALUES (3, 1, 'present')",
    "INSERT INTO grades VALUES (3, 1, 1, 'A', 16, 20, '2026-05-01', NULL, NULL, NULL)",
    "INSERT INTO residential_presences VALUES ('night', '2026-05-02', 1, 'present')",
    "INSERT INTO incidents VALUES ('2026-05-03 10:00:00', 1, 'conducta', 'leve', NULL)",
)


def _sample_engine():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        for statement in SCHEMA:
            conn.execute(text(statement))
        for statement in DATA:
            conn.execute(text(statement))
    return engine


def _settings(**overrides) -> config.Settings:
    values = dict(
        internal_key="k" * 32,
        db_host="127.0.0.1",
        db_port=3306,
        db_database="satre",
        db_username="satre_ro",
        db_password="",
        max_body_bytes=65536,
        database_url=None,
        sqlite_url="sqlite:///:memory:",
        db_connection="mysql",
    )
    values.update(overrides)
    return config.Settings(**values)


# --- engines -----------------------------------------------------------------


def test_sqlite_target_prefers_sqlite_url_and_database_url():
    implicit = db._sqlite_target(_settings(database_url="sqlite:///direct.db", db_connection="mysql"))
    assert implicit == "sqlite:///direct.db"

    explicit = db._sqlite_target(_settings(database_url=None, db_connection="sqlite"))
    assert explicit == "sqlite:///:memory:"

    none = db._sqlite_target(_settings(database_url="mysql+pymysql://u:p@h/db"))
    assert none is None


def test_ensure_sqlite_parent_creates_nested_directories(tmp_path):
    target = tmp_path / "nested" / "dir" / "analytics.db"
    url = "sqlite:///" + target.as_posix()
    engine = db.build_sqlite_engine(url)
    try:
        assert target.parent.is_dir()
        with engine.connect() as conn:
            assert conn.execute(text("SELECT 1")).scalar() == 1
    finally:
        engine.dispose()


def test_ensure_sqlite_parent_noop_cases(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    db._ensure_sqlite_parent("sqlite:///:memory:")
    db._ensure_sqlite_parent("sqlite:///")
    db._ensure_sqlite_parent("postgresql://host/db")
    db._ensure_sqlite_parent("sqlite:///relative.db")
    assert not (tmp_path / "relative.db").parent.joinpath("nested").exists()


def test_build_mysql_engine_builds_url_from_settings_parts():
    settings = _settings(
        database_url=None,
        db_username="reader",
        db_password="secret",
        db_host="db.local",
        db_port=3307,
        db_database="satre",
    )
    engine = db.build_mysql_engine(settings)
    try:
        assert engine.url.drivername.startswith("mysql")
        assert engine.url.username == "reader"
        assert engine.url.password == "secret"
        assert engine.url.host == "db.local"
        assert engine.url.port == 3307
        assert engine.url.database == "satre"
        assert engine.url.query.get("charset") == "utf8mb4"
    finally:
        engine.dispose()


def test_build_mysql_engine_uses_explicit_database_url():
    settings = _settings(database_url="mysql+pymysql://ro:pw@db.local:3306/satre")
    engine = db.build_mysql_engine(settings)
    try:
        assert engine.url.database == "satre"
        assert engine.url.username == "ro"
    finally:
        engine.dispose()


def test_build_mysql_engine_registers_read_only_connect_listener(monkeypatch):
    captured = {}

    class FakeEngine:
        pass

    def fake_listens_for(_engine, name):
        def decorator(fn):
            captured[name] = fn
            return fn

        return decorator

    monkeypatch.setattr(db, "create_engine", lambda *_a, **_k: FakeEngine())
    monkeypatch.setattr(db.event, "listens_for", fake_listens_for)

    engine = db.build_mysql_engine(_settings())
    assert isinstance(engine, FakeEngine)

    class FakeCursor:
        def __init__(self):
            self.statements = []

        def execute(self, statement):
            self.statements.append(statement)

        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

    class FakeConnection:
        def __init__(self):
            self.cursor_instance = FakeCursor()

        def cursor(self):
            return self.cursor_instance

    connection = FakeConnection()
    captured["connect"](connection, None)
    assert connection.cursor_instance.statements == ["SET SESSION TRANSACTION READ ONLY"]


def test_probe_executes_select_one():
    engine = create_engine("sqlite:///:memory:")
    try:
        db._probe(engine)
    finally:
        engine.dispose()


def test_build_engine_returns_probed_mysql_engine(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    monkeypatch.setattr(db, "build_mysql_engine", lambda _settings: engine)
    try:
        assert db.build_engine(_settings()) is engine
    finally:
        engine.dispose()


def test_build_engine_falls_back_to_sqlite_when_mysql_is_down(monkeypatch):
    class Broken:
        def connect(self):
            raise OperationalError("SELECT 1", {}, Exception("down"))

        def dispose(self):
            return None

    monkeypatch.setattr(db, "build_mysql_engine", lambda _settings: Broken())
    engine = db.build_engine(_settings(sqlite_url="sqlite:///:memory:"))
    try:
        assert engine.dialect.name == "sqlite"
        with engine.connect() as conn:
            assert conn.execute(text("SELECT 1")).scalar() == 1
    finally:
        engine.dispose()


def test_get_engine_reuses_cached_explicit_sqlite(monkeypatch):
    monkeypatch.setenv("DB_CONNECTION", "sqlite")
    monkeypatch.setenv("SQLITE_URL", "sqlite:///:memory:")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    config.get_settings.cache_clear()
    db.get_engine.cache_clear()
    try:
        first = db.get_engine()
        second = db.get_engine()
        assert first is second
        assert first.dialect.name == "sqlite"
    finally:
        db.get_engine.cache_clear()
        config.get_settings.cache_clear()


def test_get_engine_keeps_fallback_when_mysql_retry_fails(monkeypatch):
    monkeypatch.setenv("DB_CONNECTION", "mysql")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SQLITE_URL", "sqlite:///:memory:")
    config.get_settings.cache_clear()
    db.get_engine.cache_clear()

    fallback = db.build_sqlite_engine("sqlite:///:memory:")

    def broken(_settings):
        raise OperationalError("SELECT 1", {}, Exception("down"))

    monkeypatch.setattr(db, "build_mysql_engine", broken)
    db._engine_cache = fallback
    db._engine_is_mysql_fallback = True
    try:
        assert db.get_engine() is fallback
        assert db._engine_is_mysql_fallback is True
    finally:
        db._engine_cache = None
        db._engine_is_mysql_fallback = False
        fallback.dispose()
        db.get_engine.cache_clear()
        config.get_settings.cache_clear()


def test_get_repository_wraps_engine(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    monkeypatch.setattr(db, "get_engine", lambda: engine)
    try:
        repo = db.get_repository()
        assert isinstance(repo, db.Repository)
        assert repo.engine is engine
    finally:
        engine.dispose()


# --- Repository --------------------------------------------------------------


@pytest.fixture
def repo():
    engine = _sample_engine()
    try:
        yield db.Repository(engine)
    finally:
        engine.dispose()


def test_repository_single_rows_and_missing_rows(repo):
    assert repo.get_period(None)["id"] == 3
    assert repo.get_period(3)["name"] == "2026-I"
    assert repo.get_period(99) is None
    assert repo.get_student(1) == {
        "id": 1, "classroom_id": 7, "is_boarder": 1, "status": "active",
    }
    assert repo.get_student(99) is None
    assert repo.get_classroom(7) == {"id": 7, "academic_period_id": 3}
    assert repo.get_classroom(99) is None


def test_repository_period_students_filters_by_classroom(repo):
    cohort = repo.period_students(3)
    assert cohort["student_id"].tolist() == [1]
    assert repo.period_students(3, classroom_id=7)["student_id"].tolist() == [1]
    assert repo.period_students(3, classroom_id=8).empty
    empty = repo.period_students(99)
    assert empty.empty
    assert list(empty.columns) == ["student_id", "classroom_id", "is_boarder"]


def test_repository_attendance_and_grades(repo):
    attendance = repo.attendances(3, [1])
    assert attendance.to_dict("records") == [{"student_id": 1, "status": "present"}]
    assert repo.attendances(3, []).empty

    grades = repo.grades(3, [1])
    assert grades["score"].tolist() == [16.0]
    assert grades["evaluation_date"].iloc[0] == "2026-05-01"
    assert repo.grades(3, []).empty

    assert repo.grades(99, [1]).empty


def test_repository_night_presences_and_incidents(repo):
    night = repo.night_presences([1], date(2026, 1, 1), date(2026, 12, 31))
    assert night.to_dict("records") == [{"student_id": 1, "status": "present"}]
    assert repo.night_presences([], date(2026, 1, 1), date(2026, 12, 31)).empty
    assert repo.night_presences([1], date(2026, 6, 1), date(2026, 12, 31)).empty

    incidents = repo.incidents([1], date(2026, 5, 10))
    assert incidents["category"].tolist() == ["conducta"]
    assert repo.incidents([], date(2026, 5, 10)).empty
    assert repo.incidents([1], date(2026, 12, 31)).empty


def test_repository_classroom_grades(repo):
    frame = repo.classroom_grades(7, 3)
    assert frame["course_code"].tolist() == ["MAT"]
    assert frame["course_name"].tolist() == ["Matemática"]
    assert repo.classroom_grades(99, 3).empty


def test_repository_frames_keep_declared_columns_when_empty(repo):
    empty_attendance = repo.attendances(3, [])
    assert list(empty_attendance.columns) == ["student_id", "status"]
    empty_grades = repo.grades(3, [])
    assert list(empty_grades.columns) == [
        "student_id", "course_id", "criterion", "score", "max_score", "evaluation_date",
    ]


def test_repository_frame_accepts_dataframe_rows():
    from unittest.mock import MagicMock

    engine = MagicMock()
    connection = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    connection.execute.return_value.mappings.return_value.all.return_value = []
    repository = db.Repository(engine)
    frame = repository._frame(db.SQL_PERIOD, {}, ["id"])
    assert isinstance(frame, pd.DataFrame)
    assert frame.empty
    engine.connect.assert_called_once()

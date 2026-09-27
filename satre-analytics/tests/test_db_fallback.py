"""MySQL caído: la config sale de .env y el engine pasa a SQLite."""
import os

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app import config, db


def _clear_caches():
    config.get_settings.cache_clear()
    db.get_engine.cache_clear()


def test_load_environment_reads_sqlite_url(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("SQLITE_URL=sqlite:///./from-dotenv.db\nDB_CONNECTION=sqlite\n", encoding="utf-8")
    monkeypatch.delenv("SQLITE_URL", raising=False)
    monkeypatch.delenv("DB_CONNECTION", raising=False)
    _clear_caches()
    try:
        assert config.load_environment(env_file) is True
        assert os.environ["SQLITE_URL"] == "sqlite:///./from-dotenv.db"
        settings = config.get_settings()
        assert settings.sqlite_url == "sqlite:///./from-dotenv.db"
        assert settings.db_connection == "sqlite"
    finally:
        os.environ.pop("SQLITE_URL", None)
        os.environ.pop("DB_CONNECTION", None)
        _clear_caches()


def test_build_engine_uses_sqlite_when_mysql_probe_fails(monkeypatch):
    monkeypatch.setenv("DB_CONNECTION", "mysql")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SQLITE_URL", "sqlite:///:memory:")
    _clear_caches()

    class Broken:
        def connect(self):
            raise OperationalError("SELECT 1", {}, Exception("down"))

        def dispose(self):
            return None

    monkeypatch.setattr(db, "build_mysql_engine", lambda _settings: Broken())
    try:
        engine = db.build_engine(config.get_settings())
        with engine.connect() as conn:
            assert conn.execute(text("SELECT 1")).scalar() == 1
        engine.dispose()
    finally:
        _clear_caches()


def test_db_connection_sqlite_skips_mysql(monkeypatch):
    calls = []
    monkeypatch.setattr(db, "build_mysql_engine", lambda settings: calls.append(settings))
    settings = config.Settings(
        internal_key="k" * 32,
        db_host="127.0.0.1",
        db_port=3306,
        db_database="satre",
        db_username="satre_ro",
        db_password="",
        max_body_bytes=65536,
        database_url=None,
        sqlite_url="sqlite:///:memory:",
        db_connection="sqlite",
    )
    engine = db.build_engine(settings)
    assert calls == []
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1
    engine.dispose()

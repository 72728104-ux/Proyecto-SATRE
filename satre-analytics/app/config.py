"""Pesos, umbrales y ajustes del motor (SATRE_TOBE §5.3).

Los pesos y umbrales son valores de partida: deben calibrarse con el COAR.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _ROOT / ".env"

STABLE_AI_MODEL_NAME = "gemini-1.5-flash"
STABLE_AI_FALLBACK_MODEL_NAME = "gemini-1.5-flash-8b"
UNSTABLE_AI_MODELS = frozenset({
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
})


def default_sqlite_url() -> str:
    path = _ROOT / "data" / "analytics.db"
    return "sqlite:///" + path.as_posix()


def load_environment(path: Path | None = None) -> bool:
    """Carga `.env` sin pisar variables ya definidas en el proceso."""
    return load_dotenv(path or _ENV_FILE, override=False)


def ensure_gemini_api_key(path: Path | None = None) -> str | None:
    """Carga `GEMINI_API_KEY` con python-dotenv antes de instanciar Google.

    Si el proceso tiene la variable ausente o en blanco, fuerza el valor del
    `.env` del servicio (uvicorn a menudo hereda `GEMINI_API_KEY=` vacío).
    """
    env_path = path or _ENV_FILE
    load_dotenv(env_path, override=False)
    key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    if key:
        return key
    if env_path.is_file():
        file_key = (dotenv_values(env_path).get("GEMINI_API_KEY") or "").strip()
        if file_key:
            os.environ["GEMINI_API_KEY"] = file_key
            return file_key
    return None


def resolve_ai_model_name(
    name: str | None,
    *,
    fallback: str = STABLE_AI_MODEL_NAME,
) -> str:
    raw = (name or "").strip() or fallback
    if raw in UNSTABLE_AI_MODELS:
        return fallback
    return raw


load_environment()
ensure_gemini_api_key()

MODEL_VERSION = "rules-1.0"

# --- Pesos por componente (suman 1.0) -------------------------------------
WEIGHTS: dict[str, float] = {
    "unexcused_absence": 0.25,
    "grade_level": 0.25,
    "grade_trend": 0.20,
    "incidents": 0.15,
    "night_presence": 0.10,
    "tardiness": 0.05,
}

FACTOR_LABELS: dict[str, str] = {
    "unexcused_absence": "Inasistencias injustificadas",
    "grade_level": "Promedio Minedu",
    "grade_trend": "Tendencia de notas",
    "incidents": "Incidencias (30 días)",
    "night_presence": "Presencia nocturna",
    "tardiness": "Tardanzas",
}

# --- Normalización 0–1 ----------------------------------------------------
UNEXCUSED_RATE_CAP = 0.20          # min(unexcused_rate / 0.20, 1)
GRADE_REFERENCE = 4.5 * 20 / 7     # clamp((12.86 − grade_mean) / 10, 0, 1) sobre 0–20
GRADE_SPAN = 3.5 * 20 / 7
TREND_SLOPE_CAP = 0.5 * 20 / 7     # clamp(−slope / 1.43, 0, 1)
TREND_MIN_POINTS = 4               # n ≥ 4
TREND_MIN_R2 = 0.3                 # r2 ≥ 0.3
TREND_SLOPE_UNIT_DAYS = 30         # la pendiente se expresa en puntos vigesimales por 30 días
INCIDENT_WEIGHTED_CAP = 6          # min(incident_weighted_30d / 6, 1)
NIGHT_ABSENCE_CAP = 0.15           # min((1 − night_rate) / 0.15, 1)
TARDINESS_RATE_CAP = 0.25          # min(tardiness_rate / 0.25, 1)

# --- Escala Minedu vigesimal 0–20 (TOBE-4) --------------------------------
MINEDU_MIN_SCORE = 0
MINEDU_MAX_SCORE = 20
MINEDU_PASSING_SCORE = 11
IB_CRITERIA = ("A", "B", "C", "D")  # criterios evaluativos, no la letra Minedu

# --- Dominio ----------------------------------------------------------------
# 'absent' y 'justified' son estados heredados previos a la migración de §3.1.
UNEXCUSED_STATUSES = ("absent_unjustified", "absent")
LATE_STATUSES = ("late",)
NIGHT_CHECK_TYPE = "night"
NIGHT_PRESENT_STATUSES = ("present",)
NIGHT_ABSENT_STATUSES = ("absent",)   # 'on_permission' no cuenta: es salida autorizada
INCIDENT_SEVERITY_WEIGHTS: dict[str, int] = {"leve": 1, "moderada": 2, "grave": 4}
INCIDENT_WINDOW_DAYS = 30
ESCALATION_WINDOW_DAYS = 7
ESCALATION_SEVERITY = "grave"
ESCALATION_CATEGORIES = ("salud", "emocional")

# --- Niveles ----------------------------------------------------------------
LEVEL_MEDIO_MIN = 35               # BAJO < 35
LEVEL_ALTO_MIN = 65                # MEDIO 35–64 · ALTO ≥ 65

# --- Suficiencia de datos -------------------------------------------------
MIN_ATTENDANCE_RECORDS = 5         # insufficient si < 5 asistencias Y < 1 nota Minedu
MIN_GRADES = 1

RECOMMENDATIONS: dict[str, str] = {
    "BAJO": "Seguimiento regular: mantener el acompañamiento habitual del tutor.",
    "MEDIO": "Monitoreo preventivo: conversar con el estudiante y revisar el factor principal ({factor}).",
    "ALTO": "Intervención prioritaria: coordinar tutor, psicología y apoderado; registrar la intervención ({factor}).",
    "INSUFFICIENT": "Datos insuficientes para estimar el riesgo: completar registros de asistencia y notas.",
    "HUMAN_REVIEW": "Revisión humana inmediata: incidencia grave de salud o emocional en los últimos 7 días. ",
}

# --- Clustering (§5.5) ------------------------------------------------------
CLUSTER_MIN_STUDENTS = 30
CLUSTER_K = 3
CLUSTER_RANDOM_STATE = 42
CLUSTER_FEATURES = ("unexcused_rate", "tardiness_rate", "grade_mean", "incident_weighted_30d")

# --- Insights docente (§5.5) --------------------------------------------------
INSIGHTS_MIN_GRADES = 3            # notas con criterio por aula para no marcar insufficient_data
INSIGHTS_TOP_GAPS = 3
INSIGHTS_METHODOLOGIES_PER_GAP = 2

# --- Tutor socrático ------------------------------------------------------------
SOCRATIC_MAX_HINT_LEVEL = 3
SOCRATIC_MAX_VERIFICATION_ATTEMPTS = 3
SOCRATIC_MAX_MESSAGE_CHARS = 1000


def _internal_key() -> str:
    """X_INTERNAL_KEY tiene prioridad; INTERNAL_KEY queda como alias legado."""
    for name in ("X_INTERNAL_KEY", "INTERNAL_KEY"):
        key = (os.environ.get(name) or "").strip()
        if len(key) >= 32:
            return key
    raise RuntimeError("X_INTERNAL_KEY / INTERNAL_KEY debe definirse y tener al menos 32 caracteres.")


def _optional_env(name: str) -> str | None:
    value = (os.environ.get(name) or "").strip()
    return value or None


@dataclass(frozen=True)
class Settings:
    internal_key: str
    db_host: str
    db_port: int
    db_database: str
    db_username: str
    db_password: str
    max_body_bytes: int
    database_url: str | None = None
    sqlite_url: str = ""
    db_connection: str = "mysql"
    gemini_api_key: str | None = None
    ai_model_name: str = STABLE_AI_MODEL_NAME
    ai_fallback_model_name: str = STABLE_AI_FALLBACK_MODEL_NAME
    ai_timeout_seconds: float = 30.0


@lru_cache
def get_settings() -> Settings:
    ensure_gemini_api_key()
    key = _internal_key()
    database_url = (os.environ.get("DATABASE_URL") or "").strip() or None
    timeout_raw = (os.environ.get("AI_TIMEOUT_SECONDS") or "30").strip() or "30"
    return Settings(
        internal_key=key,
        db_host=os.environ.get("DB_HOST", "127.0.0.1"),
        db_port=int(os.environ.get("DB_PORT", "3306")),
        db_database=os.environ.get("DB_DATABASE", "satre"),
        db_username=os.environ.get("DB_USERNAME", "satre_ro"),
        db_password=os.environ.get("DB_PASSWORD", ""),
        max_body_bytes=int(os.environ.get("MAX_BODY_BYTES", "65536")),
        database_url=database_url,
        sqlite_url=(os.environ.get("SQLITE_URL") or "").strip() or default_sqlite_url(),
        db_connection=(os.environ.get("DB_CONNECTION") or "mysql").strip().lower() or "mysql",
        gemini_api_key=_optional_env("GEMINI_API_KEY"),
        ai_model_name=resolve_ai_model_name(_optional_env("AI_MODEL_NAME")),
        ai_fallback_model_name=resolve_ai_model_name(
            _optional_env("AI_FALLBACK_MODEL_NAME"),
            fallback=STABLE_AI_FALLBACK_MODEL_NAME,
        ),
        ai_timeout_seconds=float(timeout_raw),
    )

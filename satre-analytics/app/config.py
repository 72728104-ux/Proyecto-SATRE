"""Pesos, umbrales y ajustes del motor (SATRE_TOBE §5.3).

Los pesos y umbrales son valores de partida: deben calibrarse con el COAR.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _ROOT / ".env"


def default_sqlite_url() -> str:
    path = _ROOT / "data" / "analytics.db"
    return "sqlite:///" + path.as_posix()


def load_environment(path: Path | None = None) -> bool:
    """Carga `.env` sin pisar variables ya definidas en el proceso."""
    return load_dotenv(path or _ENV_FILE, override=False)


load_environment()

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
    "grade_level": "Promedio IB",
    "grade_trend": "Tendencia de notas",
    "incidents": "Incidencias (30 días)",
    "night_presence": "Presencia nocturna",
    "tardiness": "Tardanzas",
}

# --- Normalización 0–1 ----------------------------------------------------
UNEXCUSED_RATE_CAP = 0.20          # min(unexcused_rate / 0.20, 1)
GRADE_REFERENCE = 4.5              # clamp((4.5 − grade_mean) / 3.5, 0, 1)
GRADE_SPAN = 3.5
TREND_SLOPE_CAP = 0.5              # clamp(−slope / 0.5, 0, 1)
TREND_MIN_POINTS = 4               # n ≥ 4
TREND_MIN_R2 = 0.3                 # r2 ≥ 0.3
TREND_SLOPE_UNIT_DAYS = 30         # la pendiente se expresa en puntos IB por 30 días
INCIDENT_WEIGHTED_CAP = 6          # min(incident_weighted_30d / 6, 1)
NIGHT_ABSENCE_CAP = 0.15           # min((1 − night_rate) / 0.15, 1)
TARDINESS_RATE_CAP = 0.25          # min(tardiness_rate / 0.25, 1)

# --- Escala IB --------------------------------------------------------------
IB_MAX_SCORE = 7
IB_PASSING_SCORE = 4
IB_CRITERIA = ("A", "B", "C", "D")

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
MIN_ATTENDANCE_RECORDS = 5         # insufficient si < 5 asistencias Y < 3 notas
MIN_GRADES = 3

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


@lru_cache
def get_settings() -> Settings:
    key = os.environ.get("INTERNAL_KEY", "")
    if len(key) < 32:
        raise RuntimeError("INTERNAL_KEY debe definirse y tener al menos 32 caracteres.")
    database_url = (os.environ.get("DATABASE_URL") or "").strip() or None
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
    )

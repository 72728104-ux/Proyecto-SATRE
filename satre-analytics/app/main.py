"""SATRE Analytics · servicio interno (solo red interna; Laravel es el único cliente)."""
from __future__ import annotations

import logging
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import config
from app.api.dependencies import unauthorized_internal_key
from app.api.v1.student_tutor import router as socratic_tutor_router
from app.api.v1.teacher_report import router as teacher_report_router
from app.clustering import assign_profiles
from app.db import Repository, get_repository
from app.features import build_features, reference_date
from app.insights import build_insights
from app.risk import score_student
from app.socratic import next_turn

logger = logging.getLogger("satre.analytics")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config.get_settings()
    yield


app = FastAPI(
    title="SATRE Analytics",
    version=config.MODEL_VERSION,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    debug=False,
)
app.include_router(socratic_tutor_router)
app.include_router(teacher_report_router)


def _error(status: int, message: str, errors: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"message": message}
    if errors is not None:
        body["errors"] = errors
    return JSONResponse(status_code=status, content=body)


@app.middleware("http")
async def guard(request: Request, call_next):
    started = time.perf_counter()
    settings = config.get_settings()

    length = request.headers.get("content-length")
    if length is not None and (not length.isdigit() or int(length) > settings.max_body_bytes):
        return _error(413, "Cuerpo de la petición demasiado grande.")
    if length is None and request.method in {"POST", "PUT", "PATCH"} and "transfer-encoding" in request.headers:
        return _error(411, "Se requiere Content-Length.")

    rejected = unauthorized_internal_key(request.headers.get("x-internal-key"))
    if rejected is not None:
        return _error(*rejected)

    response = await call_next(request)
    route = request.scope.get("route")
    logger.info("%s %s %s %.0fms", request.method, getattr(route, "path", "-"), response.status_code,
                (time.perf_counter() - started) * 1000)
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(_request: Request, exc: StarletteHTTPException):
    return _error(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    errors = [{"loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()]
    return _error(422, "Datos inválidos.", errors)


_INSIGHTS_PATH = re.compile(r"^/v1/classrooms/(\d+)/insights$")


def _insights_fallback(classroom_id: int, period_id: int | None) -> dict:
    """Contrato de insights sin datos: HTTP 200, nunca 503 por caída de la BD."""
    return {
        "classroom_id": classroom_id,
        "period_id": period_id,
        "model_version": config.MODEL_VERSION,
        "generated_at": _now(),
        "insufficient_data": True,
        "courses": [],
        "top_gaps": [],
        "error_matrix": [],
    }


def _period_query(request: Request) -> int | None:
    raw = request.query_params.get("period_id")
    if raw and raw.isdigit() and int(raw) > 0:
        return int(raw)
    return None


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    logger.error("database error: %s", type(exc).__name__)
    match = _INSIGHTS_PATH.match(request.url.path)
    if request.method == "GET" and match:
        return JSONResponse(
            status_code=200,
            content=_insights_fallback(int(match.group(1)), _period_query(request)),
        )
    return _error(503, "Base de datos no disponible.")


# --- Esquemas ---------------------------------------------------------------

class BatchRiskRequest(BaseModel):
    period_id: int = Field(gt=0)
    classroom_id: int | None = Field(default=None, gt=0)


class SocraticRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=150)
    course_id: int | None = Field(default=None, gt=0)
    criterion: str | None = Field(default=None, min_length=1, max_length=1)
    message: str | None = Field(default=None, max_length=config.SOCRATIC_MAX_MESSAGE_CHARS)
    option_id: str | None = Field(default=None, max_length=10)
    state: dict[str, Any] | None = None


# --- Lógica compartida ------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _period_start(period: dict):
    start = pd.to_datetime(period.get("start_date"), errors="coerce")
    return None if pd.isna(start) else start.date()


def _cohort_features(repo: Repository, period: dict, students: pd.DataFrame) -> pd.DataFrame:
    ids = [int(sid) for sid in students["student_id"].dropna().unique()]
    as_of = reference_date(period)
    start = _period_start(period) or as_of
    return build_features(
        students,
        repo.attendances(period["id"], ids),
        repo.grades(period["id"], ids),
        repo.night_presences(ids, start, as_of),
        repo.incidents(ids, as_of),
        as_of,
    )


def _risk_payload(row: dict, period_id: int | None, profile: str | None) -> dict:
    scored = score_student(row)
    return {
        "student_id": int(row["student_id"]),
        "period_id": period_id,
        "model_version": config.MODEL_VERSION,
        "insufficient_data": scored["insufficient_data"],
        "data_coverage": scored["data_coverage"],
        "risk_level": scored["risk_level"],
        "risk_score": scored["risk_score"],
        "factors": scored["factors"],
        "recommendation": scored["recommendation"],
        "needs_human_review": scored["needs_human_review"],
        "profile_cluster": None if scored["insufficient_data"] else profile,
    }


def _empty_risk(student_id: int, period_id: int | None) -> dict:
    return _risk_payload({"student_id": student_id}, period_id, None)


def _resolve_period(repo: Repository, period_id: int | None) -> dict | None:
    period = repo.get_period(period_id)
    if period is None and period_id is not None:
        raise HTTPException(status_code=404, detail="Periodo no encontrado.")
    return period


# --- Endpoints ----------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/v1/students/{student_id}/risk")
def student_risk(
    student_id: int = Path(gt=0),
    period_id: int | None = Query(default=None, gt=0),
    repo: Repository = Depends(get_repository),
) -> dict:
    student = repo.get_student(student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado.")
    period = _resolve_period(repo, period_id)
    if period is None:
        return _empty_risk(student_id, None)

    cohort = repo.period_students(period["id"])
    if cohort.empty or student_id not in set(int(s) for s in cohort["student_id"]):
        extra = pd.DataFrame([{"student_id": student_id, "classroom_id": student.get("classroom_id"),
                               "is_boarder": student.get("is_boarder")}])
        cohort = pd.concat([cohort, extra], ignore_index=True) if not cohort.empty else extra

    features = _cohort_features(repo, period, cohort)
    profiles = assign_profiles(features)
    rows = features[features["student_id"] == student_id].to_dict("records")
    if not rows:
        return _empty_risk(student_id, period["id"])
    return _risk_payload(rows[0], period["id"], profiles.get(student_id))


@app.post("/v1/batch/risk")
def batch_risk(payload: BatchRiskRequest, repo: Repository = Depends(get_repository)) -> dict:
    period = _resolve_period(repo, payload.period_id)
    cohort = repo.period_students(period["id"])
    results: list[dict] = []
    if not cohort.empty:
        features = _cohort_features(repo, period, cohort)
        profiles = assign_profiles(features)
        if payload.classroom_id is not None:
            features = features[features["classroom_id"] == payload.classroom_id]
        results = [_risk_payload(row, period["id"], profiles.get(int(row["student_id"])))
                   for row in features.to_dict("records")]
    return {
        "period_id": period["id"],
        "classroom_id": payload.classroom_id,
        "model_version": config.MODEL_VERSION,
        "generated_at": _now(),
        "count": len(results),
        "results": results,
    }


@app.get("/v1/classrooms/{classroom_id}/insights")
def classroom_insights(
    classroom_id: int = Path(gt=0),
    period_id: int | None = Query(default=None, gt=0),
    repo: Repository = Depends(get_repository),
) -> dict:
    try:
        classroom = repo.get_classroom(classroom_id)
        if classroom is None:
            raise HTTPException(status_code=404, detail="Aula no encontrada.")
        period = _resolve_period(repo, period_id or classroom.get("academic_period_id"))
        base = {"classroom_id": classroom_id, "period_id": period["id"] if period else None,
                "model_version": config.MODEL_VERSION, "generated_at": _now()}
        if period is None:
            return {**base, "insufficient_data": True, "courses": [], "top_gaps": [], "error_matrix": []}
        return {**base, **build_insights(repo.classroom_grades(classroom_id, period["id"]))}
    except SQLAlchemyError as exc:
        logger.error("database error: %s", type(exc).__name__)
        return _insights_fallback(classroom_id, period_id)


@app.post("/v1/socratic/next")
def socratic_next(payload: SocraticRequest) -> dict:
    return next_turn(payload.topic, payload.message, payload.option_id, payload.state)

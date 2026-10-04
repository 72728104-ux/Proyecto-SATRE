"""GET /api/v1/analytics/teacher-report/{student_id} (SATRE TOBE-3 §4 / §5.4)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Path
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import get_hybrid_teacher_service, verify_internal_key
from app.db import Repository, get_repository
from app.services.ai.teacher_hybrid import HybridTeacherReportService

logger = logging.getLogger("satre.analytics")

router = APIRouter(
    prefix="/api/v1/analytics",
    dependencies=[Depends(verify_internal_key)],
)


@router.get("/teacher-report/{student_id}")
async def teacher_report(
    student_id: int = Path(gt=0),
    repo: Repository = Depends(get_repository),
    service: HybridTeacherReportService = Depends(get_hybrid_teacher_service),
) -> dict:
    try:
        return await service.get_teacher_dashboard_data(repo, student_id)
    except SQLAlchemyError:
        logger.error("teacher-report database error student_id=%s", student_id)
        return {"insufficient_data": True}
    except Exception:
        logger.exception("teacher-report failed student_id=%s", student_id)
        return {"insufficient_data": True}

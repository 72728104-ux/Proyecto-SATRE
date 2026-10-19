"""POST /api/v1/analytics/teacher-assistant (SATRE TOBE-5 §3)."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app import config
from app.api.dependencies import get_hybrid_teacher_service, verify_internal_key
from app.db import Repository, get_repository
from app.services.ai.teacher_hybrid import HybridTeacherReportService

logger = logging.getLogger("satre.analytics")

router = APIRouter(
    prefix="/api/v1/analytics",
    dependencies=[Depends(verify_internal_key)],
)


class TeacherHistoryItem(BaseModel):
    role: str = "user"
    content: str = ""


class TeacherAssistantRequest(BaseModel):
    classroom_id: int = Field(gt=0)
    user_message: str = Field(min_length=1, max_length=config.SOCRATIC_MAX_MESSAGE_CHARS)
    history: list[TeacherHistoryItem | str] | None = None
    student_id: int | None = Field(default=None, gt=0)
    criterion: str | None = Field(default=None, min_length=1, max_length=1)


def _history_payload(history: list[TeacherHistoryItem | str] | None) -> list | None:
    if history is None:
        return None
    items: list[Any] = []
    for item in history:
        if isinstance(item, str):
            items.append(item)
        else:
            items.append(item.model_dump())
    return items


@router.post("/teacher-assistant")
async def teacher_assistant(
    payload: TeacherAssistantRequest,
    repo: Repository = Depends(get_repository),
    service: HybridTeacherReportService = Depends(get_hybrid_teacher_service),
) -> dict:
    logger.info(
        "teacher-assistant request classroom_hash=%s student=%s criterion=%s message_chars=%s",
        hash(payload.classroom_id) % 10000,
        payload.student_id is not None,
        payload.criterion,
        len(payload.user_message),
    )
    try:
        result = await service.answer_teacher_query(
            repo,
            payload.classroom_id,
            payload.user_message,
            _history_payload(payload.history),
            student_id=payload.student_id,
            criterion=payload.criterion,
        )
        response = result.get("assistant_response") if isinstance(result, dict) else None
        logger.info(
            "teacher-assistant response classroom_hash=%s insufficient_data=%s gemini_available=%s",
            hash(payload.classroom_id) % 10000,
            result.get("insufficient_data") if isinstance(result, dict) else None,
            response.get("available") if isinstance(response, dict) else None,
        )
        return result
    except SQLAlchemyError:
        logger.exception(
            "teacher-assistant database error classroom_hash=%s",
            hash(payload.classroom_id) % 10000,
        )
        return {
            "available": False,
            "insufficient_data": True,
            "reason": "database_error",
            "message": "No se pudo leer el contexto académico del aula.",
        }
    except Exception:
        logger.exception(
            "teacher-assistant failed classroom_hash=%s",
            hash(payload.classroom_id) % 10000,
        )
        return {
            "available": False,
            "reason": "internal_error",
            "message": "El asistente docente no pudo completar la consulta.",
        }

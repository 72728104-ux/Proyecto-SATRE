"""POST /api/v1/analytics/socratic-tutor (SATRE TOBE-3 §4 / §5.3)."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app import config
from app.api.dependencies import get_hybrid_socratic_service, verify_internal_key
from app.db import Repository, get_repository
from app.services.ai.socratic_hybrid import HybridSocraticService

logger = logging.getLogger("satre.analytics")

router = APIRouter(
    prefix="/api/v1/analytics",
    dependencies=[Depends(verify_internal_key)],
)

class SocraticHistoryItem(BaseModel):
    role: str = "user"
    content: str = ""


class SocraticTutorRequest(BaseModel):
    student_id: int = Field(gt=0)
    user_message: str = Field(min_length=1, max_length=config.SOCRATIC_MAX_MESSAGE_CHARS)
    history: list[SocraticHistoryItem | str] | None = None
    topic: str | None = Field(default=None, max_length=150)
    create_phase: str | None = Field(default=None, max_length=20)
    intent: str | None = Field(default=None, max_length=20)
    criterion: str | None = Field(default=None, min_length=1, max_length=1)


def _history_payload(history: list[SocraticHistoryItem | str] | None) -> list | None:
    if history is None:
        return None
    items: list[Any] = []
    for item in history:
        if isinstance(item, str):
            items.append(item)
        else:
            items.append(item.model_dump())
    return items


@router.post("/socratic-tutor")
async def socratic_tutor(
    payload: SocraticTutorRequest,
    repo: Repository = Depends(get_repository),
    service: HybridSocraticService = Depends(get_hybrid_socratic_service),
) -> dict:
    logger.info(
        "socratic-tutor request received student_hash=%s topic=%s phase=%s intent=%s message_chars=%s history=%s",
        hash(payload.student_id) % 10000,
        payload.topic,
        payload.create_phase,
        payload.intent,
        len(payload.user_message),
        len(payload.history or []),
    )
    try:
        result = await service.process_interaction(
            repo,
            payload.student_id,
            payload.user_message,
            _history_payload(payload.history),
            topic=payload.topic,
            create_phase=payload.create_phase,
            intent=payload.intent,
            criterion=payload.criterion,
        )
        response = result.get("socratic_response") if isinstance(result, dict) else None
        logger.info(
            "socratic-tutor response student_hash=%s insufficient_data=%s gemini_available=%s reason=%s",
            hash(payload.student_id) % 10000,
            result.get("insufficient_data") if isinstance(result, dict) else None,
            response.get("available") if isinstance(response, dict) else None,
            (response.get("reason") if isinstance(response, dict) else None)
            or (result.get("reason") if isinstance(result, dict) else None),
        )
        return result
    except SQLAlchemyError:
        logger.exception("socratic-tutor database error student_hash=%s", hash(payload.student_id) % 10000)
        return {
            "available": False,
            "insufficient_data": True,
            "reason": "database_error",
            "message": "No se pudo leer el contexto académico del tutor.",
        }
    except Exception:
        logger.exception("socratic-tutor failed student_hash=%s", hash(payload.student_id) % 10000)
        return {
            "available": False,
            "reason": "internal_error",
            "message": "El tutor híbrido no pudo completar el turno.",
        }

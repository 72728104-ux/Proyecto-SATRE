"""Dependencia de cabecera `X-Internal-Key` (SATRE TOBE-3 §4).

Compara en tiempo constante contra el valor de `.env`
(`X_INTERNAL_KEY` / `INTERNAL_KEY`). Clave ausente o distinta → HTTP 401.
"""
from __future__ import annotations

import hashlib
import hmac

from fastapi import Depends, Header, HTTPException

from app import config
from app.services.ai.external_client import ExternalAIService
from app.services.ai.socratic_hybrid import HybridSocraticService
from app.services.ai.teacher_hybrid import HybridTeacherReportService


def internal_key_matches(provided: str, expected: str) -> bool:
    """Comparación en tiempo constante aunque las longitudes difieran."""
    left = hashlib.sha256(provided.encode("utf-8")).digest()
    right = hashlib.sha256(expected.encode("utf-8")).digest()
    return hmac.compare_digest(left, right)


def unauthorized_internal_key(provided: str | None) -> tuple[int, str] | None:
    """`None` si la clave es válida; `(401, mensaje)` si falta o no coincide."""
    expected = config.get_settings().internal_key
    if not provided:
        return 401, "Falta el header X-Internal-Key."
    if not internal_key_matches(provided, expected):
        return 401, "X-Internal-Key inválida."
    return None


def verify_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
) -> str:
    rejected = unauthorized_internal_key(x_internal_key)
    if rejected is not None:
        raise HTTPException(status_code=rejected[0], detail=rejected[1])
    return x_internal_key or ""


def get_external_ai_service() -> ExternalAIService:
    """Construye el cliente Gemini con la config ya resuelta de `app.config`.

    Evita revalidar `X_INTERNAL_KEY` vía `app.core.config` (el `.env` puede
    traer un alias corto y caer al `INTERNAL_KEY` legado).
    """
    from app.core.config import Settings as CoreSettings

    runtime = config.get_settings()
    settings = CoreSettings.model_construct(
        x_internal_key=runtime.internal_key,
        gemini_api_key=runtime.gemini_api_key,
        ai_model_name=runtime.ai_model_name,
        ai_timeout_seconds=runtime.ai_timeout_seconds,
    )
    return ExternalAIService(settings=settings)


def get_hybrid_socratic_service(
    ai_client: ExternalAIService = Depends(get_external_ai_service),
) -> HybridSocraticService:
    return HybridSocraticService(ai_client)


def get_hybrid_teacher_service(
    ai_client: ExternalAIService = Depends(get_external_ai_service),
) -> HybridTeacherReportService:
    return HybridTeacherReportService(ai_client)

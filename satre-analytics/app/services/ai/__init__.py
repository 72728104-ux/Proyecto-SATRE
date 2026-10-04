"""Integración con Google Gemini (`google-genai`)."""

from app.services.ai.create_protocol import SocraticCreateTurn
from app.services.ai.external_client import (
    ExternalAIService,
    TeacherPedagogicalPlan,
    generate_content,
    get_client,
)
from app.services.ai.socratic_hybrid import HybridSocraticService
from app.services.ai.teacher_hybrid import HybridTeacherReportService

__all__ = [
    "ExternalAIService",
    "HybridSocraticService",
    "HybridTeacherReportService",
    "SocraticCreateTurn",
    "TeacherPedagogicalPlan",
    "generate_content",
    "get_client",
]

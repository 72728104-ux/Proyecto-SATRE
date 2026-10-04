"""Filtro interno de anonimización de menores (SATRE TOBE-3 §3).

Ningún PII (nombre, DNI, teléfono, correo, COAR específico) debe salir
del perímetro SATRE hacia una API de IA externa.
"""
from __future__ import annotations

import re
import uuid
from typing import Any, Final

from app.services.deterministic.grading_scaler import PeruvianGradingScaler


class PrivacyGuardService:
    """Sanitiza texto libre y construye un `safe_context` anónimo."""

    DNI_PATTERN: Final[re.Pattern[str]] = re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}\b")
    EMAIL_PATTERN: Final[re.Pattern[str]] = re.compile(
        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    )
    PHONE_PATTERN: Final[re.Pattern[str]] = re.compile(
        r"(?:\+?51[\s.\-]*)?9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}\b"
    )
    FULL_NAME_PATTERN: Final[re.Pattern[str]] = re.compile(
        r"\b[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+"
        r"(?:(?:\s+(?:d[ae]l?|l[ao]s?|y|san|santa))?\s+"
        r"[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)+\b"
    )

    DNI_LABEL: Final[str] = "[DNI_PROTEGIDO]"
    EMAIL_LABEL: Final[str] = "[CORREO_PROTEGIDO]"
    PHONE_LABEL: Final[str] = "[TELEFONO_PROTEGIDO]"
    STUDENT_LABEL: Final[str] = "[ESTUDIANTE_ANONIMO]"

    _NAME_PARTICLES: Final[frozenset[str]] = frozenset({
        "de", "del", "da", "das", "do", "dos", "la", "las", "lo", "los",
        "y", "san", "santa",
    })
    _NAME_STOPWORDS: Final[frozenset[str]] = frozenset({
        "tengo", "hola", "me", "mi", "mis", "soy", "somos",
        "el", "la", "los", "las", "un", "una", "unos", "unas",
        "este", "esta", "estos", "estas", "ese", "esa",
        "en", "de", "del", "y", "o", "pero", "que", "qué",
        "si", "no", "para", "por", "con", "sin", "sobre",
        "logro", "destacado", "esperado", "proceso", "inicio",
        "estudio", "estudia", "compañero", "compañera",
    })
    _NAME_ALLOWLIST: Final[frozenset[str]] = frozenset({
        "logro destacado",
        "logro esperado",
        "en proceso",
        "en inicio",
    })
    _PII_KEYS: Final[frozenset[str]] = frozenset({
        "student_id",
        "id",
        "name",
        "first_name",
        "last_name",
        "student_name",
        "dni",
        "document_number",
        "email",
        "phone",
        "telefono",
        "student_code",
    })
    _GRADE_KEYS: Final[tuple[str, ...]] = (
        "vigesimal_score",
        "numeric_grade",
        "minedu_score",
        "grade_mean",
    )

    SYSTEM_PRIVACY_INSTRUCTION: Final[str] = (
        "REGLA ABSOLUTA DE CONFIDENCIALIDAD (LEYES PERUANAS DE PROTECCIÓN "
        "DE DATOS DE MENORES):\n"
        "- Bajo ninguna circunstancia pidas o guardes nombres, DNI, colegio "
        "COAR ni ubicación del alumno.\n"
        "- Las calificaciones deben gestionarse bajo la escala cualitativa "
        "oficial peruana: AD (Logro Destacado), A (Logro Esperado), "
        "B (En Proceso), C (En Inicio).\n"
        "- Si el alumno menciona datos personales, recuérdale amablemente "
        "que por seguridad no debe compartirlos y reorienta la sesión "
        "socrática al tema académico."
    )

    @classmethod
    def sanitize_student_input(cls, text: str | None) -> str:
        """Enmascara DNI, teléfonos, correos y nombres completos."""
        if not text:
            return ""
        sanitized = cls.EMAIL_PATTERN.sub(cls.EMAIL_LABEL, text)
        sanitized = cls.PHONE_PATTERN.sub(cls.PHONE_LABEL, sanitized)
        sanitized = cls.DNI_PATTERN.sub(cls.DNI_LABEL, sanitized)
        sanitized = cls.FULL_NAME_PATTERN.sub(cls._mask_name, sanitized)
        return sanitized

    @classmethod
    def _mask_name(cls, match: re.Match[str]) -> str:
        phrase = match.group(0)
        if phrase.casefold() in cls._NAME_ALLOWLIST:
            return phrase
        significant = [
            token for token in phrase.split()
            if token.casefold() not in cls._NAME_STOPWORDS
            and token.casefold() not in cls._NAME_PARTICLES
        ]
        if len(significant) < 2:
            return phrase
        if " ".join(significant).casefold() in cls._NAME_ALLOWLIST:
            return phrase
        return cls.STUDENT_LABEL

    @classmethod
    def build_safe_context(cls, student_id: int, deterministic_data: dict | None) -> dict:
        """Contexto anónimo: UUID efímero + escala MINEDU, sin PII."""
        data = dict(deterministic_data or {})
        qualitative = cls._qualitative_from(data)

        safe: dict[str, Any] = {
            "anonymous_id": cls._anonymous_id(student_id),
            "student_label": cls.STUDENT_LABEL,
            "risk_level": data.get("risk_level"),
            "qualitative_grade": qualitative,
            "trend": data.get("trend_slope", data.get("trend")),
            "cluster_id": data.get("cluster_id"),
        }

        for key, value in data.items():
            if key in cls._PII_KEYS or key in safe:
                continue
            if isinstance(value, str):
                safe[key] = cls.sanitize_student_input(value)
            elif isinstance(value, (int, float, bool)) or value is None:
                if key not in {"student_id", "id"}:
                    safe[key] = value
        return safe

    @classmethod
    def _anonymous_id(cls, student_id: int) -> str:
        digest = uuid.uuid5(uuid.NAMESPACE_OID, f"satre:student:{student_id}")
        return f"STUDENT_UUID_{digest}"

    @classmethod
    def _qualitative_from(cls, data: dict) -> str | None:
        raw = data.get("qualitative_grade")
        if raw:
            return str(raw).upper().strip()
        for key in cls._GRADE_KEYS:
            if data.get(key) is None:
                continue
            try:
                return PeruvianGradingScaler.to_qualitative(float(data[key]))
            except (TypeError, ValueError):
                continue
        return None

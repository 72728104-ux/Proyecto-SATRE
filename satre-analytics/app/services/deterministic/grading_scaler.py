"""Conversor bidireccional de la escala oficial MINEDU (TOBE-4).

La capa matemática opera en vigesimal 0–20; prompts y dashboards exponen
únicamente las etiquetas cualitativas C, B, A, AD.
"""
from __future__ import annotations

from typing import Final


class PeruvianGradingScaler:
    """Convierte C/B/A/AD ↔ vigesimal para el motor determinista interno."""

    QUALITATIVE_TO_NUMERIC: Final[dict[str, float]] = {
        "C": 5.0,     # 0.00–10.99  En Inicio
        "B": 12.5,    # 11.00–14.99 En Proceso
        "A": 16.0,    # 15.00–17.99 Logro Esperado
        "AD": 19.0,   # 18.00–20.00 Logro Destacado
    }

    AD_MIN: Final[float] = 18.0
    A_MIN: Final[float] = 15.0
    B_MIN: Final[float] = 11.0

    @classmethod
    def to_numeric(cls, grade: str) -> float:
        """Etiqueta cualitativa → representante central vigesimal.

        Códigos desconocidos se tratan como C (En Inicio).
        """
        if grade is None:
            return cls.QUALITATIVE_TO_NUMERIC["C"]
        key = str(grade).upper().strip()
        return cls.QUALITATIVE_TO_NUMERIC.get(key, cls.QUALITATIVE_TO_NUMERIC["C"])

    @classmethod
    def to_qualitative(cls, numeric_grade: float) -> str:
        """Vigesimal 0–20 → etiqueta oficial MINEDU (TOBE-4).

        Rangos (inclusivos en el piso de cada banda):
        18.00–20.00 AD · 15.00–17.99 A · 11.00–14.99 B · 0.00–10.99 C
        """
        try:
            value = float(numeric_grade)
        except (TypeError, ValueError):
            return "C"
        if value >= cls.AD_MIN:
            return "AD"
        if value >= cls.A_MIN:
            return "A"
        if value >= cls.B_MIN:
            return "B"
        return "C"

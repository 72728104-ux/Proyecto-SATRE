"""Módulo matemático determinista (escala MINEDU, riesgo, tendencia)."""

from app.services.deterministic.grading_scaler import PeruvianGradingScaler
from app.services.deterministic.risk_engine import calculate_student_risk

__all__ = ["PeruvianGradingScaler", "calculate_student_risk"]

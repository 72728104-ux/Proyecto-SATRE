"""Scoring de riesgo determinista y explicable (§5.3). Funciones puras sobre una fila de features."""
from __future__ import annotations

import math
from typing import Any, Mapping

from app import config


def _missing(value: Any) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def components(features: Mapping[str, Any]) -> dict[str, tuple[float, float]]:
    """Componentes disponibles: key -> (valor crudo, componente normalizado 0–1).

    Una fuente sin datos no aparece (se excluye y se renormalizan los pesos).
    Sin notas no hay 'grade_level': un promedio 0.0 inexistente nunca cuenta como riesgo.
    """
    result: dict[str, tuple[float, float]] = {}

    if int(features.get("attendance_count") or 0) > 0:
        unexcused = float(features.get("unexcused_rate") or 0.0)
        tardiness = float(features.get("tardiness_rate") or 0.0)
        result["unexcused_absence"] = (unexcused, min(unexcused / config.UNEXCUSED_RATE_CAP, 1.0))
        result["tardiness"] = (tardiness, min(tardiness / config.TARDINESS_RATE_CAP, 1.0))

    grade_mean = features.get("grade_mean")
    if int(features.get("grade_count") or 0) > 0 and not _missing(grade_mean):
        grade_mean = float(grade_mean)
        result["grade_level"] = (
            grade_mean,
            _clamp((config.GRADE_REFERENCE - grade_mean) / config.GRADE_SPAN),
        )

    slope, r2 = features.get("grade_slope"), features.get("grade_r2")
    if int(features.get("grade_n") or 0) >= config.TREND_MIN_POINTS and not _missing(slope):
        slope = float(slope)
        significant = not _missing(r2) and float(r2) >= config.TREND_MIN_R2
        result["grade_trend"] = (slope, _clamp(-slope / config.TREND_SLOPE_CAP) if significant else 0.0)

    weighted = float(features.get("incident_weighted_30d") or 0.0)
    result["incidents"] = (weighted, min(weighted / config.INCIDENT_WEIGHTED_CAP, 1.0))

    night_rate = features.get("night_presence_rate")
    is_boarder = features.get("is_boarder", True)
    if (is_boarder is None or bool(is_boarder)) and int(features.get("night_count") or 0) > 0 \
            and not _missing(night_rate):
        night_rate = float(night_rate)
        result["night_presence"] = (night_rate, min((1.0 - night_rate) / config.NIGHT_ABSENCE_CAP, 1.0))

    return result


def level_for(score: float) -> str:
    if score >= config.LEVEL_ALTO_MIN:
        return "ALTO"
    if score >= config.LEVEL_MEDIO_MIN:
        return "MEDIO"
    return "BAJO"


def is_insufficient(features: Mapping[str, Any]) -> bool:
    return (
        int(features.get("attendance_count") or 0) < config.MIN_ATTENDANCE_RECORDS
        and int(features.get("grade_count") or 0) < config.MIN_GRADES
    )


def score_student(features: Mapping[str, Any]) -> dict[str, Any]:
    """Devuelve la parte del contrato §5.4 que depende solo de las features."""
    needs_review = bool(features.get("severe_wellbeing_7d", False))
    available = components(features)
    coverage = round(sum(config.WEIGHTS[key] for key in available), 2)

    if is_insufficient(features):
        recommendation = config.RECOMMENDATIONS["INSUFFICIENT"]
        if needs_review:
            recommendation = config.RECOMMENDATIONS["HUMAN_REVIEW"] + recommendation
        return {
            "insufficient_data": True,
            "data_coverage": coverage,
            "risk_level": "ALTO" if needs_review else None,
            "risk_score": None,
            "factors": [],
            "recommendation": recommendation,
            "needs_human_review": needs_review,
        }

    total_weight = sum(config.WEIGHTS[key] for key in available)
    factors = []
    score = 0.0
    for key, (value, component) in available.items():
        contribution = 100.0 * (config.WEIGHTS[key] / total_weight) * component
        score += contribution
        factors.append({
            "key": key,
            "label": config.FACTOR_LABELS[key],
            "value": round(value, 3),
            "contribution": round(contribution, 1),
        })
    factors.sort(key=lambda f: f["contribution"], reverse=True)

    score = round(score, 1)
    level = level_for(score)
    if needs_review:
        level = "ALTO"

    top_label = factors[0]["label"] if factors and factors[0]["contribution"] > 0 else "sin factor dominante"
    recommendation = config.RECOMMENDATIONS[level].format(factor=top_label)
    if needs_review:
        recommendation = config.RECOMMENDATIONS["HUMAN_REVIEW"] + recommendation

    return {
        "insufficient_data": False,
        "data_coverage": coverage,
        "risk_level": level,
        "risk_score": score,
        "factors": factors,
        "recommendation": recommendation,
        "needs_human_review": needs_review,
    }

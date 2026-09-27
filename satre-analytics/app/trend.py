"""Tendencia de notas: regresión lineal sobre notas ordenadas por evaluation_date."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd
from scipy.stats import linregress

from app import config


@dataclass(frozen=True)
class TrendResult:
    slope: float | None   # puntos IB por TREND_SLOPE_UNIT_DAYS días
    r2: float | None
    n: int

    @property
    def computed(self) -> bool:
        return self.slope is not None

    @property
    def reliable(self) -> bool:
        return self.computed and self.r2 is not None and self.r2 >= config.TREND_MIN_R2


def compute_trend(dates: Iterable, scores: Iterable) -> TrendResult:
    """Devuelve pendiente, R² y n. Con n < TREND_MIN_POINTS o fechas sin varianza, slope/r2 = None."""
    frame = pd.DataFrame({"date": pd.to_datetime(pd.Series(list(dates)), errors="coerce"),
                          "score": pd.to_numeric(pd.Series(list(scores)), errors="coerce")})
    frame = frame.dropna().sort_values("date")
    n = int(len(frame))
    if n < config.TREND_MIN_POINTS:
        return TrendResult(slope=None, r2=None, n=n)

    x = (frame["date"] - frame["date"].iloc[0]).dt.days.to_numpy(dtype=float) / config.TREND_SLOPE_UNIT_DAYS
    y = frame["score"].to_numpy(dtype=float)
    if np.ptp(x) == 0:
        return TrendResult(slope=None, r2=None, n=n)

    if np.ptp(y) == 0:
        return TrendResult(slope=0.0, r2=0.0, n=n)

    result = linregress(x, y)
    return TrendResult(slope=float(result.slope), r2=float(result.rvalue ** 2), n=n)

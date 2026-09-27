from datetime import date, timedelta

import pytest

from app.trend import compute_trend

START = date(2026, 3, 1)


def dates(n, step=30):
    return [START + timedelta(days=step * i) for i in range(n)]


@pytest.mark.parametrize("n", [0, 1, 2, 3])
def test_fewer_than_4_points_returns_no_slope(n):
    result = compute_trend(dates(n), [5] * n)
    assert result.n == n
    assert result.slope is None
    assert result.r2 is None
    assert result.reliable is False


def test_perfect_decline_per_30_days():
    result = compute_trend(dates(4), [7, 6, 5, 4])
    assert result.n == 4
    assert result.slope == pytest.approx(-1.0)
    assert result.r2 == pytest.approx(1.0)
    assert result.reliable is True


def test_unordered_input_is_sorted_by_date():
    ds = dates(4)
    result = compute_trend([ds[3], ds[0], ds[2], ds[1]], [4, 7, 5, 6])
    assert result.slope == pytest.approx(-1.0)


def test_nulls_are_dropped_before_counting():
    result = compute_trend(dates(5) + [None], [7, 6, None, 4, 3, 5])
    assert result.n == 4


def test_same_date_has_no_slope():
    result = compute_trend([START] * 4, [4, 5, 6, 7])
    assert result.slope is None


def test_flat_scores_have_zero_slope():
    result = compute_trend(dates(4), [5, 5, 5, 5])
    assert result.slope == 0.0
    assert result.reliable is False

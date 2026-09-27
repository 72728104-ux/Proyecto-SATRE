"""Insights docente (§5.5): brechas por criterio IB A–D por aula y curso + metodologías."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app import config
from app.features import to_ib_scale

CATALOG_PATH = Path(__file__).parent / "catalog" / "methodologies.json"


@lru_cache
def load_methodologies() -> list[dict[str, Any]]:
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)["methodologies"]


def recommend_methodologies(criterion: str, pct_below: float, catalog: list[dict] | None = None) -> list[dict]:
    catalog = load_methodologies() if catalog is None else catalog
    matches = [
        m for m in catalog
        if criterion in m.get("criteria", []) and pct_below >= float(m.get("min_pct_below", 0))
    ]
    matches.sort(key=lambda m: (len(m.get("criteria", [])), -float(m.get("min_pct_below", 0))))
    return [
        {"id": m["id"], "name": m["name"], "description": m["description"]}
        for m in matches[: config.INSIGHTS_METHODOLOGIES_PER_GAP]
    ]


def build_insights(grades: pd.DataFrame) -> dict[str, Any]:
    """grades: student_id, course_id, course_code, course_name, criterion, score, max_score."""
    empty = {"insufficient_data": True, "courses": [], "top_gaps": [], "error_matrix": []}
    if grades.empty:
        return empty

    df = grades.copy()
    df["criterion"] = df["criterion"].fillna("").astype(str).str.upper().str.strip()
    df = df[df["criterion"].isin(config.IB_CRITERIA)]
    df["ib"] = to_ib_scale(df["score"], df["max_score"])
    df = df.dropna(subset=["ib", "student_id", "course_id"])
    if len(df) < config.INSIGHTS_MIN_GRADES:
        return empty

    per_student = (
        df.groupby(["course_id", "course_code", "course_name", "criterion", "student_id"], dropna=False)["ib"]
        .mean()
        .reset_index(name="student_mean")
    )
    per_student["below"] = per_student["student_mean"] < config.IB_PASSING_SCORE

    summary = (
        per_student.groupby(["course_id", "course_code", "course_name", "criterion"], dropna=False)
        .agg(mean=("student_mean", "mean"), pct_below_4=("below", "mean"), students=("student_id", "nunique"))
        .reset_index()
    )

    courses = []
    for (course_id, code, name), group in summary.groupby(["course_id", "course_code", "course_name"], dropna=False):
        courses.append({
            "course_id": int(course_id),
            "course_code": None if pd.isna(code) else str(code),
            "course_name": None if pd.isna(name) else str(name),
            "criteria": [
                {
                    "criterion": row.criterion,
                    "mean": round(float(row.mean), 2),
                    "pct_below_4": round(float(row.pct_below_4), 2),
                    "students": int(row.students),
                }
                for row in group.sort_values("criterion").itertuples()
            ],
        })

    gaps = summary[summary["pct_below_4"] > 0].sort_values(["pct_below_4", "mean"], ascending=[False, True])
    top_gaps = [
        {
            "course_id": int(row.course_id),
            "criterion": row.criterion,
            "mean": round(float(row.mean), 2),
            "pct_below_4": round(float(row.pct_below_4), 2),
            "methodologies": recommend_methodologies(row.criterion, float(row.pct_below_4)),
        }
        for row in gaps.head(config.INSIGHTS_TOP_GAPS).itertuples()
    ]

    error_matrix = []
    for course_id, group in per_student.groupby("course_id"):
        pivot = group.pivot_table(index="student_id", columns="criterion", values="student_mean", aggfunc="mean")
        rows = []
        for student_id, values in pivot.iterrows():
            row = {"student_id": int(student_id)}
            for criterion in config.IB_CRITERIA:
                value = values.get(criterion)
                row[criterion] = None if value is None or pd.isna(value) else round(float(value), 2)
            rows.append(row)
        error_matrix.append({"course_id": int(course_id), "criteria": list(config.IB_CRITERIA), "rows": rows})

    return {"insufficient_data": False, "courses": courses, "top_gaps": top_gaps, "error_matrix": error_matrix}

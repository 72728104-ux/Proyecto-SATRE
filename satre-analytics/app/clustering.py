"""Perfiles por KMeans (§5.5). Solo con ≥ CLUSTER_MIN_STUDENTS estudiantes con datos."""
from __future__ import annotations

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app import config

LABEL_STABLE = "estable"
LABEL_ATTENDANCE = "asistencia_irregular"
LABEL_ACADEMIC = "rendimiento_bajo"


def _label_centroids(centroids: pd.DataFrame) -> dict[int, str]:
    """Etiqueta por inspección de centroides estandarizados.

    El centroide con menor carga de riesgo es 'estable'; de los otros dos, el más cargado en
    asistencia/tardanzas es 'asistencia_irregular' y el restante 'rendimiento_bajo'.
    """
    attendance_load = centroids["unexcused_rate"] + centroids["tardiness_rate"]
    academic_load = -centroids["grade_mean"]
    total_load = attendance_load + academic_load + centroids["incident_weighted_30d"]

    stable = int(total_load.idxmin())
    remaining = [c for c in centroids.index if c != stable]
    bias = (attendance_load - academic_load).loc[remaining]
    attendance = int(bias.idxmax())
    labels = {stable: LABEL_STABLE, attendance: LABEL_ATTENDANCE}
    for cluster in remaining:
        labels.setdefault(int(cluster), LABEL_ACADEMIC)
    return labels


def assign_profiles(features: pd.DataFrame) -> dict[int, str | None]:
    """student_id -> etiqueta de perfil. Sin datos suficientes, todos quedan en None."""
    if features.empty:
        return {}
    profiles: dict[int, str | None] = {int(sid): None for sid in features["student_id"]}

    usable = features[(features["attendance_count"] > 0) & (features["grade_count"] > 0)]
    usable = usable.dropna(subset=list(config.CLUSTER_FEATURES))
    if len(usable) < config.CLUSTER_MIN_STUDENTS:
        return profiles

    matrix = usable[list(config.CLUSTER_FEATURES)].astype(float)
    if (matrix.std(ddof=0) == 0).all():
        return profiles

    scaled = StandardScaler().fit_transform(matrix)
    model = KMeans(n_clusters=config.CLUSTER_K, n_init=10, random_state=config.CLUSTER_RANDOM_STATE)
    assignments = model.fit_predict(scaled)
    centroids = pd.DataFrame(model.cluster_centers_, columns=list(config.CLUSTER_FEATURES))
    labels = _label_centroids(centroids)

    for student_id, cluster in zip(usable["student_id"], assignments):
        profiles[int(student_id)] = labels[int(cluster)]
    return profiles

"""DBSCAN Spatial & Behavioral Clusterer — Phase 13

Performs spatial and spatio-temporal clustering on check-in cohorts.
Detects isolated outlier check-ins (noise points, label == -1) where cohort data supports clustering.
"""

import numpy as np
from sklearn.cluster import DBSCAN

from app.ml.config import DBSCAN_EPS, DBSCAN_MIN_SAMPLES, MIN_SAMPLES_DBSCAN
from app.ml.schemas import DBSCANResult


class DBSCANClusterer:
    def __init__(
        self,
        eps: float = DBSCAN_EPS,
        min_samples: int = DBSCAN_MIN_SAMPLES,
    ):
        self.eps = eps
        self.min_samples = min_samples

    def cluster_spatial_points(
        self,
        points: list[tuple[float, float]],
        target_index: int,
    ) -> DBSCANResult:
        """Clusters GPS points (latitude, longitude) of a session check-in cohort.

        Identifies whether target_index is a noise outlier (isolated from class cluster).
        """
        if len(points) < MIN_SAMPLES_DBSCAN:
            return DBSCANResult(
                is_noise=False,
                cluster_label=-1,
                explanation="Insufficient cohort samples for spatial DBSCAN clustering.",
                status="insufficient_data",
            )

        if target_index < 0 or target_index >= len(points):
            return DBSCANResult(
                is_noise=False,
                cluster_label=-1,
                explanation="Target index out of range.",
                status="insufficient_data",
            )

        # Convert lat/lng to radians for Haversine distance
        coords_rad = np.radians(np.array(points))

        # 6371.0088 is Earth radius in km; eps in km / 6371.0088
        eps_rad = self.eps / 6371.0088

        db = DBSCAN(eps=eps_rad, min_samples=self.min_samples, metric="haversine")
        labels = db.fit_predict(coords_rad)

        target_label = int(labels[target_index])
        is_noise = target_label == -1

        explanation: str | None = None
        if is_noise:
            explanation = "Check-in GPS location belongs to an isolated outlier cluster relative to class cohort."

        return DBSCANResult(
            is_noise=is_noise,
            cluster_label=target_label,
            explanation=explanation,
            status="success",
        )

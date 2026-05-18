"""Cosine-similarity clustering using agglomerative with a similarity threshold."""

from __future__ import annotations

import logging

import numpy as np
from sklearn.cluster import AgglomerativeClustering

from .config import DEDUPE_SIMILARITY_THRESHOLD
from .models import Article, Cluster

log = logging.getLogger(__name__)


def _cluster_labels(
    embeddings: np.ndarray, similarity_threshold: float
) -> list[int]:
    n = embeddings.shape[0]
    if n == 0:
        return []
    if n == 1:
        return [0]

    distance_threshold = 1.0 - similarity_threshold
    model = AgglomerativeClustering(
        n_clusters=None,
        metric="cosine",
        linkage="average",
        distance_threshold=distance_threshold,
    )
    labels = model.fit_predict(embeddings)
    return [int(x) for x in labels]


def cluster_articles(
    articles: list[Article],
    embeddings: np.ndarray,
    similarity_threshold: float = DEDUPE_SIMILARITY_THRESHOLD,
) -> list[Cluster]:
    """Group articles by cosine similarity. Embeddings must align with articles."""
    if len(articles) != embeddings.shape[0]:
        raise ValueError(
            f"articles ({len(articles)}) and embeddings "
            f"({embeddings.shape[0]}) length mismatch"
        )

    labels = _cluster_labels(embeddings, similarity_threshold)
    buckets: dict[int, list[Article]] = {}
    for label, article in zip(labels, articles):
        buckets.setdefault(label, []).append(article)

    clusters: list[Cluster] = []
    for members in buckets.values():
        members.sort(key=lambda a: a.published_at, reverse=True)
        unique_sources = {a.source for a in members}
        clusters.append(
            Cluster(
                id=Cluster.make_id(members),
                headline=members[0].title,
                briefing="",
                tags=[],
                source_count=len(unique_sources),
                articles=members,
            )
        )

    clusters.sort(key=lambda c: (c.source_count, len(c.articles)), reverse=True)
    log.info("dedupe: %d articles → %d clusters", len(articles), len(clusters))
    return clusters

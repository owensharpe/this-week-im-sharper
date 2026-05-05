from datetime import datetime, timezone

import numpy as np

from sharper_pipeline.dedupe import cluster_articles
from sharper_pipeline.models import Article


def _article(url: str, title: str, source: str) -> Article:
    return Article(
        id=Article.make_id(url),
        title=title,
        description="desc",
        url=url,
        source=source,
        published_at=datetime.now(timezone.utc),
        fetched_from="rss",
    )


def _unit(vec: list[float]) -> np.ndarray:
    arr = np.array(vec, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    return arr / norm if norm else arr


def test_similar_articles_merge_into_one_cluster():
    a = _article("https://reuters.com/a", "Fed holds rates", "Reuters")
    b = _article("https://ft.com/a", "Federal Reserve keeps rates unchanged", "FT")
    c = _article("https://wsj.com/a", "FOMC leaves rates flat", "WSJ")

    embeddings = np.stack(
        [
            _unit([1.0, 0.02, 0.0]),
            _unit([0.99, 0.05, 0.01]),
            _unit([0.98, 0.03, 0.02]),
        ]
    )

    clusters = cluster_articles([a, b, c], embeddings, similarity_threshold=0.78)
    assert len(clusters) == 1
    assert clusters[0].source_count == 3
    assert {x.id for x in clusters[0].articles} == {a.id, b.id, c.id}


def test_dissimilar_articles_stay_separate():
    a = _article("https://reuters.com/a", "Fed holds rates", "Reuters")
    b = _article("https://ft.com/b", "Bitcoin tops $100k", "FT")
    c = _article("https://wsj.com/c", "Oil falls on demand fears", "WSJ")

    embeddings = np.stack(
        [
            _unit([1.0, 0.0, 0.0]),
            _unit([0.0, 1.0, 0.0]),
            _unit([0.0, 0.0, 1.0]),
        ]
    )

    clusters = cluster_articles([a, b, c], embeddings, similarity_threshold=0.78)
    assert len(clusters) == 3
    assert all(c.source_count == 1 for c in clusters)


def test_partial_overlap_creates_two_clusters():
    a = _article("https://reuters.com/a", "Fed holds rates", "Reuters")
    b = _article("https://ft.com/b", "Federal Reserve unchanged", "FT")
    c = _article("https://wsj.com/c", "Bitcoin breaks 100k", "WSJ")
    d = _article("https://bloomberg.com/d", "BTC surges past 100,000", "Bloomberg")

    embeddings = np.stack(
        [
            _unit([1.0, 0.0]),
            _unit([0.99, 0.05]),
            _unit([0.0, 1.0]),
            _unit([0.05, 0.99]),
        ]
    )

    clusters = cluster_articles([a, b, c, d], embeddings, similarity_threshold=0.78)
    assert len(clusters) == 2
    sizes = sorted(len(c.articles) for c in clusters)
    assert sizes == [2, 2]


def test_empty_input_returns_empty():
    clusters = cluster_articles([], np.zeros((0, 3), dtype=np.float32))
    assert clusters == []


def test_length_mismatch_raises():
    a = _article("https://reuters.com/a", "Fed holds rates", "Reuters")
    try:
        cluster_articles([a], np.zeros((2, 3), dtype=np.float32))
    except ValueError:
        return
    raise AssertionError("expected ValueError on length mismatch")

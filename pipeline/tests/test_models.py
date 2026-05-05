import json
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from sharper_pipeline.models import Article, Cluster, DailyDigest


def _article(url: str = "https://reuters.com/a") -> Article:
    return Article(
        id=Article.make_id(url),
        title="Fed holds rates",
        description="The FOMC kept rates unchanged.",
        url=url,
        source="Reuters",
        published_at=datetime(2026, 5, 5, 12, 0, tzinfo=timezone.utc),
        fetched_from="rss",
    )


def test_article_id_is_deterministic():
    url = "https://reuters.com/x"
    assert Article.make_id(url) == Article.make_id(url)
    assert Article.make_id(url) != Article.make_id(url + "?utm=1")


def test_article_rejects_bad_url():
    with pytest.raises(ValidationError):
        Article(
            id="x",
            title="t",
            description="d",
            url="not-a-url",
            source="s",
            published_at=datetime.now(timezone.utc),
            fetched_from="rss",
        )


def test_cluster_make_id_is_order_independent():
    a = _article("https://reuters.com/a")
    b = _article("https://ft.com/b")
    assert Cluster.make_id([a, b]) == Cluster.make_id([b, a])


def test_daily_digest_round_trip_json():
    a = _article()
    cluster = Cluster(
        id=Cluster.make_id([a]),
        headline=a.title,
        briefing="- " + a.title,
        tags=[],
        source_count=1,
        articles=[a],
    )
    digest = DailyDigest(
        date="2026-05-05",
        clusters=[cluster],
        article_count=1,
        source_count=1,
    )

    payload = digest.model_dump_json()
    parsed = json.loads(payload)
    assert parsed["date"] == "2026-05-05"
    assert parsed["clusters"][0]["source_count"] == 1
    assert parsed["clusters"][0]["articles"][0]["fetched_from"] == "rss"

    rebuilt = DailyDigest.model_validate_json(payload)
    assert rebuilt.article_count == 1
    assert rebuilt.clusters[0].articles[0].id == a.id


def test_daily_digest_default_generated_at_is_utc():
    digest = DailyDigest(
        date="2026-05-05",
        clusters=[],
        article_count=0,
        source_count=0,
    )
    assert digest.generated_at.tzinfo is not None

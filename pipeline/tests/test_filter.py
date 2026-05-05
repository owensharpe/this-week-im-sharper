from datetime import datetime, timezone

from sharper_pipeline.filter import filter_articles, is_valid
from sharper_pipeline.models import Article


def _article(
    url: str = "https://reuters.com/markets/example",
    title: str = "Fed holds rates steady",
    description: str = "The FOMC kept the target range unchanged.",
    source: str = "Reuters",
) -> Article:
    return Article(
        id=Article.make_id(url),
        title=title,
        description=description,
        url=url,
        source=source,
        published_at=datetime.now(timezone.utc),
        fetched_from="rss",
    )


def test_valid_article_passes():
    assert is_valid(_article()) is True


def test_clickbait_title_dropped():
    bad = _article(title="You won't believe what the Fed did next")
    assert is_valid(bad) is False


def test_empty_description_dropped():
    bad = _article(description="")
    assert is_valid(bad) is False


def test_content_farm_domain_dropped():
    bad = _article(url="https://buzzfeed.com/finance/best-stocks")
    assert is_valid(bad) is False


def test_filter_articles_removes_duplicate_urls():
    a = _article()
    b = _article()
    c = _article(url="https://ft.com/markets/other", title="Different story")
    kept = filter_articles([a, b, c])
    assert len(kept) == 2
    assert {str(x.url) for x in kept} == {str(a.url), str(c.url)}


def test_filter_articles_drops_hygiene_failures():
    good = _article()
    clickbait = _article(
        url="https://reuters.com/x", title="This one weird trick the Fed uses"
    )
    no_desc = _article(url="https://reuters.com/y", description="")
    kept = filter_articles([good, clickbait, no_desc])
    assert len(kept) == 1
    assert kept[0].id == good.id

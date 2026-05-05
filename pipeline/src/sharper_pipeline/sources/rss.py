"""RSS connector — iterates the feeds in config and warns on empty feeds."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from time import mktime

import feedparser

from ..config import RSS_FEEDS, USER_AGENT
from ..models import Article

log = logging.getLogger(__name__)


def _parse_struct_time(struct_time) -> datetime:
    if struct_time is None:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromtimestamp(mktime(struct_time), tz=timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return datetime.now(timezone.utc)


def _to_article(entry, source_name: str) -> Article | None:
    url = (getattr(entry, "link", "") or "").strip()
    title = (getattr(entry, "title", "") or "").strip()
    if not url or not title:
        return None

    description = (
        getattr(entry, "summary", None)
        or getattr(entry, "description", None)
        or ""
    ).strip()

    published = (
        getattr(entry, "published_parsed", None)
        or getattr(entry, "updated_parsed", None)
    )

    return Article(
        id=Article.make_id(url),
        title=title,
        description=description,
        url=url,
        source=source_name,
        published_at=_parse_struct_time(published),
        fetched_from="rss",
    )


def fetch() -> list[Article]:
    out: list[Article] = []

    for source_name, url in RSS_FEEDS:
        try:
            parsed = feedparser.parse(url, agent=USER_AGENT)
        except Exception as exc:
            log.warning("RSS %s failed to parse: %s", source_name, exc)
            continue

        if getattr(parsed, "bozo", False) and not parsed.entries:
            log.warning(
                "RSS %s parse error: %s",
                source_name,
                getattr(parsed, "bozo_exception", "unknown"),
            )
            continue

        if not parsed.entries:
            log.warning("RSS %s returned 0 entries", source_name)
            continue

        before = len(out)
        for entry in parsed.entries:
            article = _to_article(entry, source_name)
            if article is not None:
                out.append(article)
        log.info("RSS %s: %d articles", source_name, len(out) - before)

    return out

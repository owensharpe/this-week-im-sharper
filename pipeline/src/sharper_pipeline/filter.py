"""Hygiene filter — drops clickbait, content-farm, duplicate, or empty articles."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

from .config import CLICKBAIT_PATTERNS, CONTENT_FARM_DOMAINS
from .models import Article

log = logging.getLogger(__name__)


def _domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def _is_clickbait(title: str) -> bool:
    lower = title.lower()
    return any(p in lower for p in CLICKBAIT_PATTERNS)


def is_valid(article: Article) -> bool:
    """A single article passes hygiene checks."""
    if not article.title or not article.title.strip():
        return False
    if not article.description or not article.description.strip():
        return False
    if _is_clickbait(article.title):
        return False
    if _domain(str(article.url)) in CONTENT_FARM_DOMAINS:
        return False
    return True


def filter_articles(articles: list[Article]) -> list[Article]:
    """Apply hygiene rules + de-duplicate by URL."""
    seen: set[str] = set()
    out: list[Article] = []
    dropped_dup = 0
    dropped_hygiene = 0

    for article in articles:
        url = str(article.url)
        if url in seen:
            dropped_dup += 1
            continue
        if not is_valid(article):
            dropped_hygiene += 1
            continue
        seen.add(url)
        out.append(article)

    log.info(
        "filter: kept %d, dropped %d hygiene, %d duplicate-url",
        len(out),
        dropped_hygiene,
        dropped_dup,
    )
    return out

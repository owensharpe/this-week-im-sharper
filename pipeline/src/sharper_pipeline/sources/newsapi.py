"""NewsAPI connector — business headlines + finance/macro/geopolitics queries."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import requests

from ..config import NEWSAPI_KEY, NEWSAPI_QUERIES, REQUEST_TIMEOUT, USER_AGENT
from ..models import Article

log = logging.getLogger(__name__)


_BASE = "https://newsapi.org/v2"


def _endpoint_for(query_kind: str) -> str:
    if query_kind.startswith("top-headlines"):
        return f"{_BASE}/top-headlines"
    return f"{_BASE}/everything"


def _parse_published(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


def _to_article(item: dict) -> Article | None:
    url = (item.get("url") or "").strip()
    title = (item.get("title") or "").strip()
    if not url or not title or title == "[Removed]":
        return None
    source_name = (item.get("source") or {}).get("name") or "NewsAPI"
    return Article(
        id=Article.make_id(url),
        title=title,
        description=(item.get("description") or "").strip(),
        url=url,
        source=source_name,
        published_at=_parse_published(item.get("publishedAt")),
        fetched_from="newsapi",
    )


def fetch() -> list[Article]:
    if not NEWSAPI_KEY:
        log.warning("NEWSAPI_KEY not set; skipping NewsAPI source.")
        return []

    headers = {"X-Api-Key": NEWSAPI_KEY, "User-Agent": USER_AGENT}
    out: list[Article] = []

    for kind, params in NEWSAPI_QUERIES:
        url = _endpoint_for(kind)
        try:
            resp = requests.get(
                url, params=params, headers=headers, timeout=REQUEST_TIMEOUT
            )
            resp.raise_for_status()
            payload = resp.json()
        except requests.RequestException as exc:
            log.warning("NewsAPI %s failed: %s", kind, exc)
            continue

        if payload.get("status") != "ok":
            log.warning(
                "NewsAPI %s returned non-ok status: %s", kind, payload.get("message")
            )
            continue

        items = payload.get("articles") or []
        before = len(out)
        for item in items:
            article = _to_article(item)
            if article is not None:
                out.append(article)
        log.info("NewsAPI %s: %d articles", kind, len(out) - before)

    return out

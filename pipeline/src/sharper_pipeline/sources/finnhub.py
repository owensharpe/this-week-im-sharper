"""Finnhub connector — market-news endpoint."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import requests

from ..config import FINNHUB_KEY, REQUEST_TIMEOUT, USER_AGENT
from ..models import Article

log = logging.getLogger(__name__)


_URL = "https://finnhub.io/api/v1/news"


def _to_article(item: dict) -> Article | None:
    url = (item.get("url") or "").strip()
    title = (item.get("headline") or "").strip()
    if not url or not title:
        return None

    ts = item.get("datetime")
    if isinstance(ts, (int, float)) and ts > 0:
        published = datetime.fromtimestamp(ts, tz=timezone.utc)
    else:
        published = datetime.now(timezone.utc)

    return Article(
        id=Article.make_id(url),
        title=title,
        description=(item.get("summary") or "").strip(),
        url=url,
        source=item.get("source") or "Finnhub",
        published_at=published,
        fetched_from="finnhub",
    )


def fetch() -> list[Article]:
    if not FINNHUB_KEY:
        log.warning("FINNHUB_KEY not set; skipping Finnhub source.")
        return []

    headers = {"X-Finnhub-Token": FINNHUB_KEY, "User-Agent": USER_AGENT}
    out: list[Article] = []

    for category in ("general", "forex", "merger"):
        try:
            resp = requests.get(
                _URL,
                params={"category": category},
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            payload = resp.json()
        except requests.RequestException as exc:
            log.warning("Finnhub %s failed: %s", category, exc)
            continue

        if not isinstance(payload, list):
            log.warning("Finnhub %s unexpected payload shape", category)
            continue

        before = len(out)
        for item in payload:
            article = _to_article(item)
            if article is not None:
                out.append(article)
        log.info("Finnhub %s: %d articles", category, len(out) - before)

    return out

"""Weekly rollup: merges last 7 daily digests, re-clusters, writes weekly-latest.json."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .config import DIGESTS_DIR
from .dedupe import cluster_articles
from .describe import describe_all
from .embed import embed_articles
from .models import Article, DailyDigest
from .output import write_weekly

log = logging.getLogger(__name__)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )


def _load_recent_articles(days: int = 7) -> list[Article]:
    today = datetime.now(timezone.utc).date()
    seen_urls: set[str] = set()
    articles: list[Article] = []

    for i in range(days):
        day = today - timedelta(days=i)
        path: Path = DIGESTS_DIR / f"{day.isoformat()}.json"
        if not path.exists():
            log.info("rollup: no digest for %s, skipping", day)
            continue

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("rollup: failed to read %s: %s", path, exc)
            continue

        for cluster in payload.get("clusters") or []:
            for art in cluster.get("articles") or []:
                url = art.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                try:
                    articles.append(Article(**art))
                except Exception as exc:
                    log.warning("rollup: invalid article in %s: %s", path, exc)

    log.info("rollup: loaded %d unique articles from last %d days", len(articles), days)
    return articles


def run() -> DailyDigest:
    articles = _load_recent_articles(days=7)

    if not articles:
        digest = DailyDigest(
            date=datetime.now(timezone.utc).date().isoformat(),
            clusters=[],
            article_count=0,
            source_count=0,
            notes="No daily digests in the last 7 days.",
        )
        write_weekly(digest)
        return digest

    embeddings = embed_articles(articles)
    clusters = cluster_articles(articles, embeddings)
    clusters = describe_all(clusters)

    digest = DailyDigest(
        date=datetime.now(timezone.utc).date().isoformat(),
        clusters=clusters,
        article_count=len(articles),
        source_count=len({a.source for a in articles}),
        notes="Weekly rollup over the last 7 daily digests.",
    )
    write_weekly(digest)
    return digest


def main() -> None:
    _setup_logging()
    run()


if __name__ == "__main__":
    main()

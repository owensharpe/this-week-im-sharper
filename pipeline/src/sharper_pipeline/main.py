"""Daily entry point: fetch → filter → embed → cluster → describe → write."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from .dedupe import cluster_articles
from .describe import describe_all
from .embed import embed_articles
from .filter import filter_articles
from .models import DailyDigest
from .output import write_daily
from .sources import finnhub, newsapi, rss

log = logging.getLogger(__name__)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )


def run() -> DailyDigest:
    raw: list = []
    raw.extend(newsapi.fetch())
    raw.extend(rss.fetch())
    raw.extend(finnhub.fetch())
    log.info("fetched %d raw articles across all sources", len(raw))

    articles = filter_articles(raw)
    if not articles:
        log.warning("no articles after filtering; writing empty digest")
        digest = DailyDigest(
            date=datetime.now(timezone.utc).date().isoformat(),
            clusters=[],
            article_count=0,
            source_count=0,
            notes="No articles passed hygiene filters today.",
        )
        write_daily(digest)
        return digest

    embeddings = embed_articles(articles)
    clusters = cluster_articles(articles, embeddings)
    clusters = describe_all(clusters)

    digest = DailyDigest(
        date=datetime.now(timezone.utc).date().isoformat(),
        clusters=clusters,
        article_count=len(articles),
        source_count=len({a.source for a in articles}),
    )
    write_daily(digest)
    return digest


def main() -> None:
    _setup_logging()
    run()


if __name__ == "__main__":
    main()

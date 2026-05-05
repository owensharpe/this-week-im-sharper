"""Source connectors. Each module exposes a `fetch()` returning list[Article]."""

from . import finnhub, newsapi, rss

__all__ = ["finnhub", "newsapi", "rss"]

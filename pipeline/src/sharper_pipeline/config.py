"""Pipeline configuration — sources, env keys, taxonomy, filter rules."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


PACKAGE_ROOT = Path(__file__).resolve().parent
PIPELINE_ROOT = PACKAGE_ROOT.parent.parent
REPO_ROOT = PIPELINE_ROOT.parent

DIGESTS_DIR = Path(
    os.environ.get("DIGESTS_DIR", REPO_ROOT / "content" / "digests")
).resolve()

NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "").strip()
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "").strip()

USER_AGENT = (
    "this-week-im-sharper-pipeline/0.1 "
    "(+https://github.com/owensharpe/this-week-im-sharper)"
)

REQUEST_TIMEOUT = 20

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
# 0.60 cosine: same-story headlines on all-MiniLM-L6-v2 land in the 0.55-0.75
# band; tighter than that leaves near-duplicates in their own clusters.
DEDUPE_SIMILARITY_THRESHOLD = 0.60


RSS_FEEDS: list[tuple[str, str]] = [
    ("CNBC Top News", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069"),
    ("MarketWatch Top Stories", "http://feeds.marketwatch.com/marketwatch/topstories/"),
    ("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss"),
    ("FT Markets", "https://www.ft.com/markets?format=rss"),
    ("Marginal Revolution", "https://marginalrevolution.com/feed"),
    ("Calculated Risk", "https://www.calculatedriskblog.com/feeds/posts/default"),
    ("Abnormal Returns", "https://abnormalreturns.com/feed/"),
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("ECB Press", "https://www.ecb.europa.eu/rss/press.html"),
    ("Bank of England", "https://www.bankofengland.co.uk/rss/news"),
]


NEWSAPI_QUERIES: list[tuple[str, dict]] = [
    (
        "top-headlines-business",
        {"category": "business", "country": "us", "pageSize": 100},
    ),
    (
        "everything-finance-markets",
        {
            "q": '("financial markets" OR "stock market" OR "bond market" OR "Federal Reserve")',
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 100,
        },
    ),
    (
        "everything-macro-geopolitics",
        {
            "q": '(macroeconomy OR geopolitics OR "central bank" OR inflation)',
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 100,
        },
    ),
]


TOPIC_TAXONOMY: list[str] = [
    "monetary-policy",
    "markets",
    "m-and-a",
    "earnings",
    "geopolitics",
    "regulation",
    "tech",
    "crypto",
    "commodities",
    "housing",
    "labor",
    "macro-data",
    "central-banks-non-fed",
]


CLICKBAIT_PATTERNS: list[str] = [
    "you won't believe",
    "you wont believe",
    "this one weird trick",
    "shocking truth",
    "doctors hate",
    "what happens next will",
    "click here",
    "gone wrong",
    "gone viral",
    "top 10 reasons",
    "the reason will surprise you",
]


CONTENT_FARM_DOMAINS: set[str] = {
    "buzzfeed.com",
    "upworthy.com",
    "viralnova.com",
    "clickhole.com",
    "distractify.com",
    "rantt.com",
    "thethings.com",
    "topix.com",
}

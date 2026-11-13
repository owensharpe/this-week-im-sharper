"""What the snapshot pulls: Treasury tenors, and the ICE BofA series on FRED."""

from __future__ import annotations

from dataclasses import dataclass

# (key, years). Treasury also publishes a 1.5-month bill, but only since 2025,
# and a point that exists for one year of a ten-year replay is mostly a gap.
NOMINAL_TENORS: list[tuple[str, float]] = [
    ("1M", 1 / 12),
    ("2M", 2 / 12),
    ("3M", 3 / 12),
    ("4M", 4 / 12),
    ("6M", 0.5),
    ("1Y", 1.0),
    ("2Y", 2.0),
    ("3Y", 3.0),
    ("5Y", 5.0),
    ("7Y", 7.0),
    ("10Y", 10.0),
    ("20Y", 20.0),
    ("30Y", 30.0),
]

REAL_TENORS: list[tuple[str, float]] = [
    ("5Y", 5.0),
    ("7Y", 7.0),
    ("10Y", 10.0),
    ("20Y", 20.0),
    ("30Y", 30.0),
]

# (key, label, short tenor, long tenor). Quoted long minus short, in bp.
SLOPES: list[tuple[str, str, str, str]] = [
    ("2s10s", "2s10s", "2Y", "10Y"),
    ("3m10y", "3m10y", "3M", "10Y"),
    ("5s30s", "5s30s", "5Y", "30Y"),
]

# How far back the curve replay and slope history go, at daily resolution.
# Each year is one request.
TREASURY_YEARS = 10

# FRED keeps three years of ICE data, so asking for more just returns less.
CREDIT_LOOKBACK_DAYS = 3 * 365 + 30

# Windows, measured back from the latest observation. "1D" is the previous
# observation rather than the previous calendar day.
CURVE_COMPARISONS: list[tuple[str, str]] = [
    ("1D", "Previous close"),
    ("1W", "1 week ago"),
    ("1M", "1 month ago"),
    ("3M", "3 months ago"),
    ("YTD", "Start of year"),
    ("1Y", "1 year ago"),
]
CHANGE_WINDOWS: list[str] = ["1D", "1W", "1M", "YTD"]
RETURN_WINDOWS: list[str] = ["MTD", "QTD", "YTD", "1M", "3M", "1Y"]
MATURITY_COMPARISONS: list[str] = ["1W", "1M", "3M", "YTD", "1Y"]

# The weekly snapshot: how many week-ending closes get a return column, and
# the trailing window for the low/high range.
SNAPSHOT_WEEKS = 8
RANGE_DAYS = 364


@dataclass(frozen=True)
class RatingBucket:
    key: str
    label: str
    group: str  # "IG" or "HY"
    is_index: bool
    oas: str
    effective_yield: str
    total_return: str
    yield_to_worst: str


RATING_BUCKETS: list[RatingBucket] = [
    RatingBucket("IG", "US Corporate", "IG", True, "BAMLC0A0CM", "BAMLC0A0CMEY", "BAMLCC0A0CMTRIV", "BAMLC0A0CMSYTW"),
    RatingBucket("AAA", "AAA", "IG", False, "BAMLC0A1CAAA", "BAMLC0A1CAAAEY", "BAMLCC0A1AAATRIV", "BAMLC0A1CAAASYTW"),
    RatingBucket("AA", "AA", "IG", False, "BAMLC0A2CAA", "BAMLC0A2CAAEY", "BAMLCC0A2AATRIV", "BAMLC0A2CAASYTW"),
    RatingBucket("A", "A", "IG", False, "BAMLC0A3CA", "BAMLC0A3CAEY", "BAMLCC0A3ATRIV", "BAMLC0A3CASYTW"),
    RatingBucket("BBB", "BBB", "IG", False, "BAMLC0A4CBBB", "BAMLC0A4CBBBEY", "BAMLCC0A4BBBTRIV", "BAMLC0A4CBBBSYTW"),
    RatingBucket("HY", "US High Yield", "HY", True, "BAMLH0A0HYM2", "BAMLH0A0HYM2EY", "BAMLHYH0A0HYM2TRIV", "BAMLH0A0HYM2SYTW"),
    RatingBucket("BB", "BB", "HY", False, "BAMLH0A1HYBB", "BAMLH0A1HYBBEY", "BAMLHYH0A1BBTRIV", "BAMLH0A1HYBBSYTW"),
    RatingBucket("B", "B", "HY", False, "BAMLH0A2HYB", "BAMLH0A2HYBEY", "BAMLHYH0A2BTRIV", "BAMLH0A2HYBSYTW"),
    RatingBucket("CCC", "CCC & lower", "HY", False, "BAMLH0A3HYC", "BAMLH0A3HYCEY", "BAMLHYH0A3CMTRIV", "BAMLH0A3HYCSYTW"),
]

# (key, label, FRED id): the IG index split by maturity, for a credit curve.
MATURITY_BUCKETS: list[tuple[str, str, str]] = [
    ("1-3Y", "1–3y", "BAMLC1A0C13Y"),
    ("3-5Y", "3–5y", "BAMLC2A0C35Y"),
    ("5-7Y", "5–7y", "BAMLC3A0C57Y"),
    ("7-10Y", "7–10y", "BAMLC4A0C710Y"),
    ("10-15Y", "10–15y", "BAMLC7A0C1015Y"),
    ("15Y+", "15y+", "BAMLC8A0C15PY"),
]

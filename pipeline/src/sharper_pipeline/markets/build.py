"""Entry point: Treasury + FRED -> content/credit/latest.json.

Each half refreshes independently. If one can't be fetched (no FRED key, a
Treasury outage), the previous file's copy of that half is kept, so the page
never loses data it already had. The file is only rewritten when at least one
half has a newer observation, which keeps the daily commit honest.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from pydantic import ValidationError

from ..config import MARKETS_DIR
from . import fred, treasury
from .analytics import (
    TimeSeries,
    change,
    percentile,
    period_return,
    rounded,
    total_return,
    trailing_range,
    week_ends,
    window_index,
)
from .http import FetchError
from .models import (
    Comparison,
    Credit,
    CreditBucket,
    Curve,
    MarketsSnapshot,
    MaturityBucket,
    Rates,
    Replay,
    Slope,
    Source,
    WeekEnd,
)
from .series import (
    CHANGE_WINDOWS,
    CREDIT_LOOKBACK_DAYS,
    CURVE_COMPARISONS,
    MATURITY_BUCKETS,
    MATURITY_COMPARISONS,
    NOMINAL_TENORS,
    RANGE_DAYS,
    RATING_BUCKETS,
    REAL_TENORS,
    RETURN_WINDOWS,
    SLOPES,
    SNAPSHOT_WEEKS,
    TREASURY_YEARS,
)

log = logging.getLogger(__name__)

SOURCES = [
    Source(
        name="U.S. Department of the Treasury",
        url="https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
        note="Daily par yield curve rates and daily par real yield curve rates.",
    ),
    Source(
        name="ICE Data Indices, LLC",
        url="https://fred.stlouisfed.org/release?rid=209",
        note=(
            "ICE BofA US Corporate and US High Yield indices data for "
            "option-adjusted spreads, effective yields, and total return index "
            "values, are retrieved from FRED, Federal Reserve Bank of St. Louis."
        ),
    ),
]


class Unavailable(RuntimeError):
    """A half of the snapshot that came back empty."""


# --- rates ------------------------------------------------------------------


def _curve(raw: treasury.Curve, tenors: list[tuple[str, float]]) -> Curve:
    dates = sorted(raw)
    latest = dates[-1]

    def row(d: date) -> list[float | None]:
        return [rounded(raw[d].get(key), 3) for key, _ in tenors]

    comparisons = []
    for key, label in CURVE_COMPARISONS:
        i = window_index(dates, key)
        if i is not None:
            comparisons.append(
                Comparison(key=key, label=label, date=dates[i].isoformat(), yields=row(dates[i]))
            )

    return Curve(
        tenors=[key for key, _ in tenors],
        years=[round(years, 4) for _, years in tenors],
        date=latest.isoformat(),
        yields=row(latest),
        comparisons=comparisons,
    )


def _slope(raw: treasury.Curve, key: str, label: str, short: str, long: str) -> Slope | None:
    series = TimeSeries.from_pairs(
        (d, (r[long] - r[short]) * 100) for d, r in raw.items() if short in r and long in r
    )
    if not series:
        return None
    return Slope(
        key=key,
        label=label,
        current_bp=round(series.values[-1], 1),
        changes_bp={w: rounded(change(series, w), 1) for w in CHANGE_WINDOWS},
        dates=[d.isoformat() for d in series.dates],
        values_bp=[round(v, 1) for v in series.values],
    )


def rates_from_curves(nominal: treasury.Curve, real: treasury.Curve) -> Rates:
    if not nominal:
        raise Unavailable("no Treasury nominal curve data")
    dates = sorted(nominal)
    slopes = [_slope(nominal, *spec) for spec in SLOPES]
    return Rates(
        as_of=dates[-1].isoformat(),
        nominal=_curve(nominal, NOMINAL_TENORS),
        real=_curve(real, REAL_TENORS) if real else None,
        replay=Replay(
            dates=[d.isoformat() for d in dates],
            yields=[[rounded(nominal[d].get(key), 3) for key, _ in NOMINAL_TENORS] for d in dates],
        ),
        slopes=[s for s in slopes if s is not None],
    )


def build_rates(today: date) -> Rates:
    nominal = treasury.fetch(treasury.NOMINAL, today.year - TREASURY_YEARS, today.year)
    # Real yields only feed the curve and its comparisons, which reach back a year.
    real = treasury.fetch(treasury.REAL, today.year - 1, today.year)
    return rates_from_curves(nominal, real)


# --- credit -----------------------------------------------------------------

SeriesMap = dict[str, TimeSeries | None]


def _bp(x: float | None) -> float | None:
    return rounded(None if x is None else x * 100, 1)


def _bucket(spec, oas: TimeSeries | None, ey: TimeSeries | None, tr: TimeSeries | None,
            ytw: TimeSeries | None, dates: list[date], as_of: date,
            ends: list[date]) -> CreditBucket:
    """`ends` are the week-ending closes, newest first; the snapshot reports
    returns for all but the last, which only serves as the first week's start."""
    bucket = CreditBucket(key=spec.key, label=spec.label, group=spec.group, is_index=spec.is_index)
    prior_week = ends[1] if len(ends) > 1 else None
    if oas:
        bucket.oas_bp = _bp(oas.values[-1])
        bucket.oas_changes_bp = {w: rounded(change(oas, w, 100, as_of), 1) for w in CHANGE_WINDOWS}
        bucket.oas_percentile = rounded(percentile(oas), 3)
        bucket.oas_min_bp = _bp(min(oas.values))
        bucket.oas_max_bp = _bp(max(oas.values))
        bucket.oas_history_bp = [_bp(oas.value_on(d)) for d in dates]
        if prior_week:
            bucket.oas_prior_week_bp = _bp(oas.on_or_before(prior_week))
        if rng := trailing_range(oas, as_of, RANGE_DAYS):
            bucket.oas_52w_low_bp, bucket.oas_52w_high_bp = _bp(rng[0]), _bp(rng[1])
    else:
        bucket.oas_history_bp = [None] * len(dates)
    if ey:
        bucket.yield_pct = rounded(ey.values[-1], 3)
        bucket.yield_changes_bp = {w: rounded(change(ey, w, 100, as_of), 1) for w in CHANGE_WINDOWS}
    if ytw:
        bucket.ytw_pct = rounded(ytw.values[-1], 3)
        if prior_week:
            bucket.ytw_prior_week_pct = rounded(ytw.on_or_before(prior_week), 3)
        if rng := trailing_range(ytw, as_of, RANGE_DAYS):
            bucket.ytw_52w_low_pct, bucket.ytw_52w_high_pct = rounded(rng[0], 3), rounded(rng[1], 3)
    if tr:
        bucket.returns_pct = {w: rounded(total_return(tr, w, as_of), 2) for w in RETURN_WINDOWS}
        bucket.weekly_returns_pct = [
            rounded(period_return(tr, ends[k + 1], ends[k]), 2) for k in range(len(ends) - 1)
        ]
    return bucket


def credit_from_series(oas: SeriesMap, yields: SeriesMap, returns: SeriesMap,
                       maturity: SeriesMap, ytw: SeriesMap | None = None) -> Credit:
    available = [s for s in oas.values() if s]
    if not available:
        raise Unavailable("no ICE OAS series came back from FRED")

    as_of = max(s.dates[-1] for s in available)
    dates = sorted(set().union(*(s.dates for s in available)))
    # One more week-end than columns: the oldest is the first column's start.
    ends = week_ends(dates, SNAPSHOT_WEEKS + 1)
    ytw = ytw or {}

    buckets = [
        _bucket(spec, oas.get(spec.key), yields.get(spec.key), returns.get(spec.key),
                ytw.get(spec.key), dates, as_of, ends)
        for spec in RATING_BUCKETS
    ]

    maturity_buckets = []
    for key, label, _ in MATURITY_BUCKETS:
        series = maturity.get(key)
        bucket = MaturityBucket(key=key, label=label)
        if series:
            bucket.oas_bp = _bp(series.values[-1])
            for w in MATURITY_COMPARISONS:
                past = series.at_window(w, as_of)
                bucket.comparisons_bp[w] = _bp(past[1]) if past else None
        maturity_buckets.append(bucket)

    return Credit(
        as_of=as_of.isoformat(),
        history_start=dates[0].isoformat(),
        dates=[d.isoformat() for d in dates],
        buckets=buckets,
        maturity=maturity_buckets,
        # A latest close before Friday means the newest week is still running.
        weeks=[
            WeekEnd(date=e.isoformat(), partial=(k == 0 and e.weekday() < 4))
            for k, e in enumerate(ends[:-1])
        ],
        prior_week_end=ends[1].isoformat() if len(ends) > 1 else None,
    )


Fetcher = Callable[[str, date], TimeSeries]


def build_credit(today: date, fetch: Fetcher = fred.fetch_series) -> Credit:
    start = today - timedelta(days=CREDIT_LOOKBACK_DAYS)

    def pull(series_id: str) -> TimeSeries | None:
        # One bad series costs one cell, not the whole section. A missing key
        # still propagates, since every other call would fail the same way.
        try:
            return fetch(series_id, start) or None
        except FetchError as exc:
            log.warning("%s", exc)
            return None

    return credit_from_series(
        oas={b.key: pull(b.oas) for b in RATING_BUCKETS},
        yields={b.key: pull(b.effective_yield) for b in RATING_BUCKETS},
        returns={b.key: pull(b.total_return) for b in RATING_BUCKETS},
        maturity={key: pull(series_id) for key, _, series_id in MATURITY_BUCKETS},
        ytw={b.key: pull(b.yield_to_worst) for b in RATING_BUCKETS},
    )


# --- assembly ---------------------------------------------------------------


def _newer(fresh, previous):
    """Whichever copy has the later observation. Ties go to the fresh one."""
    if fresh is None:
        return previous
    if previous is None:
        return fresh
    return fresh if fresh.as_of >= previous.as_of else previous


def _as_of(snapshot: MarketsSnapshot) -> tuple:
    return (
        snapshot.schema_version,
        snapshot.rates.as_of if snapshot.rates else None,
        snapshot.credit.as_of if snapshot.credit else None,
    )


def load(path: Path) -> MarketsSnapshot | None:
    try:
        return MarketsSnapshot.model_validate_json(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except ValidationError as exc:
        log.warning("ignoring unreadable %s: %s", path, exc.error_count())
        return None


def assemble(previous: MarketsSnapshot | None, rates: Rates | None,
             credit: Credit | None) -> MarketsSnapshot | None:
    """The snapshot to write, or None when nothing has moved since last time."""
    snapshot = MarketsSnapshot(
        rates=_newer(rates, previous.rates if previous else None),
        credit=_newer(credit, previous.credit if previous else None),
        sources=SOURCES,
    )
    if previous is not None and _as_of(previous) == _as_of(snapshot):
        return None
    return snapshot


def run(today: date | None = None, out_dir: Path | None = None) -> MarketsSnapshot | None:
    today = today or datetime.now(timezone.utc).date()
    path = (out_dir or MARKETS_DIR) / "latest.json"
    previous = load(path)

    rates = credit = None
    try:
        rates = build_rates(today)
    except (FetchError, Unavailable) as exc:
        log.warning("rates not refreshed: %s", exc)
    try:
        credit = build_credit(today)
    except fred.MissingApiKey:
        log.warning("FRED_API_KEY not set; credit not refreshed")
    except (FetchError, Unavailable) as exc:
        log.warning("credit not refreshed: %s", exc)

    snapshot = assemble(previous, rates, credit)
    if snapshot is None:
        log.info("no new observations since the last run; leaving %s alone", path)
        return None

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(snapshot.model_dump_json(), encoding="utf-8")
    log.info(
        "wrote %s (rates as of %s, credit as of %s)",
        path,
        snapshot.rates.as_of if snapshot.rates else "none",
        snapshot.credit.as_of if snapshot.credit else "none",
    )
    return snapshot


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    run()


if __name__ == "__main__":
    main()

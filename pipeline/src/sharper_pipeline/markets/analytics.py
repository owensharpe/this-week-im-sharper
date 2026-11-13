"""Pure time-series arithmetic: windows, changes, percentiles, returns.

Nothing here touches the network, so all of it is unit-tested directly.
"""

from __future__ import annotations

import calendar
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable


def minus_months(d: date, months: int) -> date:
    """Same day `months` earlier, clamped to the end of a shorter month."""
    years, month0 = divmod(d.month - 1 - months, 12)
    year = d.year + years
    month = month0 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def anchor_date(window: str, as_of: date) -> date:
    """The last calendar day whose close a window is measured against.

    Period-to-date windows anchor on the last day of the previous period, so
    YTD on 12 November is measured from the 31 December close.
    """
    if window == "1W":
        return as_of - timedelta(days=7)
    if window == "1M":
        return minus_months(as_of, 1)
    if window == "3M":
        return minus_months(as_of, 3)
    if window == "1Y":
        return minus_months(as_of, 12)
    if window == "MTD":
        return as_of.replace(day=1) - timedelta(days=1)
    if window == "QTD":
        first_month = 3 * ((as_of.month - 1) // 3) + 1
        return date(as_of.year, first_month, 1) - timedelta(days=1)
    if window == "YTD":
        return date(as_of.year - 1, 12, 31)
    raise ValueError(f"unknown window {window!r}")


def index_on_or_before(dates: list[date], target: date) -> int | None:
    i = bisect_right(dates, target) - 1
    return i if i >= 0 else None


def window_index(dates: list[date], window: str, as_of: date | None = None) -> int | None:
    """Index of the observation a window compares against, or None if the
    history doesn't reach back that far.

    "1D" is the observation before the latest one, not the previous calendar
    day, so a Monday compares with Friday.
    """
    if not dates:
        return None
    if window == "1D":
        return len(dates) - 2 if len(dates) >= 2 else None
    as_of = as_of or dates[-1]
    i = index_on_or_before(dates, anchor_date(window, as_of))
    # Never compare the latest observation with itself.
    if i is None or i >= len(dates) - 1:
        return None
    return i


@dataclass
class TimeSeries:
    dates: list[date] = field(default_factory=list)
    values: list[float] = field(default_factory=list)

    @classmethod
    def from_pairs(cls, pairs: Iterable[tuple[date, float]]) -> "TimeSeries":
        # Later duplicates win, then sort: callers shouldn't have to care about
        # source ordering (Treasury files are newest-first).
        merged = dict(pairs)
        ordered = sorted(merged.items())
        return cls([d for d, _ in ordered], [v for _, v in ordered])

    def __len__(self) -> int:
        return len(self.dates)

    @property
    def latest(self) -> tuple[date, float] | None:
        return (self.dates[-1], self.values[-1]) if self.dates else None

    def at_window(self, window: str, as_of: date | None = None) -> tuple[date, float] | None:
        i = window_index(self.dates, window, as_of)
        return None if i is None else (self.dates[i], self.values[i])

    def value_on(self, d: date) -> float | None:
        i = bisect_right(self.dates, d) - 1
        return self.values[i] if i >= 0 and self.dates[i] == d else None

    def on_or_before(self, d: date) -> float | None:
        i = bisect_right(self.dates, d) - 1
        return self.values[i] if i >= 0 else None


def change(series: TimeSeries, window: str, scale: float = 1.0, as_of: date | None = None) -> float | None:
    """Latest minus the window's comparison value, times `scale`."""
    latest = series.latest
    past = series.at_window(window, as_of)
    if latest is None or past is None:
        return None
    return (latest[1] - past[1]) * scale


def percentile(series: TimeSeries) -> float | None:
    """Share of the history at or below the latest value, from 0 to 1."""
    if not series.values:
        return None
    current = series.values[-1]
    return sum(v <= current for v in series.values) / len(series.values)


def total_return(series: TimeSeries, window: str, as_of: date | None = None) -> float | None:
    """Percent change in a total return index over a window."""
    latest = series.latest
    past = series.at_window(window, as_of)
    if latest is None or past is None or past[1] == 0:
        return None
    return (latest[1] / past[1] - 1.0) * 100.0


def weekly_indices(dates: list[date]) -> list[int]:
    """Indices of the last observation in each ISO week, which always
    includes the final observation."""
    keep: list[int] = []
    for i, d in enumerate(dates):
        week = d.isocalendar()[:2]
        if keep and dates[keep[-1]].isocalendar()[:2] == week:
            keep[-1] = i
        else:
            keep.append(i)
    return keep


def week_ends(dates: list[date], count: int) -> list[date]:
    """The last `count` week-ending observations, newest first. The newest
    is the latest observation, so it may close a week that isn't over yet."""
    return [dates[i] for i in reversed(weekly_indices(dates)[-count:])]


def trailing_range(series: TimeSeries, as_of: date, days: int) -> tuple[float, float] | None:
    """Low and high over the `days` up to and including `as_of`."""
    start = bisect_right(series.dates, as_of - timedelta(days=days))
    end = bisect_right(series.dates, as_of)
    window = series.values[start:end]
    return (min(window), max(window)) if window else None


def period_return(series: TimeSeries, start: date, end: date) -> float | None:
    """Percent change in a total return index between two closes."""
    a = series.on_or_before(start)
    b = series.on_or_before(end)
    if a is None or b is None or a == 0:
        return None
    return (b / a - 1.0) * 100.0


def rounded(x: float | None, digits: int) -> float | None:
    return None if x is None else round(x, digits)

"""Shape of content/credit/latest.json. Mirrored by src/lib/credit.ts.

Units are in the field names: `_pct` is percent (4.25 means 4.25%), `_bp` is
basis points. Arrays named `yields` line up with their curve's `tenors`, and
`oas_history_bp` lines up with `Credit.dates`. Null means no observation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

# Bump when the shape changes, so the next run rewrites the file even if no
# new observations have arrived.
SCHEMA_VERSION = 3


class Comparison(BaseModel):
    key: str
    label: str
    date: str
    yields: list[Optional[float]]


class Curve(BaseModel):
    tenors: list[str]
    years: list[float]
    date: str
    yields: list[Optional[float]]
    comparisons: list[Comparison]


class Replay(BaseModel):
    """Daily closes of the nominal curve, for scrubbing back through time."""

    dates: list[str]
    yields: list[list[Optional[float]]]


class Slope(BaseModel):
    key: str
    label: str
    current_bp: float
    changes_bp: dict[str, Optional[float]]
    dates: list[str]
    values_bp: list[float]


class Rates(BaseModel):
    as_of: str
    nominal: Curve
    real: Optional[Curve] = None
    replay: Replay
    slopes: list[Slope]


class CreditBucket(BaseModel):
    key: str
    label: str
    group: Literal["IG", "HY"]
    is_index: bool
    oas_bp: Optional[float] = None
    oas_changes_bp: dict[str, Optional[float]] = Field(default_factory=dict)
    oas_percentile: Optional[float] = Field(
        default=None,
        description="Share of the available history at or below today's OAS, 0 to 1.",
    )
    oas_min_bp: Optional[float] = None
    oas_max_bp: Optional[float] = None
    oas_history_bp: list[Optional[float]] = Field(default_factory=list)
    yield_pct: Optional[float] = None
    yield_changes_bp: dict[str, Optional[float]] = Field(default_factory=dict)
    returns_pct: dict[str, Optional[float]] = Field(default_factory=dict)

    # The weekly snapshot. "Prior week" is the last close of the previous
    # week; ranges cover the trailing 52 weeks.
    oas_prior_week_bp: Optional[float] = None
    oas_52w_low_bp: Optional[float] = None
    oas_52w_high_bp: Optional[float] = None
    ytw_pct: Optional[float] = None
    ytw_prior_week_pct: Optional[float] = None
    ytw_52w_low_pct: Optional[float] = None
    ytw_52w_high_pct: Optional[float] = None
    weekly_returns_pct: list[Optional[float]] = Field(
        default_factory=list,
        description="Total return for each week in Credit.weeks, newest first.",
    )


class MaturityBucket(BaseModel):
    key: str
    label: str
    oas_bp: Optional[float] = None
    comparisons_bp: dict[str, Optional[float]] = Field(default_factory=dict)


class WeekEnd(BaseModel):
    date: str
    partial: bool = Field(
        default=False,
        description="True when the week hasn't finished yet: a week-to-date figure.",
    )


class Credit(BaseModel):
    as_of: str
    history_start: str
    dates: list[str]
    buckets: list[CreditBucket]
    maturity: list[MaturityBucket]
    weeks: list[WeekEnd] = Field(default_factory=list)
    prior_week_end: Optional[str] = None


class Source(BaseModel):
    name: str
    url: str
    note: str


class MarketsSnapshot(BaseModel):
    schema_version: int = SCHEMA_VERSION
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rates: Optional[Rates] = None
    credit: Optional[Credit] = None
    sources: list[Source] = Field(default_factory=list)

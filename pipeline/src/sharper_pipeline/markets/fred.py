"""FRED's official observations API. Needs a free key from
https://fred.stlouisfed.org/docs/api/api_key.html; the fredgraph.csv
download links are for browsers and refuse scripted clients."""

from __future__ import annotations

import logging
import time
from datetime import date

from ..config import FRED_API_KEY
from .analytics import TimeSeries
from .http import get

log = logging.getLogger(__name__)

_URL = "https://api.stlouisfed.org/fred/series/observations"

# FRED allows 120 requests a minute; a full run makes about 45.
_CALL_DELAY_S = 0.25


class MissingApiKey(RuntimeError):
    pass


def parse_observations(payload: dict) -> TimeSeries:
    """FRED marks a missing observation with "." rather than leaving it out."""
    pairs = []
    for obs in payload.get("observations", []):
        raw = str(obs.get("value", "")).strip()
        if raw in ("", "."):
            continue
        try:
            pairs.append((date.fromisoformat(obs["date"]), float(raw)))
        except (KeyError, ValueError):
            continue
    return TimeSeries.from_pairs(pairs)


def _observations(series_id: str, api_key: str | None, label: str, **params) -> TimeSeries:
    key = api_key if api_key is not None else FRED_API_KEY
    if not key:
        raise MissingApiKey("FRED_API_KEY is not set")
    resp = get(
        _URL,
        {"series_id": series_id, "api_key": key, "file_type": "json", **params},
        label=label,
    )
    time.sleep(_CALL_DELAY_S)
    return parse_observations(resp.json())


def fetch_series(series_id: str, start: date, api_key: str | None = None) -> TimeSeries:
    series = _observations(
        series_id, api_key, f"FRED {series_id}", observation_start=start.isoformat()
    )
    log.info("FRED %s: %d observations", series_id, len(series))
    return series


def latest_date(series_id: str, api_key: str | None = None) -> date | None:
    """Date of the newest observation, from the last few rows only. A few
    rather than one, since a missing day still comes back as a "." row."""
    series = _observations(
        series_id, api_key, f"FRED {series_id} (latest)", sort_order="desc", limit=5
    )
    return series.dates[-1] if series else None

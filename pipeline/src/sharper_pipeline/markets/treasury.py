"""U.S. Treasury daily par yield curves (nominal and real), straight from
home.treasury.gov. Public domain, no key, one CSV per calendar year."""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import date, datetime

from .http import FetchError, get

log = logging.getLogger(__name__)

_URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/"
    "interest-rates/daily-treasury-rates.csv/{year}/all"
)

NOMINAL = "daily_treasury_yield_curve"
REAL = "daily_treasury_real_yield_curve"

# Column headers drift between years and files: "1 Mo", "1.5 Month", "1 Yr",
# "5 YR". Normalise all of them to the "1M" / "5Y" keys the snapshot uses.
_HEADER = re.compile(r"^\s*([\d.]+)\s*(mo|month|yr|year)s?\s*$", re.IGNORECASE)

Curve = dict[date, dict[str, float]]


def tenor_key(header: str) -> str | None:
    m = _HEADER.match(header)
    if not m:
        return None
    number, unit = m.groups()
    return f"{number}{'M' if unit.lower().startswith('mo') else 'Y'}"


def parse_csv(text: str) -> Curve:
    """Rows keyed by date, each a tenor -> yield map. Blank cells (a tenor
    that didn't exist yet, or a missing print) are simply absent."""
    reader = csv.reader(io.StringIO(text.strip()))
    try:
        header = next(reader)
    except StopIteration:
        return {}
    keys = [tenor_key(h) for h in header]

    curve: Curve = {}
    for row in reader:
        if not row or not row[0].strip():
            continue
        try:
            d = datetime.strptime(row[0].strip(), "%m/%d/%Y").date()
        except ValueError:
            continue
        yields: dict[str, float] = {}
        for key, cell in zip(keys[1:], row[1:]):
            if key is None or not cell.strip():
                continue
            try:
                yields[key] = float(cell)
            except ValueError:
                continue
        if yields:
            curve[d] = yields
    return curve


def fetch_year(kind: str, year: int) -> Curve:
    resp = get(
        _URL.format(year=year),
        {"type": kind, "field_tdr_date_value": year, "page": "", "_format": "csv"},
        label=f"Treasury {kind} {year}",
    )
    return parse_csv(resp.text)


def fetch(kind: str, first_year: int, last_year: int) -> Curve:
    """Every year in the range, oldest first. An older year that fails only
    shortens the history; the current year failing is the caller's problem,
    since the result will simply be stale."""
    curve: Curve = {}
    for year in range(first_year, last_year + 1):
        try:
            rows = fetch_year(kind, year)
        except FetchError as exc:
            log.warning("%s", exc)
            continue
        curve.update(rows)
        log.info("Treasury %s %d: %d days", kind, year, len(rows))
    return curve

from datetime import date, timedelta

import pytest

from sharper_pipeline.markets import build, fred, treasury
from sharper_pipeline.markets.analytics import (
    TimeSeries,
    anchor_date,
    change,
    minus_months,
    percentile,
    period_return,
    total_return,
    trailing_range,
    week_ends,
    weekly_indices,
    window_index,
)
from sharper_pipeline.markets.http import FetchError
from sharper_pipeline.markets.series import MATURITY_BUCKETS, RATING_BUCKETS


def _daily(start: date, values: list[float]) -> TimeSeries:
    return TimeSeries.from_pairs((start + timedelta(days=i), v) for i, v in enumerate(values))


# --- windows ----------------------------------------------------------------


def test_minus_months_clamps_to_month_end():
    assert minus_months(date(2026, 3, 31), 1) == date(2026, 2, 28)
    assert minus_months(date(2024, 2, 29), 12) == date(2023, 2, 28)
    assert minus_months(date(2026, 1, 15), 1) == date(2025, 12, 15)


def test_period_to_date_windows_anchor_on_previous_period_end():
    as_of = date(2026, 11, 12)
    assert anchor_date("YTD", as_of) == date(2025, 12, 31)
    assert anchor_date("MTD", as_of) == date(2026, 10, 31)
    assert anchor_date("QTD", as_of) == date(2026, 9, 30)


def test_one_day_window_is_previous_observation_not_calendar_day():
    # Friday then Monday: 1D on Monday compares with Friday.
    dates = [date(2026, 11, 6), date(2026, 11, 9)]
    assert window_index(dates, "1D") == 0


def test_window_falls_back_to_last_observation_before_anchor():
    # No print on the anchor day itself (a holiday): use the one before.
    dates = [date(2026, 10, 9), date(2026, 10, 13), date(2026, 11, 12)]
    assert window_index(dates, "1M") == 0


def test_window_is_none_when_history_is_too_short():
    dates = [date(2026, 11, 10), date(2026, 11, 12)]
    assert window_index(dates, "1Y") is None


def test_window_never_compares_latest_with_itself():
    # A series that has gone stale relative to the section's as-of date: the
    # 1W anchor (3 Nov) lands on its own latest print (1 Nov).
    dates = [date(2026, 1, 1), date(2026, 11, 1)]
    assert window_index(dates, "1W", as_of=date(2026, 11, 10)) is None


# --- arithmetic -------------------------------------------------------------


def test_change_scales_percent_to_bp():
    s = _daily(date(2026, 11, 1), [3.10, 3.20, 3.30])
    assert change(s, "1D", scale=100) == pytest.approx(10.0)


def test_percentile_counts_ties_as_at_or_below():
    s = _daily(date(2026, 1, 1), [1.0, 2.0, 3.0, 2.0])
    assert percentile(s) == pytest.approx(0.75)


def test_total_return_from_index_levels():
    s = TimeSeries.from_pairs([(date(2025, 12, 31), 100.0), (date(2026, 6, 30), 103.0)])
    assert total_return(s, "YTD") == pytest.approx(3.0)


def test_from_pairs_sorts_and_dedupes():
    s = TimeSeries.from_pairs([(date(2026, 1, 3), 3.0), (date(2026, 1, 1), 1.0), (date(2026, 1, 3), 4.0)])
    assert s.dates == [date(2026, 1, 1), date(2026, 1, 3)]
    assert s.values == [1.0, 4.0]


def test_weekly_indices_keep_last_day_of_each_week_and_the_final_day():
    # Mon 2 Nov .. Wed 11 Nov 2026, weekdays only.
    dates = [date(2026, 11, d) for d in (2, 3, 4, 5, 6, 9, 10, 11)]
    assert weekly_indices(dates) == [4, 7]


# --- parsing ----------------------------------------------------------------


def test_treasury_headers_normalise_across_vintages():
    assert treasury.tenor_key("1 Mo") == "1M"
    assert treasury.tenor_key("1.5 Month") == "1.5M"
    assert treasury.tenor_key("10 Yr") == "10Y"
    assert treasury.tenor_key("5 YR") == "5Y"
    assert treasury.tenor_key("Date") is None


def test_treasury_csv_skips_blank_cells():
    text = 'Date,"1 Mo","4 Mo","10 Yr"\n01/03/2022,0.05,,1.63\n12/30/2022,4.12,4.69,3.88'
    curve = treasury.parse_csv(text)
    assert curve[date(2022, 1, 3)] == {"1M": 0.05, "10Y": 1.63}
    assert curve[date(2022, 12, 30)]["4M"] == 4.69


def test_fred_missing_values_are_dropped():
    payload = {"observations": [
        {"date": "2026-11-10", "value": "3.28"},
        {"date": "2026-11-11", "value": "."},
        {"date": "2026-11-12", "value": "3.30"},
    ]}
    s = fred.parse_observations(payload)
    assert s.dates == [date(2026, 11, 10), date(2026, 11, 12)]


def test_fred_without_key_raises_before_any_request(monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("should not hit the network")

    monkeypatch.setattr(fred, "get", boom)
    with pytest.raises(fred.MissingApiKey):
        fred.fetch_series("BAMLH0A0HYM2", date(2026, 1, 1), api_key="")


# --- assembly ---------------------------------------------------------------


def _nominal_curve() -> treasury.Curve:
    start = date(2025, 11, 3)
    curve = {}
    for i in range(400):
        d = start + timedelta(days=i)
        if d.weekday() < 5:
            curve[d] = {"3M": 4.0, "2Y": 4.0 + i / 1000, "5Y": 4.2, "10Y": 4.5, "30Y": 4.9}
    return curve


def test_rates_from_curves_builds_comparisons_and_slopes():
    rates = build.rates_from_curves(_nominal_curve(), {})
    assert rates.real is None
    assert [c.key for c in rates.nominal.comparisons] == ["1D", "1W", "1M", "3M", "YTD", "1Y"]
    slope = next(s for s in rates.slopes if s.key == "3m10y")
    assert slope.current_bp == pytest.approx(50.0)
    assert slope.changes_bp["1W"] == pytest.approx(0.0)
    # Daily resolution: every close is in the replay and the slope history.
    assert len(rates.replay.dates) == len(rates.replay.yields) == len(_nominal_curve())
    assert len(slope.dates) == len(_nominal_curve())


def _credit_series() -> build.SeriesMap:
    return {b.key: _daily(date(2025, 11, 1), [1.0 + i / 100 for i in range(380)]) for b in RATING_BUCKETS}


def test_credit_from_series_tolerates_missing_series():
    oas = _credit_series()
    oas["CCC"] = None
    credit = build.credit_from_series(oas, {}, {}, {})
    ccc = next(b for b in credit.buckets if b.key == "CCC")
    assert ccc.oas_bp is None
    assert len(ccc.oas_history_bp) == len(credit.dates)
    ig = next(b for b in credit.buckets if b.key == "IG")
    assert ig.oas_bp == pytest.approx(479.0)
    assert ig.oas_percentile == pytest.approx(1.0)
    assert len(credit.maturity) == len(MATURITY_BUCKETS)


def test_credit_with_no_oas_at_all_is_unavailable():
    with pytest.raises(build.Unavailable):
        build.credit_from_series({b.key: None for b in RATING_BUCKETS}, {}, {}, {})


def test_build_credit_skips_a_failed_series(monkeypatch):
    series = _daily(date(2025, 11, 1), [2.0, 2.1, 2.2])

    def fetch(series_id, start):
        if series_id == "BAMLH0A3HYC":
            raise FetchError("FRED BAMLH0A3HYC: HTTP 400")
        return series

    credit = build.build_credit(date(2026, 11, 12), fetch=fetch)
    assert next(b for b in credit.buckets if b.key == "CCC").oas_bp is None
    assert next(b for b in credit.buckets if b.key == "HY").oas_bp == pytest.approx(220.0)


def test_assemble_keeps_previous_half_when_a_refresh_fails():
    rates = build.rates_from_curves(_nominal_curve(), {})
    credit = build.credit_from_series(_credit_series(), {}, {}, {})
    previous = build.assemble(None, rates, credit)

    # Credit failed to refresh today; rates have a newer close.
    newer_rates = rates.model_copy(update={"as_of": "2099-01-01"})
    snapshot = build.assemble(previous, newer_rates, None)
    assert snapshot is not None
    assert snapshot.rates.as_of == "2099-01-01"
    assert snapshot.credit == previous.credit


def test_assemble_skips_write_when_nothing_moved():
    rates = build.rates_from_curves(_nominal_curve(), {})
    previous = build.assemble(None, rates, None)
    assert build.assemble(previous, rates, None) is None


def test_assemble_never_replaces_newer_data_with_older():
    rates = build.rates_from_curves(_nominal_curve(), {})
    previous = build.assemble(None, rates.model_copy(update={"as_of": "2099-01-01"}), None)
    assert build.assemble(previous, rates, None) is None


def test_run_round_trips_through_disk(tmp_path, monkeypatch):
    monkeypatch.setattr(build, "build_rates", lambda today: build.rates_from_curves(_nominal_curve(), {}))

    def no_key(today):
        raise fred.MissingApiKey("FRED_API_KEY is not set")

    monkeypatch.setattr(build, "build_credit", no_key)
    written = build.run(today=date(2026, 12, 7), out_dir=tmp_path)
    assert written is not None and written.credit is None
    assert build.load(tmp_path / "latest.json") == written
    # Second run, same data: nothing to write.
    assert build.run(today=date(2026, 12, 7), out_dir=tmp_path) is None


# --- weekly snapshot --------------------------------------------------------


def _weekdays(start: date, end: date) -> list[date]:
    out, d = [], start
    while d <= end:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def test_week_ends_are_newest_first_and_start_with_the_latest_close():
    # Latest close is Wednesday 11 Nov 2026, mid-week.
    dates = _weekdays(date(2026, 10, 19), date(2026, 11, 11))
    assert week_ends(dates, 4) == [date(2026, 11, 11), date(2026, 11, 6), date(2026, 10, 30), date(2026, 10, 23)]


def test_trailing_range_ignores_closes_outside_the_window():
    s = TimeSeries.from_pairs([
        (date(2025, 6, 1), 999.0),   # older than 52 weeks: excluded
        (date(2026, 1, 5), 2.0),
        (date(2026, 6, 1), 5.0),
        (date(2026, 11, 11), 3.0),
    ])
    assert trailing_range(s, date(2026, 11, 11), 364) == (2.0, 5.0)


def test_period_return_uses_closes_on_or_before_each_date():
    s = TimeSeries.from_pairs([(date(2026, 10, 30), 100.0), (date(2026, 11, 6), 100.5)])
    # 7 Nov is a Saturday: falls back to Friday's close.
    assert period_return(s, date(2026, 10, 30), date(2026, 11, 7)) == pytest.approx(0.5)


def test_snapshot_fields_from_weekly_closes():
    dates = _weekdays(date(2025, 11, 3), date(2026, 11, 11))
    # OAS falls 1bp a day; the TR index grows 0.1% a day; YTW is flat at 8%.
    oas = {b.key: TimeSeries(dates, [5.0 - i / 100 for i in range(len(dates))]) for b in RATING_BUCKETS}
    tr = {b.key: TimeSeries(dates, [100 * 1.001 ** i for i in range(len(dates))]) for b in RATING_BUCKETS}
    ytw = {b.key: TimeSeries(dates, [8.0] * len(dates)) for b in RATING_BUCKETS}
    credit = build.credit_from_series(oas, {}, tr, {}, ytw=ytw)

    assert [(w.date, w.partial) for w in credit.weeks[:3]] == [
        ("2026-11-11", True), ("2026-11-06", False), ("2026-10-30", False),
    ]
    assert len(credit.weeks) == len(hy_weeks := credit.buckets[0].weekly_returns_pct) == 8
    assert all(r is not None for r in hy_weeks)
    assert credit.prior_week_end == "2026-11-06"

    hy = next(b for b in credit.buckets if b.key == "HY")
    # Three trading days since Friday's close: -3bp, and +0.1% compounded three times.
    assert hy.oas_bp - hy.oas_prior_week_bp == pytest.approx(-3.0)
    assert hy.weekly_returns_pct[0] == pytest.approx((1.001 ** 3 - 1) * 100, abs=0.01)
    assert hy.weekly_returns_pct[1] == pytest.approx((1.001 ** 5 - 1) * 100, abs=0.01)
    assert hy.ytw_pct == hy.ytw_prior_week_pct == 8.0
    assert hy.oas_52w_low_bp == hy.oas_bp
    assert "QTD" in hy.returns_pct

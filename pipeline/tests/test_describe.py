"""Tests for describe_all's free-tier guards and the llm retry policy.

Covers the two behaviors that keep us inside Gemini's free quota:
  1. the top-N budget cap (only the most important clusters call the LLM)
  2. the consecutive-429 circuit-breaker (stop calling once quota is gone)

plus the llm-level retry policy (429 is not retried; 5xx is). The LLM is
always mocked, so these tests are fast and never touch the network.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from sharper_pipeline import describe, llm
from sharper_pipeline.llm import LLMError
from sharper_pipeline.models import Article, Cluster

_VALID_JSON = (
    '{"headline": "Real headline", '
    '"briefing": "A real synthesized briefing, long enough to validate.", '
    '"tags": []}'
)
_REAL_BRIEFING = "A real synthesized briefing, long enough to validate."


def _article(i: int) -> Article:
    return Article(
        id=f"a{i}",
        title=f"Article {i}",
        description=f"Description for article {i}.",
        url=f"https://example.com/{i}",
        source=f"source-{i}",
        published_at=datetime(2026, 5, 29, tzinfo=timezone.utc),
        fetched_from="rss",
    )


def _cluster(cid: str, n_articles: int) -> Cluster:
    arts = [_article(i) for i in range(n_articles)]
    return Cluster(
        id=cid,
        headline=arts[0].title,
        briefing="",
        tags=[],
        source_count=len({a.source for a in arts}),
        articles=arts,
    )


def _is_stub(cluster: Cluster) -> bool:
    return cluster.briefing.lstrip().startswith("- ")


def _quota_429() -> LLMError:
    err = LLMError("HTTP 429 ...: quota exceeded")
    err.status_code = 429  # type: ignore[attr-defined]
    return err


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    """Keep tests instant regardless of the LLM_CALL_DELAY_S default."""
    monkeypatch.setattr(describe, "_SLEEP_BETWEEN_CALLS_S", 0.0)


# describe_all: budget cap + circuit-breaker
def test_singletons_never_call_the_llm(monkeypatch):
    calls = {"n": 0}

    def fake_generate(prompt, system=None):
        calls["n"] += 1
        return _VALID_JSON

    monkeypatch.setattr(describe, "generate", fake_generate)
    clusters = [_cluster(f"s{i}", 1) for i in range(3)]

    describe.describe_all(clusters)

    assert calls["n"] == 0
    for c in clusters:
        assert c.briefing == "Description for article 0."
        assert not _is_stub(c)


def test_budget_cap_limits_real_briefings(monkeypatch):
    calls = {"n": 0}

    def fake_generate(prompt, system=None):
        calls["n"] += 1
        return _VALID_JSON

    monkeypatch.setattr(describe, "generate", fake_generate)
    monkeypatch.setattr(describe, "_MAX_LLM_CLUSTERS", 2)

    # 5 multi-article clusters; only the first 2 should get a real briefing.
    clusters = [_cluster(f"m{i}", 3) for i in range(5)]
    describe.describe_all(clusters)

    assert calls["n"] == 2
    assert [not _is_stub(c) for c in clusters] == [True, True, False, False, False]
    assert clusters[0].briefing == _REAL_BRIEFING
    assert _is_stub(clusters[2])


def test_quota_breaker_stops_after_consecutive_429s(monkeypatch):
    calls = {"n": 0}

    def fake_generate(prompt, system=None):
        calls["n"] += 1
        raise _quota_429()

    monkeypatch.setattr(describe, "generate", fake_generate)
    monkeypatch.setattr(describe, "_MAX_LLM_CLUSTERS", 100)  # budget is not the limiter
    monkeypatch.setattr(describe, "_QUOTA_BREAKER_THRESHOLD", 2)

    clusters = [_cluster(f"m{i}", 3) for i in range(6)]
    describe.describe_all(clusters)

    # Stops calling after 2 consecutive 429s; everything ends up stubbed.
    assert calls["n"] == 2
    assert all(_is_stub(c) for c in clusters)


def test_parse_errors_do_not_trip_quota_breaker(monkeypatch):
    """A bad/unparseable response stubs that cluster but is not a quota signal,
    so the budget stays the only limiter."""
    calls = {"n": 0}

    def fake_generate(prompt, system=None):
        calls["n"] += 1
        return "not json"  # _parse_response raises ValueError

    monkeypatch.setattr(describe, "generate", fake_generate)
    monkeypatch.setattr(describe, "_MAX_LLM_CLUSTERS", 4)
    monkeypatch.setattr(describe, "_QUOTA_BREAKER_THRESHOLD", 2)

    clusters = [_cluster(f"m{i}", 3) for i in range(6)]
    describe.describe_all(clusters)

    assert calls["n"] == 4  # all budget slots spent; breaker never tripped
    assert all(_is_stub(c) for c in clusters)


def test_intermittent_429_resets_consecutive_count(monkeypatch):
    """A success between 429s resets the streak, so the breaker only trips on a
    genuinely consecutive run."""
    seq = iter([_quota_429(), None, _quota_429(), _quota_429(), _quota_429()])
    calls = {"n": 0}

    def fake_generate(prompt, system=None):
        calls["n"] += 1
        item = next(seq)
        if item is not None:
            raise item
        return _VALID_JSON

    monkeypatch.setattr(describe, "generate", fake_generate)
    monkeypatch.setattr(describe, "_MAX_LLM_CLUSTERS", 100)
    monkeypatch.setattr(describe, "_QUOTA_BREAKER_THRESHOLD", 2)

    clusters = [_cluster(f"m{i}", 3) for i in range(6)]
    describe.describe_all(clusters)

    # 429, ok (reset), 429, 429 -> trips on the 4th call; 2 clusters left stubbed.
    assert calls["n"] == 4
    assert not _is_stub(clusters[1])  # the success


# llm: retry policy
class _Resp:
    def __init__(self, status_code: int, text: str = "err"):
        self.status_code = status_code
        self.url = "https://api.example.com/v1/x?key=secret"
        self.text = text


def test_raise_for_status_marks_429_not_retryable():
    with pytest.raises(LLMError) as ei:
        llm._raise_for_status(_Resp(429))
    assert ei.value.status_code == 429
    assert ei.value.retryable is False
    # the api key in the query string must never leak into the error message
    assert "secret" not in str(ei.value)


def test_raise_for_status_marks_5xx_retryable():
    with pytest.raises(LLMError) as ei:
        llm._raise_for_status(_Resp(503))
    assert ei.value.status_code == 503
    assert ei.value.retryable is True


def test_with_retries_does_not_retry_429(monkeypatch):
    monkeypatch.setattr(llm.time, "sleep", lambda *_: None)
    calls = {"n": 0}

    def call():
        calls["n"] += 1
        err = LLMError("429")
        err.retryable = False  # type: ignore[attr-defined]
        raise err

    with pytest.raises(LLMError):
        llm._with_retries(call)
    assert calls["n"] == 1  # surfaced immediately, no retry loop


def test_with_retries_retries_5xx_to_max(monkeypatch):
    monkeypatch.setattr(llm.time, "sleep", lambda *_: None)
    calls = {"n": 0}

    def call():
        calls["n"] += 1
        err = LLMError("503")
        err.retryable = True  # type: ignore[attr-defined]
        raise err

    with pytest.raises(LLMError):
        llm._with_retries(call)
    assert calls["n"] == 3  # default max_attempts

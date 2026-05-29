"""Cluster description.

Calls the LLM (provider configured via LLM_PROVIDER env var, default Gemini
Flash) to produce a research-analyst-style factual briefing for each cluster.

Failure handling:
  - If the LLM call fails for a single cluster, that cluster falls back to
    the old concatenated-bullets stub. The rest of the digest still ships.
  - If the LLM key is missing entirely, every cluster falls back to the stub
    and a warning is logged once.

The structure returned is the same one the dashboard already renders:
  cluster.headline   — short factual headline
  cluster.briefing   — ~200-250 word factual writeup
  cluster.tags       — 0-3 tags from the taxonomy
"""

from __future__ import annotations

import json
import logging
import os
import re
import time

from .llm import LLMError, generate
from .models import Article, Cluster

log = logging.getLogger(__name__)


_MAX_BRIEFING_ARTICLES = 8
_SLEEP_BETWEEN_CALLS_S = float(os.environ.get("LLM_CALL_DELAY_S", "1.0"))

# Cap on how many (multi-article) clusters get a real LLM briefing per run.
# Clusters arrive pre-sorted by importance (source_count, then article count)
# from dedupe, so this spends the budget on the biggest stories and stubs the
# long tail — the single biggest lever for staying under Gemini's free tier.
_MAX_LLM_CLUSTERS = int(os.environ.get("LLM_MAX_CLUSTERS", "20"))

# Trip the circuit-breaker after this many consecutive 429s: the daily quota is
# gone, so stop calling for the rest of the run instead of failing N more times.
_QUOTA_BREAKER_THRESHOLD = int(os.environ.get("LLM_QUOTA_BREAKER", "2"))

# pull from config if it exists; otherwise this default list will do.
try:
    from .config import TOPIC_TAXONOMY  # type: ignore
except Exception:
    TOPIC_TAXONOMY = [
        "monetary-policy", "inflation", "labor-market", "housing",
        "equities", "fixed-income", "fx", "commodities", "energy",
        "geopolitics", "china", "europe", "emerging-markets",
        "banking", "regulation", "crypto", "tech", "ai",
        "earnings", "m-and-a", "private-credit",
    ]


_SYSTEM_PROMPT = (
    "You are a research analyst writing factual morning briefings for a "
    "finance newsletter. Your job is to summarize a cluster of related news "
    "articles into a single neutral, fact-dense writeup.\n\n"
    "Rules:\n"
    "1. Use ONLY information present in the source articles. Do not speculate, "
    "extrapolate, or add context from outside the sources.\n"
    "2. No evaluative or editorial language: avoid words like 'significant', "
    "'notable', 'important', 'concerning', 'surprising', 'crucial', 'major'. "
    "Let the facts speak.\n"
    "3. No predictions, causes, or implications unless an article explicitly "
    "attributes them to a named source (e.g. 'Goldman Sachs forecasts...').\n"
    "4. Lead with the most concrete fact (number, decision, event, date).\n"
    "5. Briefing length: 150-250 words. Plain prose, not bullets.\n"
    "6. Headline: one neutral declarative sentence, under 90 characters, no "
    "clickbait verbs ('soars', 'plunges', 'rockets').\n"
    "7. Tags: pick 0-3 from the provided taxonomy. Use only the exact strings "
    "given. If nothing fits, return an empty array.\n\n"
    "Return ONLY a JSON object with this exact shape, no markdown fences, no "
    "preamble:\n"
    '{"headline": "...", "briefing": "...", "tags": ["tag1", "tag2"]}'
)


def describe_cluster(cluster: Cluster) -> Cluster:
    """Describe a single cluster, best-effort (never raises).

    Singletons skip the LLM entirely — a one-article "cluster" is just that
    article, so its own title/description is the briefing. Multi-article
    clusters get a real LLM briefing, falling back to the stub on any
    failure.

    For full daily runs prefer describe_all, which adds the top-N budget cap
    and the quota circuit-breaker that keep us inside Gemini's free tier.
    """
    if not cluster.articles:
        return cluster

    if len(cluster.articles) == 1:
        _apply_singleton(cluster)
        return cluster

    try:
        _apply_llm(cluster)
    except (LLMError, ValueError, KeyError) as exc:
        log.warning(
            "describe_cluster fell back to stub for cluster %s: %s",
            getattr(cluster, "id", "?"),
            exc,
        )
        _apply_stub(cluster)

    return cluster


def describe_all(clusters: list[Cluster]) -> list[Cluster]:
    """Describe clusters, spending the LLM only where it earns its keep.

    Two guards keep us inside Gemini's free-tier quota:

    1. Budget cap. Clusters arrive pre-sorted by importance (source_count,
       then article count) from dedupe, so we give the LLM to the first
       _MAX_LLM_CLUSTERS multi-article clusters and stub the long tail.
       Singletons always skip the LLM. Tune via LLM_MAX_CLUSTERS.

    2. Quota circuit-breaker. Once the API returns _QUOTA_BREAKER_THRESHOLD
       consecutive 429s the daily quota is gone for the rest of the run —
       every further call would just fail and burn rate headroom — so we
       stop calling and stub everything remaining. Tune via LLM_QUOTA_BREAKER.

    The inter-call sleep (LLM_CALL_DELAY_S) is RPM insurance and only fires
    between real attempts, never after the breaker trips.
    """
    llm_ok = 0
    llm_fail = 0
    tail_stubbed = 0
    consecutive_429 = 0
    breaker = False

    for i, c in enumerate(clusters):
        if not c.articles:
            continue

        if len(c.articles) == 1:
            _apply_singleton(c)
            continue

        # multi-article: stub the long tail and anything past the breaker
        if breaker or (llm_ok + llm_fail) >= _MAX_LLM_CLUSTERS:
            _apply_stub(c)
            tail_stubbed += 1
            continue

        # spend one LLM call on this cluster
        try:
            _apply_llm(c)
            llm_ok += 1
            consecutive_429 = 0
        except LLMError as exc:
            llm_fail += 1
            _apply_stub(c)
            log.warning("describe: cluster %s fell back to stub: %s", c.id, exc)
            if getattr(exc, "status_code", None) == 429:
                consecutive_429 += 1
                if consecutive_429 >= _QUOTA_BREAKER_THRESHOLD:
                    breaker = True
                    log.warning(
                        "LLM quota exhausted after %d consecutive 429s; "
                        "stubbing all remaining clusters this run.",
                        consecutive_429,
                    )
            else:
                consecutive_429 = 0
        except (ValueError, KeyError) as exc:
            llm_fail += 1
            consecutive_429 = 0
            _apply_stub(c)
            log.warning(
                "describe: cluster %s returned an unusable response, stubbed: %s",
                c.id,
                exc,
            )

        # pace between real attempts; pointless once the breaker has tripped
        if not breaker and _SLEEP_BETWEEN_CALLS_S > 0 and i < len(clusters) - 1:
            time.sleep(_SLEEP_BETWEEN_CALLS_S)

    log.info(
        "describe: %d LLM briefings, %d LLM failures, %d tail stubbed "
        "(budget=%d, breaker_tripped=%s)",
        llm_ok,
        llm_fail,
        tail_stubbed,
        _MAX_LLM_CLUSTERS,
        breaker,
    )
    return clusters


# real LLM briefing for one multi-article cluster
def _apply_llm(cluster: Cluster) -> None:
    """Generate and apply a real LLM briefing. Raises on failure.

    Mutates `cluster` in place on success. Lets LLMError / ValueError /
    KeyError propagate so the caller can fall back to a stub and, in
    describe_all, drive the quota circuit-breaker.
    """
    user_prompt = _build_prompt(cluster.articles)
    raw = generate(user_prompt, system=_SYSTEM_PROMPT)
    parsed = _parse_response(raw)
    cluster.headline = parsed["headline"]
    cluster.briefing = parsed["briefing"]
    cluster.tags = parsed["tags"]


# prompt construction
def _build_prompt(articles: list[Article]) -> str:
    """Format the article cluster + taxonomy into the user message."""
    lines: list[str] = []
    lines.append("Topic taxonomy (choose 0-3, use exact strings):")
    lines.append(", ".join(TOPIC_TAXONOMY))
    lines.append("")
    lines.append(f"Source articles ({len(articles[:_MAX_BRIEFING_ARTICLES])}):")
    lines.append("")

    for i, art in enumerate(articles[:_MAX_BRIEFING_ARTICLES], 1):
        outlet = art.source or "unknown"
        published = art.published_at.date().isoformat() if art.published_at else ""
        title = (art.title or "").strip()
        desc = _strip_html(art.description or "").strip()
        # description can be huge (Calculated Risk dumps full posts), so we cap it.
        if len(desc) > 1500:
            desc = desc[:1500] + "..."

        lines.append(f"[{i}] {outlet} ({published})")
        lines.append(f"    Title: {title}")
        if desc:
            lines.append(f"    Body: {desc}")
        lines.append("")

    lines.append(
        "Write the briefing now. Return JSON only, no markdown fences."
    )
    return "\n".join(lines)


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(text: str) -> str:
    """Quick-and-dirty HTML stripping for RSS descriptions."""
    no_tags = _HTML_TAG_RE.sub(" ", text)
    no_entities = (
        no_tags
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#8217;", "'")
        .replace("&#8220;", '"')
        .replace("&#8221;", '"')
        .replace("&#8230;", "...")
    )
    return _WHITESPACE_RE.sub(" ", no_entities).strip()


# response parsing
def _parse_response(raw: str) -> dict:
    """Extract and validate the JSON object from the LLM response."""
    text = raw.strip()
    # Strip markdown fences if the model added them despite instructions.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM did not return valid JSON: {text[:200]!r}") from exc

    if not isinstance(obj, dict):
        raise ValueError(f"LLM JSON was not an object: {type(obj).__name__}")

    headline = obj.get("headline", "")
    briefing = obj.get("briefing", "")
    tags = obj.get("tags", [])

    if not isinstance(headline, str) or not headline.strip():
        raise ValueError("missing or empty 'headline'")
    if not isinstance(briefing, str) or not briefing.strip():
        raise ValueError("missing or empty 'briefing'")
    if not isinstance(tags, list):
        raise ValueError(f"'tags' must be a list, got {type(tags).__name__}")

    # Coerce + filter tags to known taxonomy. The model occasionally invents
    # tags despite instructions; silently dropping is fine here.
    clean_tags: list[str] = []
    for t in tags:
        if isinstance(t, str) and t in TOPIC_TAXONOMY:
            clean_tags.append(t)
        if len(clean_tags) >= 3:
            break

    return {
        "headline": headline.strip(),
        "briefing": briefing.strip(),
        "tags": clean_tags,
    }


# singleton: skip the LLM, the article is its own briefing
def _apply_singleton(cluster: Cluster) -> None:
    """Use the lone article's own title and description as the briefing.

    No LLM call. A singleton "cluster" is just one story; the article's
    description already summarizes it, and the LLM would mostly rephrase
    rather than synthesize. Reserves the API budget for multi-article
    clusters where the merge produces something new.
    """
    art = cluster.articles[0]
    cluster.headline = art.title
    desc = _strip_html(art.description or "").strip()
    cluster.briefing = desc if desc else art.title
    cluster.tags = []


# stub fallback (unchanged from V1)
def _apply_stub(cluster: Cluster) -> None:
    cluster.headline = cluster.articles[0].title

    bullets: list[str] = []
    for art in cluster.articles[:_MAX_BRIEFING_ARTICLES]:
        line = f"- {art.title}"
        desc = (art.description or "").strip()
        if desc:
            line += f" — {desc}"
        bullets.append(line)
    cluster.briefing = "\n".join(bullets)
    cluster.tags = []

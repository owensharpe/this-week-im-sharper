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

# Pull from config if it exists; otherwise this default list will do.
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
    """Generate a real LLM briefing for one cluster, with stub fallback."""
    if not cluster.articles:
        return cluster

    user_prompt = _build_prompt(cluster.articles)

    try:
        raw = generate(user_prompt, system=_SYSTEM_PROMPT)
        parsed = _parse_response(raw)
        cluster.headline = parsed["headline"]
        cluster.briefing = parsed["briefing"]
        cluster.tags = parsed["tags"]
    except (LLMError, ValueError, KeyError) as exc:
        log.warning(
            "describe_cluster fell back to stub for cluster %s: %s",
            getattr(cluster, "id", "?"),
            exc,
        )
        _apply_stub(cluster)

    return cluster


def describe_all(clusters: list[Cluster]) -> list[Cluster]:
    """Describe every cluster, sleeping briefly between calls.

    The sleep is cheap insurance against the Gemini free-tier 15 RPM ceiling
    on a heavy day. Tune via LLM_CALL_DELAY_S env var (default 1s).
    """
    out: list[Cluster] = []
    for i, c in enumerate(clusters):
        out.append(describe_cluster(c))
        if i < len(clusters) - 1 and _SLEEP_BETWEEN_CALLS_S > 0:
            time.sleep(_SLEEP_BETWEEN_CALLS_S)
    return out


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
        # Description can be huge (Calculated Risk dumps full posts), so we cap it.
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


# stub fallback (unchanged behavior from V1)
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

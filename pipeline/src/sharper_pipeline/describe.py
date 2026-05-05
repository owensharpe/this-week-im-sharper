"""Cluster description.

V1: a placeholder that concatenates article titles + descriptions into a
bulleted briefing. No LLM call. The point is to ship an end-to-end pipeline
the dashboard can render today; the writeup quality lands when the LLM is
wired in.

# TODO(LLM): replace `describe_cluster` body with a Claude API call.
# The signature below is the swap-point — keep `Cluster` in / `Cluster` out
# so the rest of the pipeline never has to learn the model exists.
# Suggested prompt frame (research-analyst morning brief, factual not commentary):
#   - 1 line: neutral headline summarising the story
#   - 4-8 bullets: who/what/when/where/why, only facts present in the sources
#   - tags: pick 0-3 from config.TOPIC_TAXONOMY
"""

from __future__ import annotations

import logging

from .models import Cluster

log = logging.getLogger(__name__)


_MAX_BRIEFING_ARTICLES = 8


def describe_cluster(cluster: Cluster) -> Cluster:
    """V1 placeholder — concatenate titles + descriptions, no LLM."""
    if not cluster.articles:
        return cluster

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
    return cluster


def describe_all(clusters: list[Cluster]) -> list[Cluster]:
    return [describe_cluster(c) for c in clusters]

"""Pydantic models for the pipeline's structured output."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator

BriefingSource = Literal["llm", "singleton", "stub"]


class Article(BaseModel):
    id: str
    title: str
    description: str = ""
    url: HttpUrl
    source: str
    published_at: datetime
    fetched_from: str = Field(
        description="Which connector found this article: 'newsapi', 'rss', 'finnhub'."
    )

    @field_validator("title", "description")
    @classmethod
    def _strip(cls, v: str) -> str:
        return (v or "").strip()

    @classmethod
    def make_id(cls, url: str) -> str:
        return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


class Cluster(BaseModel):
    id: str
    headline: str
    briefing: str
    tags: list[str] = Field(default_factory=list)
    source_count: int
    articles: list[Article]
    briefing_source: BriefingSource = Field(
        default="stub",
        description=(
            "How the briefing was written: 'llm' is a real synthesized "
            "paragraph, 'singleton' is a lone article's own blurb, 'stub' is "
            "the concatenated-bullets fallback. The dashboard only renders "
            "'llm' clusters."
        ),
    )

    @classmethod
    def make_id(cls, articles: list[Article]) -> str:
        joined = "|".join(sorted(a.id for a in articles))
        return hashlib.sha1(joined.encode("utf-8")).hexdigest()[:16]


class DailyDigest(BaseModel):
    date: str
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    clusters: list[Cluster]
    article_count: int
    source_count: int
    notes: Optional[str] = None

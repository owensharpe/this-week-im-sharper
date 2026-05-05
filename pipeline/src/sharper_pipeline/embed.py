"""Sentence-transformer embeddings (CPU). Lazy-loaded so tests can stub it."""

from __future__ import annotations

import logging
from functools import lru_cache

import numpy as np

from .config import EMBEDDING_MODEL
from .models import Article

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _model():
    from sentence_transformers import SentenceTransformer

    log.info("loading embedding model %s", EMBEDDING_MODEL)
    return SentenceTransformer(EMBEDDING_MODEL, device="cpu")


def article_text(article: Article) -> str:
    parts = [article.title]
    if article.description:
        parts.append(article.description)
    return " — ".join(parts)


def embed_articles(articles: list[Article]) -> np.ndarray:
    """Returns an (n, d) array of L2-normalised embeddings."""
    if not articles:
        return np.zeros((0, 384), dtype=np.float32)

    texts = [article_text(a) for a in articles]
    vectors = _model().encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return vectors.astype(np.float32)

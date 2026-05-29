"""JSON writer for daily digests."""

from __future__ import annotations

import logging
from pathlib import Path

from .config import DIGESTS_DIR
from .models import DailyDigest

log = logging.getLogger(__name__)


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_daily(digest: DailyDigest, out_dir: Path | None = None) -> Path:
    target_dir = out_dir or DIGESTS_DIR
    _ensure_dir(target_dir)
    path = target_dir / f"{digest.date}.json"
    payload = digest.model_dump_json(indent=2)
    path.write_text(payload, encoding="utf-8")
    log.info("wrote %s (%d clusters)", path, len(digest.clusters))
    return path

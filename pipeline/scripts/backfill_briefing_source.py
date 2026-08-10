"""One-off backfill: stamp `briefing_source` onto clusters in existing digests.

Digests written before the field existed carry no record of how each briefing
was produced, and the dashboard now renders only real LLM briefings. This
script infers the source from the shape of the data the writers left behind:

  singleton — exactly one article, so describe.py used the article's own blurb
  stub      — multiple articles and the briefing is the concatenated-bullets
              fallback ("- Title — description" lines)
  llm       — multiple articles and the briefing is prose

Nothing is deleted and no other field is touched; files round-trip byte for
byte apart from the added key. Safe to re-run — clusters that already carry a
briefing_source are left alone unless --force is passed.

Usage:
    uv run python scripts/backfill_briefing_source.py            # write
    uv run python scripts/backfill_briefing_source.py --dry-run  # report only
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# content/digests, relative to the repo root (this file lives in pipeline/scripts)
DEFAULT_DIGESTS_DIR = Path(__file__).resolve().parents[2] / "content" / "digests"


def classify(cluster: dict) -> str:
    """Infer how this cluster's briefing was written."""
    if len(cluster.get("articles", [])) <= 1:
        return "singleton"
    if cluster.get("briefing", "").lstrip().startswith("- "):
        return "stub"
    return "llm"


def backfill_file(path: Path, *, force: bool, dry_run: bool) -> dict[str, int]:
    raw = path.read_text(encoding="utf-8")
    digest = json.loads(raw)

    counts = {"llm": 0, "singleton": 0, "stub": 0, "skipped": 0}
    changed = False

    for cluster in digest.get("clusters", []):
        if cluster.get("briefing_source") and not force:
            counts["skipped"] += 1
            counts[cluster["briefing_source"]] = (
                counts.get(cluster["briefing_source"], 0) + 1
            )
            continue
        source = classify(cluster)
        if cluster.get("briefing_source") != source:
            cluster["briefing_source"] = source
            changed = True
        counts[source] += 1

    if changed and not dry_run:
        # pydantic's model_dump_json(indent=2) output round-trips exactly through
        # json.dumps with these settings and no trailing newline, so re-writing
        # an untouched file would be a no-op diff.
        path.write_text(
            json.dumps(digest, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    counts["changed"] = int(changed)
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--digests-dir",
        type=Path,
        default=DEFAULT_DIGESTS_DIR,
        help=f"directory of digest JSON files (default: {DEFAULT_DIGESTS_DIR})",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="report counts without writing"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="re-classify clusters that already have a briefing_source",
    )
    args = parser.parse_args()

    if not args.digests_dir.is_dir():
        print(f"no such directory: {args.digests_dir}", file=sys.stderr)
        return 1

    files = sorted(args.digests_dir.glob("*.json"))
    if not files:
        print(f"no digest files in {args.digests_dir}", file=sys.stderr)
        return 1

    totals = {"llm": 0, "singleton": 0, "stub": 0, "skipped": 0}
    files_changed = 0

    for path in files:
        counts = backfill_file(path, force=args.force, dry_run=args.dry_run)
        files_changed += counts.pop("changed")
        for key in totals:
            totals[key] += counts.get(key, 0)
        print(
            f"{path.name}: llm={counts['llm']} singleton={counts['singleton']} "
            f"stub={counts['stub']}"
        )

    verb = "would write" if args.dry_run else "wrote"
    print(
        f"\n{len(files)} files scanned, {verb} {files_changed}. "
        f"totals: llm={totals['llm']} singleton={totals['singleton']} "
        f"stub={totals['stub']} already-tagged={totals['skipped']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

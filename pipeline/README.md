# sharper-pipeline

Daily news pipeline that powers the `/dashboard` view in the parent Next.js
project. Pulls finance / markets / macro / geopolitics news from NewsAPI,
RSS feeds, and Finnhub; deduplicates and clusters them; writes JSON to
`../content/digests/`.

**V1 — no LLM yet.** `describe.py` ships a placeholder briefing built from
article titles + descriptions. The architecture is organised so swapping in
a Claude API call is a single-function change. See
[Wire up Claude API](#wire-up-claude-api) below.

## Setup (uv)

```bash
# install uv: https://docs.astral.sh/uv/getting-started/installation/
cd pipeline
uv sync
cp .env.example .env
# edit .env with your keys
```

You need API keys for:

- **NewsAPI**:register at https://newsapi.org/register
- **Finnhub**:register at https://finnhub.io/register

The RSS feeds need no key.

## Run locally

```bash
# daily run — writes ../content/digests/YYYY-MM-DD.json
uv run sharper-pipeline

# weekly rollup — writes ../content/digests/weekly-latest.json
uv run sharper-pipeline-weekly
```

First run downloads the embedding model
(`sentence-transformers/all-MiniLM-L6-v2`, ~90 MB) and caches it locally.

## Tests

```bash
uv run --extra dev pytest
```

Tests pass synthetic embeddings — they don't load the sentence-transformers
model.

## Debugging a failing source

The pipeline is intentionally tolerant: a source that errors logs a warning
and the rest of the run continues. To narrow down a failure:

```bash
# rerun with fresh logging
uv run sharper-pipeline 2>&1 | tee /tmp/pipeline.log
```

Common issues:

- **NewsAPI returns 401** → key is missing or invalid. Check `.env`.
- **NewsAPI returns 426** → the free tier blocks server-side requests for
  some endpoints; the pipeline already prefers `/everything` for those.
- **An RSS feed shows `0 entries`** → the feed URL changed or returned a 403. Check the URL in a browser; if dead, edit `RSS_FEEDS` in
  [`config.py`](src/sharper_pipeline/config.py).
- **Finnhub returns `unexpected payload shape`** → rate limit hit; back off
  for a minute.
- **`embed_articles` hangs on first run** → it's downloading the model.
  Subsequent runs read from `~/.cache/huggingface/`.

To probe one source in isolation:

```bash
uv run python -c "from sharper_pipeline.sources import rss; \
  print(len(rss.fetch()), 'rss articles')"
```

## Output shape

```jsonc
// content/digests/YYYY-MM-DD.json
{
  "date": "2026-05-05",
  "generated_at": "2026-05-05T11:00:01Z",
  "clusters": [
    {
      "id": "abc...",
      "headline": "Fed holds rates steady",
      "briefing": "- Fed holds rates...\n- Federal Reserve...",
      "tags": [],
      "source_count": 4,
      "articles": [{ "id": "...", "title": "...", "url": "...", ... }]
    }
  ],
  "article_count": 312,
  "source_count": 18
}
```

Tags are empty in V1 — the LLM will assign them later from the taxonomy in
[`config.py`](src/sharper_pipeline/config.py).

## Wire up Claude API

When the LLM gets wired in, only `describe.py` should change. The
swap-point is `describe_cluster(cluster: Cluster) -> Cluster`. Suggested
shape:

1. Add `anthropic` to `pyproject.toml` dependencies.
2. Add `ANTHROPIC_API_KEY` to `.env.example` and the workflow secrets.
3. In `describe_cluster`:
   - Build a prompt frame: the cluster's article titles + descriptions, plus
     the topic taxonomy from `config.TOPIC_TAXONOMY`.
   - Ask for a structured response: `headline`, `briefing` (4–8 factual
     bullets, no commentary), `tags` (subset of the taxonomy).
   - Parse and assign onto the cluster.
4. Keep the V1 path as a fallback when `ANTHROPIC_API_KEY` is missing, so
   local runs without the key still work.

The rest of the pipeline (fetch, filter, embed, cluster, output, rollup,
the workflow, the dashboard) needs no changes.

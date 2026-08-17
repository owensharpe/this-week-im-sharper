# sharper-pipeline

Daily news pipeline that powers the `/dashboard` view in the parent Next.js
project. Pulls finance / markets / macro / geopolitics news from NewsAPI,
RSS feeds, and Finnhub; deduplicates and clusters them; writes JSON to
`../content/digests/`.

Cluster briefings are written by an LLM. `describe.py` sends each
multi-article cluster to the configured provider (default Gemini 2.5 Flash;
`anthropic` and `deepseek` also supported) and asks for a neutral, fact-dense
briefing, a headline, and 0–3 tags from the taxonomy. Single-article clusters
skip the LLM and reuse the article's own title and description. If a call
fails — or no API key is set — that cluster falls back to a plain stub built
from article titles, so the digest always ships. See
[LLM briefings](#llm-briefings) below.

## Setup (uv)

```bash
# install uv: https://docs.astral.sh/uv/getting-started/installation/
cd pipeline
uv sync
cp .env.example .env
# edit .env with your keys
```

You need API keys for:

- **NewsAPI** — register at https://newsapi.org/register
- **Finnhub** — register at https://finnhub.io/register
- **An LLM provider** — Gemini by default (free tier, no card):
  https://aistudio.google.com/apikey. Set `LLM_PROVIDER` and its matching key
  in `.env`. Without an LLM key the pipeline still runs, but every briefing is
  the plain stub.

The RSS feeds need no key.

## Run locally

```bash
# daily run — writes ../content/digests/YYYY-MM-DD.json
uv run sharper-pipeline
```

First run downloads the embedding model
(`sentence-transformers/all-MiniLM-L6-v2`, ~90 MB) and caches it locally.

## Tests

```bash
uv run --extra dev pytest
```

Tests pass synthetic embeddings; they don't load the sentence-transformers
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
- **Every briefing is a bullet-list stub** → the LLM key is missing or you're
  being rate-limited. Watch for `429` or "fell back to stub" warnings in the
  logs; check `LLM_PROVIDER` and its key in `.env`, or raise `LLM_CALL_DELAY_S`.
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
      "headline": "Fed holds benchmark rate steady at May meeting",
      "briefing": "The Federal Reserve held its benchmark rate at ... (LLM prose, ~150-250 words)",
      "tags": ["monetary-policy"],
      "source_count": 4,
      "articles": [{ "id": "...", "title": "...", "url": "...", ... }]
    }
  ],
  "article_count": 312,
  "source_count": 18
}
```

`briefing` is LLM-written prose (or a bullet stub when the LLM is skipped or
fails); `tags` are 0–3 entries from the taxonomy in
[`config.py`](src/sharper_pipeline/config.py).

## LLM briefings

Briefings are generated in [`describe.py`](src/sharper_pipeline/describe.py),
which calls the provider-agnostic gateway in
[`llm.py`](src/sharper_pipeline/llm.py). Pick a provider with `LLM_PROVIDER`
and set the matching key (see example of some providers and models below):

| `LLM_PROVIDER` | key                 | default model (override var)            |
| -------------- | ------------------- | --------------------------------------- |
| `gemini`       | `GEMINI_API_KEY`    | `gemini-2.5-flash` (`GEMINI_MODEL`)     |
| `anthropic`    | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` (`ANTHROPIC_MODEL`) |
| `deepseek`     | `DEEPSEEK_API_KEY`  | `deepseek-chat` (`DEEPSEEK_MODEL`)      |

Notes:

- A one-article cluster reuses the article's own
  title and description, reserving API calls for multi-article merges.
- A failed call (rate limit, bad JSON, missing key)
  drops only that cluster to the stub; the rest of the digest is unaffected.
- `LLM_CALL_DELAY_S` (default `1.0`) is the pause between
  LLM calls. Gemini's free tier allows ~10 requests/min, so bump it if you see
  429s — the GitHub Actions run uses `7`.

Only `describe.py` and `llm.py` know about the LLM; the rest of the pipeline
(fetch, filter, embed, cluster, output, the workflow, the dashboard) is
provider-agnostic.

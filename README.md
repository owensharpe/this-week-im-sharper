# This Week I'm Sharper

A finance and macro newsletter, and the automated research pipeline that feeds it.

Two halves share this repository:

- **The site** (`src/`) is a statically exported Next.js app that publishes the newsletter
  issues and renders the daily digest.
- **The pipeline** (`pipeline/`) is a Python job that runs every morning, pulls ~600 articles
  from 14 sources, clusters them into distinct stories using sentence embeddings, has an LLM
  write a neutral briefing for the biggest ones, and commits the result back to this repo as
  JSON.

The site reads that JSON at build time. There is no database and no server: the pipeline's
output is versioned in git, and the whole front end is pre-rendered HTML.

```
  NewsAPI ──┐
  10 RSS   ─┼─→ fetch → filter → embed → cluster → describe → content/digests/YYYY-MM-DD.json
  Finnhub ──┘                  (MiniLM)  (agglom.)   (LLM)               │
                                                                        ▼
                                            Next.js reads the filesystem at build time
```

## Quickstart

The site and the pipeline are installed separately.

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
cd pipeline
uv sync
cp .env.example .env  # add your API keys
uv run sharper-pipeline
```

The site runs fine with no pipeline output at all; the dashboard just shows an empty state.
See [`pipeline/README.md`](pipeline/README.md) for API keys, provider configuration, the
output schema, and a debugging runbook for each failure mode.

## How the pipeline works

1. **Fetch** (`sources/`). Three connectors, each exposing `fetch() -> list[Article]`: NewsAPI
   (three tuned queries), 10 curated RSS feeds including the Fed, ECB, and Bank of England
   press releases, and Finnhub market news. Each one fails independently, so a dead feed or a
   missing key degrades the run instead of ending it.
2. **Filter** (`filter.py`). Drops empty, clickbait, and content-farm articles, then
   deduplicates by URL, which is where most syndicated wire copy goes.
3. **Embed** (`embed.py`). `all-MiniLM-L6-v2` on CPU, 384 dimensions, L2-normalized. Loaded
   lazily so tests can pass synthetic vectors without downloading the model.
4. **Cluster** (`dedupe.py`). Agglomerative clustering over cosine distance with a similarity
   threshold, since the number of stories per day is not known in advance. Average linkage
   avoids the chaining that would merge unrelated stories. Cluster IDs are order-independent
   hashes of their members, so the same story yields the same ID across runs.
5. **Describe** (`describe.py`). Each multi-article cluster gets an LLM-written briefing
   constrained to a factual register: source-grounded claims only, no evaluative language, a
   neutral headline, and up to three tags from a fixed taxonomy. Output is parsed and validated
   rather than trusted.
6. **Write** (`output.py`). One Pydantic-validated JSON file per day.

### Staying inside a free API tier

Briefing generation is the only part that costs money, so three mechanisms bound it:

- **Single-article clusters skip the LLM entirely.** The article's own description already
  summarizes it, so a call would only paraphrase.
- **A top-N budget cap.** Clustering sorts by source count, so the first `LLM_MAX_CLUSTERS`
  (default 20) calls land on the biggest stories and the long tail is stubbed.
- **A quota circuit-breaker.** After two consecutive 429s the daily quota is presumed gone, so
  the run stops calling instead of failing repeatedly. Rate limits are deliberately never
  retried; only 5xx and network errors back off and retry.

Every briefing is stamped with a `briefing_source` of `llm`, `singleton`, or `stub`, so a real
synthesized briefing is always distinguishable from a fallback. **The digest always ships** —
there is no failure or configuration state, including having no API key at all, that produces
no output.

The dashboard renders only `llm` briefings. The others stay in the JSON for archival and for
drafting issues, but a truncated RSS blurb is not worth a reader's time.

## Layout

```
src/
  app/                    routes: home, archive, about, issues/[slug], dashboard/[date], saved
  components/dashboard/   day view, cluster card, calendar picker
  lib/digests.ts          digest reader; decides what is worth rendering
  lib/issues.ts           markdown + frontmatter, chronological issue numbering
content/
  digests/                one JSON file per day, written by the pipeline
  issues/                 newsletter issues, written by hand
pipeline/
  src/sharper_pipeline/   the six stages above, plus a provider-agnostic LLM gateway
  tests/                  27 tests: clustering, cost control, retry policy, filtering
.github/workflows/        the daily scheduled run
```

## Automation

[`daily-digest.yml`](.github/workflows/daily-digest.yml) runs at 11:00 UTC (07:00 ET), caches
the embedding model so it isn't re-downloaded every run, and commits any new digest back to
`main`. It has produced 85 consecutive daily digests since 2026-05-19.

## Tests

```bash
cd pipeline && uv run --extra dev pytest
```

The suite covers clustering behavior, the budget cap and circuit-breaker state transitions,
retryability classification, ID determinism, and each filter rule. It uses synthetic
embeddings, so it runs in seconds and never touches the network.

## Stack

Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind CSS v4, shadcn/ui.
Python 3.12, uv, Pydantic, sentence-transformers, scikit-learn. Gemini by default for
briefings, with Anthropic and DeepSeek behind the same interface. GitHub Actions.

## License

Personal project. The code is here to be read; the newsletter writing is not licensed for
reuse.

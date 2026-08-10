import fs from "fs";
import path from "path";

export interface DigestArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  published_at: string;
  fetched_from: "newsapi" | "rss" | "finnhub";
}

/**
 * How the pipeline wrote a cluster's briefing:
 *   llm       — a real synthesized paragraph
 *   singleton — a lone article's own RSS blurb, usually one truncated sentence
 *   stub      — the "- Title — description" bullet fallback used when the LLM
 *               budget or quota ran out
 * Only `llm` clusters are readable as prose, so only those get rendered.
 */
export type BriefingSource = "llm" | "singleton" | "stub";

export interface DigestCluster {
  id: string;
  headline: string;
  briefing: string;
  tags: string[];
  source_count: number;
  articles: DigestArticle[];
  briefing_source?: BriefingSource;
}

export interface DailyDigest {
  date: string;
  generated_at: string;
  clusters: DigestCluster[];
  article_count: number;
  source_count: number;
  notes?: string | null;
}

const digestsDirectory = path.join(process.cwd(), "content/digests");

/**
 * True for clusters worth rendering: real LLM briefings only.
 *
 * Digests backfilled by pipeline/scripts/backfill_briefing_source.py carry the
 * field explicitly. The shape check is the fallback for any file written before
 * the backfill (or by an older pipeline): a stub is a bullet list, and a
 * one-article cluster never went through the LLM.
 */
function isRealBriefing(cluster: DigestCluster): boolean {
  if (cluster.briefing_source) return cluster.briefing_source === "llm";
  return cluster.articles.length > 1 && !cluster.briefing.trimStart().startsWith("- ");
}

function readJson(file: string): DailyDigest | null {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const digest = JSON.parse(raw) as DailyDigest;
    // Filter here so every consumer (day view, tag list, static params) sees
    // the same set. article_count / source_count stay as the pipeline recorded
    // them: they describe the day's crawl, not what's on screen.
    return { ...digest, clusters: digest.clusters.filter(isRealBriefing) };
  } catch {
    return null;
  }
}

/** All available digest dates (YYYY-MM-DD), newest first. */
export function getAllDigestDates(): string[] {
  if (!fs.existsSync(digestsDirectory)) return [];
  return fs
    .readdirSync(digestsDirectory)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ""))
    .sort()
    .reverse();
}

/** One day's digest by date string, or null if missing/invalid. */
export function getDigestByDate(date: string): DailyDigest | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readJson(path.join(digestsDirectory, `${date}.json`));
}

/** Most recent day's digest, or null if none exist. */
export function getLatestDigest(): DailyDigest | null {
  const [latest] = getAllDigestDates();
  return latest ? getDigestByDate(latest) : null;
}

/** Tags present in a single day's clusters, sorted. */
export function collectTags(digest: DailyDigest | null): string[] {
  const seen = new Set<string>();
  for (const cluster of digest?.clusters ?? []) {
    for (const tag of cluster.tags) seen.add(tag);
  }
  return Array.from(seen).sort();
}

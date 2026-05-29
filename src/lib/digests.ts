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

export interface DigestCluster {
  id: string;
  headline: string;
  briefing: string;
  tags: string[];
  source_count: number;
  articles: DigestArticle[];
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

function readJson(file: string): DailyDigest | null {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as DailyDigest;
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

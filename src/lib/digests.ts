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

export interface DigestBundle {
  weekly: DailyDigest | null;
  daily: DailyDigest[]; // newest first, up to 7
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

export function getDigestBundle(): DigestBundle {
  if (!fs.existsSync(digestsDirectory)) {
    return { weekly: null, daily: [] };
  }

  const files = fs.readdirSync(digestsDirectory);

  const weekly = readJson(path.join(digestsDirectory, "weekly-latest.json"));

  const daily = files
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .reverse()
    .slice(0, 7)
    .map((name) => readJson(path.join(digestsDirectory, name)))
    .filter((d): d is DailyDigest => d !== null);

  return { weekly, daily };
}

export function collectTags(bundle: DigestBundle): string[] {
  const seen = new Set<string>();
  const all = [
    ...(bundle.weekly?.clusters ?? []),
    ...bundle.daily.flatMap((d) => d.clusters),
  ];
  for (const cluster of all) {
    for (const tag of cluster.tags) seen.add(tag);
  }
  return Array.from(seen).sort();
}

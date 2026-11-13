import fs from "fs";
import path from "path";

/**
 * content/credit/latest.json, written by the markets job in
 * pipeline/src/sharper_pipeline/markets. The Python models there are the
 * source of truth for this shape.
 *
 * Units ride in the names: `_pct` is percent (4.25 means 4.25%), `_bp` is
 * basis points. `yields` arrays line up with their curve's `tenors`;
 * `oas_history_bp` lines up with `Credit.dates`. Null is a missing print.
 */

export interface CurveComparison {
  key: string;
  label: string;
  date: string;
  yields: (number | null)[];
}

export interface Curve {
  tenors: string[];
  years: number[];
  date: string;
  yields: (number | null)[];
  comparisons: CurveComparison[];
}

export interface Replay {
  dates: string[];
  yields: (number | null)[][];
}

export interface Slope {
  key: string;
  label: string;
  current_bp: number;
  changes_bp: Record<string, number | null>;
  dates: string[];
  values_bp: number[];
}

export interface Rates {
  as_of: string;
  nominal: Curve;
  real: Curve | null;
  replay: Replay;
  slopes: Slope[];
}

export interface CreditBucket {
  key: string;
  label: string;
  group: "IG" | "HY";
  is_index: boolean;
  oas_bp: number | null;
  oas_changes_bp: Record<string, number | null>;
  oas_percentile: number | null;
  oas_min_bp: number | null;
  oas_max_bp: number | null;
  oas_history_bp: (number | null)[];
  yield_pct: number | null;
  yield_changes_bp: Record<string, number | null>;
  returns_pct: Record<string, number | null>;
  // Weekly snapshot (schema 2+). "Prior week" is the previous week's last
  // close; ranges are trailing 52 weeks.
  oas_prior_week_bp?: number | null;
  oas_52w_low_bp?: number | null;
  oas_52w_high_bp?: number | null;
  ytw_pct?: number | null;
  ytw_prior_week_pct?: number | null;
  ytw_52w_low_pct?: number | null;
  ytw_52w_high_pct?: number | null;
  /** One per `Credit.weeks`, newest first. */
  weekly_returns_pct?: (number | null)[];
}

export interface MaturityBucket {
  key: string;
  label: string;
  oas_bp: number | null;
  comparisons_bp: Record<string, number | null>;
}

export interface WeekEnd {
  date: string;
  /** The week isn't over yet, so its return is week-to-date. */
  partial: boolean;
}

export interface Credit {
  as_of: string;
  history_start: string;
  dates: string[];
  buckets: CreditBucket[];
  maturity: MaturityBucket[];
  weeks?: WeekEnd[];
  prior_week_end?: string | null;
}

export interface Source {
  name: string;
  url: string;
  note: string;
}

export interface MarketsSnapshot {
  schema_version: number;
  generated_at: string;
  rates: Rates | null;
  credit: Credit | null;
  sources: Source[];
}

const snapshotFile = path.join(process.cwd(), "content/credit/latest.json");

/** The latest snapshot, or null before the markets job has ever run. */
export function getMarketsSnapshot(): MarketsSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(snapshotFile, "utf8")) as MarketsSnapshot;
  } catch {
    return null;
  }
}

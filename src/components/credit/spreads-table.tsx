"use client";

import { useMemo, useState } from "react";

import type { CreditBucket } from "@/lib/credit";
import { ChartPanel, ChartTabs } from "./chart-chrome";
import { bp, dayToMs, formatDay, pct, signedBp } from "./format";
import { heatStyle } from "./palette";

const TH = "px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-wider whitespace-nowrap";
const TD = "px-2 py-1.5 font-mono tabular-nums whitespace-nowrap";
const MUTED = { color: "var(--viz-muted)" };
const INDEX_ROW = { background: "color-mix(in oklch, var(--viz-ink) 6%, transparent)" };
const DAY = 86_400_000;

const WINDOWS = [
  { key: "6M", label: "6M", days: 183 },
  { key: "1Y", label: "1Y", days: 366 },
  { key: "2Y", label: "2Y", days: 731 },
  { key: "ALL", label: "All", days: null },
] as const;
const CHANGES = ["1D", "1W", "1M", "YTD"];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The spread over the window, as a tiny line: ink, ending in a dot. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 88;
  const h = 22;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = w / (values.length - 1);
  const y = (v: number) => (hi > lo ? h - 2 - ((v - lo) / (hi - lo)) * (h - 4) : h / 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="inline-block align-middle">
      <path d={d} fill="none" stroke="var(--viz-ink)" strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={w} cy={y(values[values.length - 1])} r={2.25} fill="var(--viz-ink)" />
    </svg>
  );
}

/**
 * Today's rank in the window as a short meter: filled to the percentile,
 * claret toward the widest closes (bad for a bondholder), blue toward the
 * tightest, and faint near the middle where nothing is unusual. The tick
 * marks the median.
 */
function PercentileMeter({ value }: { value: number }) {
  const distance = Math.abs(value - 50) / 50;
  const hue = value >= 50 ? "var(--viz-2)" : "var(--viz-1)";
  const fill = `color-mix(in oklch, ${hue} ${Math.round(30 + distance * 70)}%, var(--viz-panel))`;
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <span
        aria-hidden
        className="relative inline-block h-2 w-16 overflow-hidden rounded-full"
        style={{ background: "color-mix(in oklch, var(--viz-ink) 9%, transparent)" }}
      >
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(4, value)}%`, background: fill }} />
        <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "var(--viz-panel)" }} />
      </span>
      <span className="w-11 text-right">{ordinal(value)}</span>
    </span>
  );
}

/** Where today sits between the window's low and high. */
function RangeBar({ now, lo, hi }: { now: number; lo: number; hi: number }) {
  const at = hi > lo ? ((now - lo) / (hi - lo)) * 100 : 50;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-9 text-right text-[11px]" style={MUTED}>{bp(lo)}</span>
      <span className="relative inline-block h-2.5 w-20" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: "var(--viz-axis)" }} />
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${at}%`, background: "var(--viz-ink)", boxShadow: "0 0 0 2px var(--viz-panel)" }}
        />
      </span>
      <span className="w-10 text-left text-[11px]" style={MUTED}>{bp(hi)}</span>
    </span>
  );
}

/**
 * Spreads by rating. The window picks the history behind the trend line, the
 * range and the percentile; the change columns are fixed. Changes are shaded
 * blue where spreads tightened and claret where they widened.
 */
export function SpreadsTable({ buckets, dates }: { buckets: CreditBucket[]; dates: string[] }) {
  const [win, setWin] = useState<string>("ALL");
  const last = dayToMs(dates[dates.length - 1]);
  const days = WINDOWS.find((w) => w.key === win)?.days ?? null;
  const start = days == null ? -Infinity : last - days * DAY;
  const firstIndex = Math.max(0, dates.findIndex((d) => dayToMs(d) >= start));

  const rows = useMemo(
    () =>
      buckets.map((b) => {
        const window = b.oas_history_bp.slice(firstIndex).filter((v): v is number => v != null);
        const now = b.oas_bp;
        const lo = window.length ? Math.min(...window) : null;
        const hi = window.length ? Math.max(...window) : null;
        const pctile =
          now != null && window.length ? Math.round((window.filter((v) => v <= now).length / window.length) * 100) : null;
        return { b, window, lo, hi, pctile };
      }),
    [buckets, firstIndex]
  );
  const scale = Object.fromEntries(
    CHANGES.map((c) => [c, Math.max(1, ...buckets.map((b) => Math.abs(b.oas_changes_bp[c] ?? 0)))])
  );
  const since = formatDay(dates[firstIndex], "long");

  return (
    <ChartPanel
      download={{
        filename: `ice-oas-by-rating-${dates[dates.length - 1]}.csv`,
        rows: [
          ["rating", "oas_bp", ...CHANGES.map((c) => `change_${c.toLowerCase()}_bp`), "window_low_bp", "window_high_bp", "percentile", "effective_yield_pct"],
          ...rows.map(({ b, lo, hi, pctile }) => [b.label, b.oas_bp, ...CHANGES.map((c) => b.oas_changes_bp[c] ?? null), lo, hi, pctile, b.yield_pct]),
        ],
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pr-12">
        <span className="font-mono text-[11px] uppercase tracking-wider" style={MUTED}>Range window</span>
        <ChartTabs items={WINDOWS.map((w) => ({ key: w.key, label: w.label }))} value={win} onChange={setWin} label="Range window" />
        <span className="text-xs" style={MUTED}>since {since}</span>
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[820px] text-right text-sm">
          <caption className="sr-only">
            ICE BofA option-adjusted spreads by rating in basis points, with changes, and trend, range and percentile since {since}
          </caption>
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--viz-ink)" }}>
              <th scope="col" className={`${TH} text-left`}>Rating</th>
              <th scope="col" className={TH}>OAS</th>
              {CHANGES.map((c) => (
                <th key={c} scope="col" className={TH}>{c}</th>
              ))}
              <th scope="col" className={`${TH} text-center`}>Trend</th>
              <th scope="col" className={`${TH} text-center`}>Low · now · high</th>
              <th scope="col" className={TH}>Percentile</th>
              <th scope="col" className={TH}>Yield</th>
            </tr>
          </thead>
          {(["IG", "HY"] as const).map((g) => (
            <tbody key={g} className="border-b last:border-0" style={{ borderColor: "var(--viz-border)" }}>
              {rows
                .filter(({ b }) => b.group === g)
                .map(({ b, window, lo, hi, pctile }) => (
                  <tr key={b.key} style={b.is_index ? INDEX_ROW : undefined}>
                    <th scope="row" className={`${TD} text-left ${b.is_index ? "font-semibold" : "font-normal"}`}>{b.label}</th>
                    <td className={`${TD} ${b.is_index ? "font-semibold" : ""}`}>{bp(b.oas_bp)}</td>
                    {CHANGES.map((c) => {
                      const v = b.oas_changes_bp[c];
                      return (
                        <td key={c} className={TD} style={heatStyle(v == null ? null : -v, scale[c], 28)}>
                          {signedBp(v)}
                        </td>
                      );
                    })}
                    <td className={`${TD} text-center`}><Sparkline values={window} /></td>
                    <td className={`${TD} text-center`}>
                      {b.oas_bp != null && lo != null && hi != null ? <RangeBar now={b.oas_bp} lo={lo} hi={hi} /> : "–"}
                    </td>
                    <td className={TD}>{pctile == null ? "–" : <PercentileMeter value={pctile} />}</td>
                    <td className={TD}>{pct(b.yield_pct)}</td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-3 text-[11px]" style={MUTED}>
        OAS and changes in basis points. Changes shaded blue where spreads tightened, claret where they widened.
        Percentile ranks today&apos;s spread within the window: claret near its widest, blue near its tightest. Yield is the
        effective yield.
      </p>
    </ChartPanel>
  );
}

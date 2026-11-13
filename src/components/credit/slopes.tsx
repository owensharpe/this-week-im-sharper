"use client";

import { useMemo, useState } from "react";

import type { Replay } from "@/lib/credit";
import { pct } from "./format";
import { HistoryPanel, type HistoryItem } from "./history-panel";
import { OptionPicker, type PickerOption } from "./option-picker";

/**
 * Curve slopes and curvature, computed in the browser from the daily curve
 * the page already carries for the Treasury chart's custom day. So any pair
 * of tenors works, with no extra data from the pipeline.
 */

type Leg = [tenor: string, weight: number];

interface Spec {
  key: string;
  label: string;
  groupStart?: boolean;
  unitLabel: string;
  legs: Leg[];
  noShade?: boolean;
}

const PRESETS: Spec[] = [
  { key: "2s10s", label: "2s10s", unitLabel: "bp, 10Y minus 2Y", legs: [["10Y", 1], ["2Y", -1]] },
  { key: "3m10y", label: "3m10y", unitLabel: "bp, 10Y minus 3M", legs: [["10Y", 1], ["3M", -1]] },
  { key: "5s30s", label: "5s30s", unitLabel: "bp, 30Y minus 5Y", legs: [["30Y", 1], ["5Y", -1]] },
  { key: "2s5s", label: "2s5s", groupStart: true, unitLabel: "bp, 5Y minus 2Y", legs: [["5Y", 1], ["2Y", -1]] },
  { key: "5s10s", label: "5s10s", unitLabel: "bp, 10Y minus 5Y", legs: [["10Y", 1], ["5Y", -1]] },
  { key: "10s30s", label: "10s30s", unitLabel: "bp, 30Y minus 10Y", legs: [["30Y", 1], ["10Y", -1]] },
  { key: "2s30s", label: "2s30s", unitLabel: "bp, 30Y minus 2Y", legs: [["30Y", 1], ["2Y", -1]] },
  { key: "3m2y", label: "3m2y", unitLabel: "bp, 2Y minus 3M", legs: [["2Y", 1], ["3M", -1]] },
  {
    key: "fly",
    label: "2s5s10s fly",
    groupStart: true,
    unitLabel: "bp, 2 × 5Y − 2Y − 10Y",
    legs: [["5Y", 2], ["2Y", -1], ["10Y", -1]],
    // A negative fly means a rich belly, not an inverted curve.
    noShade: true,
  },
];

const CUSTOM = "custom";

/** Desk shorthand: "1s20s" for two year tenors, "6m10y" when a bill is involved. */
function pairName(short: string, long: string): string {
  const years = (t: string) => t.endsWith("Y");
  if (years(short) && years(long)) return `${short.slice(0, -1)}s${long.slice(0, -1)}s`;
  return `${short.toLowerCase()}${long.toLowerCase()}`;
}

export function SlopePanel({ replay, tenors, years }: { replay: Replay; tenors: string[]; years: number[] }) {
  const [pair, setPair] = useState({ short: "1Y", long: "20Y" });

  const column = useMemo(() => Object.fromEntries(tenors.map((t, i) => [t, i])), [tenors]);
  const series = useMemo(
    () => (legs: Leg[]) =>
      replay.yields.map((row) => {
        let total = 0;
        for (const [tenor, weight] of legs) {
          const y = row[column[tenor]];
          if (y == null) return null;
          total += weight * y;
        }
        return Math.round(total * 1000) / 10;
      }),
    [replay.yields, column]
  );

  const presets = useMemo<HistoryItem[]>(
    () =>
      PRESETS.filter((p) => p.legs.every(([t]) => t in column)).map((p) => ({
        key: p.key,
        label: p.label,
        groupStart: p.groupStart,
        unitLabel: p.unitLabel,
        seriesLabel: `${p.label} (bp)`,
        dates: replay.dates,
        values: series(p.legs),
        noShade: p.noShade,
      })),
    [column, replay.dates, series]
  );

  const name = pairName(pair.short, pair.long);
  const items = useMemo<HistoryItem[]>(
    () => [
      ...presets,
      {
        key: CUSTOM,
        label: `Custom · ${name}`,
        groupStart: true,
        unitLabel: `bp, ${pair.long} minus ${pair.short}`,
        seriesLabel: `${name} (bp)`,
        dates: replay.dates,
        values: series([[pair.long, 1], [pair.short, -1]]),
      },
    ],
    [presets, name, pair.long, pair.short, replay.dates, series]
  );

  const yearsOf = (t: string) => years[tenors.indexOf(t)];
  const latest = replay.yields[replay.yields.length - 1] ?? [];
  // Each tenor with today's yield beside it, bills apart from notes and bonds.
  const tenorOptions = (disabled: (t: string) => boolean): PickerOption[] =>
    tenors.map((t, i) => ({
      value: t,
      label: t,
      hint: latest[i] == null ? undefined : pct(latest[i]),
      group: t.endsWith("M") ? "Bills" : "Notes and bonds",
      disabled: disabled(t),
    }));

  return (
    <HistoryPanel
      items={items}
      defaultKeys={["2s10s"]}
      zero
      shadeBelowZero
      filePrefix="treasury-slopes"
      chipsLabel="Curve slopes"
      extra={(api) => (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: "var(--viz-muted)" }}>
          <span className="font-mono uppercase tracking-wider text-[10px]">Custom spread</span>
          <OptionPicker
            name="Custom spread, short tenor"
            value={pair.short}
            // The longest tenor can't be the short leg.
            options={tenorOptions((t) => t === tenors[tenors.length - 1])}
            onChange={(short) => {
              // Keep the long leg longer than the short one.
              const long = yearsOf(pair.long) > yearsOf(short) ? pair.long : tenors[tenors.indexOf(short) + 1];
              setPair({ short, long });
              api.turnOn(CUSTOM);
            }}
          />
          <span>to</span>
          <OptionPicker
            name="Custom spread, long tenor"
            value={pair.long}
            options={tenorOptions((t) => yearsOf(t) <= yearsOf(pair.short))}
            onChange={(long) => {
              setPair({ short: pair.short, long });
              api.turnOn(CUSTOM);
            }}
          />
          {!api.isOn(CUSTOM) && api.full && <span className="text-xs">Turn a slope off to add it.</span>}
        </div>
      )}
    />
  );
}

"use client";

import { useMemo, useState } from "react";

import {
  ChartPanel,
  ChartTabs,
  DotLegend,
  HeroFigure,
  RangeControls,
  ToggleChips,
  useRange,
  useSlots,
} from "./chart-chrome";
import { dayToMs, formatDay, signedBp } from "./format";
import { LineChart, type ChartSeries } from "./line-chart";
import { INK, MAX_SERIES, SLOTS } from "./palette";

/** The first series is ink (the single-series look); the next three take blue, claret and gold. */
const HISTORY_COLORS = [INK, SLOTS[0], SLOTS[1], SLOTS[2]];

export interface HistoryItem {
  key: string;
  label: string;
  groupStart?: boolean;
  /** Under the hero figure, e.g. "bp, 10Y minus 2Y". */
  unitLabel: string;
  /** Names the line in the tooltip and CSV. */
  seriesLabel: string;
  dates: string[];
  values: (number | null)[];
  /** Skip the below-zero wash even when the panel shades (it isn't an inversion). */
  noShade?: boolean;
}

type Mode = "level" | "indexed";

/** What an `extra` control can do to the panel's selection. */
export interface SelectionApi {
  isOn: (key: string) => boolean;
  /** Turn a series on if there's room; a no-op when it's on or the panel is full. */
  turnOn: (key: string) => void;
  full: boolean;
}

/**
 * Daily history for up to four series at once, over any window: a preset,
 * typed dates, or a mouse drag across the chart. One series leads with its
 * value set large; several get a legend with each one's level and change.
 */
export function HistoryPanel({
  items,
  defaultKeys,
  defaultRange = "MAX",
  zero = false,
  shadeBelowZero = false,
  indexable = false,
  measurePercent = false,
  goodWhen = "neutral",
  filePrefix,
  chipsLabel,
  height = 300,
  extra,
}: {
  items: HistoryItem[];
  defaultKeys: string[];
  defaultRange?: string;
  zero?: boolean;
  shadeBelowZero?: boolean;
  /** Offer an indexed view, for series whose levels differ by orders of magnitude. */
  indexable?: boolean;
  /** Measuring shows % change as well as bp (spreads yes; slopes, which cross zero, no). */
  measurePercent?: boolean;
  /** Which direction a measured change shades blue; "neutral" leaves it unshaded. */
  goodWhen?: "up" | "down" | "neutral";
  filePrefix: string;
  chipsLabel: string;
  height?: number;
  /** Controls set under the chips, e.g. pickers that define a custom series. */
  extra?: (api: SelectionApi) => React.ReactNode;
}) {
  const slots = useSlots(MAX_SERIES, defaultKeys, 1);
  const [mode, setMode] = useState<Mode>("level");
  const [dragMode, setDragMode] = useState<"zoom" | "measure">("zoom");

  // Each series by date, for lining several up on one axis.
  const byDate = useMemo(
    () =>
      Object.fromEntries(
        items.map((it) => [it.key, new Map(it.dates.map((d, i) => [d, it.values[i]]))])
      ),
    [items]
  );
  const allDates = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.dates.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [items]);
  const min = dayToMs(allDates[0]);
  const max = dayToMs(allDates[allDates.length - 1]);
  const range = useRange(min, max, defaultRange);

  const picked = slots.picked.map(({ key, slot }) => ({
    item: items.find((it) => it.key === key)!,
    color: HISTORY_COLORS[slot],
  }));
  // Closes inside the window where at least one picked series has a value.
  const dates = allDates.filter((d) => {
    const ms = dayToMs(d);
    return ms >= range.from && ms <= range.to && picked.some((p) => byDate[p.item.key]?.get(d) != null);
  });
  const x = dates.map(dayToMs);

  const lines = picked.map(({ item, color }) => {
    const raw = dates.map((d) => byDate[item.key].get(d) ?? null);
    const first = raw.find((v) => v != null) ?? null;
    const lastValue = [...raw].reverse().find((v) => v != null) ?? null;
    const values =
      mode === "indexed" && first ? raw.map((v) => (v == null ? null : (v / first) * 100)) : raw;
    return { item, color, raw, values, first, last: lastValue };
  });
  const indexed = mode === "indexed" && indexable;
  const series: ChartSeries[] = lines.map((l) => ({
    key: l.item.key,
    label: indexed ? `${l.item.label} (start = 100)` : l.item.seriesLabel,
    values: indexed ? l.values : l.raw,
    color: l.color,
    width: lines.length === 1 ? 1.5 : 2,
  }));

  const since = dates.length ? formatDay(dates[0], "long") : "";
  const changeNote = (l: (typeof lines)[number]) =>
    l.first != null && l.last != null ? `${signedBp(l.last - l.first)} bp since ${since}` : undefined;

  return (
    <ChartPanel
      download={{
        filename: `${filePrefix}-${dates[0] ?? "x"}-to-${dates[dates.length - 1] ?? "x"}.csv`,
        rows: [["date", ...lines.map((l) => l.item.seriesLabel)], ...dates.map((d, i) => [d, ...lines.map((l) => l.raw[i])])],
      }}
    >
      <div className="pr-12">
        <ToggleChips
          items={items}
          colors={Object.fromEntries(lines.map((l) => [l.item.key, l.color]))}
          onToggle={slots.toggle}
          full={slots.full}
          label={chipsLabel}
        />
        {extra && (
          <div className="mt-2">
            {extra({
              isOn: (key) => slots.picked.some((p) => p.key === key),
              turnOn: (key) => {
                if (!slots.picked.some((p) => p.key === key) && !slots.full) slots.toggle(key);
              },
              full: slots.full,
            })}
          </div>
        )}
      </div>

      <div className="mt-5">
        {lines.length === 1 ? (
          <HeroFigure
            value={lines[0].last != null ? signedOrPlain(lines[0].last, zero) : "–"}
            unit={lines[0].item.unitLabel}
            note={changeNote(lines[0])}
          />
        ) : (
          <>
            <DotLegend
              items={lines.map((l) => ({
                label: l.item.label,
                color: l.color,
                value: l.last != null ? `${signedOrPlain(l.last, zero)} bp, ${signedBp(l.first != null ? l.last - l.first : null)}` : undefined,
              }))}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--viz-muted)" }}>
              Latest level, then the change in bp since {since}.
            </p>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <RangeControls range={range} min={min} max={max} days={allDates} />
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {indexable && (
            <ChartTabs
              items={[
                { key: "level", label: "Level" },
                { key: "indexed", label: "Indexed" },
              ]}
              value={mode}
              onChange={(k) => setMode(k as Mode)}
              label="Scale"
            />
          )}
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--viz-muted)" }}>
              Drag to
            </span>
            <ChartTabs
              items={[
                { key: "zoom", label: "Zoom" },
                { key: "measure", label: "Measure" },
              ]}
              value={dragMode}
              onChange={(k) => setDragMode(k as "zoom" | "measure")}
              label="What dragging across the chart does"
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        {dates.length > 1 ? (
          <LineChart
            x={x}
            series={series}
            unit={indexed ? "index" : "bp"}
            height={height}
            zero={zero && !indexed}
            shadeBelowZero={shadeBelowZero && lines.length === 1 && !lines[0].item.noShade}
            yAxis="right"
            onBrush={(a, b) => range.custom(a, b)}
            dragMode={dragMode}
            measure={{ percent: measurePercent, goodWhen }}
            ariaLabel={`${lines.map((l) => l.item.seriesLabel).join(", ")} from ${since} to ${formatDay(dates[dates.length - 1], "long")}`}
          />
        ) : (
          <p className="py-16 text-center text-sm" style={{ color: "var(--viz-muted)" }}>
            No closes in that window.
          </p>
        )}
        <p className="mt-2 text-[11px]" style={{ color: "var(--viz-muted)" }}>
          {dragMode === "zoom" ? (
            <span className="hidden sm:inline">Drag across the chart to zoom in. Hold Shift to measure instead.</span>
          ) : (
            <>
              Drag across the chart to measure the change.
              <span className="hidden sm:inline"> Hold Shift to zoom instead.</span> Click the chart to clear.
            </>
          )}
        </p>
      </div>
    </ChartPanel>
  );
}

/** Spreads read as plain numbers; slopes, which cross zero, keep their sign. */
function signedOrPlain(v: number, signed: boolean): string {
  return signed ? signedBp(v) : String(Math.round(v));
}

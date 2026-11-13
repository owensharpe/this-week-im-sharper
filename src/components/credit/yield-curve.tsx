"use client";

import { useMemo, useState } from "react";

import type { Curve, Replay } from "@/lib/credit";
import { ChartPanel, DotLegend, ToggleChips, useSlots } from "./chart-chrome";
import { DatePicker } from "./date-picker";
import { formatDay, pct } from "./format";
import { LineChart, type ChartSeries } from "./line-chart";
import { INK, MAX_SERIES, SLOTS } from "./palette";

/** Labels that crowd first when the chart narrows. */
const MINOR_TENORS = new Set(["2M", "4M", "3Y", "7Y", "20Y"]);
/** Today's yield is printed above these points; the rest are in the table. */
const LABELLED_TENORS = ["3M", "2Y", "10Y", "30Y"];
const CUSTOM = "custom";

/**
 * Today's Treasury curve against up to four earlier ones: preset windows,
 * and/or any single day back to 2016 picked with the slider or date box.
 * Maturity runs on a log scale so the bills aren't crushed into the left edge.
 */
export function YieldCurve({ curve, replay }: { curve: Curve; replay: Replay }) {
  const slots = useSlots(MAX_SERIES, curve.comparisons.some((c) => c.key === "1M") ? ["1M"] : []);
  const last = replay.dates.length - 1;
  // Start the custom day a year back, so the first drag has somewhere to go.
  const [day, setDay] = useState(() => Math.max(0, last - 250));

  const x = useMemo(() => curve.years.map((y) => Math.log(y)), [curve.years]);
  const ticks = useMemo(
    () => curve.tenors.map((t, i) => ({ x: x[i], label: t, minor: MINOR_TENORS.has(t) })),
    [curve.tenors, x]
  );
  const pointLabels = useMemo(
    () =>
      LABELLED_TENORS.map((t) => curve.tenors.indexOf(t))
        .filter((i) => i >= 0 && curve.yields[i] != null)
        .map((i) => ({ index: i, text: pct(curve.yields[i]) })),
    [curve.tenors, curve.yields]
  );
  // With a custom day on screen, hold the axis across the whole replay so
  // dragging doesn't make it jump.
  const replayDomain = useMemo((): [number, number] => {
    const all = [...replay.yields.flat(), ...curve.yields].filter((v): v is number => v != null);
    return [Math.min(...all), Math.max(...all)];
  }, [replay.yields, curve.yields]);

  const comparisons = slots.picked.map(({ key, slot }) => {
    if (key === CUSTOM) {
      const date = replay.dates[day];
      return { key, date, label: formatDay(date, "long"), yields: replay.yields[day], color: SLOTS[slot] };
    }
    const c = curve.comparisons.find((c) => c.key === key)!;
    return { key, date: c.date, label: `${c.key}, ${formatDay(c.date, "long")}`, yields: c.yields, color: SLOTS[slot] };
  });
  const customOn = slots.picked.some((p) => p.key === CUSTOM);

  const series: ChartSeries[] = [
    { key: "today", label: `Today, ${formatDay(curve.date)}`, values: curve.yields, color: INK, strong: true, width: 2.25 },
    ...comparisons.map((c) => ({ key: c.key, label: c.label, values: c.yields, color: c.color })),
  ];

  const pickDay = (i: number) => {
    setDay(Math.max(0, Math.min(last, i)));
    if (!customOn && !slots.full) slots.toggle(CUSTOM);
  };

  const chips = [
    ...curve.comparisons.map((c) => ({ key: c.key, label: c.key })),
    { key: CUSTOM, label: "Custom day", groupStart: true },
  ];

  return (
    <ChartPanel
      className="h-full"
      download={{
        filename: `treasury-curve-${curve.date}.csv`,
        rows: [
          ["tenor", "years", curve.date, ...comparisons.map((c) => c.date)],
          ...curve.tenors.map((t, i) => [t, curve.years[i], curve.yields[i], ...comparisons.map((c) => c.yields[i])]),
        ],
      }}
    >
      <div className="pr-12">
        <ToggleChips
          items={chips}
          colors={Object.fromEntries(comparisons.map((c) => [c.key, c.color]))}
          onToggle={slots.toggle}
          full={slots.full}
          label="Compare today's curve with"
        />
      </div>

      <div className="mt-4">
        <DotLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      </div>

      <div className="mt-2">
        <LineChart
          x={x}
          labels={curve.tenors}
          ticks={ticks}
          series={series}
          unit="pct"
          height={330}
          dots
          pointLabels={pointLabels}
          difference={comparisons.length === 1 ? { a: "today", b: comparisons[0].key, label: "Change" } : undefined}
          domain={customOn ? replayDomain : undefined}
          minTickGap={26}
          yTitle="Yield (%)"
          xTitle="Maturity (log scale)"
          ariaLabel={`Treasury par yield curve on ${formatDay(curve.date, "long")}${
            comparisons.length ? ` compared with ${comparisons.map((c) => c.label).join(", ")}` : ""
          }`}
        />
      </div>

      {replay.dates.length > 1 && (
        <div className="mt-4">
          <div
            className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--viz-muted)" }}
          >
            <span>Custom day, any close since {replay.dates[0].slice(0, 4)}</span>
            <span className="flex items-center gap-1 normal-case tracking-normal">
              <button
                type="button"
                aria-label="Previous close"
                onClick={() => pickDay(day - 1)}
                className="rounded border border-[color:var(--viz-border)] px-1.5 hover:text-[color:var(--viz-ink)]"
              >
                ‹
              </button>
              <DatePicker
                name="Custom day"
                value={replay.dates[day]}
                days={replay.dates}
                onChange={(d) => pickDay(replay.dates.indexOf(d))}
              />
              <button
                type="button"
                aria-label="Next close"
                onClick={() => pickDay(day + 1)}
                className="rounded border border-[color:var(--viz-border)] px-1.5 hover:text-[color:var(--viz-ink)]"
              >
                ›
              </button>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={last}
            value={day}
            onChange={(e) => pickDay(Number(e.target.value))}
            className="viz-range mt-1"
            aria-label="Custom day to compare with"
            aria-valuetext={formatDay(replay.dates[day], "long")}
          />
          {!customOn && slots.full && (
            <p className="mt-1 text-xs" style={{ color: "var(--viz-muted)" }}>
              Four comparisons are already on. Turn one off to add a custom day.
            </p>
          )}
        </div>
      )}
    </ChartPanel>
  );
}

"use client";

import { useMemo } from "react";

import type { Curve, MaturityBucket } from "@/lib/credit";
import { ChartPanel, DotLegend, ToggleChips, useSlots } from "./chart-chrome";
import { bp, formatDay, pct } from "./format";
import { LineChart, type ChartSeries } from "./line-chart";
import { INK, MAX_SERIES, SLOTS } from "./palette";

/**
 * Nominal and real par yields across maturities, with the gap between them
 * (breakeven inflation) shaded.
 */
export function RealYieldChart({ nominal, real }: { nominal: Curve; real: Curve }) {
  const x = useMemo(() => real.years.map((y) => Math.log(y)), [real.years]);
  const nominalAtReal = real.tenors.map((t) => nominal.yields[nominal.tenors.indexOf(t)] ?? null);
  const at10 = real.tenors.indexOf("10Y");
  const series: ChartSeries[] = [
    { key: "nominal", label: "Nominal", values: nominalAtReal, color: INK, strong: true, width: 2.25 },
    { key: "real", label: "Real (TIPS)", values: real.yields, color: SLOTS[0] },
  ];
  const n10 = nominalAtReal[at10];
  const r10 = real.yields[at10];

  return (
    <ChartPanel
      className="h-full"
      download={{
        filename: `treasury-nominal-real-curve-${real.date}.csv`,
        rows: [
          ["tenor", "years", "nominal_pct", "real_pct", "breakeven_pct"],
          ...real.tenors.map((t, i) => {
            const n = nominalAtReal[i];
            const r = real.yields[i];
            return [t, real.years[i], n, r, n == null || r == null ? null : Number((n - r).toFixed(3))];
          }),
        ],
      }}
    >
      <div className="pr-12">
        <DotLegend
          items={[
            { label: "Nominal", color: INK, value: at10 >= 0 ? `10Y ${pct(n10)}` : undefined },
            { label: "Real", color: SLOTS[0], value: at10 >= 0 ? `10Y ${pct(r10)}` : undefined },
            {
              label: "Breakeven",
              color: "color-mix(in oklch, var(--viz-3) 45%, transparent)",
              value: n10 != null && r10 != null ? `10Y ${pct(n10 - r10)}` : undefined,
            },
          ]}
        />
      </div>
      <div className="mt-2">
        <LineChart
          x={x}
          labels={real.tenors}
          ticks={real.tenors.map((t, i) => ({ x: x[i], label: t }))}
          series={series}
          unit="pct"
          height={290}
          dots
          band={{ upper: "nominal", lower: "real", color: "var(--viz-3)" }}
          difference={{ a: "nominal", b: "real", label: "Breakeven" }}
          minTickGap={30}
          yTitle="Yield (%)"
          xTitle="Maturity (log scale)"
          ariaLabel={`Nominal and real Treasury par yields on ${formatDay(real.date, "long")}, with breakeven inflation shaded between them`}
        />
      </div>
    </ChartPanel>
  );
}

const IG_WINDOWS: Record<string, string> = {
  "1W": "1 week ago",
  "1M": "1 month ago",
  "3M": "3 months ago",
  YTD: "Start of year",
  "1Y": "1 year ago",
};

/** The IG spread curve by maturity, today against up to four earlier dates. */
export function IgSpreadCurve({ buckets, asOf }: { buckets: MaturityBucket[]; asOf: string }) {
  const available = Object.keys(IG_WINDOWS).filter((w) => buckets.some((b) => b.comparisons_bp[w] != null));
  const slots = useSlots(MAX_SERIES, available.includes("1Y") ? ["1Y"] : available.slice(0, 1));
  const last = buckets.length - 1;

  const series: ChartSeries[] = [
    { key: "today", label: "Today", values: buckets.map((b) => b.oas_bp), color: INK, strong: true, width: 2.25 },
    ...slots.picked.map(({ key, slot }) => ({
      key,
      label: IG_WINDOWS[key],
      values: buckets.map((b) => b.comparisons_bp[key] ?? null),
      color: SLOTS[slot],
    })),
  ];

  return (
    <ChartPanel
      className="h-full"
      download={{
        filename: `ice-ig-spread-curve-chart-${asOf}.csv`,
        rows: [
          ["maturity", "oas_bp_today", ...slots.picked.map(({ key }) => `oas_bp_${key.toLowerCase()}`)],
          ...buckets.map((b) => [b.label, b.oas_bp, ...slots.picked.map(({ key }) => b.comparisons_bp[key] ?? null)]),
        ],
      }}
    >
      <div className="pr-12">
        <ToggleChips
          items={available.map((w) => ({ key: w, label: w }))}
          colors={Object.fromEntries(slots.picked.map(({ key, slot }) => [key, SLOTS[slot]]))}
          onToggle={slots.toggle}
          full={slots.full}
          label="Compare today's spread curve with"
        />
      </div>
      <div className="mt-4">
        <DotLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      </div>
      <div className="mt-2">
        <LineChart
          x={buckets.map((_, i) => i)}
          labels={buckets.map((b) => b.label)}
          ticks={buckets.map((b, i) => ({ x: i, label: b.label }))}
          series={series}
          unit="bp"
          height={290}
          dots
          pointLabels={[0, last].map((i) => ({ index: i, text: bp(buckets[i].oas_bp) }))}
          difference={slots.picked.length === 1 ? { a: "today", b: slots.picked[0].key, label: "Change" } : undefined}
          minTickGap={30}
          yTitle="OAS (bp)"
          xTitle="Maturity"
          ariaLabel="Investment grade option-adjusted spread by maturity bucket, today and earlier dates"
        />
      </div>
    </ChartPanel>
  );
}

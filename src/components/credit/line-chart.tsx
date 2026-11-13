"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { bp, pct, signedBp } from "./format";
import { heatStyle } from "./palette";

export interface ChartSeries {
  key: string;
  label: string;
  values: (number | null)[];
  color: string;
  /** Drawn on top. The series the chart is about. */
  strong?: boolean;
  width?: number;
}

export interface Tick {
  x: number;
  label: string;
  /** Dropped before any major tick when labels would collide. */
  minor?: boolean;
}

export type Unit = "pct" | "bp" | "index";

interface Props {
  /** Ascending positions: UTC timestamps for time charts, anything for others. */
  x: number[];
  /** Tooltip heading per point. Time charts can leave it out. */
  labels?: string[];
  /** Leave out on time charts for evenly spaced dates pinned to both ends. */
  ticks?: Tick[];
  series: ChartSeries[];
  unit: Unit;
  height?: number;
  /** Keep zero in the domain and draw it as the baseline. */
  zero?: boolean;
  /** Wash the area between the first series and zero where it's negative. */
  shadeBelowZero?: boolean;
  /** Fill between two series, e.g. nominal and real yields. */
  band?: { upper: string; lower: string; color: string };
  dots?: boolean;
  /** Text set above the highest point at each index. Use sparingly. */
  pointLabels?: { index: number; text: string }[];
  /** A tooltip row for series `a` minus series `b`, in bp. */
  difference?: { a: string; b: string; label: string };
  /** Pin the y domain (e.g. while scrubbing, so the axis holds still). */
  domain?: [number, number];
  minTickGap?: number;
  /** "left": a labelled axis. "right": quiet labels in a narrow right gutter. */
  yAxis?: "left" | "right";
  xTitle?: string;
  yTitle?: string;
  /** Drag across the plot with a mouse to pick a range (time charts). */
  onBrush?: (from: number, to: number) => void;
  /** What a drag does: zoom (calls onBrush) or measure the change. Shift flips it. */
  dragMode?: "zoom" | "measure";
  /** Turns measuring on. `percent` adds % change; `goodWhen` picks which way shades blue. */
  measure?: { percent: boolean; goodWhen: "up" | "down" | "neutral" };
  ariaLabel: string;
}

type DragMode = "zoom" | "measure";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

export function shortDate(ms: number, withDay: boolean): string {
  const d = new Date(ms);
  const yy = String(d.getUTCFullYear()).slice(2);
  return withDay
    ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} '${yy}`
    : `${MONTHS[d.getUTCMonth()]} '${yy}`;
}

/**
 * Round-numbered y ticks: the smallest step of 1, 2, 2.5 or 5 (times a power
 * of ten) that covers the data with gridlines at least ~34px apart.
 */
function yScale(values: number[], zero: boolean, plotH: number, pinned?: [number, number]) {
  let lo = pinned ? pinned[0] : Math.min(...values);
  let hi = pinned ? pinned[1] : Math.max(...values);
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const maxIntervals = Math.max(2, Math.floor(plotH / 34));
  const magnitude = 10 ** Math.floor(Math.log10((hi - lo) / maxIntervals));
  let step = magnitude;
  let min = 0;
  let max = 0;
  for (const m of [1, 2, 2.5, 5, 10, 20, 25, 50]) {
    step = m * magnitude;
    min = Math.floor(lo / step + 1e-9) * step;
    max = Math.ceil(hi / step - 1e-9) * step;
    if ((max - min) / step <= maxIntervals + 1e-9) break;
  }
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  let decimals = 0;
  while (decimals < 4 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-6) {
    decimals++;
  }
  return { min, max, ticks, decimals };
}

/** Width of the wrapper, so the SVG draws at 1:1 and its text never scales. */
function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Labels drawn over lines get a halo in the panel colour, so they stay legible. */
const HALO = {
  stroke: "var(--viz-panel)",
  strokeWidth: 4,
  paintOrder: "stroke" as const,
  strokeLinejoin: "round" as const,
};

type Placed = { label: string; at: number; anchor: "start" | "middle" | "end" };

export function formatValue(v: number | null | undefined, unit: Unit): string {
  if (v == null) return "–";
  if (unit === "pct") return pct(v);
  if (unit === "bp") return `${Math.round(v)} bp`;
  return v.toFixed(1);
}

/**
 * A thin-line SVG chart with a crosshair tooltip. One y axis only; two
 * measures on different scales are drawn as two charts, or indexed.
 */
export function LineChart({
  x,
  labels,
  ticks,
  series,
  unit,
  height = 220,
  zero = false,
  shadeBelowZero = false,
  band,
  dots = false,
  pointLabels,
  difference,
  domain,
  minTickGap = 44,
  yAxis = "left",
  xTitle,
  yTitle,
  onBrush,
  dragMode = "zoom",
  measure,
  ariaLabel,
}: Props) {
  const [ref, width] = useWidth(600);
  const [active, setActive] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; mode: DragMode } | null>(null);
  // The live drag, for event handlers: state lags a render behind, and a move
  // event landing between release and re-render must not restart the drag.
  const dragRef = useRef<{ from: number; to: number; mode: DragMode } | null>(null);
  // A finished measurement, in data units so it survives a resize. It stays
  // up until the next click on the chart or Escape.
  const [measured, setMeasured] = useState<{ from: number; to: number } | null>(null);
  const clipId = useId().replace(/:/g, "");

  const margin = {
    top: pointLabels?.length ? 24 : 12,
    // The right gutter keeps the labels clear of the line's latest point.
    right: yAxis === "right" ? 38 : 14,
    bottom: xTitle ? 44 : 24,
    left: yAxis === "right" ? 2 : yTitle ? 58 : 42,
  };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const y = useMemo(() => {
    const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
    return yScale(all.length ? all : [0], zero, plotH, domain);
  }, [series, zero, domain, plotH]);

  const x0 = x[0] ?? 0;
  const x1 = x[x.length - 1] ?? 1;
  const px = (v: number) => margin.left + ((v - x0) / (x1 - x0 || 1)) * plotW;
  const py = (v: number) => margin.top + (1 - (v - y.min) / (y.max - y.min)) * plotH;
  const toData = (p: number) => x0 + ((p - margin.left) / plotW) * (x1 - x0);

  function linePath(values: (number | null)[]): string {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${px(x[i]).toFixed(1)},${py(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  /** Closed shape between a series and zero, for the negative wash. */
  function zeroArea(values: (number | null)[]): string {
    const base = py(0).toFixed(1);
    let d = "";
    let start: number | null = null;
    let last = 0;
    const close = () => {
      if (start != null) d += `L${px(x[last]).toFixed(1)},${base}L${px(x[start]).toFixed(1)},${base}Z`;
    };
    values.forEach((v, i) => {
      if (v == null) {
        close();
        start = null;
        return;
      }
      d += `${start == null ? "M" : "L"}${px(x[i]).toFixed(1)},${py(v).toFixed(1)}`;
      if (start == null) start = i;
      last = i;
    });
    close();
    return d;
  }

  function bandPath(): string {
    const upper = series.find((s) => s.key === band?.upper)?.values;
    const lower = series.find((s) => s.key === band?.lower)?.values;
    if (!upper || !lower) return "";
    const idx = x.map((_, i) => i).filter((i) => upper[i] != null && lower[i] != null);
    if (idx.length < 2) return "";
    const top = idx.map((i, k) => `${k ? "L" : "M"}${px(x[i]).toFixed(1)},${py(upper[i]!).toFixed(1)}`);
    const bottom = [...idx].reverse().map((i) => `L${px(x[i]).toFixed(1)},${py(lower[i]!).toFixed(1)}`);
    return `${top.join("")}${bottom.join("")}Z`;
  }

  // Explicit ticks are thinned majors-first; time charts get evenly spaced
  // dates with the first and last pinned to the plot's edges.
  let placed: Placed[];
  if (ticks) {
    const kept: Placed[] = [];
    const fits = (at: number) => kept.every((k) => Math.abs(k.at - at) >= minTickGap);
    for (const pass of [false, true]) {
      for (const t of ticks) {
        if (Boolean(t.minor) !== pass) continue;
        const at = px(t.x);
        if (fits(at)) kept.push({ label: t.label, at, anchor: "middle" });
      }
    }
    placed = kept.sort((a, b) => a.at - b.at);
  } else {
    const count = plotW < 420 ? 3 : 5;
    const withDay = x1 - x0 < 730 * DAY;
    placed = Array.from({ length: count }, (_, k): Placed => {
      const v = x0 + ((x1 - x0) * k) / (count - 1);
      return {
        label: shortDate(v, withDay),
        at: px(v),
        anchor: k === 0 ? "start" : k === count - 1 ? "end" : "middle",
      };
    });
  }

  /** Pointer position in chart units, held inside the plot so a drag that
   * runs past either edge stops at that edge. */
  function plotX(clientX: number, rect: DOMRect) {
    const at = ((clientX - rect.left) / rect.width) * width;
    return Math.min(width - margin.right, Math.max(margin.left, at));
  }

  function nearest(local: number): number {
    const target = toData(local);
    let lo = 0;
    let hi = x.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (x[mid] < target) lo = mid;
      else hi = mid;
    }
    return Math.abs(x[lo] - target) <= Math.abs(x[hi] - target) ? lo : hi;
  }

  const tickFmt = (v: number) =>
    unit === "pct" ? `${v.toFixed(y.decimals)}%` : v.toFixed(y.decimals);
  const heading = (i: number) => labels?.[i] ?? shortDate(x[i], true);
  const topAt = (i: number) =>
    Math.min(...series.map((s) => s.values[i]).filter((v): v is number => v != null).map(py));

  const activeX = active != null ? px(x[active]) : 0;
  const tooltipLeft = activeX > width * 0.6;
  const muted = "var(--viz-muted)";
  const lines = [...series].sort((a, b) => Number(Boolean(a.strong)) - Number(Boolean(b.strong)));
  const dragging = drag && Math.abs(drag.to - drag.from) > 6;
  const brushing = dragging && drag?.mode === "zoom";
  // The stretch being measured: live while dragging, then pinned. Pixel ends
  // snap to the nearest close.
  let sel: { ia: number; ib: number } | null = null;
  if (dragging && drag?.mode === "measure") {
    const ia = nearest(Math.min(drag.from, drag.to));
    const ib = nearest(Math.max(drag.from, drag.to));
    if (ib > ia) sel = { ia, ib };
  } else if (!drag && measured && measured.from >= x0 && measured.to <= x1) {
    const ia = nearest(px(measured.from));
    const ib = nearest(px(measured.to));
    if (ib > ia) sel = { ia, ib };
  }
  const showHover = active != null && !brushing && !sel;

  return (
    <div ref={ref} className="relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={[
          "block h-auto w-full touch-pan-y overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-brand",
          onBrush ? "cursor-crosshair" : "",
        ].join(" ")}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // Shift does whichever the panel isn't set to.
          let mode: DragMode = e.shiftKey ? (dragMode === "zoom" ? "measure" : "zoom") : dragMode;
          if (mode === "zoom" && !onBrush) mode = "measure";
          if (mode === "measure" && !measure) mode = "zoom";
          // Zooming is mouse-only (a finger drag scrubs the tooltip); measuring works with touch too.
          if ((mode === "zoom" && (!onBrush || e.pointerType !== "mouse")) || (mode === "measure" && !measure)) return;
          const at = plotX(e.clientX, e.currentTarget.getBoundingClientRect());
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { from: at, to: at, mode };
          setDrag(dragRef.current);
        }}
        onPointerMove={(e) => {
          const at = plotX(e.clientX, e.currentTarget.getBoundingClientRect());
          if (dragRef.current) {
            dragRef.current = { ...dragRef.current, to: at };
            setDrag(dragRef.current);
          }
          setActive(nearest(at));
        }}
        onPointerUp={() => {
          const d = dragRef.current;
          dragRef.current = null;
          setDrag(null);
          if (!d) return;
          if (Math.abs(d.to - d.from) <= 6) {
            // A click, not a drag: clears any measurement.
            setMeasured(null);
            return;
          }
          const a = toData(Math.min(d.from, d.to));
          const b = toData(Math.max(d.from, d.to));
          if (d.mode === "zoom" && onBrush) {
            setActive(null);
            setMeasured(null);
            onBrush(a, b);
          } else {
            setMeasured({ from: a, to: b });
          }
        }}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setDrag(null);
        }}
        onPointerLeave={() => {
          if (!dragRef.current) setActive(null);
        }}
        onFocus={() => setActive(x.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setMeasured(null);
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const step = e.key === "ArrowLeft" ? -1 : 1;
          setActive((i) => Math.min(x.length - 1, Math.max(0, (i ?? x.length - 1) + step)));
        }}
      >
        {shadeBelowZero && (
          <defs>
            <clipPath id={`${clipId}-below`}>
              <rect x={0} y={py(0)} width={width} height={Math.max(0, height - py(0))} />
            </clipPath>
          </defs>
        )}

        {y.ticks.map((t) => (
          <g key={t}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={py(t)}
              y2={py(t)}
              stroke={zero && t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}
              strokeWidth={1}
            />
            {yAxis === "left" ? (
              <text x={margin.left - 8} y={py(t)} dy="0.32em" textAnchor="end" fill={muted} className="text-[11px] tabular-nums">
                {tickFmt(t)}
              </text>
            ) : (
              <text x={width - 2} y={py(t)} dy="0.32em" textAnchor="end" fill={muted} className="text-[10px] tabular-nums">
                {tickFmt(t)}
              </text>
            )}
          </g>
        ))}

        {placed.map((t) => (
          <text key={`${t.at}-${t.label}`} x={t.at} y={margin.top + plotH + 17} textAnchor={t.anchor} fill={muted} className="text-[11px]">
            {t.label}
          </text>
        ))}

        {xTitle && (
          <text x={margin.left + plotW / 2} y={height - 4} textAnchor="middle" fill="var(--viz-ink)" className="text-xs">
            {xTitle}
          </text>
        )}
        {yTitle && (
          <text transform={`translate(12 ${margin.top + plotH / 2}) rotate(-90)`} textAnchor="middle" fill="var(--viz-ink)" className="text-xs">
            {yTitle}
          </text>
        )}

        {band && <path d={bandPath()} fill={band.color} fillOpacity={0.18} />}

        {shadeBelowZero && series[0] && (
          <path d={zeroArea(series[0].values)} fill="var(--viz-2)" fillOpacity={0.2} clipPath={`url(#${clipId}-below)`} />
        )}

        {lines.map((s) => (
          <path
            key={s.key}
            d={linePath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {dots &&
          lines.map((s) =>
            s.values.map((v, i) =>
              v == null ? null : (
                <circle key={`${s.key}-${i}`} cx={px(x[i])} cy={py(v)} r={s.strong ? 5 : 4} fill={s.color} stroke="var(--viz-panel)" strokeWidth={2} />
              )
            )
          )}

        {pointLabels?.map(({ index, text }) => {
          const at = px(x[index]);
          const anchor = at < margin.left + 16 ? "start" : at > width - margin.right - 16 ? "end" : "middle";
          return (
            <text key={`${index}-${text}`} x={at} y={topAt(index) - 11} textAnchor={anchor} fill="var(--viz-ink)" className="text-[11px] font-semibold tabular-nums" {...HALO}>
              {text}
            </text>
          );
        })}

        {brushing && drag && (
          <rect
            x={Math.min(drag.from, drag.to)}
            y={margin.top}
            width={Math.abs(drag.to - drag.from)}
            height={plotH}
            fill="var(--viz-ink)"
            fillOpacity={0.08}
            stroke="var(--viz-axis)"
            pointerEvents="none"
          />
        )}

        {sel && (
          <g pointerEvents="none">
            <rect
              x={px(x[sel.ia])}
              y={margin.top}
              width={px(x[sel.ib]) - px(x[sel.ia])}
              height={plotH}
              fill="var(--viz-ink)"
              fillOpacity={0.07}
            />
            {[sel.ia, sel.ib].map((i) => (
              <line key={i} x1={px(x[i])} x2={px(x[i])} y1={margin.top} y2={margin.top + plotH} stroke="var(--viz-ink)" strokeWidth={1} strokeOpacity={0.6} />
            ))}
            {series.flatMap((s) =>
              [sel!.ia, sel!.ib].map((i) => {
                const v = s.values[i];
                return v == null ? null : (
                  <circle key={`${s.key}-${i}`} cx={px(x[i])} cy={py(v)} r={4.5} fill={s.color} stroke="var(--viz-panel)" strokeWidth={2} />
                );
              })
            )}
          </g>
        )}

        {showHover && active != null && (
          <g pointerEvents="none">
            <line x1={activeX} x2={activeX} y1={margin.top} y2={margin.top + plotH} stroke="var(--viz-axis)" strokeWidth={1} />
            {series.map((s) => {
              const v = s.values[active];
              return v == null ? null : (
                <circle key={s.key} cx={activeX} cy={py(v)} r={5} fill={s.color} stroke="var(--viz-panel)" strokeWidth={2} />
              );
            })}
          </g>
        )}
      </svg>

      {sel && measure && (
        <MeasureCard
          sel={sel}
          x={x}
          series={series}
          unit={unit}
          measure={measure}
          left={Math.min(width - 130, Math.max(130, (px(x[sel.ia]) + px(x[sel.ib])) / 2)) / width}
        />
      )}

      {showHover && active != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border px-3 py-2 text-xs shadow-sm"
          style={{
            background: "var(--viz-panel)",
            borderColor: "var(--viz-border)",
            color: "var(--viz-ink)",
            ...(tooltipLeft
              ? { right: `${((width - activeX + 12) / width) * 100}%` }
              : { left: `${((activeX + 12) / width) * 100}%` }),
          }}
        >
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: muted }}>
            {heading(active)}
          </p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span style={{ color: muted }}>{s.label}</span>
              <span className="ml-auto pl-3 font-mono tabular-nums">{formatValue(s.values[active], unit)}</span>
            </p>
          ))}
          {difference && (
            <p className="mt-1 flex items-center gap-2 border-t pt-1" style={{ borderColor: "var(--viz-border)" }}>
              <span style={{ color: muted }}>{difference.label}</span>
              <span className="ml-auto pl-3 font-mono tabular-nums">
                {(() => {
                  const a = series.find((s) => s.key === difference.a)?.values[active];
                  const b = series.find((s) => s.key === difference.b)?.values[active];
                  if (a == null || b == null) return "–";
                  return `${signedBp(unit === "pct" ? (a - b) * 100 : a - b)} bp`;
                })()}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The readout for a measured stretch: the two dates, how long between them,
 * and each series' start, end and change. Spread changes are shaded by
 * whether they're good or bad for a bondholder; slopes stay neutral.
 */
function MeasureCard({
  sel,
  x,
  series,
  unit,
  measure,
  left,
}: {
  sel: { ia: number; ib: number };
  x: number[];
  series: ChartSeries[];
  unit: Unit;
  measure: { percent: boolean; goodWhen: "up" | "down" | "neutral" };
  left: number;
}) {
  const days = Math.round((x[sel.ib] - x[sel.ia]) / DAY);
  const value = (v: number) => (unit === "index" ? v.toFixed(1) : unit === "pct" ? pct(v) : bp(v));
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border px-3 py-2 text-xs shadow-sm"
      style={{ left: `${left * 100}%`, background: "var(--viz-panel)", borderColor: "var(--viz-border)", color: "var(--viz-ink)" }}
    >
      <p className="mb-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--viz-muted)" }}>
        {shortDate(x[sel.ia], true)} → {shortDate(x[sel.ib], true)} · {days.toLocaleString("en-US")} days
      </p>
      {series.map((s) => {
        const a = s.values[sel.ia];
        const b = s.values[sel.ib];
        if (a == null || b == null) return null;
        const change = b - a;
        const shade =
          measure.goodWhen === "neutral" ? undefined : heatStyle(measure.goodWhen === "down" ? -change : change, Math.abs(change) || 1, 24);
        return (
          <p key={s.key} className="flex items-center gap-2 whitespace-nowrap">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span style={{ color: "var(--viz-muted)" }}>{s.label}</span>
            <span className="ml-auto pl-3 font-mono tabular-nums">
              {value(a)} → {value(b)}
            </span>
            <span className="rounded px-1 font-mono tabular-nums" style={shade}>
              {unit === "index" ? `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}` : `${signedBp(change)} bp`}
              {measure.percent && a > 0 && b > 0 && (
                <span className="ml-1.5">
                  {change >= 0 ? "+" : "−"}
                  {Math.abs((b / a - 1) * 100).toFixed(1)}%
                </span>
              )}
            </span>
          </p>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

import { DatePicker } from "./date-picker";

/** Everything around a chart: panel, tabs, toggles, range, big number, key. */

const DAY = 86_400_000;

export function ChartPanel({
  label,
  download,
  className = "",
  children,
}: {
  /** Small descriptor at the top right, e.g. "Yield vs. maturity". */
  label?: string;
  download?: { filename: string; rows: (string | number | null)[][] };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={`relative min-w-0 border px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5 ${className}`}
      style={{ background: "var(--viz-panel)", borderColor: "var(--viz-border)", color: "var(--viz-ink)" }}
    >
      {(label || download) && (
        <div className="absolute right-4 top-4 flex items-center gap-3 sm:right-6 sm:top-5">
          {label && (
            <span className="hidden text-sm lg:inline" style={{ color: "var(--viz-muted)" }}>
              {label}
            </span>
          )}
          {download && <DownloadButton {...download} />}
        </div>
      )}
      {children}
    </figure>
  );
}

function DownloadButton({ filename, rows }: { filename: string; rows: (string | number | null)[][] }) {
  const save = () => {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const text = cell == null ? "" : String(cell);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(",")
      )
      .join("\n");
    // The byte-order mark tells Excel the file is UTF-8, so labels like
    // "1–3y" don't come out garbled.
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={save}
      title="Download data (CSV)"
      aria-label="Download chart data as CSV"
      className="grid size-8 place-items-center rounded-md border border-[color:var(--viz-border)] text-[color:var(--viz-muted)] transition-colors hover:text-[color:var(--viz-ink)]"
    >
      <Download className="size-4" strokeWidth={1.75} />
    </button>
  );
}

export interface TabItem {
  key: string;
  label: string;
  /** Extra space before this item, to separate groups. */
  groupStart?: boolean;
}

/** Plain text tabs, one active: the active one in ink, the rest muted. */
export function ChartTabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:gap-x-5">
      {items.map((item, i) => {
        const on = item.key === value;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on || (i === 0 && !items.some((t) => t.key === value)) ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
              onChange(items[next].key);
              refs.current[next]?.focus();
            }}
            className={[
              "py-1 font-mono text-[13px] transition-colors",
              item.groupStart ? "sm:ml-3" : "",
              on
                ? "text-[color:var(--viz-ink)] underline decoration-[color:var(--viz-ink)] decoration-1 underline-offset-[6px]"
                : "text-[color:var(--viz-muted)] hover:text-[color:var(--viz-ink)]",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Several on at once. A selected item shows the colour its series is drawn
 * in, so the toggles double as the legend.
 */
export function ToggleChips({
  items,
  colors,
  onToggle,
  full,
  label,
}: {
  items: TabItem[];
  /** Colour for each selected key; absent keys are off. */
  colors: Record<string, string | undefined>;
  onToggle: (key: string) => void;
  /** At the limit: unselected items are disabled. */
  full: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
      {items.map((item) => {
        const color = colors[item.key];
        const on = Boolean(color);
        const disabled = !on && full;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            title={disabled ? "Up to four at a time. Turn one off first." : undefined}
            onClick={() => onToggle(item.key)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[12px] transition-colors",
              item.groupStart ? "sm:ml-3" : "",
              on
                ? "border-[color:var(--viz-ink)] text-[color:var(--viz-ink)]"
                : "border-[color:var(--viz-border)] text-[color:var(--viz-muted)] hover:text-[color:var(--viz-ink)]",
              disabled ? "cursor-not-allowed opacity-40 hover:text-[color:var(--viz-muted)]" : "",
            ].join(" ")}
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ background: color ?? "transparent", boxShadow: on ? undefined : "inset 0 0 0 1px var(--viz-axis)" }}
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Selected keys with a colour slot each. A slot belongs to its key until the
 * key is turned off, so adding or removing one series never repaints the
 * others.
 */
export function useSlots(max: number, initial: string[], minKeep = 0) {
  const [picked, setPicked] = useState(() => initial.slice(0, max).map((key, slot) => ({ key, slot })));
  const toggle = (key: string) =>
    setPicked((cur) => {
      if (cur.some((p) => p.key === key)) {
        return cur.length > minKeep ? cur.filter((p) => p.key !== key) : cur;
      }
      if (cur.length >= max) return cur;
      const used = new Set(cur.map((p) => p.slot));
      const slot = Array.from({ length: max }, (_, i) => i).find((i) => !used.has(i)) ?? 0;
      return [...cur, { key, slot }];
    });
  return { picked, toggle, full: picked.length >= max };
}

export interface RangePreset {
  key: string;
  label: string;
  /** Days back from the latest point; "ytd" from the prior year-end; null for everything. */
  days: number | "ytd" | null;
}

export const RANGE_PRESETS: RangePreset[] = [
  { key: "1M", label: "1M", days: 31 },
  { key: "3M", label: "3M", days: 92 },
  { key: "6M", label: "6M", days: 183 },
  { key: "YTD", label: "YTD", days: "ytd" },
  { key: "1Y", label: "1Y", days: 366 },
  { key: "3Y", label: "3Y", days: 3 * 366 },
  { key: "5Y", label: "5Y", days: 5 * 366 },
  { key: "MAX", label: "Max", days: null },
];

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function presetStart(p: RangePreset, min: number, max: number): number {
  if (p.days == null) return min;
  if (p.days === "ytd") return Math.max(min, Date.UTC(new Date(max).getUTCFullYear() - 1, 11, 31));
  return Math.max(min, max - p.days * DAY);
}

/** A time window: a preset, or any custom from/to (typed or dragged). */
export function useRange(min: number, max: number, initial = "MAX") {
  const [state, setState] = useState<{ preset: string | null; from: number; to: number }>(() => {
    const p = RANGE_PRESETS.find((r) => r.key === initial) ?? RANGE_PRESETS[RANGE_PRESETS.length - 1];
    return { preset: p.key, from: presetStart(p, min, max), to: max };
  });
  // Presets follow the data's own bounds (a tab switch can change them).
  const preset = RANGE_PRESETS.find((r) => r.key === state.preset);
  const from = preset ? presetStart(preset, min, max) : Math.max(min, state.from);
  const to = preset ? max : Math.min(max, state.to);
  return {
    from,
    to,
    preset: state.preset,
    choose: (key: string) => setState((s) => ({ ...s, preset: key })),
    custom: (a: number, b: number) =>
      setState({ preset: null, from: Math.min(a, b), to: Math.max(a, b) }),
  };
}

export function RangeControls({
  range,
  min,
  max,
  days,
  presets = RANGE_PRESETS,
}: {
  range: ReturnType<typeof useRange>;
  min: number;
  max: number;
  /** Every close in the data, ascending: the only days the pickers offer. */
  days: string[];
  presets?: RangePreset[];
}) {
  const span = max - min;
  // Only offer windows the data actually covers (plus Max).
  const shown = presets.filter((p) => p.days == null || p.days === "ytd" || p.days * DAY < span);
  const fromDay = isoDay(range.from);
  const toDay = isoDay(range.to);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Time range" className="flex flex-wrap items-baseline gap-x-2.5">
        {shown.map((p) => {
          const on = range.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={on}
              onClick={() => range.choose(p.key)}
              className={[
                "font-mono text-[12px] transition-colors",
                on
                  ? "text-[color:var(--viz-ink)] underline underline-offset-4"
                  : "text-[color:var(--viz-muted)] hover:text-[color:var(--viz-ink)]",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--viz-muted)" }}>
        <DatePicker
          name="From"
          value={fromDay}
          days={days.filter((d) => d < toDay)}
          onChange={(d) => range.custom(Date.parse(d), range.to)}
        />
        <span>to</span>
        <DatePicker
          name="To"
          value={toDay}
          days={days.filter((d) => d > fromDay)}
          onChange={(d) => range.custom(range.from, Date.parse(d))}
        />
      </div>
    </div>
  );
}

/** The one big number a panel leads with, unit set small beside it. */
export function HeroFigure({ value, unit, note }: { value: string; unit: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        className="text-5xl leading-none tracking-tight sm:text-6xl"
        // Not font-heading: the site steps that up to 800 in dark mode, and
        // this wants Bodoni's regular cut at display size.
        style={{ fontFamily: "var(--font-bodoni), ui-serif, Georgia, serif", fontWeight: 400 }}
      >
        {value}
      </span>
      <span className="text-sm" style={{ color: "var(--viz-muted)" }}>
        {unit}
        {note && <span className="ml-2 whitespace-nowrap font-mono text-xs tabular-nums">{note}</span>}
      </span>
    </div>
  );
}

/** Dot keys, optionally with each series' latest value. */
export function DotLegend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-3 rounded-full"
            style={{ background: item.color, boxShadow: "0 0 0 1.5px var(--viz-panel), 0 0 0 2.5px var(--viz-border)" }}
          />
          {item.label}
          {item.value && <span className="font-mono text-xs tabular-nums" style={{ color: "var(--viz-muted)" }}>{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export interface SectionTab {
  key: string;
  label: string;
  figures: { label: string; value: string }[];
}

/**
 * The page's sections as tabs, each carrying its headline numbers. Every
 * panel stays in the HTML (inactive ones hidden), and the open tab rides in
 * the URL hash, so /markets#credit opens on credit.
 */
export function SectionTabs({ tabs, panels }: { tabs: SectionTab[]; panels: React.ReactNode[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const fromHash = () => {
      const key = window.location.hash.slice(1);
      if (tabs.some((t) => t.key === key)) setActive(key);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const open = (key: string) => {
    setActive(key);
    window.history.replaceState(null, "", `#${key}`);
  };

  return (
    <div>
      <div role="tablist" aria-label="Sections" className="grid grid-cols-3 border-b">
        {tabs.map((tab, i) => {
          const on = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={on}
              aria-controls={`panel-${tab.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => open(tab.key)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                open(tabs[next].key);
                refs.current[next]?.focus();
              }}
              className="group relative pb-3 pr-3 text-left"
            >
              <span
                className={[
                  "block font-mono text-[10px] uppercase tracking-[0.2em] transition-colors sm:text-[11px]",
                  on ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
                ].join(" ")}
              >
                {tab.label}
              </span>
              <span className={["mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 transition-opacity", on ? "" : "opacity-55 group-hover:opacity-90"].join(" ")}>
                {tab.figures.map((f, k) => (
                  <span key={f.label} className={k > 0 ? "hidden md:inline" : ""}>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{f.label} </span>
                    <span className="font-heading text-lg font-bold tabular-nums sm:text-2xl">{f.value}</span>
                  </span>
                ))}
              </span>
              <span
                aria-hidden
                className={["absolute -bottom-px left-0 right-3 h-0.5 bg-brand transition-transform duration-300 origin-left", on ? "scale-x-100" : "scale-x-0"].join(" ")}
              />
            </button>
          );
        })}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== active}
          className="pt-10"
        >
          {panels[i]}
        </div>
      ))}
    </div>
  );
}

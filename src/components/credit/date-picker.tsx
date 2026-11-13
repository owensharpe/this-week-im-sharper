"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A date button that opens a month calendar, for the Markets tab. Only days
 * with a close can be picked; weekends, holidays and anything outside the
 * data are shown but greyed out. The title flips to a month-and-year view
 * for long jumps. Keyboard: arrows step between closes (up/down by a week),
 * Page Up/Down by a month, Enter picks, Escape closes.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parts = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
};
const label = (s: string) => {
  const { y, m, d } = parts(s);
  return `${MONTHS[m]} ${d}, ${y}`;
};
/** Shift an ISO day by whole days, in UTC so nothing drifts across DST. */
const shift = (s: string, days: number) => {
  const { y, m, d } = parts(s);
  return new Date(Date.UTC(y, m, d + days)).toISOString().slice(0, 10);
};

interface Props {
  value: string;
  /** Every pickable day, ascending (YYYY-MM-DD). */
  days: string[];
  onChange: (day: string) => void;
  /** Accessible name, e.g. "From". */
  name: string;
}

export function DatePicker({ value, days, onChange, name }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [cursor, setCursor] = useState(value);
  const [month, setMonth] = useState(() => ({ y: parts(value).y, m: parts(value).m }));
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const pickable = useMemo(() => new Set(days), [days]);
  const first = days[0];
  const last = days[days.length - 1];

  const openPicker = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setAlignRight(rect ? rect.left + 300 > window.innerWidth : false);
    setCursor(value);
    setMonth({ y: parts(value).y, m: parts(value).m });
    setView("days");
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (day: string) => {
    onChange(day);
    close();
  };

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep keyboard focus on the cursor day as it moves.
  useEffect(() => {
    if (!open || view !== "days") return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [open, view, cursor, month]);

  /** The nearest pickable day from `from`, stepping `dir` (+1/-1). */
  const nearest = (from: string, dir: 1 | -1): string | null => {
    let d = from;
    for (let i = 0; i < 40; i++) {
      if (pickable.has(d)) return d;
      d = shift(d, dir);
      if (d < first || d > last) break;
    }
    return null;
  };
  const moveCursor = (to: string | null) => {
    if (!to) return;
    setCursor(to);
    const p = parts(to);
    setMonth({ y: p.y, m: p.m });
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const steps: Record<string, [number, 1 | -1]> = {
      ArrowLeft: [-1, -1],
      ArrowRight: [1, 1],
      ArrowUp: [-7, -1],
      ArrowDown: [7, 1],
      PageUp: [-30, -1],
      PageDown: [30, 1],
    };
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    moveCursor(nearest(shift(cursor, step[0]), step[1]));
  };

  const stepMonth = (delta: number) =>
    setMonth(({ y, m }) => {
      const t = y * 12 + m + delta;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });
  const monthKey = (y: number, m: number) => y * 12 + m;
  const firstKey = monthKey(parts(first).y, parts(first).m);
  const lastKey = monthKey(parts(last).y, parts(last).m);
  const thisKey = monthKey(month.y, month.m);

  const cells = useMemo(() => {
    const lead = new Date(Date.UTC(month.y, month.m, 1)).getUTCDay();
    const count = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: count }, (_, i) => iso(month.y, month.m, i + 1)),
    ];
  }, [month]);

  const iconButton =
    "grid size-7 place-items-center rounded-md text-[color:var(--viz-muted)] transition-colors hover:text-[color:var(--viz-ink)] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${name}: ${label(value)}`}
        onClick={() => (open ? close(false) : openPicker())}
        className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--viz-border)] px-2 py-1 font-mono text-[12px] tabular-nums text-[color:var(--viz-ink)] transition-colors hover:border-[color:var(--viz-ink)]"
      >
        <CalendarDays className="size-3.5 text-[color:var(--viz-muted)]" strokeWidth={1.75} aria-hidden />
        {label(value)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${name.toLowerCase()} date`}
          className={`absolute top-full z-40 mt-1.5 w-[288px] rounded-lg border p-3 shadow-lg ${alignRight ? "right-0" : "left-0"}`}
          style={{ background: "var(--viz-panel)", borderColor: "var(--viz-border)", color: "var(--viz-ink)" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(view === "days" ? "months" : "days")}
              aria-label={view === "days" ? "Choose month and year" : "Back to days"}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-heading text-base font-bold tracking-tight hover:text-brand"
            >
              {view === "days" ? `${LONG_MONTHS[month.m]} ${month.y}` : month.y}
              <ChevronDown className={`size-3.5 transition-transform ${view === "months" ? "rotate-180" : ""}`} aria-hidden />
            </button>
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={view === "days" ? "Previous month" : "Previous year"}
                className={iconButton}
                disabled={view === "days" ? thisKey <= firstKey : month.y <= parts(first).y}
                onClick={() => (view === "days" ? stepMonth(-1) : stepMonth(-12))}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label={view === "days" ? "Next month" : "Next year"}
                className={iconButton}
                disabled={view === "days" ? thisKey >= lastKey : month.y >= parts(last).y}
                onClick={() => (view === "days" ? stepMonth(1) : stepMonth(12))}
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>

          {view === "days" ? (
            <>
              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="text-center font-mono text-[10px] uppercase" style={{ color: "var(--viz-muted)" }}>
                    {d}
                  </span>
                ))}
              </div>
              <div ref={gridRef} role="grid" aria-label={`${LONG_MONTHS[month.m]} ${month.y}`} className="grid grid-cols-7 gap-y-0.5" onKeyDown={onGridKey}>
                {cells.map((day, i) => {
                  if (!day) return <span key={`blank-${i}`} />;
                  const n = Number(day.slice(8));
                  const can = pickable.has(day);
                  const selected = day === value;
                  const isLast = day === last;
                  return (
                    <button
                      key={day}
                      type="button"
                      data-day={day}
                      disabled={!can}
                      tabIndex={day === cursor ? 0 : -1}
                      aria-label={`${label(day)}${isLast ? ", latest close" : ""}${can ? "" : ", no close"}`}
                      aria-pressed={selected}
                      onClick={() => choose(day)}
                      className={[
                        "relative mx-auto flex size-9 items-center justify-center rounded-md font-mono text-[12px] tabular-nums transition-colors",
                        selected
                          ? "bg-[color:var(--viz-ink)] font-semibold text-[color:var(--viz-panel)]"
                          : can
                            ? "hover:bg-[color:color-mix(in_oklch,var(--viz-ink)_8%,transparent)]"
                            : "cursor-default opacity-30",
                        day === cursor && !selected ? "ring-1 ring-[color:var(--viz-ink)]" : "",
                      ].join(" ")}
                    >
                      {n}
                      {isLast && !selected && (
                        <span aria-hidden className="absolute bottom-1 size-1 rounded-full" style={{ background: "var(--viz-1)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS.map((m, i) => {
                const key = monthKey(month.y, i);
                const can = key >= firstKey && key <= lastKey;
                const on = month.y === parts(value).y && i === parts(value).m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!can}
                    onClick={() => {
                      setMonth({ y: month.y, m: i });
                      setView("days");
                    }}
                    className={[
                      "rounded-md py-2 font-mono text-[12px] transition-colors",
                      on
                        ? "bg-[color:var(--viz-ink)] text-[color:var(--viz-panel)]"
                        : "hover:bg-[color:color-mix(in_oklch,var(--viz-ink)_8%,transparent)]",
                      can ? "" : "pointer-events-none opacity-30",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t pt-2 font-mono text-[11px]" style={{ borderColor: "var(--viz-border)" }}>
            <button type="button" onClick={() => choose(first)} className="text-[color:var(--viz-muted)] hover:text-[color:var(--viz-ink)]">
              Earliest · {label(first)}
            </button>
            <button type="button" onClick={() => choose(last)} className="inline-flex items-center gap-1 text-[color:var(--viz-muted)] hover:text-[color:var(--viz-ink)]">
              <span aria-hidden className="size-1 rounded-full" style={{ background: "var(--viz-1)" }} />
              Latest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

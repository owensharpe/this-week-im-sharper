"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  /** Dates that have a digest, as YYYY-MM-DD. */
  availableDates: string[];
  /** The date currently being shown, as YYYY-MM-DD. */
  activeDate: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Parse "YYYY-MM-DD" into parts without going through Date (avoids UTC shift). */
function parseDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function CalendarPicker({ availableDates, activeDate }: Props) {
  const available = useMemo(() => new Set(availableDates), [availableDates]);

  // availableDates arrives newest-first, so [0] is the max and last is the min.
  const bounds = useMemo(() => {
    if (availableDates.length === 0) return null;
    const max = parseDate(availableDates[0]);
    const min = parseDate(availableDates[availableDates.length - 1]);
    return {
      min: monthIndex(min.year, min.month),
      max: monthIndex(max.year, max.month),
    };
  }, [availableDates]);

  const active = parseDate(activeDate);
  const [view, setView] = useState({ year: active.year, month: active.month });

  const current = monthIndex(view.year, view.month);
  const canPrev = bounds !== null && current > bounds.min;
  const canNext = bounds !== null && current < bounds.max;

  const cells = useMemo(() => {
    const firstWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(`${view.year}-${pad(view.month + 1)}-${pad(d)}`);
    }
    return out;
  }, [view]);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const step = (delta: number) => {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <div className="rounded-lg border border-border p-3 w-full max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-xs font-mono uppercase tracking-wider">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-label="Next month"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <span
            key={i}
            className="text-center text-[10px] font-mono uppercase text-muted-foreground/60"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (date === null) return <span key={`blank-${i}`} />;
          const day = Number(date.slice(8));
          const isActive = date === activeDate;
          const hasDigest = available.has(date);

          if (!hasDigest) {
            return (
              <span
                key={date}
                className="flex items-center justify-center size-9 text-xs tabular-nums text-muted-foreground/30 select-none"
              >
                {day}
              </span>
            );
          }

          return (
            <Link
              key={date}
              href={`/dashboard/${date}`}
              aria-current={isActive ? "date" : undefined}
              className={[
                "flex items-center justify-center size-9 rounded-md text-xs tabular-nums border transition-colors",
                isActive
                  ? "bg-brand text-brand-foreground border-brand font-semibold"
                  : "border-transparent text-foreground hover:border-brand hover:text-brand",
              ].join(" ")}
            >
              {day}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Number and date formatting for the Credit tab. Kept free of `fs` so the
 * client charts can share it with the server-rendered tables.
 */

const MINUS = "−";

export function pct(value: number | null | undefined, digits = 2): string {
  return value == null ? "–" : `${value < 0 ? MINUS : ""}${Math.abs(value).toFixed(digits)}%`;
}

export function bp(value: number | null | undefined): string {
  return value == null ? "–" : `${value < 0 ? MINUS : ""}${Math.abs(Math.round(value))}`;
}

/** Signed, for changes: +12, −3, 0. */
export function signedBp(value: number | null | undefined): string {
  if (value == null) return "–";
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : MINUS}${Math.abs(rounded)}`;
}

export function signedPct(value: number | null | undefined, digits = 2): string {
  if (value == null) return "–";
  const fixed = Math.abs(value).toFixed(digits);
  if (Number(fixed) === 0) return fixed;
  return `${value > 0 ? "+" : MINUS}${fixed}`;
}

/** "YYYY-MM-DD" as a UTC timestamp, so nothing shifts a day in the browser. */
export function dayToMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatDay(day: string | number, style: "short" | "long" = "short"): string {
  const ms = typeof day === "number" ? day : dayToMs(day);
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: style === "long" || typeof day === "number" ? "numeric" : undefined,
  });
}

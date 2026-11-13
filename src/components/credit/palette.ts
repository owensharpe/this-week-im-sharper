/**
 * Chart colours by role. Plain module (not "use client") so server
 * components can read it too. Values live in globals.css as --viz-* tokens.
 */

/** Today's series, or a lone series. */
export const INK = "var(--viz-ink)";
/** A backdrop series when there's only one thing to compare against. */
export const COMPARE = "var(--viz-compare)";
/** Up to four series beside the ink one, in this order. Validated as a set. */
export const SLOTS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)"] as const;
/** How many series a chart lets you turn on at once. */
export const MAX_SERIES = 4;
/** Heatmap poles. */
export const GAIN = "var(--viz-1)";
/**
 * Positive returns use a teal-green instead of blue, closer to the usual
 * green-for-up. A truer green fails the colourblind check against claret;
 * this one passes (light mode in the warning band, which the printed signs
 * cover). Spread and yield shading stay blue.
 */
export const RETURN_GAIN = "var(--viz-4)";
export const LOSS = "var(--viz-2)";

/** Tinted cell background: blue for positive, claret for negative, scaled to `scale`. */
export function heatStyle(v: number | null | undefined, scale: number, max = 32, gain: string = GAIN) {
  if (v == null || v === 0 || !scale) return undefined;
  const strength = Math.round(Math.min(1, Math.abs(v) / scale) * max);
  return { background: `color-mix(in oklch, ${v > 0 ? gain : LOSS} ${strength}%, transparent)` };
}

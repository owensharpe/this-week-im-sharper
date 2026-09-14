import Link from "next/link";

/**
 * The wire strip under the masthead: today's real cluster headlines, scrolling.
 *
 * The track holds the list twice and travels exactly -50%, which is what makes
 * the loop seamless without measuring anything. `aria-hidden` on the duplicate
 * keeps a screen reader from reading the same headlines through a second time.
 *
 * Pure CSS, so it costs no JavaScript; hovering pauses it, and with reduced
 * motion it stops moving and becomes a normal horizontally scrollable strip.
 */
export function WireTicker({
  headlines,
  date,
}: {
  headlines: string[];
  date: string;
}) {
  if (headlines.length === 0) return null;

  const items = (duplicate: boolean) =>
    headlines.map((headline, i) => (
      <span
        key={`${duplicate ? "b" : "a"}-${i}`}
        className="inline-flex items-center whitespace-nowrap"
      >
        <span className="text-brand" aria-hidden>
          &#9679;
        </span>
        <span className="px-3 text-muted-foreground">{headline}</span>
      </span>
    ));

  return (
    <div className="wire-strip group relative flex items-stretch overflow-hidden border-b border-border">
      {/* Sits above the track and carries the page background, so headlines
          disappear under the label instead of colliding with it. */}
      <Link
        href="/dashboard"
        className="relative z-10 shrink-0 border-r border-border bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-brand transition-colors hover:bg-brand hover:text-brand-foreground"
      >
        The Wire
      </Link>
      <div className="relative flex-1 overflow-hidden py-2">
        <div className="wire-track flex w-max font-mono text-[11px]">
          {items(false)}
          <span aria-hidden className="flex">
            {items(true)}
          </span>
        </div>
      </div>
      <p className="relative z-10 hidden shrink-0 items-center border-l border-border bg-background px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:flex">
        {date}
      </p>
    </div>
  );
}

import Link from "next/link";
import { WireTicker } from "./wire-ticker";
import { ColophonFigures, type Figure } from "./colophon-figures";

/**
 * The front-page nameplate.
 *
 * Replaces the centered eyebrow / title / subtitle / button stack that used to
 * sit here. Everything in this block is either the publication's own name or a
 * measured fact about it: no line restates another, which is what the old
 * subtitle was doing.
 */
export function Masthead({
  established,
  dateLabel,
  wireDate,
  headlines,
  figures,
}: {
  /** Month and year the publication was founded, e.g. "April 2026". */
  established: string;
  dateLabel: string;
  wireDate: string;
  headlines: string[];
  figures: Figure[];
}) {
  return (
    <section className="relative mb-16">
      {/* Extra density behind the nameplate. Static and server-rendered: the
          light that moves over it is one site-wide layer in the root layout,
          so this block doesn't carry its own copy of that. */}
      <div aria-hidden className="newsprint-masthead" />

      {/* No rule of its own above the nameplate: the header's own bottom border
          is directly above this and serves as the top of the frame, so drawing
          another one only put a heavy black line a gap below an existing line.
          The rules below the nameplate and under the dateline still run the
          full page, the way they do on a broadsheet; only the type is held to
          the measure. The @container sits on that inner measure rather than the
          section, so the nameplate's cqw sizing tracks the column and not the
          window. */}
      <div className="@container max-w-6xl mx-auto px-4">
        {/* Ceiling is tuned to the measure: at the 1120px this column resolves
            to, 21 characters of Bodoni need about 6rem to span it, and the cqw
            term keeps it filling the width all the way down to a phone. */}
        <h2
          className="nameplate font-heading font-bold text-center leading-[0.9] tracking-tight
            pt-6 pb-5 text-[clamp(2rem,8.8cqw,6rem)]"
        >
          This Week I&apos;m Sharper
        </h2>
      </div>

      <div className="border-t border-border" />

      {/* The dateline: edges pinned, centre centred, which is how a newspaper
          sets this line and why it reads as typeset rather than as a flex row
          of three arbitrary items. */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {/* Not the latest issue's number, which used to sit here: the front
              page isn't that issue, it only links to it, and the number is
              already on the Latest Issue block below. The founding date is what
              a masthead actually carries in this slot. */}
          <span className="shrink-0 text-brand">Est. {established}</span>
          <span className="hidden shrink-0 tabular-nums sm:inline">
            {dateLabel}
          </span>
          <Link
            href="/dashboard"
            className="shrink-0 transition-colors hover:text-brand"
          >
            Today&apos;s digest &rarr;
          </Link>
        </div>
      </div>

      <WireTicker headlines={headlines} date={wireDate} />

      <div className="max-w-6xl mx-auto px-4 pt-8">
        <ColophonFigures figures={figures} />
      </div>
    </section>
  );
}

import type { Credit, CreditBucket, WeekEnd } from "@/lib/credit";
import { ChartPanel } from "./chart-chrome";
import { bp, dayToMs, formatDay, pct, signedBp, signedPct } from "./format";
import { LOSS, RETURN_GAIN, heatStyle } from "./palette";
import { MUTED, TD, TH } from "./tables";

/**
 * The week in credit. Returns by rating, with each rating's last eight weeks
 * drawn as bars; then yield to worst and spread, each with a 52-week range
 * that shows where it was last Friday and where it is now.
 */

const PERIODS = ["MTD", "QTD", "YTD", "1Y"];
const INDEX_ROW = { background: "color-mix(in oklch, var(--viz-ink) 6%, transparent)" };
const BORDER = { borderColor: "var(--viz-border)" };
const HEAD_RULE = { borderColor: "var(--viz-ink)" };

function ordered(buckets: CreditBucket[]) {
  return (["IG", "HY"] as const).map((g) => buckets.filter((b) => b.group === g));
}

function RowLabel({ bucket }: { bucket: CreditBucket }) {
  return (
    <th scope="row" className={`${TD} text-left ${bucket.is_index ? "font-semibold" : "font-normal"}`}>
      {bucket.label}
    </th>
  );
}

function weekName(w: WeekEnd) {
  return w.partial ? `Week to ${formatDay(w.date)} (so far)` : `Week ended ${formatDay(w.date)}`;
}

/**
 * Eight weekly returns, oldest on the left, around a zero line. One scale for
 * every row, so CCC's swings read bigger than AAA's because they are. The
 * week still running is drawn hollow.
 */
function WeekBars({ returns, weeks, scale }: { returns: (number | null)[]; weeks: WeekEnd[]; scale: number }) {
  const w = 9;
  const gap = 3;
  const h = 30;
  const mid = h / 2;
  const order = weeks.map((wk, i) => ({ wk, v: returns[i] ?? null })).reverse();
  return (
    <svg width={order.length * (w + gap)} height={h} viewBox={`0 0 ${order.length * (w + gap)} ${h}`} className="inline-block align-middle" role="img" aria-label={order.map(({ wk, v }) => `${weekName(wk)}: ${v == null ? "no data" : `${signedPct(v)}%`}`).join("; ")}>
      <line x1={0} x2={order.length * (w + gap)} y1={mid} y2={mid} stroke="var(--viz-axis)" strokeWidth={1} />
      {order.map(({ wk, v }, i) => {
        if (v == null) return null;
        const len = Math.max(1, (Math.abs(v) / scale) * (mid - 1));
        const color = v >= 0 ? RETURN_GAIN : LOSS;
        return (
          <rect
            key={wk.date}
            x={i * (w + gap)}
            y={v >= 0 ? mid - len : mid}
            width={w}
            height={len}
            rx={1.5}
            fill={wk.partial ? "transparent" : color}
            stroke={wk.partial ? color : "none"}
            strokeWidth={wk.partial ? 1.25 : 0}
          >
            <title>{`${weekName(wk)}: ${signedPct(v)}%`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

const withPct = (v: number | null | undefined) => (v == null ? "–" : `${signedPct(v)}%`);

function ReturnsTable({ credit }: { credit: Credit }) {
  const weeks = credit.weeks ?? [];
  const rows = credit.buckets;
  const latest = weeks[0];
  const barScale = Math.max(0.05, ...rows.flatMap((b) => (b.weekly_returns_pct ?? []).map((v) => Math.abs(v ?? 0))));
  const colScale = (vals: (number | null | undefined)[]) => Math.max(0.01, ...vals.map((v) => Math.abs(v ?? 0)));
  const weekScale = colScale(rows.map((b) => b.weekly_returns_pct?.[0]));
  const periodScale = Object.fromEntries(PERIODS.map((p) => [p, colScale(rows.map((b) => b.returns_pct[p]))]));

  return (
    <table className="w-full min-w-[680px] text-right text-sm">
      <caption className="sr-only">ICE BofA total returns by rating: the last eight weeks, then month, quarter and year to date and one year</caption>
      <thead>
        <tr className="border-b" style={HEAD_RULE}>
          <th scope="col" className={`${TH} text-left`}>Rating</th>
          <th scope="col" className={`${TH} text-center`}>Last {weeks.length} weeks</th>
          <th scope="col" className={TH}>{latest?.partial ? "Week so far" : "Week"}</th>
          {PERIODS.map((p) => (
            <th key={p} scope="col" className={TH}>{p}</th>
          ))}
        </tr>
      </thead>
      {ordered(rows).map((group, g) => (
        <tbody key={g} className="border-b last:border-0" style={BORDER}>
          {group.map((b) => (
            <tr key={b.key} style={b.is_index ? INDEX_ROW : undefined}>
              <RowLabel bucket={b} />
              <td className={`${TD} text-center`}>
                <WeekBars returns={b.weekly_returns_pct ?? []} weeks={weeks} scale={barScale} />
              </td>
              <td className={`${TD} ${b.is_index ? "font-semibold" : ""}`} style={heatStyle(b.weekly_returns_pct?.[0], weekScale, 32, RETURN_GAIN)}>
                {withPct(b.weekly_returns_pct?.[0])}
              </td>
              {PERIODS.map((p) => (
                <td key={p} className={TD} style={heatStyle(b.returns_pct[p], periodScale[p], 32, RETURN_GAIN)}>
                  {withPct(b.returns_pct[p])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

/**
 * A 52-week range with last Friday's close as a hollow ring and today's as a
 * solid dot, joined by a short rule: which way it moved, and how far.
 */
/** Where `v` sits between the low (0) and the high (100). */
function rangePosition(v: number, lo: number, hi: number): number {
  return hi > lo ? Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)) : 50;
}

function MoveRange({ now, prev, lo, hi, fmt }: { now?: number | null; prev?: number | null; lo?: number | null; hi?: number | null; fmt: (v: number) => string }) {
  if (now == null || lo == null || hi == null) return <span style={MUTED}>–</span>;
  const a = rangePosition(now, lo, hi);
  const b = prev == null ? a : rangePosition(prev, lo, hi);
  return (
    <span className="inline-flex items-center gap-2" title={`52-week low ${fmt(lo)}, high ${fmt(hi)}${prev != null ? `, last week ${fmt(prev)}` : ""}`}>
      <span className="w-11 text-right text-[11px]" style={MUTED}>{fmt(lo)}</span>
      <span className="relative inline-block h-3 w-20" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: "var(--viz-axis)" }} />
        <span className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%`, background: "var(--viz-ink)" }} />
        {prev != null && (
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]" style={{ left: `${b}%`, borderColor: "var(--viz-ink)", background: "var(--viz-panel)" }} />
        )}
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${a}%`, background: "var(--viz-ink)", boxShadow: "0 0 0 2px var(--viz-panel)" }} />
      </span>
      <span className="w-11 text-left text-[11px]" style={MUTED}>{fmt(hi)}</span>
    </span>
  );
}

/** The range position as its own column, so it isn't mistaken for a percentile. */
function RangeShare({ now, lo, hi }: { now?: number | null; lo?: number | null; hi?: number | null }) {
  return (
    <td className={`${TD} text-[12px]`}>
      {now == null || lo == null || hi == null ? "–" : `${Math.round(rangePosition(now, lo, hi))}%`}
    </td>
  );
}

function YieldsSpreadsTable({ credit }: { credit: Credit }) {
  const rows = ordered(credit.buckets);
  const ytwDelta = (b: CreditBucket) => (b.ytw_pct == null || b.ytw_prior_week_pct == null ? null : (b.ytw_pct - b.ytw_prior_week_pct) * 100);
  const oasDelta = (b: CreditBucket) => (b.oas_bp == null || b.oas_prior_week_bp == null ? null : b.oas_bp - b.oas_prior_week_bp);
  const flat = credit.buckets;
  const ytwScale = Math.max(1, ...flat.map((b) => Math.abs(ytwDelta(b) ?? 0)));
  const oasScale = Math.max(1, ...flat.map((b) => Math.abs(oasDelta(b) ?? 0)));
  const adverse = (v: number | null, s: number) => heatStyle(v == null ? null : -v, s, 28);
  const fmtPct = (v: number) => pct(v);
  const fmtBp = (v: number) => bp(v);

  return (
    <table className="w-full min-w-[900px] text-right text-sm">
      <caption className="sr-only">
        ICE BofA yield to worst and option-adjusted spread by rating: latest close, change on the week, and the 52-week range with the prior week&apos;s close
      </caption>
      <thead>
        <tr>
          <td />
          <th colSpan={4} scope="colgroup" className={`${TH} border-b text-center`} style={HEAD_RULE}>Yield to worst</th>
          <td className="w-4" />
          <th colSpan={4} scope="colgroup" className={`${TH} border-b text-center`} style={HEAD_RULE}>Option-adjusted spread</th>
        </tr>
        <tr className="border-b" style={HEAD_RULE}>
          <th scope="col" className={`${TH} text-left`}>Rating</th>
          <th scope="col" className={TH}>Now</th>
          <th scope="col" className={TH}>w/w bp</th>
          <th scope="col" className={`${TH} text-center`}>52-week range</th>
          <th scope="col" className={`${TH} w-14 whitespace-normal leading-tight`}>% of range</th>
          <td />
          <th scope="col" className={TH}>Now</th>
          <th scope="col" className={TH}>w/w bp</th>
          <th scope="col" className={`${TH} text-center`}>52-week range</th>
          <th scope="col" className={`${TH} w-14 whitespace-normal leading-tight`}>% of range</th>
        </tr>
      </thead>
      {rows.map((group, g) => (
        <tbody key={g} className="border-b last:border-0" style={BORDER}>
          {group.map((b) => (
            <tr key={b.key} style={b.is_index ? INDEX_ROW : undefined}>
              <RowLabel bucket={b} />
              <td className={`${TD} ${b.is_index ? "font-semibold" : ""}`}>{pct(b.ytw_pct)}</td>
              <td className={TD} style={adverse(ytwDelta(b), ytwScale)}>{signedBp(ytwDelta(b))}</td>
              <td className={`${TD} text-center`}>
                <MoveRange now={b.ytw_pct} prev={b.ytw_prior_week_pct} lo={b.ytw_52w_low_pct} hi={b.ytw_52w_high_pct} fmt={fmtPct} />
              </td>
              <RangeShare now={b.ytw_pct} lo={b.ytw_52w_low_pct} hi={b.ytw_52w_high_pct} />
              <td />
              <td className={`${TD} ${b.is_index ? "font-semibold" : ""}`}>{b.oas_bp == null ? "–" : `${bp(b.oas_bp)} bp`}</td>
              <td className={TD} style={adverse(oasDelta(b), oasScale)}>{signedBp(oasDelta(b))}</td>
              <td className={`${TD} text-center`}>
                <MoveRange now={b.oas_bp} prev={b.oas_prior_week_bp} lo={b.oas_52w_low_bp} hi={b.oas_52w_high_bp} fmt={fmtBp} />
              </td>
              <RangeShare now={b.oas_bp} lo={b.oas_52w_low_bp} hi={b.oas_52w_high_bp} />
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

function csvRows(credit: Credit): (string | number | null)[][] {
  const weeks = credit.weeks ?? [];
  return [
    [
      "rating",
      ...weeks.map((w) => `return_week_${w.date}${w.partial ? "_so_far" : ""}`),
      ...PERIODS.map((p) => `return_${p.toLowerCase()}`),
      "ytw_pct", "ytw_prior_week_pct", "ytw_52w_low_pct", "ytw_52w_high_pct",
      "oas_bp", "oas_prior_week_bp", "oas_52w_low_bp", "oas_52w_high_bp",
    ],
    ...credit.buckets.map((b) => [
      b.label,
      ...weeks.map((_, k) => b.weekly_returns_pct?.[k] ?? null),
      ...PERIODS.map((p) => b.returns_pct[p] ?? null),
      b.ytw_pct ?? null, b.ytw_prior_week_pct ?? null, b.ytw_52w_low_pct ?? null, b.ytw_52w_high_pct ?? null,
      b.oas_bp, b.oas_prior_week_bp ?? null, b.oas_52w_low_bp ?? null, b.oas_52w_high_bp ?? null,
    ]),
  ];
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <h4 className="font-heading text-base font-bold tracking-tight">{children}</h4>;
}

export function WeeklySnapshot({ credit }: { credit: Credit }) {
  const latest = credit.weeks?.[0];
  // Monday of the latest week, for the panel's dateline.
  const monday = latest ? dayToMs(latest.date) - ((new Date(dayToMs(latest.date)).getUTCDay() + 6) % 7) * 86_400_000 : null;
  return (
    <ChartPanel download={{ filename: `ice-weekly-snapshot-${credit.as_of}.csv`, rows: csvRows(credit) }}>
      <p className="pr-12 pt-1.5 font-mono text-[11px] uppercase tracking-wider" style={MUTED}>
        ICE BofA US indices
        {monday != null && latest && (
          <> · week of {formatDay(monday)}{latest.partial ? `, through ${formatDay(latest.date)}` : ""}</>
        )}
      </p>
      <div className="mt-5 space-y-8">
        <section>
          <Subhead>Returns</Subhead>
          <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ReturnsTable credit={credit} />
          </div>
        </section>
        <section>
          <Subhead>Yields and Spreads</Subhead>
          <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <YieldsSpreadsTable credit={credit} />
          </div>
        </section>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed" style={MUTED}>
        Total returns include coupons, shaded green for gains and claret for losses. Bars run oldest to newest, with
        the week still running drawn hollow. Yield and spread changes are shaded blue where they fell. On each
        52-week range, the ring is last Friday&apos;s close and the dot is today&apos;s. % of range is where today sits on a
        straight line from the 52-week low (0%) to the high (100%).
      </p>
    </ChartPanel>
  );
}

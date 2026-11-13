import type { Curve, MaturityBucket } from "@/lib/credit";
import { ChartPanel } from "./chart-chrome";
import { bp, pct, signedBp } from "./format";
import { heatStyle } from "./palette";

/**
 * Server-rendered table panels. Yield and spread changes are shaded blue
 * when they fall (good for a bondholder) and claret when they rise. Returns,
 * in the weekly snapshot, use teal-green for gains instead of blue, so the
 * two kinds of number don't read alike. Each column is scaled on its own.
 */

export const TH = "px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-wider whitespace-nowrap";
export const TD = "px-2 py-1.5 font-mono tabular-nums whitespace-nowrap";
export const MUTED = { color: "var(--viz-muted)" };
export const RULE = { borderColor: "var(--viz-border)" };

export function PanelKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="pr-12 pt-1.5 font-mono text-[11px] uppercase tracking-wider" style={MUTED}>
      {children}
    </p>
  );
}

/** Tables scroll sideways inside their panel on phones; the page never does. */
export function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">{children}</div>;
}

const scaleOf = (values: (number | null | undefined)[]) =>
  Math.max(1, ...values.map((v) => Math.abs(v ?? 0)));

/** Rising yields or spreads are bad for a bondholder, so the shade is flipped. */
const adverse = (v: number | null | undefined, scale: number) =>
  heatStyle(v == null ? null : -v, scale, 28);

function changeFrom(curve: Curve, key: string, i: number): number | null {
  const past = curve.comparisons.find((c) => c.key === key)?.yields[i];
  const now = curve.yields[i];
  return past == null || now == null ? null : (now - past) * 100;
}

export function CurveTable({ curve }: { curve: Curve }) {
  const windows = ["1D", "1W", "1M", "YTD"].filter((k) => curve.comparisons.some((c) => c.key === k));
  const changes = Object.fromEntries(
    windows.map((w) => [w, curve.tenors.map((_, i) => changeFrom(curve, w, i))])
  );
  const scale = Object.fromEntries(windows.map((w) => [w, scaleOf(changes[w])]));

  return (
    <ChartPanel
      className="h-full"
      download={{
        filename: `treasury-yields-${curve.date}.csv`,
        rows: [
          ["tenor", "yield_pct", ...windows.map((w) => `change_${w.toLowerCase()}_bp`)],
          ...curve.tenors.map((t, i) => [t, curve.yields[i], ...windows.map((w) => changes[w][i])]),
        ],
      }}
    >
      <PanelKicker>Yields and changes</PanelKicker>
      <Scroll>
        <table className="w-full text-right text-sm">
          <caption className="sr-only">Treasury par yields and changes in basis points</caption>
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--viz-ink)" }}>
              <th scope="col" className={`${TH} text-left`}>Tenor</th>
              <th scope="col" className={TH}>Yield</th>
              {windows.map((w) => (
                <th key={w} scope="col" className={TH}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {curve.tenors.map((tenor, i) => (
              <tr key={tenor} className="border-b last:border-0" style={RULE}>
                <th scope="row" className={`${TD} text-left font-normal`} style={MUTED}>{tenor}</th>
                <td className={`${TD} font-semibold`}>{pct(curve.yields[i])}</td>
                {windows.map((w) => (
                  <td key={w} className={TD} style={adverse(changes[w][i], scale[w])}>
                    {signedBp(changes[w][i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      <p className="mt-3 text-[11px]" style={MUTED}>
        Changes in basis points. Blue where yields fell, claret where they rose.
      </p>
    </ChartPanel>
  );
}

export function RealYieldTable({ nominal, real }: { nominal: Curve; real: Curve }) {
  const monthAgo = real.comparisons.find((c) => c.key === "1M");
  const rows = real.tenors.map((tenor, i) => {
    const n = nominal.yields[nominal.tenors.indexOf(tenor)] ?? null;
    const r = real.yields[i];
    const past = monthAgo?.yields[i];
    return {
      tenor,
      n,
      r,
      breakeven: n == null || r == null ? null : n - r,
      realChange: r == null || past == null ? null : (r - past) * 100,
    };
  });
  const scale = scaleOf(rows.map((row) => row.realChange));

  return (
    <ChartPanel
      className="h-full"
      download={{
        filename: `treasury-real-yields-${real.date}.csv`,
        rows: [
          ["tenor", "nominal_pct", "real_pct", "breakeven_pct", "real_change_1m_bp"],
          ...rows.map((row) => [
            row.tenor,
            row.n,
            row.r,
            row.breakeven == null ? null : Number(row.breakeven.toFixed(3)),
            row.realChange,
          ]),
        ],
      }}
    >
      <PanelKicker>Nominal, real and breakeven</PanelKicker>
      <Scroll>
        <table className="w-full text-right text-sm">
          <caption className="sr-only">Nominal and real Treasury par yields, with breakeven inflation</caption>
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--viz-ink)" }}>
              <th scope="col" className={`${TH} text-left`}>Tenor</th>
              <th scope="col" className={TH}>Nominal</th>
              <th scope="col" className={TH}>Real</th>
              <th scope="col" className={TH}>Breakeven</th>
              {monthAgo && <th scope="col" className={TH}>Real 1M</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tenor} className="border-b last:border-0" style={RULE}>
                <th scope="row" className={`${TD} text-left font-normal`} style={MUTED}>{row.tenor}</th>
                <td className={TD}>{pct(row.n)}</td>
                <td className={TD}>{pct(row.r)}</td>
                <td className={`${TD} font-semibold`}>{pct(row.breakeven)}</td>
                {monthAgo && (
                  <td className={TD} style={adverse(row.realChange, scale)}>
                    {signedBp(row.realChange)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      <p className="mt-3 text-[11px]" style={MUTED}>Real 1M is the change over the month, in basis points.</p>
    </ChartPanel>
  );
}

export function IgCurveTable({ buckets, asOf }: { buckets: MaturityBucket[]; asOf: string }) {
  const windows = ["1M", "YTD", "1Y"].filter((w) => buckets.some((b) => b.comparisons_bp[w] != null));
  const changes = Object.fromEntries(
    windows.map((w) => [
      w,
      buckets.map((b) =>
        b.oas_bp == null || b.comparisons_bp[w] == null ? null : b.oas_bp - (b.comparisons_bp[w] as number)
      ),
    ])
  );
  const scale = Object.fromEntries(windows.map((w) => [w, scaleOf(changes[w])]));

  return (
    <ChartPanel
      className="h-full"
      download={{
        filename: `ice-ig-spread-curve-${asOf}.csv`,
        rows: [
          ["maturity", "oas_bp", ...windows.map((w) => `change_${w.toLowerCase()}_bp`)],
          ...buckets.map((b, i) => [b.label, b.oas_bp, ...windows.map((w) => changes[w][i])]),
        ],
      }}
    >
      <PanelKicker>Spread by maturity</PanelKicker>
      <Scroll>
        <table className="w-full text-right text-sm">
          <caption className="sr-only">Investment grade option-adjusted spread by maturity, with changes in basis points</caption>
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--viz-ink)" }}>
              <th scope="col" className={`${TH} text-left`}>Maturity</th>
              <th scope="col" className={TH}>OAS</th>
              {windows.map((w) => (
                <th key={w} scope="col" className={TH}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={b.key} className="border-b last:border-0" style={RULE}>
                <th scope="row" className={`${TD} text-left font-normal`} style={MUTED}>{b.label}</th>
                <td className={`${TD} font-semibold`}>{b.oas_bp == null ? "–" : `${bp(b.oas_bp)} bp`}</td>
                {windows.map((w) => (
                  <td key={w} className={TD} style={adverse(changes[w][i], scale[w])}>
                    {signedBp(changes[w][i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      <p className="mt-3 text-[11px]" style={MUTED}>
        Changes in basis points. Blue where spreads tightened, claret where they widened.
      </p>
    </ChartPanel>
  );
}

import { Separator } from "@/components/ui/separator";
import { SectionTabs, type SectionTab } from "@/components/credit/chart-chrome";
import { IgSpreadCurve, RealYieldChart } from "@/components/credit/curve-charts";
import { bp, formatDay, pct, signedBp, signedPct } from "@/components/credit/format";
import { HistoryPanel, type HistoryItem } from "@/components/credit/history-panel";
import { SlopePanel } from "@/components/credit/slopes";
import { WeeklySnapshot } from "@/components/credit/snapshot";
import { SpreadsTable } from "@/components/credit/spreads-table";
import { CurveTable, IgCurveTable, RealYieldTable } from "@/components/credit/tables";
import { YieldCurve } from "@/components/credit/yield-curve";
import { getMarketsSnapshot, type Credit, type Rates } from "@/lib/credit";

export const metadata = {
  title: "Markets - This Week I'm Sharper",
  description:
    "Rates and credit: the Treasury curve, corporate bond spreads and returns by rating, updated every weekday.",
};

function SectionHead({ title, note }: { title: string; note?: React.ReactNode }) {
  return (
    <div className="mb-5 max-w-2xl">
      <h3 className="font-heading text-xl font-bold tracking-tight">{title}</h3>
      {note && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A chart and its table side by side, the same height. */
function Pair({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">{children}</div>
  );
}

function TreasuriesTab({ rates }: { rates: Rates }) {
  return (
    <div className="space-y-16">
      <section>
        <SectionHead title="Treasury Curve" note="Par yields from 1 month to 30 years." />
        <Pair>
          <YieldCurve curve={rates.nominal} replay={rates.replay} />
          <CurveTable curve={rates.nominal} />
        </Pair>
      </section>

      {rates.replay.dates.length > 1 && (
        <section>
          <SectionHead
            title="Curve Shape"
            note="Long yield minus short yield, daily. Below zero the curve is inverted, and the gap is shaded."
          />
          <SlopePanel replay={rates.replay} tenors={rates.nominal.tenors} years={rates.nominal.years} />
        </section>
      )}

      {rates.real && (
        <section>
          <SectionHead
            title="Real Yields and Breakevens"
            note="Real yields are TIPS par yields. Breakeven is nominal minus real at the same maturity."
          />
          <Pair>
            <RealYieldChart nominal={rates.nominal} real={rates.real} />
            <RealYieldTable nominal={rates.nominal} real={rates.real} />
          </Pair>
        </section>
      )}
    </div>
  );
}

function CreditTab({ credit }: { credit: Credit }) {
  const since = formatDay(credit.history_start, "long");
  const spreads: HistoryItem[] = credit.buckets
    .filter((b) => b.oas_bp != null)
    .map((b) => ({
      key: b.key,
      label: b.key,
      groupStart: b.key === "HY",
      unitLabel: `bp over Treasuries, ${b.is_index ? b.label : `${b.label} rated`}`,
      seriesLabel: `${b.label} OAS (bp)`,
      dates: credit.dates,
      values: b.oas_history_bp,
    }));
  const maturity = credit.maturity.filter((m) => m.oas_bp != null);

  return (
    <div className="space-y-16">
      <section>
        <SectionHead
          title="Spreads by Rating"
          note="Option-adjusted spread over Treasuries for each rating bucket of the ICE BofA US corporate and high yield indices."
        />
        <SpreadsTable buckets={credit.buckets} dates={credit.dates} />
      </section>

      {spreads.length > 0 && (
        <section>
          <SectionHead
            title="Spread History"
            note={`Daily closes since ${since}. Pick up to four ratings, and switch to Indexed to compare how far each has moved.`}
          />
          <HistoryPanel
            items={spreads}
            defaultKeys={["HY"]}
            indexable
            measurePercent
            goodWhen="down"
            filePrefix="ice-oas"
            chipsLabel="Ratings"
          />
        </section>
      )}

      {maturity.length > 1 && (
        <section>
          <SectionHead
            title="Investment Grade Spread Curve"
            note="OAS of the ICE BofA US Corporate Index split by maturity: what lenders charge high-grade borrowers for lending longer."
          />
          <Pair>
            <IgSpreadCurve buckets={maturity} asOf={credit.as_of} />
            <IgCurveTable buckets={maturity} asOf={credit.as_of} />
          </Pair>
        </section>
      )}
    </div>
  );
}

function tabsFor(rates: Rates | null, credit: Credit | null): SectionTab[] {
  const i10 = rates ? rates.nominal.tenors.indexOf("10Y") : -1;
  const slope = rates?.slopes.find((s) => s.key === "2s10s");
  const bucket = (key: string) => credit?.buckets.find((b) => b.key === key);
  return [
    {
      key: "treasuries",
      label: "Treasuries",
      figures: [
        { label: "10Y", value: rates ? pct(rates.nominal.yields[i10]) : "–" },
        { label: "2s10s", value: slope ? `${signedBp(slope.current_bp)} bp` : "–" },
      ],
    },
    {
      key: "credit",
      label: "Credit Spreads",
      figures: [
        { label: "IG", value: bucket("IG")?.oas_bp != null ? `${bp(bucket("IG")!.oas_bp)} bp` : "–" },
        { label: "HY", value: bucket("HY")?.oas_bp != null ? `${bp(bucket("HY")!.oas_bp)} bp` : "–" },
      ],
    },
    {
      key: "weekly",
      label: "Weekly Snapshot",
      figures: [
        { label: "HY", value: withPct(bucket("HY")?.weekly_returns_pct?.[0]) },
        { label: "IG", value: withPct(bucket("IG")?.weekly_returns_pct?.[0]) },
      ],
    },
  ];
}

function withPct(v: number | null | undefined) {
  return v == null ? "–" : `${signedPct(v)}%`;
}

const Unavailable = ({ what }: { what: string }) => (
  <p className="text-muted-foreground">{what} aren&apos;t available yet.</p>
);

export default function MarketsPage() {
  const snapshot = getMarketsSnapshot();
  const rates = snapshot?.rates ?? null;
  const credit = snapshot?.credit ?? null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">Markets</p>
      <h2 className="font-heading text-3xl font-bold tracking-tight mb-2">Rates &amp; Credit</h2>
      <p className="text-muted-foreground mb-3 max-w-2xl">
        Treasury and corporate credit data refreshed every weekday from Treasury and ICE data.
      </p>
      {(rates || credit) && (
        <p className="mb-8 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {rates && <>Treasury close {formatDay(rates.as_of, "long")}</>}
          {rates && credit && <span className="mx-2">·</span>}
          {credit && <>ICE close {formatDay(credit.as_of, "long")}</>}
        </p>
      )}
      <Separator className="mb-8" />

      {!snapshot ? (
        <p className="text-muted-foreground">No market data yet. It arrives with the next scheduled run.</p>
      ) : (
        <div className="space-y-16">
          <SectionTabs
            tabs={tabsFor(rates, credit)}
            panels={[
              rates ? <TreasuriesTab key="t" rates={rates} /> : <Unavailable key="t" what="Treasury yields" />,
              credit ? <CreditTab key="c" credit={credit} /> : <Unavailable key="c" what="Credit spreads" />,
              credit && (credit.weeks?.length ?? 0) > 0 ? (
                <section key="w">
                  <SectionHead title="Weekly Snapshot" note="The week in credit." />
                  <WeeklySnapshot credit={credit} />
                </section>
              ) : (
                <Unavailable key="w" what="Weekly figures" />
              ),
            ]}
          />

          <section className="border-t pt-8">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-brand">Notes &amp; Sources</h3>
            <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-foreground/80">
              <p>
                Changes are measured from the last close on or before each date. In this case, 1D is the previous
                close. Spread and yield changes are in basis points.
                {credit && (
                  <>
                    {" "}Spread ranges and percentiles cover the history FRED publishes for ICE data, which starts{" "}
                    {formatDay(credit.history_start, "long")}.
                  </>
                )}
              </p>
              <ul className="space-y-2">
                {snapshot.sources.map((s) => (
                  <li key={s.name}>
                    <a href={s.url} className="link-underline text-foreground hover:text-brand" target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                    . {s.note}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

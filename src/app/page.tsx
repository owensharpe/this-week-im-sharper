import Link from "next/link";
import { formatIssueNumber, getAllIssues } from "@/lib/issues";
import { getAllDigestDates, getLatestDigest } from "@/lib/digests";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IssueImage } from "@/components/issue-image";
import { Masthead } from "@/components/masthead";

/** Enough to fill the strip without making one loop take all afternoon. */
const WIRE_HEADLINES = 12;

/**
 * When work on the project started, which is the first commit (April 30) rather
 * than the first published issue the following week. Stated rather than derived
 * from the issues for that reason, and because a publication's founding date
 * shouldn't move if the earliest issue is ever edited or back-dated.
 */
const ESTABLISHED = "April 2026";

/**
 * The dateline is pinned to Eastern rather than read from the server's clock,
 * so the date a reader sees doesn't depend on where the page happened to be
 * built or revalidated.
 */
const EDITION_ZONE = "America/New_York";

/**
 * The page is otherwise static, so without this the dateline would freeze at
 * whatever day the last build ran. An hour is fine for a line that only has to
 * change at midnight.
 */
export const revalidate = 3600;

export default function HomePage() {
  const issues = getAllIssues();
  const latest = issues[0];
  const recent = issues.slice(1, 4);

  const digest = getLatestDigest();
  const digestDates = getAllDigestDates();

  if (!latest) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">No issues published yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Lifted out of the measure below so its rules, wire and halftone can
          span the full page the way a broadsheet's do, while the type inside
          it stays in the same column as everything else. */}
      <Masthead
        established={ESTABLISHED}
        dateLabel={
          // Today, not the latest issue's date, which used to sit here and made
          // the whole front page read as stale on every day between issues.
          new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: EDITION_ZONE,
          })
        }
        wireDate={
          digest
            ? new Date(`${digest.date}T00:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : ""
        }
        headlines={
          digest?.clusters.slice(0, WIRE_HEADLINES).map((c) => c.headline) ?? []
        }
        figures={[
          { value: issues.length, label: "Issues published" },
          { value: digestDates.length, label: "Digests generated" },
          { value: digest?.article_count ?? 0, label: "Articles scanned today" },
          { value: digest?.source_count ?? 0, label: "Sources tracked today" },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 pb-12">
      <Separator className="mb-12" />

      {/* Latest Issue */}
      <section className="mb-16 animate-fade-up [animation-delay:120ms]">
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground mb-4">
          Latest Issue
        </p>
        <Link
          href={`/issues/${latest.slug}`}
          className="group flex items-start gap-4 sm:gap-6"
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-3 group-hover:text-brand transition-colors">
              <span className="link-underline">{latest.title}</span>
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {latest.subtitle}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-brand tabular-nums">
                No. {formatIssueNumber(latest.number)}
              </span>
              <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {new Date(`${latest.date}T00:00:00`).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </time>
              {latest.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] font-mono uppercase tracking-wider"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          {latest.image && (
            <IssueImage
              src={latest.image}
              alt={latest.imageAlt ?? latest.title}
              className="w-28 h-20 sm:w-40 sm:h-28 shrink-0"
              sizes="(max-width: 640px) 7rem, 10rem"
              priority
            />
          )}
        </Link>
      </section>

      {/* Recent Issues */}
      {recent.length > 0 && (
        <section className="animate-fade-up [animation-delay:240ms]">
          <Separator className="mb-8" />
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground mb-6">
            Recent Issues
          </p>
          <div className="divide-y divide-border stagger">
            {recent.map((issue) => (
              <Link
                key={issue.slug}
                href={`/issues/${issue.slug}`}
                className="group flex items-start gap-4 py-5 first:pt-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-mono uppercase tracking-wider text-brand tabular-nums">
                      No. {formatIssueNumber(issue.number)}
                    </span>
                    <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {new Date(`${issue.date}T00:00:00`).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <h4 className="font-semibold mt-1 mb-1 transition-colors group-hover:text-brand">
                    <span className="link-underline">{issue.title}</span>
                  </h4>
                  {issue.subtitle && (
                    <p className="text-sm text-muted-foreground leading-snug line-clamp-2">
                      {issue.subtitle}
                    </p>
                  )}
                </div>
                {issue.image && (
                  <IssueImage
                    src={issue.image}
                    alt={issue.imageAlt ?? issue.title}
                    className="w-24 h-16 sm:w-36 sm:h-24 shrink-0"
                    sizes="(max-width: 640px) 6rem, 9rem"
                  />
                )}
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/archive"
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
            >
              View all issues &rarr;
            </Link>
          </div>
        </section>
      )}
      </div>
    </>
  );
}

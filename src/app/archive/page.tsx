import Link from "next/link";
import { formatIssueNumber, getAllIssues } from "@/lib/issues";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IssueImage } from "@/components/issue-image";

export const metadata = {
  title: "Archive - This Week I'm Sharper",
};

export default function ArchivePage() {
  const issues = getAllIssues();

  const issuesByYear = issues.reduce<Record<string, typeof issues>>(
    (acc, issue) => {
      const year = new Date(`${issue.date}T00:00:00`).getFullYear().toString();
      if (!acc[year]) acc[year] = [];
      acc[year].push(issue);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        Archive
      </p>
      <h2 className="font-heading text-3xl font-bold tracking-tight mb-2">
        Issue Archive
      </h2>
      <p className="text-muted-foreground mb-8">
        Every issue from the beginning onward lies here.
      </p>
      <Separator className="mb-10" />

      {Object.entries(issuesByYear)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, yearIssues]) => (
          <section key={year} className="mb-12">
            <h3 className="text-lg font-mono uppercase tracking-wider text-muted-foreground mb-4">
              {year}
            </h3>
            <div className="space-y-5 stagger">
              {yearIssues.map((issue) => (
                <Link
                  key={issue.slug}
                  href={`/issues/${issue.slug}`}
                  className="group flex items-start gap-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 shrink-0">
                      <span className="text-xs font-mono uppercase tracking-wider text-brand tabular-nums">
                        No. {formatIssueNumber(issue.number)}
                      </span>
                      <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground tabular-nums">
                        {new Date(`${issue.date}T00:00:00`).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                    <div>
                      <h4 className="font-medium transition-colors group-hover:text-brand">
                        <span className="link-underline">{issue.title}</span>
                      </h4>
                      <div className="flex gap-2 mt-1">
                        {issue.tags.slice(0, 3).map((tag) => (
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
                  </div>
                  {issue.image && (
                    <IssueImage
                      src={issue.image}
                      alt={issue.imageAlt ?? issue.title}
                      className="w-20 h-14 sm:w-24 sm:h-16 shrink-0"
                      sizes="(max-width: 640px) 5rem, 6rem"
                    />
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}

      {issues.length === 0 && (
        <p className="text-muted-foreground">No issues published yet.</p>
      )}
    </div>
  );
}

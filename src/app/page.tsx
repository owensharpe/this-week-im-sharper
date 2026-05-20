import Link from "next/link";
import { getAllIssues } from "@/lib/issues";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const issues = getAllIssues();
  const latest = issues[0];
  const recent = issues.slice(1, 4);

  if (!latest) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">No issues published yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Masthead */}
      <section className="text-center mb-16 animate-fade-up">
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
          A Weekly Newsletter
        </p>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          This Week I&apos;m Sharper
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Some thoughts, comments, and opinions on weekly finance and world
          events. Markets, policies, and the things that matter.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Link
            href="/dashboard"
            className="hover:text-brand transition-colors"
          >
            View today&apos;s digest &rarr;
          </Link>
        </div>
      </section>

      <Separator className="mb-12" />

      {/* Latest Issue */}
      <section className="mb-16 animate-fade-up [animation-delay:120ms]">
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground mb-4">
          Latest Issue
        </p>
        <Link href={`/issues/${latest.slug}`} className="group block">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 group-hover:text-brand transition-colors">
            <span className="link-underline">{latest.title}</span>
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            {latest.subtitle}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {new Date(latest.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
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
        </Link>
      </section>

      {/* Recent Issues */}
      {recent.length > 0 && (
        <section className="animate-fade-up [animation-delay:240ms]">
          <Separator className="mb-8" />
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-muted-foreground mb-6">
            Recent Issues
          </p>
          <div className="space-y-6 stagger">
            {recent.map((issue) => (
              <Link
                key={issue.slug}
                href={`/issues/${issue.slug}`}
                className="group block"
              >
                <h4 className="font-semibold mb-1 transition-colors group-hover:text-brand">
                  <span className="link-underline">{issue.title}</span>
                </h4>
                <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {new Date(issue.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
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
  );
}

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
      <section className="text-center mb-16">
        <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-3">
          A Weekly Newsletter
        </p>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          This Week I&apos;m Sharper
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Some thoughts, comments, and opinions on weekly finance and world events. Markets, policies, and the things that matter!
        </p>
      </section>

      <Separator className="mb-12" />

      {/* Latest Issue */}
      <section className="mb-16">
        <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-4">
          Latest Issue
        </p>
        <Link href={`/issues/${latest.slug}`} className="group block">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight group-hover:underline underline-offset-4 decoration-1 mb-3">
            {latest.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            {latest.subtitle}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <time className="text-sm text-muted-foreground">
              {new Date(latest.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {latest.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </Link>
      </section>

      {/* Recent Issues */}
      {recent.length > 0 && (
        <section>
          <Separator className="mb-8" />
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-6">
            Recent Issues
          </p>
          <div className="space-y-6">
            {recent.map((issue) => (
              <Link
                key={issue.slug}
                href={`/issues/${issue.slug}`}
                className="group block"
              >
                <h4 className="font-semibold group-hover:underline underline-offset-4 decoration-1 mb-1">
                  {issue.title}
                </h4>
                <time className="text-sm text-muted-foreground">
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
              className="text-sm font-medium hover:underline underline-offset-4"
            >
              View all issues &rarr;
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

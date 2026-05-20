import Link from "next/link";
import { getAllIssueSlugs, getIssueBySlug } from "@/lib/issues";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export async function generateStaticParams() {
  return getAllIssueSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = await getIssueBySlug(slug);
  return {
    title: `${issue.title} — This Week I'm Sharper`,
    description: issue.subtitle,
  };
}

export default async function IssuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = await getIssueBySlug(slug);

  return (
    <article className="max-w-3xl mx-auto px-4 py-12 animate-fade-up">
      <Link
        href="/"
        className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors inline-block mb-8"
      >
        &larr; Back to latest
      </Link>

      <header className="mb-8">
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-4">
          Issue
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {issue.title}
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-4">
          {issue.subtitle}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {new Date(issue.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {issue.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] font-mono uppercase tracking-wider"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </header>

      <Separator className="mb-8" />

      <div
        className="prose dark:prose-invert prose-neutral max-w-none
          prose-headings:tracking-tight prose-headings:font-bold
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
          prose-p:leading-relaxed prose-p:text-foreground/90
          prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-a:underline-offset-4 prose-a:decoration-1
          prose-li:text-foreground/90
          prose-strong:text-foreground
          prose-blockquote:border-l-brand prose-blockquote:text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: issue.contentHtml }}
      />

      <Separator className="mt-12 mb-8" />

      <div className="flex justify-between items-center">
        <Link
          href="/archive"
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
        >
          &larr; All issues
        </Link>
      </div>
    </article>
  );
}

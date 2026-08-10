import Link from "next/link";
import {
  formatIssueNumber,
  getAllIssueSlugs,
  getIssueBySlug,
} from "@/lib/issues";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IssueImage } from "@/components/issue-image";

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
    <div className="bg-paper min-h-full animate-fade-up">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <article className="rounded-2xl bg-card shadow-sm ring-1 ring-border/60 px-6 py-10 sm:px-14 sm:py-14">
          <div className="px-5 sm:px-8">
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors inline-block mb-8"
            >
              &larr; Back to latest
            </Link>

            <header className="mb-8">
              <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-4">
                Issue No. {formatIssueNumber(issue.number)}
              </p>
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    {issue.title}
                  </h1>
                  <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                    {issue.subtitle}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {new Date(`${issue.date}T00:00:00`).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
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
                </div>
                {issue.image && (
                  <IssueImage
                    src={issue.image}
                    alt={issue.imageAlt ?? issue.title}
                    className="w-28 h-20 sm:w-40 sm:h-28 shrink-0"
                    sizes="(max-width: 640px) 7rem, 10rem"
                    priority
                  />
                )}
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
          </div>
        </article>
      </div>
    </div>
  );
}

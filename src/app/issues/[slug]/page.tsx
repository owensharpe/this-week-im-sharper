import Link from "next/link";
import {
  formatIssueNumber,
  getAllIssueSlugs,
  getIssueBySlug,
} from "@/lib/issues";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IssueImage } from "@/components/issue-image";

/**
 * Sizes the headline so it sets on a single line whatever the title's length.
 *
 * Bodoni Moda averages a shade under 0.5em per character in mixed case, so a
 * title of N characters needs roughly N * 0.5 * fontSize of width. Solving for
 * fontSize against the container gives ~2 * width / N; the 1.85 factor leaves a
 * safety margin for caps- and W-heavy titles. `cqw` resolves against the
 * `@container` on <header>, so this tracks the real column width at any
 * viewport instead of guessing at breakpoints.
 *
 * Clamped to a 3rem ceiling (so short titles don't balloon) and a 1.75rem floor
 * (so long ones stay readable). Deliberately no `white-space: nowrap`: once a
 * title is long enough to hit the floor, forcing one line overflows the card,
 * and wrapping is the better failure. Verified one line through ~50 characters,
 * which covers every title shipped so far.
 */
function headlineStyle(title: string) {
  return { fontSize: `clamp(1.75rem, ${(185 / title.length).toFixed(2)}cqw, 3rem)` };
}

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
    <>
      {/* Extends the paper tint under the sticky header so its translucent
          background blends instead of banding at the top of the page. Kept
          outside the animated wrapper, whose transform would otherwise make
          this "fixed" layer resolve against it rather than the viewport. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-paper" />
      <div className="bg-paper min-h-full animate-fade-up">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <article className="rounded-2xl bg-card shadow-sm ring-1 ring-border/60 px-6 py-10 sm:px-16 sm:py-16">
          <div>
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors inline-block mb-8"
            >
              &larr; Back to latest
            </Link>

            <header className="mb-8 @container">
              <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-4">
                Issue No. {formatIssueNumber(issue.number)}
              </p>
              {/* Headline spans the full column width, above the image, so it
                  has the whole measure to fit on one line. Size is derived from
                  the title's length (see headlineStyle) rather than fixed. */}
              <h1
                className="font-heading font-bold tracking-tight leading-[1.1] mb-4"
                style={headlineStyle(issue.title)}
              >
                {issue.title}
              </h1>
              {/* Reversed column on mobile so the image sits full-width above
                  the text instead of squeezing it into a ~170px column. */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-start gap-4 sm:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-4">
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
                    className="w-full h-44 sm:w-40 sm:h-28 shrink-0"
                    sizes="(max-width: 640px) 100vw, 10rem"
                    priority
                  />
                )}
              </div>
            </header>

            <Separator className="mb-8" />

            <div
              className="prose prose-lg dark:prose-invert prose-neutral max-w-none
                prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-bold
                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
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
    </>
  );
}

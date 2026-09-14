import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPaperSlugs, getPaperBySlug } from "@/lib/papers";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GitHubIcon } from "@/components/icons";
import { PaperViewer } from "@/components/paper-viewer";

export async function generateStaticParams() {
  return getAllPaperSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paper = await getPaperBySlug(slug);
  if (!paper) return {};
  return {
    title: `${paper.title} — This Week I'm Sharper`,
    description: paper.abstract,
  };
}

export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paper = await getPaperBySlug(slug);
  if (!paper) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-up">
      <Link
        href="/research"
        className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors inline-block mb-8"
      >
        &larr; All papers
      </Link>

      <header className="mb-8">
        <div className="flex items-baseline gap-3 mb-4 flex-wrap">
          <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand">
            Working Paper
          </p>
          {paper.status && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono uppercase tracking-wider"
            >
              {paper.status}
            </Badge>
          )}
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] mb-4">
          {paper.title}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground tabular-nums">
            {new Date(`${paper.date}T00:00:00`).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </time>
          {paper.tags.map((tag) => (
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

      {paper.abstract && (
        <section className="mb-6">
          <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-brand mb-3">
            Abstract
          </h2>
          <p className="text-foreground/90 leading-relaxed">{paper.abstract}</p>
        </section>
      )}

      {paper.repo && (
        <a
          href={paper.repo}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 mb-8"
        >
          <GitHubIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand"
          />
          <span className="font-mono text-sm text-brand group-hover:underline underline-offset-4">
            Code for this paper
          </span>
        </a>
      )}

      {/* Only rendered when the markdown body has content; remark returns "" for
          an empty file, and papers whose landing page is abstract-only are the
          expected case. */}
      {paper.notesHtml.trim() && (
        <div
          className="prose dark:prose-invert prose-neutral max-w-none mb-8
            prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-bold
            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
            prose-p:leading-relaxed prose-p:text-foreground/90
            prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-a:underline-offset-4 prose-a:decoration-1
            prose-li:text-foreground/90
            prose-strong:text-foreground"
          dangerouslySetInnerHTML={{ __html: paper.notesHtml }}
        />
      )}

      <Separator className="mb-8" />

      {paper.pdf ? (
        <PaperViewer file={paper.pdf} title={paper.title} />
      ) : (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          The paper itself isn&apos;t posted yet.
        </p>
      )}
    </div>
  );
}

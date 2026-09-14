import Link from "next/link";
import { getAllPapers } from "@/lib/papers";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "Research - This Week I'm Sharper",
  description:
    "Quantitative research write-ups, each with the paper and the code behind it.",
};

export default function ResearchPage() {
  const papers = getAllPapers();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        Research
      </p>
      <h2 className="font-heading text-3xl font-bold tracking-tight mb-2">
        Working Papers
      </h2>
      <p className="text-muted-foreground mb-8">
        Longer-form quantitative work.
      </p>
      <Separator className="mb-10" />

      <div className="space-y-10 stagger">
        {papers.map((paper) => (
          <article key={paper.slug}>
            <Link href={`/research/${paper.slug}`} className="group block">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <time className="text-xs font-mono uppercase tracking-wider text-muted-foreground tabular-nums">
                  {new Date(`${paper.date}T00:00:00`).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "short" }
                  )}
                </time>
                {paper.status && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono uppercase tracking-wider text-brand"
                  >
                    {paper.status}
                  </Badge>
                )}
              </div>
              <h3 className="font-heading text-xl font-bold tracking-tight leading-snug transition-colors group-hover:text-brand">
                <span className="link-underline">{paper.title}</span>
              </h3>
              {paper.abstract && (
                <p className="mt-2 text-foreground/80 leading-relaxed line-clamp-3">
                  {paper.abstract}
                </p>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
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
            </Link>
          </article>
        ))}
      </div>

      {papers.length === 0 && (
        <p className="text-muted-foreground">No papers published yet. Building...</p>
      )}
    </div>
  );
}

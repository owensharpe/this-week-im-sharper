"use client";

import { useState } from "react";
import { Bookmark, Check, ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DigestCluster } from "@/lib/digests";

interface Props {
  cluster: DigestCluster;
  isRead: boolean;
  isSaved: boolean;
  onToggleRead: () => void;
  onToggleSave: () => void;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ClusterCard({
  cluster,
  isRead,
  isSaved,
  onToggleRead,
  onToggleSave,
}: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const tags = cluster.tags.length > 0 ? cluster.tags : ["untagged"];

  return (
    <Card
      data-read={isRead}
      className="group relative transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md data-[read=true]:opacity-60 data-[read=true]:hover:opacity-100"
    >
      {/* Brand accent rail on left, fades in on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-r bg-brand opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            {cluster.headline}
          </CardTitle>
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
            title={`${cluster.source_count} ${
              cluster.source_count === 1 ? "source" : "sources"
            }`}
          >
            <span className="inline-flex">
              {Array.from({ length: Math.min(cluster.source_count, 5) }).map(
                (_, i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-brand/70 -ml-0.5 first:ml-0 ring-1 ring-background"
                  />
                )
              )}
            </span>
            {cluster.source_count}{" "}
            {cluster.source_count === 1 ? "src" : "srcs"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={tag === "untagged" ? "outline" : "secondary"}
              className={[
                "text-[10px] font-mono uppercase tracking-wider",
                tag === "untagged"
                  ? ""
                  : "bg-brand-soft text-brand border-transparent hover:bg-brand-soft/80",
              ].join(" ")}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
          {cluster.briefing}
        </div>

        <button
          type="button"
          onClick={() => setSourcesOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
        >
          {sourcesOpen ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {cluster.articles.length}{" "}
          {cluster.articles.length === 1 ? "article" : "articles"}
        </button>

        {sourcesOpen && (
          <ul className="space-y-1.5 border-l-2 border-brand/40 pl-3 text-xs animate-fade-up">
            {cluster.articles.map((art) => (
              <li key={art.id}>
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand transition-colors block"
                >
                  <span className="font-mono uppercase tracking-wider text-[10px]">
                    {art.source}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {" "}
                    · {formatTimestamp(art.published_at)}
                  </span>
                  <div className="text-muted-foreground">{art.title}</div>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRead}
            className="text-xs font-mono uppercase tracking-wider"
          >
            <Check className="size-3" />
            {isRead ? "Mark unread" : "Mark read"}
          </Button>
          <Button
            variant={isSaved ? "default" : "ghost"}
            size="sm"
            onClick={onToggleSave}
            className={[
              "text-xs font-mono uppercase tracking-wider",
              isSaved ? "bg-brand text-brand-foreground hover:bg-brand/90" : "",
            ].join(" ")}
          >
            <Bookmark className="size-3" />
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

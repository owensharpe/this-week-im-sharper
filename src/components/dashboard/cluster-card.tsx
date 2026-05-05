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
      className="data-[read=true]:opacity-60 transition-opacity"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            {cluster.headline}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {cluster.source_count}{" "}
            {cluster.source_count === 1 ? "source" : "sources"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={tag === "untagged" ? "outline" : "secondary"}
              className="text-[10px]"
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
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
          <ul className="space-y-1.5 border-l-2 border-border pl-3 text-xs">
            {cluster.articles.map((art) => (
              <li key={art.id}>
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  <span className="font-medium">{art.source}</span>
                  <span className="text-muted-foreground">
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
            className="text-xs"
          >
            <Check className="size-3" />
            {isRead ? "Mark unread" : "Mark as read"}
          </Button>
          <Button
            variant={isSaved ? "default" : "ghost"}
            size="sm"
            onClick={onToggleSave}
            className="text-xs"
          >
            <Bookmark className="size-3" />
            {isSaved ? "Saved" : "Save for newsletter"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

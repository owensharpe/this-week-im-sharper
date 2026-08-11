"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DailyDigest } from "@/lib/digests";
import { useReadClusters, useSavedClusters } from "@/lib/use-clusters";

import { CalendarPicker } from "./calendar-picker";
import { ClusterCard } from "./cluster-card";

const ALL_VIEW = "__all__";

interface Props {
  digest: DailyDigest | null;
  availableDates: string[];
  activeDate: string | null;
  allTags: string[];
}

export function DayView({ digest, availableDates, activeDate, allTags }: Props) {
  const { isRead, toggleRead } = useReadClusters();
  const { saved, isSaved, toggleSave } = useSavedClusters();
  const [activeTag, setActiveTag] = useState<string>(ALL_VIEW);

  // Reset the topic filter when the day changes.
  useEffect(() => {
    setActiveTag(ALL_VIEW);
  }, [activeDate]);

  const visibleClusters = useMemo(() => {
    const clusters = digest?.clusters ?? [];
    if (activeTag === ALL_VIEW) return clusters;
    if (activeTag === "untagged") {
      return clusters.filter((c) => c.tags.length === 0);
    }
    return clusters.filter((c) => c.tags.includes(activeTag));
  }, [digest, activeTag]);

  const hasData = digest !== null && activeDate !== null;
  const tagOptions = allTags.length > 0 ? allTags : ["untagged"];
  const formattedDate = activeDate
    ? new Date(`${activeDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const isLatest = availableDates.length > 0 && availableDates[0] === activeDate;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        Dashboard
      </p>
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <h2 className="font-heading text-3xl font-bold tracking-tight">Daily Digest</h2>
        {hasData && (
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground tabular-nums">
            {isLatest ? `${formattedDate} · latest` : formattedDate}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-6">
        Daily clusters from finance, markets, macro, and geopolitics. Pick a
        date, filter editorially, and save what&apos;s worth keeping.
      </p>
      <Separator className="mb-8" />

      {!hasData ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col lg:flex-row lg:gap-8">
          <aside className="mb-6 lg:mb-0 lg:shrink-0">
            <div className="lg:sticky lg:top-24">
              <CalendarPicker
                availableDates={availableDates}
                activeDate={activeDate as string}
              />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <TopicFilter
              tags={tagOptions}
              activeTag={activeTag}
              setActiveTag={setActiveTag}
            />

            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground mt-4 mb-4">
              <span>
                {visibleClusters.length}{" "}
                {visibleClusters.length === 1 ? "cluster" : "clusters"}
              </span>
              <Link
                href="/dashboard/saved"
                className="hover:text-brand transition-colors"
              >
                Saved ({saved.length}) &rarr;
              </Link>
            </div>

            {visibleClusters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                {/* The day view only renders synthesized briefings, so an empty
                    "all" view means the run produced none, not a bad filter. */}
                {activeTag === ALL_VIEW
                  ? "No briefings for this day."
                  : "No clusters match this filter."}
              </p>
            ) : (
              <div key={`${activeDate}-${activeTag}`} className="grid gap-4 stagger">
                {visibleClusters.map((cluster) => (
                  <ClusterCard
                    key={cluster.id}
                    cluster={cluster}
                    isRead={isRead(cluster.id)}
                    isSaved={isSaved(cluster.id)}
                    onToggleRead={() => toggleRead(cluster.id)}
                    onToggleSave={() => toggleSave(cluster, activeDate as string)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">No digests yet</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>
          The pipeline hasn&apos;t produced any output yet. Once the daily
          GitHub Actions run completes (or you run{" "}
          <code className="text-xs">uv run sharper-pipeline</code> locally),
          digests will appear here.
        </p>
        <p>
          See <code className="text-xs">pipeline/README.md</code> for setup.
        </p>
      </CardContent>
    </Card>
  );
}

interface TopicFilterProps {
  tags: string[];
  activeTag: string;
  setActiveTag: (t: string) => void;
}

function TopicFilter({ tags, activeTag, setActiveTag }: TopicFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => setActiveTag(ALL_VIEW)}
        aria-pressed={activeTag === ALL_VIEW}
      >
        <Badge
          variant={activeTag === ALL_VIEW ? "default" : "outline"}
          className={[
            "text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer",
            activeTag === ALL_VIEW
              ? "bg-brand text-brand-foreground hover:bg-brand/90"
              : "hover:border-brand hover:text-brand",
          ].join(" ")}
        >
          all
        </Badge>
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setActiveTag(tag)}
          aria-pressed={activeTag === tag}
        >
          <Badge
            variant={activeTag === tag ? "default" : "outline"}
            className={[
              "text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer",
              activeTag === tag
                ? "bg-brand text-brand-foreground hover:bg-brand/90"
                : "hover:border-brand hover:text-brand",
            ].join(" ")}
          >
            {tag}
          </Badge>
        </button>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Separator } from "@/components/ui/separator";
import { useReadClusters, useSavedClusters } from "@/lib/use-clusters";

import { ClusterCard } from "./cluster-card";

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SavedClient() {
  const { isRead, toggleRead } = useReadClusters();
  const { saved, isSaved, toggleSave } = useSavedClusters();

  // Newest source-date first.
  const ordered = useMemo(
    () => [...saved].sort((a, b) => b.savedDate.localeCompare(a.savedDate)),
    [saved]
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        Saved
      </p>
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <h2 className="font-heading text-3xl font-bold tracking-tight">
          Saved for newsletter
        </h2>
        <Link
          href="/dashboard"
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-brand transition-colors"
        >
          &larr; Back to dashboard
        </Link>
      </div>
      <p className="text-muted-foreground mb-6">
        {ordered.length} {ordered.length === 1 ? "cluster" : "clusters"} flagged
        for the next issue.
      </p>
      <Separator className="mb-8" />

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          No saved clusters yet. Save one from the dashboard to add it here.
        </p>
      ) : (
        <div className="grid gap-4 stagger">
          {ordered.map((cluster) => (
            <div key={cluster.id}>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                {formatDate(cluster.savedDate)}
              </p>
              <ClusterCard
                cluster={cluster}
                isRead={isRead(cluster.id)}
                isSaved={isSaved(cluster.id)}
                onToggleRead={() => toggleRead(cluster.id)}
                onToggleSave={() => toggleSave(cluster, cluster.savedDate)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

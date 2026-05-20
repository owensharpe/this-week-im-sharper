"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { DailyDigest, DigestBundle } from "@/lib/digests";

import { ClusterCard } from "./cluster-card";

const DASHBOARD_PASSWORD =
  process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD ?? "sharper2026";

const READ_KEY = "sharper:read-clusters";
const SAVED_KEY = "sharper:saved-clusters";

const ALL_VIEW = "__all__";

type DayKey = string; // YYYY-MM-DD or "weekly"

function loadIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveIds(key: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

interface Props {
  bundle: DigestBundle;
  allTags: string[];
}

export function DashboardClient({ bundle, allTags }: Props) {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const initialView: DayKey =
    bundle.weekly !== null
      ? "weekly"
      : (bundle.daily[0]?.date ?? "weekly");
  const [view, setView] = useState<DayKey>(initialView);
  const [activeTag, setActiveTag] = useState<string>(ALL_VIEW);

  useEffect(() => {
    setReadIds(loadIds(READ_KEY));
    setSavedIds(loadIds(SAVED_KEY));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DASHBOARD_PASSWORD) {
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  const toggleRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveIds(READ_KEY, next);
      return next;
    });
  };

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveIds(SAVED_KEY, next);
      return next;
    });
  };

  const activeDigest: DailyDigest | null = useMemo(() => {
    if (view === "weekly") return bundle.weekly;
    return bundle.daily.find((d) => d.date === view) ?? null;
  }, [view, bundle]);

  const visibleClusters = useMemo(() => {
    const clusters = activeDigest?.clusters ?? [];
    if (activeTag === ALL_VIEW) return clusters;
    if (activeTag === "untagged") {
      return clusters.filter((c) => c.tags.length === 0);
    }
    return clusters.filter((c) => c.tags.includes(activeTag));
  }, [activeDigest, activeTag]);

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 animate-fade-up">
        <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3 text-center">
          Private
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-center mb-2">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Enter the password to access today&apos;s digest.
        </p>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-mono uppercase tracking-wider"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">
                  Incorrect password. Try again.
                </p>
              )}
              <Button type="submit" className="w-full">
                Access Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAnyData = bundle.weekly !== null || bundle.daily.length > 0;
  const tagOptions = allTags.length > 0 ? allTags : ["untagged"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3">
        Today&apos;s Digest
      </p>
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        {activeDigest && (
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {view === "weekly"
              ? "weekly rollup"
              : new Date(activeDigest.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-6">
        Daily clusters from finance, markets, macro, and geopolitics. Filter
        editorially; mark and save what&apos;s worth keeping.
      </p>
      <Separator className="mb-8" />

      {!hasAnyData && <EmptyState />}

      {hasAnyData && (
        <>
          <DayToggle
            view={view}
            setView={setView}
            weekly={bundle.weekly}
            daily={bundle.daily}
          />

          <TopicFilter
            tags={tagOptions}
            activeTag={activeTag}
            setActiveTag={setActiveTag}
          />

          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground mt-6 mb-4">
            <span>
              {visibleClusters.length}{" "}
              {visibleClusters.length === 1 ? "cluster" : "clusters"}
            </span>
            <Link
              href="/dashboard/saved"
              className="hover:text-brand transition-colors"
            >
              Saved ({savedIds.size}) &rarr;
            </Link>
          </div>

          {visibleClusters.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No clusters match this filter.
            </p>
          ) : (
            <div
              key={`${view}-${activeTag}`}
              className="grid gap-4 stagger"
            >
              {visibleClusters.map((cluster) => (
                <ClusterCard
                  key={cluster.id}
                  cluster={cluster}
                  isRead={readIds.has(cluster.id)}
                  isSaved={savedIds.has(cluster.id)}
                  onToggleRead={() => toggleRead(cluster.id)}
                  onToggleSave={() => toggleSave(cluster.id)}
                />
              ))}
            </div>
          )}
        </>
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

interface DayToggleProps {
  view: DayKey;
  setView: (v: DayKey) => void;
  weekly: DailyDigest | null;
  daily: DailyDigest[];
}

function DayToggle({ view, setView, weekly, daily }: DayToggleProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {weekly && (
        <button
          type="button"
          onClick={() => setView("weekly")}
          aria-pressed={view === "weekly"}
          className={[
            "px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-md border transition-colors",
            view === "weekly"
              ? "bg-brand text-brand-foreground border-brand"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
          ].join(" ")}
        >
          This week
        </button>
      )}
      {daily.map((d) => (
        <button
          key={d.date}
          type="button"
          onClick={() => setView(d.date)}
          aria-pressed={view === d.date}
          className={[
            "px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-md border transition-colors tabular-nums",
            view === d.date
              ? "bg-brand text-brand-foreground border-brand"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
          ].join(" ")}
        >
          {d.date.slice(5)}
        </button>
      ))}
    </div>
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

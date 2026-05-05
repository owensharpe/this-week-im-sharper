"use client";

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
      <div className="max-w-md mx-auto px-4 py-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter the password to access your private digest.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
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
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <Badge variant="outline" className="text-[10px]">
          V1 — LLM briefings coming soon
        </Badge>
      </div>
      <p className="text-muted-foreground mb-6">
        Daily clusters from finance, markets, macro, and geopolitics. Filter
        editorially; mark and save what's worth keeping.
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

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 mb-3">
            <span>
              {visibleClusters.length}{" "}
              {visibleClusters.length === 1 ? "cluster" : "clusters"}
            </span>
            <a
              href="/dashboard/saved"
              className="hover:underline text-foreground"
            >
              Saved for newsletter ({savedIds.size}) →
            </a>
          </div>

          {visibleClusters.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No clusters match this filter.
            </p>
          ) : (
            <div className="grid gap-4">
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
    <div className="flex flex-wrap gap-2 mb-3">
      {weekly && (
        <Button
          variant={view === "weekly" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("weekly")}
        >
          This week
        </Button>
      )}
      {daily.map((d) => (
        <Button
          key={d.date}
          variant={view === d.date ? "default" : "outline"}
          size="sm"
          onClick={() => setView(d.date)}
        >
          {d.date.slice(5)}
        </Button>
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
        className="text-xs"
        aria-pressed={activeTag === ALL_VIEW}
      >
        <Badge variant={activeTag === ALL_VIEW ? "default" : "outline"}>
          all
        </Badge>
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setActiveTag(tag)}
          className="text-xs"
          aria-pressed={activeTag === tag}
        >
          <Badge variant={activeTag === tag ? "default" : "outline"}>
            {tag}
          </Badge>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { DigestBundle, DigestCluster } from "@/lib/digests";

import { ClusterCard } from "./cluster-card";

const DASHBOARD_PASSWORD =
  process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD ?? "sharper2026";

const READ_KEY = "sharper:read-clusters";
const SAVED_KEY = "sharper:saved-clusters";

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

export function SavedClient({ bundle }: { bundle: DigestBundle }) {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  const savedClusters: DigestCluster[] = useMemo(() => {
    if (savedIds.size === 0) return [];
    const seen = new Set<string>();
    const all = [
      ...(bundle.weekly?.clusters ?? []),
      ...bundle.daily.flatMap((d) => d.clusters),
    ];
    const out: DigestCluster[] = [];
    for (const cluster of all) {
      if (savedIds.has(cluster.id) && !seen.has(cluster.id)) {
        seen.add(cluster.id);
        out.push(cluster);
      }
    }
    return out;
  }, [bundle, savedIds]);

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Saved clusters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter the password to view your saved-for-newsletter list.
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
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
        <h2 className="text-3xl font-bold tracking-tight">
          Saved for newsletter
        </h2>
        <a
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← back to dashboard
        </a>
      </div>
      <p className="text-muted-foreground mb-6">
        {savedClusters.length}{" "}
        {savedClusters.length === 1 ? "cluster" : "clusters"} flagged for the
        next issue.
      </p>
      <Separator className="mb-8" />

      {savedClusters.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          No saved clusters yet. Save one from the dashboard to add it here.
        </p>
      ) : (
        <div className="grid gap-4">
          {savedClusters.map((cluster) => (
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
    </div>
  );
}

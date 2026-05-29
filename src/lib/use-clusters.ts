"use client";

import { useCallback, useEffect, useState } from "react";

import type { DigestCluster } from "./digests";

const READ_KEY = "sharper:read-clusters";
const SAVED_KEY = "sharper:saved-clusters";

/** A saved cluster keeps the day it came from so Saved can render it without
 *  re-loading that day's digest server-side. */
export interface SavedCluster extends DigestCluster {
  savedDate: string;
}

function loadSaved(): SavedCluster[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop the legacy id-only (string) format; only full objects are usable.
    return parsed.filter(
      (c): c is SavedCluster =>
        c != null && typeof c === "object" && typeof c.id === "string"
    );
  } catch {
    return [];
  }
}

function writeSaved(items: SavedCluster[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(items));
}

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeReadIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
}

export function useSavedClusters() {
  const [saved, setSaved] = useState<SavedCluster[]>([]);

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  const isSaved = useCallback(
    (id: string) => saved.some((c) => c.id === id),
    [saved]
  );

  const toggleSave = useCallback((cluster: DigestCluster, savedDate: string) => {
    setSaved((prev) => {
      const next = prev.some((c) => c.id === cluster.id)
        ? prev.filter((c) => c.id !== cluster.id)
        : [...prev, { ...cluster, savedDate }];
      writeSaved(next);
      return next;
    });
  }, []);

  return { saved, isSaved, toggleSave };
}

export function useReadClusters() {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const toggleRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeReadIds(next);
      return next;
    });
  }, []);

  return { readIds, isRead, toggleRead };
}

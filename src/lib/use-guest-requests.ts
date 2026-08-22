'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { GuestRequest } from '@/lib/types';

/**
 * Spec note 4 — delta polling behind one hook so a future WebSocket layer
 * replaces this file without touching components. Full list on first load,
 * then `updatedSince` deltas merged by id every poll tick. Pauses while the
 * tab is hidden (guarded — Capacitor-ready) or the screen is inactive.
 */
const POLL_MS = Number(process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ?? 15_000);

interface RequestsFeed {
  data: GuestRequest[];
  serverTime: string;
}

/** Newest first — the server order; local merges must preserve it. */
export function sortRequests(rows: GuestRequest[]): GuestRequest[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Replace-by-id merge; delta rows win (they are strictly newer). */
export function mergeRequests(
  current: GuestRequest[],
  delta: GuestRequest[],
): GuestRequest[] {
  if (delta.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const row of delta) byId.set(row.id, row);
  return sortRequests([...byId.values()]);
}

export function useGuestRequests(active: boolean) {
  const [requests, setRequests] = useState<GuestRequest[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    const since = mode === 'delta' ? cursor.current : null;
    try {
      const feed = await api<RequestsFeed>(
        since
          ? `/guest/requests?updatedSince=${encodeURIComponent(since)}`
          : '/guest/requests',
      );
      cursor.current = feed.serverTime;
      setError(null);
      setRequests((prev) =>
        since && prev ? mergeRequests(prev, feed.data) : sortRequests(feed.data),
      );
    } catch (err) {
      // Delta ticks fail silently (transient network); the next tick retries.
      if (mode === 'full') setError(err as ApiError);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load(cursor.current ? 'delta' : 'full');
    const timer = setInterval(() => {
      // Guarded document access — core flows must survive WebViews.
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return;
      }
      void load('delta');
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, load]);

  /** Optimistic local insert/update (submit + cancel land instantly). */
  const applyLocal = useCallback((row: GuestRequest) => {
    setRequests((prev) => mergeRequests(prev ?? [], [row]));
  }, []);

  const refresh = useCallback(() => load('full'), [load]);

  return { requests, error, refresh, applyLocal };
}

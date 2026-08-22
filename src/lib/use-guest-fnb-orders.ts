'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { GuestFnbOrder } from '@/lib/types';

/**
 * Epic 16 (16.6 AC1) — the requests delta-polling contract, applied to F&B
 * orders: full list first, `updatedSince` deltas merged by id, paused while
 * hidden. A future WebSocket layer replaces this file without touching
 * components.
 */
const POLL_MS = Number(
  process.env.NEXT_PUBLIC_FNB_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ??
    15_000,
);

interface OrdersFeed {
  data: GuestFnbOrder[];
  serverTime: string;
}

/** Newest first — the server order; local merges must preserve it. */
export function sortOrders(rows: GuestFnbOrder[]): GuestFnbOrder[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Replace-by-id merge; delta rows win (they are strictly newer). */
export function mergeOrders(
  current: GuestFnbOrder[],
  delta: GuestFnbOrder[],
): GuestFnbOrder[] {
  if (delta.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const row of delta) byId.set(row.id, row);
  return sortOrders(Array.from(byId.values()));
}

export function useGuestFnbOrders(active: boolean) {
  const [orders, setOrders] = useState<GuestFnbOrder[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    const since = mode === 'delta' ? cursor.current : null;
    try {
      const feed = await api<OrdersFeed>(
        since
          ? `/guest/fnb/orders?updatedSince=${encodeURIComponent(since)}`
          : '/guest/fnb/orders',
      );
      cursor.current = feed.serverTime;
      setError(null);
      setOrders((prev) =>
        since && prev ? mergeOrders(prev, feed.data) : sortOrders(feed.data),
      );
    } catch (err) {
      if (mode === 'full') setError(err as ApiError);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load(cursor.current ? 'delta' : 'full');
    const timer = setInterval(() => {
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

  /** Optimistic local insert/update (place + cancel land instantly). */
  const applyLocal = useCallback((row: GuestFnbOrder) => {
    setOrders((prev) => mergeOrders(prev ?? [], [row]));
  }, []);

  const refresh = useCallback(() => load('full'), [load]);

  return { orders, error, refresh, applyLocal };
}

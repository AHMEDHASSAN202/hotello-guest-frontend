'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { GuestAnnouncement } from '@/lib/types';

/**
 * Epic 19, Story 19.4 — the announcements feed behind one hook (the Epic
 * 15/16 delta-poll shape). Differences from its siblings: the envelope
 * carries `unreadCount` (the bell badge — no second polling loop), and delta
 * rows with `active: false` are tombstones that REMOVE the item (retraction
 * propagates mid-poll, 19.2 AC2). Mounted once in GuestFlow and shared by
 * the bell, the home banner and the inbox — never per-screen.
 */
const POLL_MS = Number(
  process.env.NEXT_PUBLIC_ANNOUNCEMENTS_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ??
    15_000,
);

interface AnnouncementsFeed {
  data: GuestAnnouncement[];
  unreadCount: number;
  serverTime: string;
}

/** Priority ("مهم") pinned on top, newest first within each band (AC2). */
export function sortAnnouncements(
  rows: GuestAnnouncement[],
): GuestAnnouncement[] {
  return [...rows].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  });
}

/** Replace-by-id merge; tombstones (active: false) drop the row. */
export function mergeAnnouncements(
  current: GuestAnnouncement[],
  delta: GuestAnnouncement[],
): GuestAnnouncement[] {
  if (delta.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const row of delta) {
    if (row.active === false) byId.delete(row.id);
    else byId.set(row.id, row);
  }
  return sortAnnouncements(Array.from(byId.values()));
}

/** 19.4 AC3 — the newest unread priority announcement, or null. */
export function latestUnreadPriority(
  rows: GuestAnnouncement[] | null,
): GuestAnnouncement | null {
  if (!rows) return null;
  const candidates = rows
    .filter((r) => r.priority && !r.readAt)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  return candidates[0] ?? null;
}

export function useGuestAnnouncements(active: boolean) {
  const [announcements, setAnnouncements] = useState<
    GuestAnnouncement[] | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const cursor = useRef<string | null>(null);
  // Mirror for event handlers — setState updaters must stay side-effect free.
  const rowsRef = useRef<GuestAnnouncement[] | null>(null);
  useEffect(() => {
    rowsRef.current = announcements;
  }, [announcements]);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    const since = mode === 'delta' ? cursor.current : null;
    try {
      const feed = await api<AnnouncementsFeed>(
        since
          ? `/guest/announcements?updatedSince=${encodeURIComponent(since)}`
          : '/guest/announcements',
      );
      cursor.current = feed.serverTime;
      setError(null);
      setUnreadCount(feed.unreadCount);
      setAnnouncements((prev) =>
        since && prev
          ? mergeAnnouncements(prev, feed.data)
          : sortAnnouncements(feed.data),
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

  /**
   * Optimistic mark-read: the row flips instantly, the badge decrements, and
   * the POST is fire-and-forget (the next poll corrects any drift).
   */
  const markRead = useCallback((id: string) => {
    const row = rowsRef.current?.find((r) => r.id === id);
    if (!row || row.readAt) return;
    const readAt = new Date().toISOString();
    setUnreadCount((n) => Math.max(0, n - 1));
    setAnnouncements((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, readAt } : r)) : prev,
    );
    void api(`/guest/announcements/${id}/read`, { method: 'POST' }).catch(
      () => undefined,
    );
  }, []);

  const refresh = useCallback(() => load('full'), [load]);

  return { announcements, unreadCount, error, refresh, markRead };
}

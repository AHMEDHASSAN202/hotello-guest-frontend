'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { GuestEventBooking, GuestEventBookingsResponse } from '@/lib/types';

/**
 * Epic 21 (21.5) — the guest's own event bookings, following the same
 * delta-polling contract shape as `use-guest-fnb-orders.ts`: full load on
 * mount, a background poll paused while the tab is hidden, and a local
 * `applyLocal` for instant optimistic insert/cancel so the booking and
 * detail sheets don't wait on a round trip.
 *
 * One deliberate divergence from the F&B contract, called out here rather
 * than silently papered over: `GET /guest/events/bookings`
 * (`guest-events.service.ts` `myBookings`) has no `updatedSince` cursor and
 * no `serverTime` in its envelope — it's tab-filtered
 * (`?tab=upcoming|past|cancelled`, `ListGuestEventsQueryDto`) and always
 * returns the FULL current contents of that tab, never an incremental
 * delta. There is nothing to merge network-side, so every poll (initial or
 * background) simply replaces state with the server's fresh answer.
 * `mergeBookings`/`applyLocal` exist purely for the LOCAL, client-only
 * optimistic path between poll ticks — they never see a genuine partial
 * payload from the network. Reconciles Task 20's ad-hoc 3-parallel-`api()`-
 * calls (previously inline in `events-screen.tsx`) into this one shared
 * hook.
 */
const POLL_MS = Number(
  process.env.NEXT_PUBLIC_EVENTS_POLL_MS ??
    process.env.NEXT_PUBLIC_REQUESTS_POLL_MS ??
    15_000,
);

export interface GuestEventBookingsFeed {
  /** Active bookings — server tab `upcoming`. */
  upcoming: GuestEventBooking[];
  /** Past + cancelled, merged newest-created-first (the "My bookings" history disclosure). */
  history: GuestEventBooking[];
  /** Today's live booking, if any (Task 7's `myBookings.todayBooking`) — the home strip's payoff. */
  todayBooking: GuestEventBooking | null;
}

/** Newest-created first — the events-screen.tsx history ordering. */
export function sortBookings(rows: GuestEventBooking[]): GuestEventBooking[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Replace-by-id merge; incoming rows win. Used for the local optimistic path only. */
export function mergeBookings(
  current: GuestEventBooking[],
  incoming: GuestEventBooking[],
): GuestEventBooking[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const row of incoming) byId.set(row.id, row);
  return sortBookings(Array.from(byId.values()));
}

const EMPTY_FEED: GuestEventBookingsFeed = {
  upcoming: [],
  history: [],
  todayBooking: null,
};

/**
 * The `applyLocal` categorization, pulled out as a pure function so it's
 * unit-testable without rendering the hook: a `booked` row lands in
 * `upcoming` (and drops out of `history` if it was there); anything else
 * (`cancelled`) lands in `history` (and drops out of `upcoming`); a booking
 * that no longer qualifies as `booked` also clears `todayBooking` if it was
 * the one showing there.
 */
export function applyBookingLocal(
  feed: GuestEventBookingsFeed | null,
  booking: GuestEventBooking,
): GuestEventBookingsFeed {
  const base = feed ?? EMPTY_FEED;
  const isUpcoming = booking.status === 'booked';
  return {
    upcoming: isUpcoming
      ? mergeBookings(base.upcoming, [booking])
      : base.upcoming.filter((b) => b.id !== booking.id),
    history: isUpcoming
      ? base.history.filter((b) => b.id !== booking.id)
      : mergeBookings(base.history, [booking]),
    todayBooking:
      base.todayBooking?.id === booking.id && !isUpcoming
        ? null
        : base.todayBooking,
  };
}

export function useGuestEventBookings(active: boolean) {
  const [feed, setFeed] = useState<GuestEventBookingsFeed | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async (mode: 'full' | 'delta') => {
    try {
      const [upcoming, past, cancelled] = await Promise.all([
        api<GuestEventBookingsResponse>('/guest/events/bookings?tab=upcoming'),
        api<GuestEventBookingsResponse>('/guest/events/bookings?tab=past'),
        api<GuestEventBookingsResponse>('/guest/events/bookings?tab=cancelled'),
      ]);
      setError(null);
      setFeed({
        upcoming: sortBookings(upcoming.data),
        history: sortBookings([...past.data, ...cancelled.data]),
        // The three tab calls all compute todayBooking off the same
        // full set (see myBookings) — any one of them carries it.
        todayBooking: upcoming.todayBooking,
      });
    } catch (err) {
      if (mode === 'full') setError(err as ApiError);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load('full');
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

  /** Optimistic local insert/update (book + cancel land instantly). */
  const applyLocal = useCallback((booking: GuestEventBooking) => {
    setFeed((prev) => applyBookingLocal(prev, booking));
  }, []);

  const refresh = useCallback(() => load('full'), [load]);

  return { feed, error, refresh, applyLocal };
}

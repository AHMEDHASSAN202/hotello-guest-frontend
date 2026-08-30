// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuestEventBooking, GuestEventBookingsResponse } from './types';

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

import {
  applyBookingLocal,
  mergeBookings,
  sortBookings,
  useGuestEventBookings,
} from './use-guest-event-bookings';

/**
 * Epic 21 (21.5) — the delta-merge/optimistic-apply contract, F&B orders
 * parity (`use-guest-fnb-orders.test.ts`). Dates are fixed, non-DST-boundary
 * winter values (this repo's Cairo-DST test-clock gotcha) even though none
 * of this logic does local-time comparison — `createdAt` is compared as a
 * plain ISO string, never parsed into a local `Date`.
 */
const booking = (o: Partial<GuestEventBooking> = {}): GuestEventBooking =>
  ({
    id: 'bk-1',
    eventId: 'ev-1',
    title: 'Sunset Yoga',
    startAtLocal: '2026-01-15 18:00',
    endAtLocal: null,
    locationText: 'Beach — Building B',
    partySize: 2,
    unitPrice: 300,
    included: false,
    totalAmount: 600,
    currency: 'EGP',
    paymentMethod: 'room_charge',
    status: 'booked',
    cancelledBy: null,
    cancelledAt: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    ...o,
  }) as GuestEventBooking;

describe('sortBookings / mergeBookings', () => {
  it('sorts newest-created first', () => {
    const rows = sortBookings([
      booking({ id: 'a', createdAt: '2026-01-15T09:00:00.000Z' }),
      booking({ id: 'b', createdAt: '2026-01-15T11:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('delta rows replace by id and re-sort', () => {
    const current = [
      booking({ id: 'a' }),
      booking({ id: 'b', createdAt: '2026-01-15T09:00:00.000Z' }),
    ];
    const merged = mergeBookings(current, [
      booking({ id: 'a', status: 'cancelled' }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].status).toBe('cancelled');
  });

  it('an empty delta returns the same array reference', () => {
    const current = [booking({ id: 'a' })];
    expect(mergeBookings(current, [])).toBe(current);
  });
});

describe('applyBookingLocal — optimistic insert/cancel (Task 22)', () => {
  it('a fresh `booked` row against a null feed seeds upcoming only', () => {
    const feed = applyBookingLocal(null, booking());
    expect(feed.upcoming.map((b) => b.id)).toEqual(['bk-1']);
    expect(feed.history).toEqual([]);
    expect(feed.todayBooking).toBeNull();
  });

  it('a `booked` row lands in upcoming and is removed from history if present there', () => {
    const feed = applyBookingLocal(
      {
        upcoming: [],
        history: [booking({ id: 'bk-1', status: 'cancelled' })],
        todayBooking: null,
      },
      booking({ id: 'bk-1', status: 'booked' }),
    );
    expect(feed.upcoming.map((b) => b.id)).toEqual(['bk-1']);
    expect(feed.history).toEqual([]);
  });

  it('a cancelled row moves from upcoming into history (instant cancel feedback)', () => {
    const cancelled = booking({ id: 'bk-1', status: 'cancelled' });
    const feed = applyBookingLocal(
      { upcoming: [booking({ id: 'bk-1' })], history: [], todayBooking: null },
      cancelled,
    );
    expect(feed.upcoming).toEqual([]);
    expect(feed.history.map((b) => b.id)).toEqual(['bk-1']);
    expect(feed.history[0].status).toBe('cancelled');
  });

  it("cancelling today's booking clears todayBooking", () => {
    const today = booking({ id: 'bk-1', status: 'booked' });
    const feed = applyBookingLocal(
      { upcoming: [today], history: [], todayBooking: today },
      booking({ id: 'bk-1', status: 'cancelled' }),
    );
    expect(feed.todayBooking).toBeNull();
  });

  it("cancelling a DIFFERENT booking leaves today's booking untouched", () => {
    const today = booking({ id: 'today-1', status: 'booked' });
    const other = booking({ id: 'other-1', status: 'booked' });
    const feed = applyBookingLocal(
      { upcoming: [today, other], history: [], todayBooking: today },
      booking({ id: 'other-1', status: 'cancelled' }),
    );
    expect(feed.todayBooking?.id).toBe('today-1');
    expect(feed.upcoming.map((b) => b.id)).toEqual(['today-1']);
    expect(feed.history.map((b) => b.id)).toEqual(['other-1']);
  });
});

describe('useGuestEventBookings — stale-poll race guard (final-review IMPORTANT fix)', () => {
  const empty = (): GuestEventBookingsResponse => ({ data: [], todayBooking: null });

  beforeEach(() => {
    apiMock.api.mockReset();
  });

  it("a poll's load() response resolving AFTER applyLocal() must not erase the local booking", async () => {
    // Initial mount: full load resolves immediately, empty feed.
    apiMock.api.mockImplementation(async () => empty());
    const { result } = renderHook(() => useGuestEventBookings(true));
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    expect(result.current.feed!.upcoming).toEqual([]);

    // A poll's load() begins (`refresh()` drives the same `load` fn a
    // background tick would) — its `tab=upcoming` leg is left in flight to
    // simulate the slowest of the 3 concurrent legs.
    let resolveUpcoming!: (v: GuestEventBookingsResponse) => void;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.includes('tab=upcoming')) {
        return new Promise<GuestEventBookingsResponse>((res) => {
          resolveUpcoming = res;
        });
      }
      return empty();
    });
    act(() => {
      void result.current.refresh();
    });

    // The optimistic booking lands locally WHILE that poll is still pending
    // — the ~1100ms optimistic-success beat landing mid-poll (final-review
    // finding's concrete sequence).
    const fresh = booking({ id: 'bk-fresh' });
    act(() => result.current.applyLocal(fresh));
    expect(result.current.feed!.upcoming.map((b) => b.id)).toEqual(['bk-fresh']);

    // The stale poll leg finally resolves with a snapshot that PREDATES the
    // booking (empty upcoming). Without the generation guard this REPLACEs
    // the feed and the fresh booking silently disappears.
    await act(async () => resolveUpcoming(empty()));
    expect(result.current.feed!.upcoming.map((b) => b.id)).toEqual(['bk-fresh']);
  });

  it('a load() that resolves BEFORE any newer applyLocal() still applies normally', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.includes('tab=upcoming')) {
        return { data: [booking({ id: 'bk-server' })], todayBooking: null };
      }
      return empty();
    });
    const { result } = renderHook(() => useGuestEventBookings(true));
    await waitFor(() =>
      expect(result.current.feed?.upcoming.map((b) => b.id)).toEqual(['bk-server']),
    );

    // A later local update still applies on top of the settled server state.
    act(() => result.current.applyLocal(booking({ id: 'bk-local' })));
    expect(result.current.feed!.upcoming.map((b) => b.id).sort()).toEqual([
      'bk-local',
      'bk-server',
    ]);
  });
});

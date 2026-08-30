import { describe, expect, it } from 'vitest';
import type { GuestEventBooking } from './types';
import {
  applyBookingLocal,
  mergeBookings,
  sortBookings,
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

import { describe, expect, it } from 'vitest';
import type { GuestFnbOrder } from './types';
import { mergeOrders, sortOrders } from './use-guest-fnb-orders';

/** Epic 16 (16.6 AC1) — the delta-merge contract, requests parity. */

const order = (o: Partial<GuestFnbOrder>): GuestFnbOrder =>
  ({
    id: 'o1',
    status: 'new',
    destinationType: 'room',
    locationName: null,
    spot: null,
    roomNumber: '304',
    paymentMethod: 'cash',
    totalAmount: 100,
    currency: 'EGP',
    slaTargetMinutes: 30,
    createdAt: '2026-08-22T10:00:00.000Z',
    startedAt: null,
    outForDeliveryAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelledReason: null,
    updatedAt: '2026-08-22T10:00:00.000Z',
    lines: [],
    ...o,
  }) as GuestFnbOrder;

describe('sortOrders / mergeOrders', () => {
  it('sorts newest first', () => {
    const rows = sortOrders([
      order({ id: 'a', createdAt: '2026-08-22T09:00:00.000Z' }),
      order({ id: 'b', createdAt: '2026-08-22T11:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('delta rows replace by id and re-sort', () => {
    const current = [order({ id: 'a' }), order({ id: 'b', createdAt: '2026-08-22T09:00:00.000Z' })];
    const merged = mergeOrders(current, [order({ id: 'a', status: 'preparing' })]);
    expect(merged).toHaveLength(2);
    expect(merged[0].status).toBe('preparing');
  });

  it('an empty delta returns the same array reference', () => {
    const current = [order({ id: 'a' })];
    expect(mergeOrders(current, [])).toBe(current);
  });
});

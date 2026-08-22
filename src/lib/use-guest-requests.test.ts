import { describe, expect, it } from 'vitest';
import type { GuestRequest } from './types';
import { mergeRequests, sortRequests } from './use-guest-requests';

function req(id: string, createdAt: string, status = 'new'): GuestRequest {
  return {
    id,
    itemName: 'Extra towels',
    icon: 'layers',
    optionType: null,
    optionValue: null,
    note: null,
    status: status as GuestRequest['status'],
    slaTargetMinutes: 20,
    createdAt,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    updatedAt: createdAt,
  };
}

describe('delta merge (spec note 4)', () => {
  it('sorts newest first', () => {
    const sorted = sortRequests([
      req('a', '2026-08-22T10:00:00Z'),
      req('b', '2026-08-22T12:00:00Z'),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('delta rows replace matching ids (status transitions land)', () => {
    const current = [req('a', '2026-08-22T10:00:00Z')];
    const merged = mergeRequests(current, [
      { ...req('a', '2026-08-22T10:00:00Z'), status: 'done' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('done');
  });

  it('new delta rows are inserted in order', () => {
    const current = [req('a', '2026-08-22T10:00:00Z')];
    const merged = mergeRequests(current, [req('b', '2026-08-22T12:00:00Z')]);
    expect(merged.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('an empty delta is a no-op returning the same array', () => {
    const current = [req('a', '2026-08-22T10:00:00Z')];
    expect(mergeRequests(current, [])).toBe(current);
  });
});

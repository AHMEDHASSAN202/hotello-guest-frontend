import { describe, expect, it } from 'vitest';
import type { GuestAnnouncement } from '@/lib/types';
import {
  latestUnreadPriority,
  mergeAnnouncements,
  sortAnnouncements,
} from './use-guest-announcements';

const make = (o: Partial<GuestAnnouncement> = {}): GuestAnnouncement => ({
  id: 'ann-1',
  title: 'Pool closed',
  body: 'Maintenance 9-12',
  priority: false,
  infoChip: null,
  publishedAt: '2026-01-14T09:00:00.000Z',
  readAt: null,
  active: true,
  ...o,
});

describe('sortAnnouncements (19.4 AC2)', () => {
  it('pins priority items above newer non-priority, newest first within each band', () => {
    const rows = [
      make({ id: 'new', publishedAt: '2026-01-15T09:00:00.000Z' }),
      make({ id: 'old-priority', priority: true, publishedAt: '2026-01-10T09:00:00.000Z' }),
      make({ id: 'old', publishedAt: '2026-01-12T09:00:00.000Z' }),
      make({ id: 'new-priority', priority: true, publishedAt: '2026-01-13T09:00:00.000Z' }),
    ];
    expect(sortAnnouncements(rows).map((r) => r.id)).toEqual([
      'new-priority',
      'old-priority',
      'new',
      'old',
    ]);
  });
});

describe('mergeAnnouncements (19.2 AC2 retraction propagation)', () => {
  it('returns the same reference on an empty delta', () => {
    const current = [make()];
    expect(mergeAnnouncements(current, [])).toBe(current);
  });

  it('replaces rows by id', () => {
    const current = [make({ readAt: null })];
    const merged = mergeAnnouncements(current, [
      make({ readAt: '2026-01-15T10:00:00.000Z' }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].readAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('drops tombstones (active: false) — retract/expire removes the row', () => {
    const current = [make({ id: 'stays' }), make({ id: 'gone' })];
    const merged = mergeAnnouncements(current, [
      { id: 'gone', active: false } as GuestAnnouncement,
    ]);
    expect(merged.map((r) => r.id)).toEqual(['stays']);
  });

  it('a tombstone for an unknown id is a no-op', () => {
    const current = [make({ id: 'stays' })];
    const merged = mergeAnnouncements(current, [
      { id: 'never-seen', active: false } as GuestAnnouncement,
    ]);
    expect(merged.map((r) => r.id)).toEqual(['stays']);
  });
});

describe('latestUnreadPriority (19.4 AC3 home banner)', () => {
  it('picks the newest unread priority announcement only', () => {
    const rows = [
      make({ id: 'unread-normal', publishedAt: '2026-01-16T09:00:00.000Z' }),
      make({
        id: 'read-priority',
        priority: true,
        readAt: '2026-01-15T10:00:00.000Z',
        publishedAt: '2026-01-15T09:00:00.000Z',
      }),
      make({ id: 'older-unread-priority', priority: true, publishedAt: '2026-01-12T09:00:00.000Z' }),
      make({ id: 'newer-unread-priority', priority: true, publishedAt: '2026-01-14T09:00:00.000Z' }),
    ];
    expect(latestUnreadPriority(rows)?.id).toBe('newer-unread-priority');
  });

  it('returns null when there is nothing to surface', () => {
    expect(latestUnreadPriority(null)).toBeNull();
    expect(latestUnreadPriority([make({ id: 'plain' })])).toBeNull();
    expect(
      latestUnreadPriority([
        make({ id: 'read', priority: true, readAt: '2026-01-15T10:00:00.000Z' }),
      ]),
    ).toBeNull();
  });
});

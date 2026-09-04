import { describe, expect, it } from 'vitest';
import { parseOpenParam } from './deep-link';

/**
 * Epic 23 Task 10 — the `?open=` grammar the backend composes into push
 * notification URLs (`/{slug}?open=<kind>:<id>` or `/{slug}?open=home`).
 * This parser is the single source of truth for that grammar on the guest
 * side; a malformed/tampered value must resolve to `null`, never throw.
 */
describe('parseOpenParam (Epic 23 Task 10)', () => {
  it('parses each id-carrying kind', () => {
    expect(parseOpenParam('announcement:abc123')).toEqual({
      kind: 'announcement',
      id: 'abc123',
    });
    expect(parseOpenParam('request:req-1')).toEqual({
      kind: 'request',
      id: 'req-1',
    });
    expect(parseOpenParam('order:o1')).toEqual({ kind: 'order', id: 'o1' });
    expect(parseOpenParam('event:ev-9')).toEqual({
      kind: 'event',
      id: 'ev-9',
    });
  });

  it('parses the bare home token', () => {
    expect(parseOpenParam('home')).toEqual({ kind: 'home' });
  });

  it('an id can itself contain colons (e.g. a UUID-ish id is fine, but so is anything after the first colon)', () => {
    expect(parseOpenParam('order:o1:extra')).toEqual({
      kind: 'order',
      id: 'o1:extra',
    });
  });

  it('undefined input is not a deep link', () => {
    expect(parseOpenParam(undefined)).toBeNull();
  });

  it('empty string is not a deep link', () => {
    expect(parseOpenParam('')).toBeNull();
  });

  it('missing colon (not "home") is malformed', () => {
    expect(parseOpenParam('order')).toBeNull();
    expect(parseOpenParam('garbage')).toBeNull();
  });

  it('empty id after the colon is malformed', () => {
    expect(parseOpenParam('order:')).toBeNull();
    expect(parseOpenParam('announcement:')).toBeNull();
  });

  it('unknown kind is malformed', () => {
    expect(parseOpenParam('billing:acct-1')).toBeNull();
    expect(parseOpenParam('Order:o1')).toBeNull(); // case-sensitive — the backend always lowercases
  });

  it('empty kind before the colon is malformed', () => {
    expect(parseOpenParam(':o1')).toBeNull();
  });

  it('array-typed searchParams value (Next.js repeated query param) returns null, not a throw', () => {
    expect(parseOpenParam(['order:o1', 'order:o2'] as unknown as string)).toBeNull();
    expect(parseOpenParam([] as unknown as string)).toBeNull();
  });

  it('non-string/object input returns null, not a throw', () => {
    expect(parseOpenParam(null as unknown as string)).toBeNull();
    expect(parseOpenParam(42 as unknown as string)).toBeNull();
    expect(parseOpenParam({} as unknown as string)).toBeNull();
  });
});

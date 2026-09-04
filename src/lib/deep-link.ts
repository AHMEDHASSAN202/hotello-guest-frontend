/**
 * Epic 23 (Web Push) — the `?open=` deep-link grammar. The backend composes
 * push notification URLs as `/{slug}?open=<kind>:<id>` or `/{slug}?open=home`
 * (Task 3); this is the single pure parser both the guest app boot path and
 * any future caller share. Never throws — a malformed or tampered value is
 * simply not a deep link.
 */
export type DeepLink =
  | { kind: 'announcement' | 'request' | 'order' | 'event'; id: string }
  | { kind: 'announcements' | 'home' };

const ID_KINDS = ['announcement', 'request', 'order', 'event'] as const;

/**
 * Parses the raw `?open=` value. `value` is typed `string | undefined` to
 * match the normalized shape callers pass in (see `page.tsx`'s `asString`),
 * but the check below is a runtime `typeof` guard on purpose: Next.js hands
 * back `string[]` for a repeated query param, and this must resolve to
 * `null` rather than throw even if a caller passes that raw shape through.
 */
export function parseOpenParam(value: string | undefined): DeepLink | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value === 'home') return { kind: 'home' };

  const sep = value.indexOf(':');
  if (sep <= 0) return null; // no colon, or colon is the first char (empty kind)

  const kind = value.slice(0, sep);
  const id = value.slice(sep + 1);
  if (!id) return null;
  if (!(ID_KINDS as readonly string[]).includes(kind)) return null;

  return { kind: kind as (typeof ID_KINDS)[number], id };
}

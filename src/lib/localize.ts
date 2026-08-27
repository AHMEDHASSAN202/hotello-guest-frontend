/**
 * Locale resolution for translated DATA fields shipped whole in public
 * payloads (the profile is cached per slug, so the backend cannot
 * pre-localize it). EN fallback, empty → null so callers render nothing.
 * Deliberately NOT a 'use client' module — server layout and the manifest
 * route import it too (see the hotelDisplayName precedent).
 */
export function localizeField(
  map: Partial<Record<string, string>> | null | undefined,
  locale: string,
): string | null {
  if (!map) return null;
  const value = map[locale] ?? map.en ?? '';
  return value || null;
}

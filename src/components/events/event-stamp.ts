/**
 * Events' `startAtLocal`/`endAtLocal` are naive hotel-local
 * 'YYYY-MM-DD HH:MM' stamps (Epic 21 backend convention — see
 * `hotello-backend/src/modules/events/event-time.ts`). Parsed via explicit
 * date-part construction, never `new Date(stampString)`: that space-
 * separated (non-ISO) shape is parsed inconsistently across engines (Safari
 * in particular can return an Invalid Date), and this app runs inside a
 * Capacitor WebView where that gap would actually bite.
 */
export function parseLocalStamp(stamp: string): Date {
  const [datePart, timePart] = stamp.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** The 'YYYY-MM-DD' date-only prefix — what `formatCheckoutDate` expects. */
export function localStampDate(stamp: string): string {
  return stamp.slice(0, 10);
}

import type { Locale } from './config';

/**
 * Latin digits everywhere (14.3 AC6) — Arabic locales would otherwise render
 * Eastern Arabic numerals for room numbers, codes, and dates. Gregorian
 * calendar forced for the same reason.
 */
const INTL_TAGS: Record<Locale, string> = {
  ar: 'ar-EG-u-nu-latn-ca-gregory',
  en: 'en-GB-u-nu-latn', // en-GB: "Sat, 24 Aug" day-month order
  ru: 'ru-RU-u-nu-latn',
  fr: 'fr-FR-u-nu-latn',
  it: 'it-IT-u-nu-latn',
  es: 'es-ES-u-nu-latn',
  de: 'de-DE-u-nu-latn',
};

export function intlLocale(locale: Locale): string {
  return INTL_TAGS[locale];
}

/** Parse the contract's 'YYYY-MM-DD' into date parts, timezone-free. */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Sat, 24 Aug" / «сб, 24 авг.» — the checkout date on the stay card. */
export function formatCheckoutDate(dateStr: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parseDateOnly(dateStr));
}

/** Today's 'YYYY-MM-DD' in the hotel's timezone. */
export function todayInTimezone(timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole nights between today (hotel-local) and the checkout date. 0 on the
 * checkout day itself — the stay card switches to the "checkout today" line.
 */
export function nightsRemaining(checkOutDate: string, timezone: string): number {
  const today = Date.parse(`${todayInTimezone(timezone)}T00:00:00Z`);
  const checkout = Date.parse(`${checkOutDate}T00:00:00Z`);
  return Math.max(0, Math.round((checkout - today) / DAY_MS));
}

export function isCheckoutDay(checkOutDate: string, timezone: string): boolean {
  return todayInTimezone(timezone) >= checkOutDate;
}

const RELATIVE_LADDER: Array<[limitSeconds: number, unit: Intl.RelativeTimeFormatUnit, unitSeconds: number]> = [
  [60 * 60, 'minute', 60],
  [24 * 60 * 60, 'hour', 60 * 60],
  [7 * 24 * 60 * 60, 'day', 24 * 60 * 60],
  [30 * 24 * 60 * 60, 'week', 7 * 24 * 60 * 60],
  [365 * 24 * 60 * 60, 'month', 30 * 24 * 60 * 60],
];

/**
 * "5 мин назад" / «منذ 4 دقائق» (15.3 AC4) — localized relative age with
 * Latin digits via intlLocale. Under a minute reads as "this minute"-style
 * copy (numeric:'auto'), which is the warm "just now". `now` is injectable
 * so a poll ticker can re-render live ages.
 */
export function formatRelativeTime(
  value: string | Date,
  locale: Locale,
  now: Date = new Date(),
): string {
  const then = typeof value === 'string' ? new Date(value) : value;
  const diffSeconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const magnitude = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: 'auto',
  });
  for (const [limit, unit, unitSeconds] of RELATIVE_LADDER) {
    if (magnitude < limit) {
      return rtf.format(Math.trunc(diffSeconds / unitSeconds), unit);
    }
  }
  return rtf.format(Math.trunc(diffSeconds / (365 * 24 * 60 * 60)), 'year');
}

/** "14:05" — timeline timestamps (guest's clock context, Latin digits). */
export function formatTimeOfDay(value: string | Date, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Live lockout countdown, mm:ss (14.2 AC3). Always Latin digits. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

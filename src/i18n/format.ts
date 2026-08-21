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

/** Live lockout countdown, mm:ss (14.2 AC3). Always Latin digits. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

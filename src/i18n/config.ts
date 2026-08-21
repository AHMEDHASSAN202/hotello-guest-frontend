/**
 * Single source of truth for the Guest App's locales — the same seven, in the
 * same order, as the backend's GUEST_LANGUAGES and the check-in language
 * dropdown (Epic 13). Never hardcode this list anywhere else.
 */
export const locales = ['ar', 'en', 'ru', 'fr', 'it', 'es', 'de'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Explicit user choice from the language switcher — persisted one year. */
export const LOCALE_COOKIE = 'gxp_guest_locale';

/**
 * The stay's guest language, mirrored from the session profile by
 * `LocaleSync`. A session cookie: it loses to an explicit choice and dies
 * with the browser session (14.3 AC2 resolution order).
 */
export const SESSION_LOCALE_COOKIE = 'gxp_guest_locale_stay';

/** Locales that flow right-to-left. */
const rtlLocales: readonly Locale[] = ['ar'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

/** Endonym + flag shown in the language switcher (14.3 AC3). */
export const localeMeta: Record<Locale, { endonym: string; flag: string }> = {
  ar: { endonym: 'العربية', flag: '🇪🇬' },
  en: { endonym: 'English', flag: '🇬🇧' },
  ru: { endonym: 'Русский', flag: '🇷🇺' },
  fr: { endonym: 'Français', flag: '🇫🇷' },
  it: { endonym: 'Italiano', flag: '🇮🇹' },
  es: { endonym: 'Español', flag: '🇪🇸' },
  de: { endonym: 'Deutsch', flag: '🇩🇪' },
};

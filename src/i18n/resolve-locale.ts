import { defaultLocale, isLocale, type Locale } from './config';

/**
 * The 14.3 AC2 resolution order, as one pure function:
 *   explicit user choice → stay's guest language → Accept-Language → 'en'.
 * Pre-login screens naturally use the last two (the first two are absent).
 */
export function resolveLocale(input: {
  /** LOCALE_COOKIE — set only by the language switcher. */
  explicit?: string | null;
  /** SESSION_LOCALE_COOKIE — mirrored from the session profile. */
  stay?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.explicit)) return input.explicit;
  if (isLocale(input.stay)) return input.stay;

  for (const tag of acceptedTags(input.acceptLanguage)) {
    const base = tag.split('-')[0].toLowerCase();
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

/** Parse an Accept-Language header into tags ordered by q-value (desc). */
function acceptedTags(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((e) => e.tag.length > 0 && e.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((e) => e.tag);
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { isLocale, LOCALE_COOKIE, SESSION_LOCALE_COOKIE } from '@/i18n/config';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Mirrors the stay's guest language into the resolution order (14.3 AC2):
 * once the session profile is known, a session cookie carries its language —
 * unless the guest has made an explicit switcher choice, which always wins.
 */
export function LocaleSync({ stayLanguage }: { stayLanguage: string }) {
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    if (!isLocale(stayLanguage)) return;
    if (readCookie(LOCALE_COOKIE)) return; // explicit choice wins
    if (readCookie(SESSION_LOCALE_COOKIE) === stayLanguage) return;
    document.cookie = `${SESSION_LOCALE_COOKIE}=${stayLanguage}; path=/; samesite=lax`;
    if (stayLanguage !== locale) router.refresh();
  }, [stayLanguage, locale, router]);

  return null;
}

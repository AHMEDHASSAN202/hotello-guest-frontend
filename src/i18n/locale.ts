'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, type Locale } from './config';

/** Explicit user choice — persisted a year; wins the resolution order. */
export function setLocaleCookie(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function useSetLocale() {
  const current = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(locale: Locale) {
    if (locale === current) return;
    setLocaleCookie(locale);
    // router.refresh() re-runs server components with the new cookie while
    // preserving client state — the switch is instant and loses nothing.
    startTransition(() => router.refresh());
  }

  return { locale: current, setLocale, pending };
}

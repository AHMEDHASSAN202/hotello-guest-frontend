'use client';

import { Check, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { localeMeta, locales, type Locale } from '@/i18n/config';
import { useSetLocale } from '@/i18n/locale';
import { BottomSheet } from './bottom-sheet';

/**
 * Always-reachable language switcher (14.3 AC3) — a quiet pill that opens
 * the bottom sheet with flags + endonyms. Switching is instant (cookie +
 * router.refresh) and preserves client state.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const t = useTranslations('common');
  const { locale, setLocale } = useSetLocale();
  const [open, setOpen] = useState(false);

  function choose(next: Locale) {
    setOpen(false);
    setLocale(next);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('language')}
        className="pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-card/80 px-3.5 text-[13px] font-medium text-ink-soft shadow-card backdrop-blur"
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span>{localeMeta[locale].endonym}</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('language')}>
        <ul className={className}>
          {locales.map((loc) => (
            <li key={loc}>
              <button
                onClick={() => choose(loc)}
                className="pressable flex min-h-[48px] w-full items-center gap-3 rounded-card px-3 text-start text-[15px] text-ink"
                aria-current={loc === locale ? 'true' : undefined}
              >
                <span className="text-xl" aria-hidden>
                  {localeMeta[loc].flag}
                </span>
                <span className="flex-1">{localeMeta[loc].endonym}</span>
                {loc === locale ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Screen } from '../ui';

/** Epic 17 — placeholder; the full directory screen lands in the next task. */
export function InfoScreen() {
  const t = useTranslations('info');
  return (
    <Screen>
      <h1 className="pt-4 text-xl font-bold text-ink">{t('title')}</h1>
    </Screen>
  );
}

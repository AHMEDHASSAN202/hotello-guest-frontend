'use client';

import { useTranslations } from 'next-intl';
import { Screen } from '../ui';

/**
 * Events (Epic 21) — minimal placeholder so the `events` dynamic chunk
 * (Task 19 wiring) compiles and renders end-to-end. Task 20 replaces this
 * with the real browse + bookings screen; nothing here should grow beyond
 * a stub.
 */
export function EventsScreen() {
  const t = useTranslations('home');
  return (
    <Screen>
      <h1 className="mt-7 text-[22px] font-bold leading-snug text-ink">
        {t('tiles.events')}
      </h1>
    </Screen>
  );
}

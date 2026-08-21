'use client';

import { useTranslations } from 'next-intl';
import type { GuestProfile } from '@/lib/types';
import { Screen } from './ui';

/** Fleshed out in the home-screen task — the state machine renders this. */
export function HomeScreen({ profile }: { profile: GuestProfile; onRefresh?: () => Promise<void> }) {
  const t = useTranslations('home');
  return (
    <Screen data-testid="home">
      <div data-testid="home-root">
        <h1>{t('greeting', { name: profile.guestName })}</h1>
      </div>
    </Screen>
  );
}

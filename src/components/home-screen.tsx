'use client';

/* eslint-disable @next/next/no-img-element */
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useHotel } from '@/components/hotel-provider';
import { assetUrl } from '@/lib/api';
import type { GuestProfile } from '@/lib/types';
import { LanguageSwitcher } from './language-switcher';
import { ServicesGrid } from './services-grid';
import { StayCard } from './stay-card';
import { Screen } from './ui';

const PULL_THRESHOLD = 70;

/**
 * Home (14.4 AC2): hotel header → personal greeting → stay card → services
 * grid. Hotel-first branding; quiet GXP footer. Pull-to-refresh re-probes the
 * session — the one place the gesture is meaningful (14.5 AC5).
 */
export function HomeScreen({
  profile,
  onRefresh,
}: {
  profile: GuestProfile;
  onRefresh?: () => Promise<void>;
}) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const { hotel, hotelName } = useHotel();
  const logo = assetUrl(hotel.logoUrl);

  const pullStart = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0 && !refreshing) pullStart.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (pullStart.current === null) return;
    const dy = e.touches[0].clientY - pullStart.current;
    setPull(dy > 0 ? Math.min(dy * 0.4, PULL_THRESHOLD + 20) : 0);
  }
  async function onTouchEnd() {
    const pulled = pull;
    pullStart.current = null;
    setPull(0);
    if (pulled >= PULL_THRESHOLD && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  }

  return (
    <Screen>
      <div
        data-testid="home-root"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: pull ? `translateY(${pull}px)` : undefined }}
        className={pull ? '' : 'transition-transform duration-200'}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-1 flex justify-center transition-opacity ${
            pull >= PULL_THRESHOLD || refreshing ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className={`h-6 w-6 rounded-full border-2 border-accent border-t-transparent ${refreshing ? 'animate-spin' : ''}`} />
        </div>

        <header className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2.5">
            {logo ? (
              <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
            ) : null}
            <span className="text-[15px] font-semibold text-ink">{hotelName}</span>
          </div>
          <LanguageSwitcher />
        </header>

        <h1 className="mt-7 text-[22px] font-bold leading-snug text-ink">
          {t('greeting', { name: profile.guestName })}
        </h1>

        <div className="mt-5">
          <StayCard profile={profile} />
        </div>

        <div className="mt-7">
          <ServicesGrid />
        </div>

        <p className="mt-10 pb-2 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          {tc('poweredBy')}
        </p>

        {/* Reserved bottom-nav slot (14.5 AC3) — Epic 15 activates it. */}
        <div aria-hidden className="h-2" />
      </div>
    </Screen>
  );
}

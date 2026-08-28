'use client';

/* eslint-disable @next/next/no-img-element */
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useHotel } from '@/components/hotel-provider';
import { assetUrl } from '@/lib/api';
import { localizeField } from '@/lib/localize';
import type { GuestAnnouncement, GuestProfile } from '@/lib/types';
import { AnnouncementsBell } from './announcements/announcements-bell';
import { PriorityBanner } from './announcements/priority-banner';
import { LanguageSwitcher } from './language-switcher';
import { ServicesGrid } from './services-grid';
import { StayCard, type StayCardDnd } from './stay-card';
import { Screen } from './ui';

const PULL_THRESHOLD = 70;

/** 19.4 — everything home needs from the shared announcements feed. */
export interface HomeAnnouncements {
  unreadCount: number;
  banner: GuestAnnouncement | null;
  onOpenInbox: () => void;
  onOpenBanner: () => void;
  onDismissBanner: () => void;
}

/**
 * Home (14.4 AC2): hotel header → personal greeting → stay card → services
 * grid. Hotel-first branding; quiet GXP footer. Pull-to-refresh re-probes the
 * session — the one place the gesture is meaningful (14.5 AC5).
 */
export function HomeScreen({
  profile,
  onRefresh,
  onOpenTile,
  announcements,
  dnd,
}: {
  profile: GuestProfile;
  onRefresh?: () => Promise<void>;
  onOpenTile?: (key: 'requests' | 'dining' | 'housekeeping' | 'transport' | 'info') => void;
  /** null/absent = module off → no bell, no banner (19.4 AC4). */
  announcements?: HomeAnnouncements | null;
  /** null/absent = housekeeping module off → no DND row (Epic 20, 20.4). */
  dnd?: StayCardDnd | null;
}) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const { hotel, hotelName } = useHotel();
  const logo = assetUrl(hotel.logoUrl);
  const locale = useLocale();
  const cover = assetUrl(hotel.coverImageUrl);
  const [coverFailed, setCoverFailed] = useState(false);
  // A replaced cover (e.g. rebranding mid-stay) must not stay hidden behind a
  // stale failure latched onto the previous URL.
  useEffect(() => setCoverFailed(false), [cover]);
  const showCover = Boolean(cover) && !coverFailed;
  const welcome = localizeField(hotel.welcomeMessage, locale);

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

        {showCover ? (
          <div data-testid="home-cover" className="relative -mx-5 aspect-[16/9] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover ?? undefined}
              alt=""
              onError={() => setCoverFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
              {...{ fetchpriority: 'high' }}
            />
            {/* Legibility scrim — text stays readable over any photo (18.2 AC2). */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2.5">
                {logo ? <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" /> : null}
                <span className="text-[15px] font-semibold text-white">{hotelName}</span>
              </div>
              <div className="flex items-center gap-2">
                {announcements ? (
                  <AnnouncementsBell
                    unreadCount={announcements.unreadCount}
                    onOpen={announcements.onOpenInbox}
                    onCover
                  />
                ) : null}
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        ) : (
          <header className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2.5">
              {logo ? (
                <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
              ) : null}
              <span className="text-[15px] font-semibold text-ink">{hotelName}</span>
            </div>
            <div className="flex items-center gap-2">
              {announcements ? (
                <AnnouncementsBell
                  unreadCount={announcements.unreadCount}
                  onOpen={announcements.onOpenInbox}
                />
              ) : null}
              <LanguageSwitcher />
            </div>
          </header>
        )}

        <h1 className="mt-7 text-[22px] font-bold leading-snug text-ink">
          {t('greeting', { name: profile.guestName })}
        </h1>

        {welcome ? (
          <p data-testid="home-welcome" className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            {welcome}
          </p>
        ) : null}

        {announcements?.banner ? (
          <div className="mt-4">
            <PriorityBanner
              announcement={announcements.banner}
              onOpen={announcements.onOpenBanner}
              onDismiss={announcements.onDismissBanner}
            />
          </div>
        ) : null}

        <div className="mt-5">
          <StayCard profile={profile} dnd={dnd} />
        </div>

        <div className="mt-7">
          <ServicesGrid onOpen={onOpenTile} />
        </div>

        <p className="mt-10 pb-2 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          {tc('poweredBy')}
        </p>
      </div>
    </Screen>
  );
}

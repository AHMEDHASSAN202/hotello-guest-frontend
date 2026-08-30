'use client';

import { ArrowLeft, BookOpen, Megaphone, PartyPopper } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from '@/i18n/format';
import { isLocale, type Locale } from '@/i18n/config';
import type { ApiError } from '@/lib/api';
import type {
  GuestAnnouncement,
  GuestAnnouncementChip,
  GuestAnnouncementEventChip,
  GuestProfile,
} from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { GenericErrorScreen, OfflineScreen, StateShell } from '../state-screens';
import { Screen, Skeleton } from '../ui';

/** What the screen consumes from GuestFlow's single shared poller. */
export interface AnnouncementsFeedHandle {
  announcements: GuestAnnouncement[] | null;
  unreadCount: number;
  error: ApiError | null;
  refresh: () => void;
  markRead: (id: string) => void;
}

/**
 * Epic 19, Story 19.4 AC2 — the inbox. Priority pinned with the "مهم"
 * treatment, unread styled distinctly, opening an item marks it read, the
 * Hotel Info chip deep-links. Reached from the bell, not the bottom nav —
 * the back arrow returns home.
 *
 * Epic 21 Task 23 — the event chip mirrors the info chip's shape and visual
 * treatment exactly (same pill, same button pattern); it deep-links into
 * the Events section, opening that event's detail sheet.
 *
 * FINAL-REVIEW FIX (whole-branch review) — `onOpenEvent` is nullable and the
 * chip is not rendered without it. The backend puts `eventChip` on an
 * announcement regardless of the hotel's plan, so on a hotel WITHOUT the
 * events module the chip used to render and then do nothing at all when
 * tapped (`guest-flow.tsx` no-ops it when events aren't live) — a dead tap,
 * the one thing an app is never allowed to have. Capability arrives as a
 * nullable prop, the `HomeScreen` `announcements`/`dnd` idiom, rather than
 * as a new boolean or a context read.
 */
export function AnnouncementsScreen({
  feed,
  profile,
  onBack,
  onOpenInfo,
  onOpenEvent,
}: {
  feed: AnnouncementsFeedHandle;
  profile: GuestProfile;
  onBack: () => void;
  /** `null` when the hotel-info section isn't live — the chip then isn't rendered. */
  onOpenInfo: ((chip: GuestAnnouncementChip) => void) | null;
  /** `null` when the events section isn't live — the chip then isn't rendered. */
  onOpenEvent: ((chip: GuestAnnouncementEventChip) => void) | null;
}) {
  const t = useTranslations('announcements');
  const router = useRouter();
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale)
    ? activeLocale
    : isLocale(profile.language)
      ? profile.language
      : 'en';

  const [detail, setDetail] = useState<GuestAnnouncement | null>(null);

  // Live relative ages — the my-requests 30s ticker.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Module disabled mid-stay: warm screen + one server-layout refresh
  // (the Epic 15 pattern).
  const moduleGone =
    !!feed.error &&
    (feed.error.code === 'MODULE_NOT_ENABLED' ||
      feed.error.code === 'HOTEL_UNAVAILABLE');
  const refreshed = useRef(false);
  useEffect(() => {
    if (moduleGone && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [moduleGone, router]);

  if (moduleGone) {
    return (
      <StateShell icon={Megaphone} title={t('soon.title')} body={t('soon.body')} />
    );
  }
  if (feed.error && feed.error.code === 'NETWORK') {
    return <OfflineScreen onRetry={feed.refresh} />;
  }
  if (feed.error) {
    return <GenericErrorScreen onRetry={feed.refresh} />;
  }

  const rows = feed.announcements;

  return (
    <Screen>
      <header className="flex items-center gap-2 pt-3">
        <button
          type="button"
          data-testid="announcements-back"
          aria-label={t('back')}
          onClick={onBack}
          className="pressable flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink"
        >
          <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.75} />
        </button>
        <h1 className="text-[22px] font-bold leading-snug text-ink">
          {t('title')}
        </h1>
      </header>

      <div className="mt-5 flex-1 pb-6">
        {rows === null ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="pt-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
              <Megaphone className="h-7 w-7 text-accent" strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">
              {t('empty.title')}
            </h2>
            <p className="mx-auto mt-1 max-w-[34ch] text-sm leading-relaxed text-ink-soft">
              {t('empty.body')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <AnnouncementRow
                key={`${row.id}-${row.readAt ? 'read' : 'unread'}`}
                announcement={row}
                locale={locale}
                now={now}
                priorityLabel={t('priority')}
                unreadLabel={t('unread')}
                onOpen={() => {
                  feed.markRead(row.id);
                  setDetail(row);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <BottomSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title}
      >
        {detail ? (
          <div className="pb-2">
            {detail.priority ? (
              <span className="inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                {t('priority')}
              </span>
            ) : null}
            {detail.publishedAt ? (
              <p className="mt-1 text-xs text-ink-faint">
                {formatRelativeTime(detail.publishedAt, locale, now)}
              </p>
            ) : null}
            <div className="mt-3">
              {detail.body.split(/\n{2,}/).map((paragraph, i) => (
                <p
                  key={i}
                  className="mb-3 text-sm leading-relaxed text-ink last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            {detail.infoChip && onOpenInfo ? (
              <button
                type="button"
                onClick={() => onOpenInfo(detail.infoChip!)}
                className="pressable mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent"
              >
                <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span>
                  {t('infoChip')} · {detail.infoChip.name}
                </span>
              </button>
            ) : null}
            {detail.eventChip && onOpenEvent ? (
              <button
                type="button"
                onClick={() => onOpenEvent(detail.eventChip!)}
                className="pressable mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent"
              >
                <PartyPopper className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span>
                  {t('eventChip')} · {detail.eventChip.title}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function AnnouncementRow({
  announcement,
  locale,
  now,
  priorityLabel,
  unreadLabel,
  onOpen,
}: {
  announcement: GuestAnnouncement;
  locale: Locale;
  now: Date;
  priorityLabel: string;
  unreadLabel: string;
  onOpen: () => void;
}) {
  const unread = !announcement.readAt;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`pressable animate-fade-in block w-full rounded-card bg-card p-4 text-start shadow-card ${
        unread ? '' : 'opacity-75'
      }`}
    >
      <span className="flex items-center gap-2">
        {announcement.priority ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
            {priorityLabel}
          </span>
        ) : null}
        {announcement.publishedAt ? (
          <span className="text-xs text-ink-faint">
            {formatRelativeTime(announcement.publishedAt, locale, now)}
          </span>
        ) : null}
        {unread ? (
          <span
            data-testid={`unread-dot-${announcement.id}`}
            aria-label={unreadLabel}
            className="ms-auto h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
          />
        ) : null}
      </span>
      <span
        className={`mt-1.5 block text-[15px] leading-snug text-ink ${
          unread ? 'font-bold' : 'font-semibold'
        }`}
      >
        {announcement.title}
      </span>
      <span className="mt-0.5 block truncate text-sm text-ink-soft">
        {announcement.body.split('\n')[0]}
      </span>
    </button>
  );
}

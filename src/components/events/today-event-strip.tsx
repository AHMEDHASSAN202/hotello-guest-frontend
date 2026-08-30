'use client';

import { PartyPopper } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { isLocale } from '@/i18n/config';
import { formatTimeOfDay } from '@/i18n/format';
import { useGuestEventBookings } from '@/lib/use-guest-event-bookings';
import { parseLocalStamp } from './event-stamp';

/**
 * Epic 21 (21.5) — the `ActiveOrderStrip` pattern (16.6 AC1) applied to
 * Events: the guest's booking for TODAY surfaces on the app home as a
 * compact, non-dismissable pill floating above the bottom nav. Renders only
 * while the backend's `todayBooking` (Task 7, `myBookings`) is non-null —
 * there is no explicit dismiss affordance by design, it simply stops
 * rendering once the booking's window has passed (the server recomputes
 * this on every poll tick). Tapping it opens the Events section directly on
 * that booking's detail sheet.
 *
 * FINAL-REVIEW FIX (whole-branch review): this used to carry its own
 * `fixed inset-x-0 bottom-[64px]` wrapper — byte-identical coordinates to
 * `ActiveOrderStrip`, so a guest with both an in-progress F&B order and a
 * today's-event booking got this strip silently covering that one. Fixed
 * positioning now lives once, on the shared `home-strips` column in
 * `guest-flow.tsx`, so multiple strips stack instead of overlapping; this
 * component renders only its pill.
 */
export function TodayEventStrip({
  onOpen,
}: {
  onOpen: (bookingId: string) => void;
}) {
  const t = useTranslations('events');
  const tHome = useTranslations('home');
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale) ? activeLocale : 'en';
  const { feed } = useGuestEventBookings(true);
  const booking = feed?.todayBooking ?? null;
  if (!booking) return null;

  return (
    <button
      data-testid="today-event-strip"
      onClick={() => onOpen(booking.id)}
      className="pressable animate-fade-in flex min-h-[52px] w-full items-center gap-3 rounded-card bg-card p-3 shadow-sheet"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <PartyPopper className="h-4 w-4 text-accent" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-semibold text-ink">
          {booking.title}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          {t('today.startsAt', {
            time: formatTimeOfDay(parseLocalStamp(booking.startAtLocal), locale),
          })}
        </span>
      </span>
      <span className="shrink-0 text-xs font-bold text-accent">
        {tHome('eventCard.view')}
      </span>
    </button>
  );
}

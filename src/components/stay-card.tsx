'use client';

import { CalendarDays, Clock, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useHotel } from '@/components/hotel-provider';
import type { Locale } from '@/i18n/config';
import { formatCheckoutDate, isCheckoutDay, nightsRemaining } from '@/i18n/format';
import type { GuestProfile } from '@/lib/types';
import { Bdi, Switch } from './ui';

/**
 * Everything the DND row needs (Epic 20, 20.4). The parent decides whether
 * the row exists at all — null/absent = housekeeping module off (the
 * AnnouncementsBell convention). `onRequestCleaning` is defined only when
 * the requests module is live (AC4 cross-link, never a request channel here).
 */
export interface StayCardDnd {
  active: boolean;
  /** POST in flight — the switch disables so double taps can't race. */
  busy: boolean;
  onToggle: (active: boolean) => void;
  onRequestCleaning?: () => void;
}

/**
 * The stay card (14.4 AC2): room number large, nights remaining, checkout
 * date + the hotel's checkout time. On the last day it turns into a gentle
 * checkout note (AC4) — warm, accent-tinted, never alarming. Epic 20 adds
 * an optional third row: the Do-Not-Disturb toggle (20.4 AC1).
 */
export function StayCard({
  profile,
  dnd,
}: {
  profile: GuestProfile;
  dnd?: StayCardDnd | null;
}) {
  const t = useTranslations('home');
  const locale = useLocale() as Locale;
  const { hotel } = useHotel();

  const lastDay = isCheckoutDay(profile.checkOutDate, hotel.timezone);
  const nights = nightsRemaining(profile.checkOutDate, hotel.timezone);

  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          {t('stayCard.room')}
        </span>
        <span className="text-4xl font-bold tabular-nums text-ink" data-selectable>
          <Bdi>{profile.roomNumber}</Bdi>
        </span>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {lastDay ? (
          <p className="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-[14px] leading-relaxed text-ink">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span>{t('stayCard.checkoutToday', { time: hotel.checkoutTime })}</span>
          </p>
        ) : (
          <div className="flex items-center gap-2 text-[14px] text-ink-soft">
            <CalendarDays className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="font-medium text-ink">
              {t('stayCard.nights', { count: nights })}
            </span>
            <span aria-hidden>·</span>
            <span>
              {t('stayCard.checkout', {
                date: formatCheckoutDate(profile.checkOutDate, locale),
                time: hotel.checkoutTime,
              })}
            </span>
          </div>
        )}
      </div>

      {dnd ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">
                {t('stayCard.dnd.label')}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                {t('stayCard.dnd.explainer')}
              </p>
              {dnd.active ? (
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-accent">
                  {t('stayCard.dnd.resetNote')}
                </p>
              ) : null}
            </div>
            <Switch
              checked={dnd.active}
              onChange={dnd.onToggle}
              disabled={dnd.busy}
              aria-label={t('stayCard.dnd.label')}
              data-testid="dnd-switch"
            />
          </div>
          {dnd.onRequestCleaning ? (
            <button
              type="button"
              onClick={dnd.onRequestCleaning}
              data-testid="dnd-cross-link"
              className="pressable mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent-soft px-4 text-start text-[13px] font-semibold text-accent"
            >
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span>{t('stayCard.dnd.crossLink')}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

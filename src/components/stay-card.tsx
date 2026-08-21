'use client';

import { CalendarDays, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useHotel } from '@/components/hotel-provider';
import type { Locale } from '@/i18n/config';
import { formatCheckoutDate, isCheckoutDay, nightsRemaining } from '@/i18n/format';
import type { GuestProfile } from '@/lib/types';
import { Bdi } from './ui';

/**
 * The stay card (14.4 AC2): room number large, nights remaining, checkout
 * date + the hotel's checkout time. On the last day it turns into a gentle
 * checkout note (AC4) — warm, accent-tinted, never alarming.
 */
export function StayCard({ profile }: { profile: GuestProfile }) {
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
    </section>
  );
}

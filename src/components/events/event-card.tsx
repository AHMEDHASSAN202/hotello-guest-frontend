'use client';

/* eslint-disable @next/next/no-img-element */
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatCheckoutDate, formatMoney, formatTimeOfDay } from '@/i18n/format';
import { assetUrl } from '@/lib/api';
import type { GuestEvent } from '@/lib/types';
import { localStampDate, parseLocalStamp } from './event-stamp';

/**
 * 21.4 AC1 — spots-left is only a hint when capacity is genuinely tight, not
 * a running counter on every event. Five-or-fewer reads as "hurry, but not
 * an emergency" without being noisy on a 20-capacity yoga class sitting at
 * 12 left.
 */
const SPOTS_LEFT_TIGHT_THRESHOLD = 5;

/**
 * 21.4 AC1 — upcoming events as photo cards (menu-browse.tsx's item-row
 * layout): date/time, location, price or ✓Included, a spots-left hint only
 * when tight, sold-out and past-event states designed. The backend already
 * filters to upcoming-published (`listUpcoming`), so past-event handling
 * here is defense in depth against a stale cached list, not a normal path.
 */
export function EventCard({
  events,
  locale,
  onPick,
}: {
  events: GuestEvent[];
  locale: Locale;
  onPick: (event: GuestEvent) => void;
}) {
  const t = useTranslations('events');
  const now = new Date();

  return (
    <ul className="mt-4 space-y-3">
      {events.map((event) => {
        const start = parseLocalStamp(event.startAtLocal);
        const isPast = start.getTime() < now.getTime();
        const open = !event.soldOut && !isPast;
        const pillLabel = isPast
          ? t('browse.ended')
          : event.soldOut
            ? t('browse.soldOut')
            : null;
        const spotsLeft = event.spotsLeft;
        const tight =
          spotsLeft != null &&
          spotsLeft > 0 &&
          spotsLeft <= SPOTS_LEFT_TIGHT_THRESHOLD;

        return (
          <li key={event.id}>
            <button
              type="button"
              data-testid={`event-card-${event.id}`}
              disabled={!open}
              onClick={() => open && onPick(event)}
              className={`pressable flex w-full items-center gap-3 rounded-card bg-card p-3 text-start shadow-card ${
                isPast ? 'opacity-70' : ''
              } ${!open ? 'cursor-default' : ''}`}
            >
              {event.photoThumbUrl ? (
                <img
                  src={assetUrl(event.photoThumbUrl) ?? undefined}
                  alt=""
                  loading="lazy"
                  className="h-16 w-20 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg"
                >
                  🎉
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {event.title}
                </span>
                <span className="mt-0.5 block text-[13px] text-ink-soft">
                  {formatCheckoutDate(localStampDate(event.startAtLocal), locale)}
                  {' · '}
                  {formatTimeOfDay(start, locale)}
                </span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-ink-soft">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{event.locationText}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {event.price.included ? (
                      <span className="text-success">{t('browse.included')}</span>
                    ) : event.price.unitPrice === 0 ? (
                      <span className="text-ink">{t('browse.free')}</span>
                    ) : (
                      <span className="text-ink" dir="ltr">
                        {formatMoney(event.price.unitPrice, event.currency, locale)}
                      </span>
                    )}
                  </span>
                  {pillLabel ? (
                    <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-xs font-semibold text-ink-soft">
                      {pillLabel}
                    </span>
                  ) : tight ? (
                    <span className="text-xs font-semibold text-accent">
                      {t('browse.spotsLeft', { count: spotsLeft as number })}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

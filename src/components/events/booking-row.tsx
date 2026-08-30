'use client';

import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatCheckoutDate, formatMoney, formatTimeOfDay } from '@/i18n/format';
import type { EventBookingStatus, GuestEventBooking } from '@/lib/types';
import { localStampDate, parseLocalStamp } from './event-stamp';

const STATUS_STYLES: Record<EventBookingStatus, string> = {
  booked: 'bg-accent-soft text-ink',
  cancelled: 'bg-ink/[0.06] text-ink-faint',
};

/**
 * One booking in "My bookings" (21.5): status chip, event date/time, party
 * size × title, total (or ✓Included), room-charge badge — the order-row.tsx
 * pattern applied to a booking instead of an F&B order. `muted` dims a row
 * inside the collapsed history section regardless of its own status.
 */
export function BookingRow({
  booking,
  locale,
  onOpen,
  muted = false,
}: {
  booking: GuestEventBooking;
  locale: Locale;
  onOpen: () => void;
  muted?: boolean;
}) {
  const t = useTranslations('events');

  return (
    <li>
      <button
        type="button"
        data-testid={`event-booking-row-${booking.id}`}
        onClick={onOpen}
        className={`pressable w-full rounded-card bg-card p-4 text-start shadow-card ${
          muted || booking.status === 'cancelled' ? 'opacity-70' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[booking.status]}`}
          >
            {t(`status.${booking.status}`)}
          </span>
          <span className="text-xs tabular-nums text-ink-faint" dir="ltr">
            {formatCheckoutDate(localStampDate(booking.startAtLocal), locale)}
            {' · '}
            {formatTimeOfDay(parseLocalStamp(booking.startAtLocal), locale)}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink">
          {booking.partySize}× {booking.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          {booking.included ? (
            <span className="font-semibold text-success">
              {t('bookings.included')}
            </span>
          ) : (
            <span dir="ltr" className="font-semibold text-ink">
              {formatMoney(booking.totalAmount, booking.currency, locale)}
            </span>
          )}
          {booking.paymentMethod === 'room_charge' ? (
            <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {t('bookings.roomCharge')}
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

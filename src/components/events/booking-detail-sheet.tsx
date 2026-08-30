'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { formatCheckoutDate, formatMoney, formatTimeOfDay } from '@/i18n/format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { EventBookingStatus, GuestEventBooking } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { localStampDate, parseLocalStamp } from './event-stamp';

const STATUS_STYLES: Record<EventBookingStatus, string> = {
  booked: 'bg-accent-soft text-ink',
  cancelled: 'bg-ink/[0.06] text-ink-faint',
};

/**
 * Epic 21, Story 21.5 — booking detail: renders the booking's frozen
 * SNAPSHOT only, never the live event (21.4 AC4) — an edited or cancelled
 * event must never rewrite what the guest already booked. The
 * `order-detail-sheet.tsx` two-step inline cancel pattern, gated to
 * `status === 'booked'` AND pre-start; once the event has started (or the
 * booking is already cancelled) the cancel affordance is replaced by
 * front-desk guidance instead of a dead/misleading button.
 */
export function BookingDetailSheet({
  booking,
  locale,
  onClose,
  onChanged,
}: {
  booking: GuestEventBooking | null;
  locale: Locale;
  onClose: () => void;
  onChanged: (booking: GuestEventBooking) => void;
}) {
  const t = useTranslations('events');
  const resolveError = useApiError();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  // Same naive-local-stamp-as-Date convention as event-card.tsx (Task 20) —
  // the guest's device clock stands in for hotel-local time.
  const isPast = parseLocalStamp(booking.startAtLocal).getTime() <= Date.now();
  const canCancel = booking.status === 'booked' && !isPast;

  async function cancel() {
    if (!booking) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await api<GuestEventBooking>(
        `/guest/events/bookings/${booking.id}/cancel`,
        { method: 'POST' },
      );
      onChanged(updated);
      onClose();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={booking.title}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[booking.status]}`}
        >
          {t(`status.${booking.status}`)}
        </span>
        <span className="text-xs tabular-nums text-ink-faint">
          {formatCheckoutDate(localStampDate(booking.startAtLocal), locale)}
          {' · '}
          {formatTimeOfDay(parseLocalStamp(booking.startAtLocal), locale)}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium leading-snug text-ink">
        {booking.partySize}× {booking.title}
      </p>
      <p className="mt-1 text-sm text-ink-soft">{booking.locationText}</p>

      {/* Payment (snapshot totals — never re-derived from live pricing) */}
      <div className="mt-4 rounded-xl bg-ink/[0.03] p-3 text-sm font-medium text-ink-soft">
        {booking.included
          ? t('detail.included')
          : booking.paymentMethod === 'room_charge'
            ? t('detail.payRoom')
            : t('detail.payCash', {
                amount: formatMoney(
                  booking.totalAmount,
                  booking.currency,
                  locale,
                ),
              })}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* Guest cancel — only while booked and before the event starts (21.5) */}
      {canCancel ? (
        confirming ? (
          <div className="mt-5">
            <p className="text-center text-sm font-medium text-ink">
              {t('detail.cancelConfirm')}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="pressable min-h-[44px] flex-1 rounded-full bg-ink/[0.06] text-sm font-semibold text-ink"
              >
                {t('detail.keep')}
              </button>
              <button
                data-testid="confirm-cancel-booking"
                onClick={() => void cancel()}
                disabled={cancelling}
                className="pressable min-h-[44px] flex-1 rounded-full bg-danger text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('detail.yesCancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            data-testid="cancel-booking"
            onClick={() => setConfirming(true)}
            className="pressable mt-5 min-h-[44px] w-full rounded-full text-sm font-semibold text-danger"
          >
            {t('detail.cancel')}
          </button>
        )
      ) : booking.status === 'booked' ? (
        <p className="mt-5 text-center text-xs text-ink-faint">
          {t('detail.noCancel')}
        </p>
      ) : null}
    </BottomSheet>
  );
}

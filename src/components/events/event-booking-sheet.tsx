'use client';

/* eslint-disable @next/next/no-img-element */
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { formatCheckoutDate, formatMoney, formatTimeOfDay } from '@/i18n/format';
import { api, ApiError, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  FnbPaymentMethod,
  GuestEvent,
  GuestEventBooking,
  GuestEventDetail,
} from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { Skeleton } from '../ui';
import { localStampDate, parseLocalStamp } from './event-stamp';

/**
 * Epic 21, Story 21.4 — the booking sheet: `ItemSheet` (photo/description/
 * stepper/submit-label-flip) and `CheckoutSheet` (payment row/optimistic
 * success beat) merged into one sheet, since Events has no cart — one event,
 * one booking, nothing to accumulate first. The browse card only carries
 * `GuestEvent` (list shape); this sheet fetches `GET /guest/events/:id`
 * itself on open both for the fields the card doesn't have (description,
 * maxPartySize, paymentMethods) and for a fresher `spotsLeft` than the list
 * snapshot the guest tapped from.
 *
 * Race safety (21.4): the backend's `book()` is the sole capacity guard (a
 * pessimistic-lock transaction) — this sheet does no client-side locking. A
 * `409 EVENT_SOLD_OUT` gets a friendly inline notice instead of the generic
 * error banner, and re-fetches the event detail so the party-size bound and
 * spots-left figure reflect what actually happened, letting the guest retry
 * with a smaller party immediately rather than bouncing to a dead end.
 */
export function EventBookingSheet({
  event,
  locale,
  onClose,
  onBooked,
}: {
  event: GuestEvent | null;
  locale: Locale;
  onClose: () => void;
  onBooked: (booking: GuestEventBooking) => void;
}) {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const resolveError = useApiError();

  const [detail, setDetail] = useState<GuestEventDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [payment, setPayment] = useState<FnbPaymentMethod>('cash');
  const [placing, setPlacing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldOutNotice, setSoldOutNotice] = useState(false);

  const loadDetail = useCallback(
    async (id: string): Promise<GuestEventDetail | null> => {
      try {
        const d = await api<GuestEventDetail>(`/guest/events/${id}`);
        setDetail(d);
        setDetailError(null);
        return d;
      } catch (err) {
        setDetail(null);
        setDetailError(resolveError(err));
        return null;
      }
    },
    [resolveError],
  );

  useEffect(() => {
    if (!event) return;
    setDetail(null);
    setDetailError(null);
    setPartySize(1);
    setPayment('cash');
    setPlacing(false);
    setConfirmed(false);
    setError(null);
    setSoldOutNotice(false);
    void loadDetail(event.id).then((d) => {
      if (d) setPayment(d.paymentMethods[0] ?? 'cash');
    });
    // Only re-run when a different event is opened — loadDetail is stable
    // enough (only depends on the resolver) that including it would just
    // re-fire this on every render without changing behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  if (!event) return null;

  if (confirmed) {
    return (
      <BottomSheet open onClose={() => {}}>
        <div className="animate-fade-in flex flex-col items-center py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <Check className="h-7 w-7 text-success" aria-hidden />
          </span>
          <p className="mt-3 font-semibold text-lg text-ink">
            {t('success.title')}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{t('success.body')}</p>
        </div>
      </BottomSheet>
    );
  }

  if (detailError) {
    return (
      <BottomSheet open onClose={onClose} title={event.title}>
        <p role="alert" className="py-6 text-center text-sm text-danger">
          {detailError}
        </p>
        <button
          onClick={() => void loadDetail(event.id)}
          className="pressable min-h-[44px] w-full rounded-full bg-ink/[0.06] text-sm font-semibold text-ink"
        >
          {tc('retry')}
        </button>
      </BottomSheet>
    );
  }

  if (!detail) {
    return (
      <BottomSheet open onClose={onClose} title={event.title}>
        <div className="space-y-3 py-1">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </BottomSheet>
    );
  }

  const maxParty = Math.min(detail.spotsLeft ?? Infinity, detail.maxPartySize);
  const noSpotsAvailable = maxParty < 1;
  const total = detail.price.unitPrice * partySize;
  const singleMethod = detail.paymentMethods.length === 1;
  const start = parseLocalStamp(detail.startAtLocal);
  // FINAL-REVIEW CRITICAL FIX (whole-branch review) — this sheet used to
  // render the stepper/payment/submit off `spotsLeft`/`maxPartySize` alone,
  // never checking `detail.status` or the start time. The backend's book()
  // only rejects on status !== 'published' (no time check), the completion
  // scheduler doesn't flip published → completed until well after the event
  // starts, and auto-generated event-publish announcements never expire —
  // so a deep-linked past/non-published event stayed fully bookable for the
  // guest's whole stay. `EventCard` and `BookingDetailSheet` already guard
  // this exact condition elsewhere in this branch; this sheet was the one
  // surface missing it.
  const ended = detail.status !== 'published' || start.getTime() <= Date.now();

  async function book() {
    setPlacing(true);
    setError(null);
    setSoldOutNotice(false);
    try {
      const booking = await api<GuestEventBooking>(
        `/guest/events/${event!.id}/book`,
        {
          method: 'POST',
          body: JSON.stringify({
            partySize,
            ...(detail!.price.included ? {} : { paymentMethod: payment }),
          }),
        },
      );
      // 21.4 — the same optimistic-success beat as F&B checkout, then hand
      // the fresh booking to the parent (tab switch + close happen there).
      setConfirmed(true);
      setTimeout(() => onBooked(booking), 1100);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EVENT_SOLD_OUT') {
        setPlacing(false);
        setSoldOutNotice(true);
        const refreshed = await loadDetail(event!.id);
        if (refreshed) {
          const newMax = Math.min(
            refreshed.spotsLeft ?? Infinity,
            refreshed.maxPartySize,
          );
          if (newMax >= 1) setPartySize((p) => Math.min(p, newMax));
        }
        return;
      }
      setError(resolveError(err));
      setPlacing(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={detail.title}>
      {detail.photoDetailUrl ? (
        <img
          src={assetUrl(detail.photoDetailUrl) ?? undefined}
          alt=""
          className="h-44 w-full rounded-card object-cover"
        />
      ) : null}

      <p className="mt-3 text-[13px] text-ink-soft">
        {formatCheckoutDate(localStampDate(detail.startAtLocal), locale)}
        {' · '}
        {formatTimeOfDay(start, locale)}
        {' · '}
        {detail.locationText}
      </p>

      {detail.description ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {detail.description}
        </p>
      ) : null}

      {ended ? (
        <p
          role="alert"
          data-testid="event-ended-notice"
          className="mt-5 rounded-xl bg-ink/[0.05] p-3 text-center text-sm font-medium text-ink-soft"
        >
          {t('browse.ended')}
        </p>
      ) : noSpotsAvailable ? (
        <p
          role="alert"
          data-testid="sold-out-notice"
          className="mt-5 rounded-xl bg-ink/[0.05] p-3 text-center text-sm font-medium text-ink-soft"
        >
          {t('sheet.soldOut')}
        </p>
      ) : (
        <>
          {soldOutNotice ? (
            <p
              role="alert"
              data-testid="sold-out-notice"
              className="mt-4 rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger"
            >
              {t('sheet.soldOut')}
            </p>
          ) : null}

          {/* Party-size stepper (21.4 AC — min 1, max spotsLeft capped at maxPartySize) */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
              {t('sheet.partySize')}
            </p>
            <div dir="ltr" className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPartySize((p) => Math.max(1, p - 1));
                  setSoldOutNotice(false);
                }}
                disabled={partySize <= 1}
                aria-label={t('sheet.less')}
                data-testid="party-minus"
                className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-lg font-semibold text-ink disabled:opacity-40"
              >
                −
              </button>
              <span
                data-testid="party-size"
                className="w-6 text-center font-semibold tabular-nums text-ink"
              >
                {partySize}
              </span>
              <button
                onClick={() => {
                  setPartySize((p) => Math.min(maxParty, p + 1));
                  setSoldOutNotice(false);
                }}
                disabled={partySize >= maxParty}
                aria-label={t('sheet.more')}
                data-testid="party-plus"
                className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-lg font-semibold text-ink disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Payment — skipped entirely when fully included (F&B checkout precedent) */}
          {detail.price.included ? (
            <p className="mt-4 rounded-xl bg-success/10 p-3 text-sm font-medium text-success">
              {t('checkout.includedNote')}
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
                {t('checkout.payment')}
              </p>
              <div className="mt-2 space-y-2">
                {detail.paymentMethods.map((method) => (
                  <DestinationOption
                    key={method}
                    selected={payment === method}
                    onSelect={() => setPayment(method)}
                    compact={singleMethod}
                    testId={`pay-${method}`}
                  >
                    {method === 'cash'
                      ? t('checkout.cash')
                      : t('checkout.roomCharge')}
                  </DestinationOption>
                ))}
              </div>
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            data-testid="book-event"
            disabled={placing}
            onClick={() => void book()}
            className="pressable mt-5 min-h-[48px] w-full rounded-full bg-accent font-semibold text-accent-contrast disabled:opacity-40"
          >
            {placing ? (
              t('sheet.booking')
            ) : detail.price.included ? (
              <>
                {t('sheet.book')} · {t('browse.included')}
              </>
            ) : (
              <span dir="auto">
                {t('sheet.bookFor', {
                  price: formatMoney(total, detail.currency, locale),
                })}
              </span>
            )}
          </button>
        </>
      )}
    </BottomSheet>
  );
}

/** The checkout-sheet.tsx `DestinationOption` pattern, recreated locally so
 * Events doesn't reach into the Dining feature folder for a styled radio row. */
function DestinationOption({
  selected,
  onSelect,
  compact,
  testId,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable flex w-full items-center justify-between rounded-xl border p-3 text-start text-sm font-medium ${
        selected
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-line bg-card text-ink'
      } ${compact ? 'py-2.5' : ''}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span
        aria-hidden
        className={`ms-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected ? 'border-accent bg-accent' : 'border-line'
        }`}
      >
        {selected ? <Check className="h-3 w-3 text-accent-contrast" /> : null}
      </span>
    </button>
  );
}

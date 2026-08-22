'use client';

/* eslint-disable @next/next/no-img-element */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { formatMoney, formatTimeOfDay } from '@/i18n/format';
import { api, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { GuestFnbOrder } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { Bdi } from '../ui';

/**
 * 16.6 AC1/AC2 — order tracking: animated status timeline
 * (Received → Preparing → On the way → Delivered), lines with photos,
 * destination, payment ("have X ready" / "on your room bill" / included),
 * two-step inline cancel while `new` only.
 */
export function OrderDetailSheet({
  order,
  locale,
  onClose,
  onChanged,
}: {
  order: GuestFnbOrder | null;
  locale: Locale;
  onClose: () => void;
  onChanged: (order: GuestFnbOrder) => void;
}) {
  const t = useTranslations('dining');
  const resolveError = useApiError();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!order) return null;

  const steps: Array<{ key: string; at: string | null }> =
    order.status === 'cancelled'
      ? [
          { key: 'new', at: order.createdAt },
          { key: 'cancelled', at: order.cancelledAt },
        ]
      : [
          { key: 'new', at: order.createdAt },
          { key: 'preparing', at: order.startedAt },
          { key: 'on_the_way', at: order.outForDeliveryAt },
          { key: 'delivered', at: order.deliveredAt },
        ];

  const destination =
    order.destinationType === 'room' ? (
      <Bdi>{t('checkout.myRoom', { room: order.roomNumber })}</Bdi>
    ) : (
      <>
        {order.locationName}
        {order.spot ? (
          <>
            {' · '}
            <Bdi>{order.spot}</Bdi>
          </>
        ) : null}
      </>
    );

  async function cancel() {
    if (!order) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await api<GuestFnbOrder>(
        `/guest/fnb/orders/${order.id}/cancel`,
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
    <BottomSheet open onClose={onClose} title={t(`status.${order.status}`)}>
      {/* Timeline (request-detail-sheet pattern — transitions animate) */}
      <ol className="relative space-y-4">
        {steps.map(({ key, at }) => (
          <li key={key} className="relative flex items-center gap-3 ps-1">
            <span
              aria-hidden
              className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors duration-300 ${
                at ? 'border-accent bg-accent' : 'border-line bg-card'
              }`}
            />
            <span
              className={`flex-1 text-sm font-medium ${at ? 'text-ink' : 'text-ink-faint'}`}
            >
              {t(`status.${key}`)}
            </span>
            {at ? (
              <span className="text-xs tabular-nums text-ink-soft">
                {formatTimeOfDay(at, locale)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {/* Destination + payment (16.6 AC2) */}
      <div className="mt-5 rounded-xl bg-ink/[0.03] p-3 text-sm">
        <p>
          <span className="font-semibold text-ink">
            {t('tracking.destination')}:
          </span>{' '}
          <span className="text-ink">{destination}</span>
        </p>
        <p className="mt-1 font-medium text-ink-soft">
          {order.totalAmount === 0
            ? t('tracking.included')
            : order.paymentMethod === 'room_charge'
              ? t('tracking.payRoom')
              : t('tracking.payCash', {
                  amount: formatMoney(order.totalAmount, order.currency, locale),
                })}
        </p>
      </div>

      {/* Lines with photos */}
      <ul className="mt-4 space-y-2">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3">
            {line.photoThumbUrl ? (
              <img
                src={assetUrl(line.photoThumbUrl) ?? undefined}
                alt=""
                className="h-10 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-sm"
              >
                🍽
              </span>
            )}
            <span className="min-w-0 flex-1 text-sm text-ink">
              {line.quantity}× {line.itemName}
              {line.variantOptionName ? (
                <span className="text-ink-soft"> · {line.variantOptionName}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-sm font-medium">
              {line.included ? (
                <span className="text-success">{t('cart.included')}</span>
              ) : (
                <span dir="ltr" className="text-ink">
                  {formatMoney(line.lineTotal, order.currency, locale)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {/* Guest cancel — while `new` only (16.6 AC2) */}
      {order.status === 'new' ? (
        confirming ? (
          <div className="mt-5">
            <p className="text-center text-sm font-medium text-ink">
              {t('tracking.cancelConfirm')}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="pressable min-h-[44px] flex-1 rounded-full bg-ink/[0.06] text-sm font-semibold text-ink"
              >
                {t('tracking.keep')}
              </button>
              <button
                data-testid="confirm-cancel"
                onClick={() => void cancel()}
                disabled={cancelling}
                className="pressable min-h-[44px] flex-1 rounded-full bg-danger text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('tracking.yesCancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            data-testid="cancel-order"
            onClick={() => setConfirming(true)}
            className="pressable mt-5 min-h-[44px] w-full rounded-full text-sm font-semibold text-danger"
          >
            {t('tracking.cancel')}
          </button>
        )
      ) : order.status === 'preparing' || order.status === 'on_the_way' ? (
        <p className="mt-5 text-center text-xs text-ink-faint">
          {t('tracking.noCancel')}
        </p>
      ) : null}
    </BottomSheet>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatMoney, formatTimeOfDay } from '@/i18n/format';
import type { GuestFnbOrder } from '@/lib/types';
import { OPEN_FNB_ORDER_STATUSES } from '@/lib/types';

const STATUS_STYLES: Record<GuestFnbOrder['status'], string> = {
  new: 'bg-accent-soft text-ink',
  preparing: 'bg-accent-soft text-ink',
  on_the_way: 'bg-accent-soft text-ink',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-ink/[0.06] text-ink-faint',
};

/**
 * One order in the "My orders" list (16.6 AC3): summary line, total (or
 * ✓Included), status chip, room-charge badge — the guest's own preview of
 * the checkout bill.
 */
export function OrderRow({
  order,
  locale,
  onOpen,
}: {
  order: GuestFnbOrder;
  locale: Locale;
  onOpen: () => void;
}) {
  const t = useTranslations('dining');
  const summary = order.lines
    .map((l) => `${l.quantity}× ${l.itemName}`)
    .join(' · ');
  const open = OPEN_FNB_ORDER_STATUSES.includes(order.status);

  return (
    <li>
      <button
        data-testid={`fnb-order-row-${order.id}`}
        onClick={onOpen}
        className={`pressable w-full rounded-card bg-card p-4 text-start shadow-card ${
          order.status === 'cancelled' ? 'opacity-70' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[order.status]}`}
          >
            {t(`status.${order.status}`)}
          </span>
          <span className="text-xs tabular-nums text-ink-faint">
            {formatTimeOfDay(order.createdAt, locale)}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink">
          {summary}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          {order.totalAmount === 0 ? (
            <span className="font-semibold text-success">
              {t('tracking.included')}
            </span>
          ) : (
            <span dir="ltr" className="font-semibold text-ink">
              {formatMoney(order.totalAmount, order.currency, locale)}
            </span>
          )}
          {order.paymentMethod === 'room_charge' ? (
            <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {t('history.roomCharge')}
            </span>
          ) : null}
          {open ? (
            <span className="ms-auto text-xs font-semibold text-accent">
              {t('tabs.orders')} →
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

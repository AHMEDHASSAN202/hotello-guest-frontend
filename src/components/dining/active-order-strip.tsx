'use client';

import { ChefHat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { OPEN_FNB_ORDER_STATUSES } from '@/lib/types';
import { useGuestFnbOrders } from '@/lib/use-guest-fnb-orders';

/**
 * 16.6 AC1 — the active order surfaces on the app home as a compact
 * progress strip floating above the bottom nav; tapping it opens Dining.
 */
export function ActiveOrderStrip({
  onOpen,
}: {
  onOpen: (orderId: string) => void;
}) {
  const t = useTranslations('dining');
  const tHome = useTranslations('home');
  useLocale(); // keeps the strip re-rendering on locale switches
  const { orders } = useGuestFnbOrders(true);
  const active = orders?.find((o) =>
    OPEN_FNB_ORDER_STATUSES.includes(o.status),
  );
  if (!active) return null;

  return (
    <div className="fixed inset-x-0 bottom-[64px] z-30 mx-auto max-w-[430px] px-5 pb-2">
      <button
        data-testid="active-order-strip"
        onClick={() => onOpen(active.id)}
        className="pressable animate-fade-in flex min-h-[52px] w-full items-center gap-3 rounded-card bg-card p-3 shadow-sheet"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          <ChefHat className="h-4 w-4 text-accent" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-start">
          <span className="block text-sm font-semibold text-ink">
            {t(`status.${active.status}`)}
          </span>
          <span className="block truncate text-xs text-ink-soft">
            {active.lines.map((l) => `${l.quantity}× ${l.itemName}`).join(' · ')}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-accent">
          {tHome('diningCard.track')}
        </span>
      </button>
    </div>
  );
}

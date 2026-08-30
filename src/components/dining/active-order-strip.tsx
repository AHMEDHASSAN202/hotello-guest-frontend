'use client';

import { ChefHat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { OPEN_FNB_ORDER_STATUSES } from '@/lib/types';
import { useGuestFnbOrders } from '@/lib/use-guest-fnb-orders';

/**
 * 16.6 AC1 — the active order surfaces on the app home as a compact
 * progress strip floating above the bottom nav; tapping it opens Dining.
 *
 * FINAL-REVIEW FIX (whole-branch review, Epic 21): this used to carry its
 * own `fixed inset-x-0 bottom-[64px]` wrapper, which put it at byte-identical
 * coordinates to `TodayEventStrip` — when both an active order and a
 * today's-event booking exist simultaneously, the Events strip silently
 * covered this one. Fixed positioning now lives once, on the shared
 * `home-strips` column in `guest-flow.tsx`, so multiple strips stack in
 * normal flow instead of overlapping; this component renders only its pill.
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
    <button
      data-testid="active-order-strip"
      onClick={() => onOpen(active.id)}
      className="pressable animate-fade-in pointer-events-auto flex min-h-[52px] w-full items-center gap-3 rounded-card bg-card p-3 shadow-sheet"
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
  );
}

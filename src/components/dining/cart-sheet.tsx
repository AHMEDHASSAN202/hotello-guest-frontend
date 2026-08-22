'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatMoney } from '@/i18n/format';
import {
  removeLine,
  updateQuantity,
  type GuestCart,
} from '@/lib/cart';
import type { GuestFnbItem, GuestFnbMenu } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';

export type ItemIndex = Map<string, { item: GuestFnbItem; menu: GuestFnbMenu }>;

/** Resolved display data for one cart line — null price = included. */
export interface ResolvedLine {
  name: string;
  optionName: string | null;
  included: boolean;
  unitPrice: number;
  /** Item vanished or its menu closed while in the cart (16.5 AC3 edge). */
  blocked: boolean;
}

export function resolveLine(
  line: GuestCart['lines'][number],
  itemIndex: ItemIndex,
): ResolvedLine {
  const entry = itemIndex.get(line.itemId);
  if (!entry) {
    return { name: '', optionName: null, included: false, unitPrice: 0, blocked: true };
  }
  const option = entry.item.variant?.options.find(
    (o) => o.key === line.variantKey,
  );
  if (line.variantKey && !option) {
    return { name: entry.item.name, optionName: null, included: false, unitPrice: 0, blocked: true };
  }
  return {
    name: entry.item.name,
    optionName: option?.name ?? null,
    included: option ? option.included : entry.item.included,
    unitPrice: option ? option.unitPrice : entry.item.unitPrice,
    blocked: !entry.menu.availability.available,
  };
}

/** Display-only paid total — the server recomputes at order time (note 3). */
export function cartTotal(cart: GuestCart, itemIndex: ItemIndex): number {
  return cart.lines.reduce((sum, line) => {
    const resolved = resolveLine(line, itemIndex);
    return resolved.blocked || resolved.included
      ? sum
      : sum + resolved.unitPrice * line.quantity;
  }, 0);
}

/**
 * 16.5 AC3 — the cart: line editing, included lines listed at 0 with the ✓
 * badge, paid-only total, and the closed-menu edge — flagged lines must be
 * removed before checkout.
 */
export function CartSheet({
  open,
  cart,
  itemIndex,
  currency,
  locale,
  onClose,
  onChange,
  onCheckout,
}: {
  open: boolean;
  cart: GuestCart;
  itemIndex: ItemIndex;
  currency: string;
  locale: Locale;
  onClose: () => void;
  onChange: (cart: GuestCart) => void;
  onCheckout: () => void;
}) {
  const t = useTranslations('dining');
  if (!open) return null;

  const resolved = cart.lines.map((line) => resolveLine(line, itemIndex));
  const hasBlocked = resolved.some((r) => r.blocked);
  const total = cartTotal(cart, itemIndex);

  return (
    <BottomSheet open onClose={onClose} title={t('cart.title')}>
      {cart.lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          {t('cart.empty')}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {cart.lines.map((line, i) => {
              const r = resolved[i];
              return (
                <li
                  key={`${line.itemId}-${line.variantKey}-${i}`}
                  data-testid={`cart-line-${i}`}
                  className={`rounded-xl p-3 ${
                    r.blocked ? 'bg-danger/5' : 'bg-ink/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {r.name || '—'}
                        {r.optionName ? (
                          <span className="font-normal text-ink-soft">
                            {' '}
                            · {r.optionName}
                          </span>
                        ) : null}
                      </span>
                      {line.note ? (
                        <span className="block truncate text-xs italic text-ink-soft">
                          “{line.note}”
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {r.blocked ? null : r.included ? (
                        <span className="text-success">
                          {t('cart.included')}
                        </span>
                      ) : (
                        <span dir="ltr" className="text-ink">
                          {formatMoney(r.unitPrice * line.quantity, currency, locale)}
                        </span>
                      )}
                    </span>
                  </div>
                  {r.blocked ? (
                    <p className="mt-1 text-xs font-medium text-danger">
                      {t('cart.menuClosed')}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <div dir="ltr" className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onChange(updateQuantity(cart, i, line.quantity - 1))
                        }
                        aria-label={t('sheet.less')}
                        className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-ink/[0.06] font-semibold text-ink"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() =>
                          onChange(updateQuantity(cart, i, line.quantity + 1))
                        }
                        aria-label={t('sheet.more')}
                        className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-ink/[0.06] font-semibold text-ink"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => onChange(removeLine(cart, i))}
                      aria-label={t('cart.remove')}
                      className="pressable flex h-9 w-9 items-center justify-center rounded-full text-ink-faint"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold text-ink">
              {t('cart.total')}
            </span>
            <span dir="ltr" className="font-semibold text-ink">
              {formatMoney(total, currency, locale)}
            </span>
          </div>

          <button
            data-testid="go-checkout"
            disabled={hasBlocked || cart.lines.length === 0}
            onClick={onCheckout}
            className="pressable mt-4 min-h-[48px] w-full rounded-full bg-accent font-semibold text-accent-contrast disabled:opacity-40"
          >
            {t('cart.checkout')}
          </button>
        </>
      )}
    </BottomSheet>
  );
}

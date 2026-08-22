'use client';

import { ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { isLocale } from '@/i18n/config';
import { api, ApiError } from '@/lib/api';
import {
  addLine,
  cartStore,
  type CartLine,
  type GuestCart,
} from '@/lib/cart';
import type {
  GuestFnbCatalog,
  GuestFnbItem,
  GuestFnbMenu,
  GuestFnbOrder,
  GuestProfile,
} from '@/lib/types';
import { OPEN_FNB_ORDER_STATUSES } from '@/lib/types';
import { useGuestFnbOrders } from '@/lib/use-guest-fnb-orders';
import { useApiError } from '@/lib/errors';
import { Screen, Skeleton } from '../ui';
import { StateShell } from '../state-screens';
import { CartSheet } from './cart-sheet';
import { CheckoutSheet } from './checkout-sheet';
import { ItemSheet } from './item-sheet';
import { MenuBrowse } from './menu-browse';
import { OrderDetailSheet } from './order-detail-sheet';
import { OrderRow } from './order-row';

export interface DiningPrefill {
  location?: string;
  spot?: string;
}

/**
 * The Dining section (16.5/16.6) — browse → item sheet → cart → checkout →
 * tracking, one animated surface. The cart persists per stay (localStorage);
 * all pricing comes pre-resolved from the server for THIS guest's stay type,
 * so what renders is exactly what the order will cost.
 */
export function DiningScreen({
  profile,
  prefill,
}: {
  profile: GuestProfile;
  prefill?: DiningPrefill;
}) {
  const t = useTranslations('dining');
  const resolveError = useApiError();
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale)
    ? activeLocale
    : isLocale(profile.language)
      ? (profile.language as Locale)
      : 'en';

  const [tab, setTab] = useState<'menu' | 'orders'>('menu');
  const [catalog, setCatalog] = useState<GuestFnbCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cart, setCart] = useState<GuestCart>(() =>
    cartStore.load(profile.stayId),
  );
  const [sheetItem, setSheetItem] = useState<{
    item: GuestFnbItem;
    menu: GuestFnbMenu;
  } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { orders, error: ordersError, refresh, applyLocal } =
    useGuestFnbOrders(true);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      setCatalog(await api<GuestFnbCatalog>('/guest/fnb/menus'));
    } catch (err) {
      setCatalog(null);
      setCatalogError(
        err instanceof ApiError ? resolveError(err) : resolveError(err),
      );
    }
  }, [resolveError]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Persist every cart change (16.5 AC3 — survives restarts until ordered).
  const persist = useCallback((next: GuestCart) => {
    setCart(next);
    cartStore.save(next);
  }, []);

  // Item lookup across the catalog (cart lines render from it).
  const itemIndex = useMemo(() => {
    const map = new Map<string, { item: GuestFnbItem; menu: GuestFnbMenu }>();
    for (const menu of catalog?.menus ?? []) {
      for (const section of menu.sections) {
        for (const item of section.items) map.set(item.id, { item, menu });
      }
    }
    return map;
  }, [catalog]);

  const cartCount = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
  const activeOrders =
    orders?.filter((o) => OPEN_FNB_ORDER_STATUSES.includes(o.status)) ?? [];
  const detailOrder = orders?.find((o) => o.id === detailId) ?? null;

  function addToCart(lineToAdd: CartLine) {
    persist(addLine(cart, lineToAdd));
    setSheetItem(null);
  }

  function onPlaced(order: GuestFnbOrder) {
    persist({ stayId: profile.stayId, lines: [] });
    cartStore.clear();
    applyLocal(order);
    setCheckoutOpen(false);
    setCartOpen(false);
    setTab('orders');
    setDetailId(order.id);
  }

  return (
    <Screen>
      <div className="flex items-center justify-between pt-3">
        <h1 className="font-semibold text-xl text-ink">{t('title')}</h1>
        {/* Cart button lives in the header — always reachable. */}
        <button
          onClick={() => setCartOpen(true)}
          aria-label={t('cart.title')}
          data-testid="cart-button"
          className="pressable relative flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06]"
        >
          <ShoppingBag className="h-5 w-5 text-ink" aria-hidden />
          {cartCount > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
              {cartCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {(['menu', 'orders'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`pressable rounded-full px-4 py-2 text-sm font-semibold ${
              tab === key ? 'bg-accent text-accent-contrast' : 'bg-ink/[0.06] text-ink'
            }`}
          >
            {t(`tabs.${key}`)}
            {key === 'orders' && activeOrders.length > 0
              ? ` · ${activeOrders.length}`
              : ''}
          </button>
        ))}
      </div>

      {tab === 'menu' ? (
        catalogError ? (
          <div className="mt-8">
            <StateShell
              icon={UtensilsCrossed}
              title={t('browse.loadError')}
              body=""
            >
              <button
                onClick={() => void loadCatalog()}
                className="pressable mt-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast"
              >
                {t('browse.retry')}
              </button>
            </StateShell>
          </div>
        ) : catalog === null ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : catalog.menus.length === 0 ? (
          <div className="mt-8">
            <StateShell
              icon={UtensilsCrossed}
              title={t('browse.empty')}
              body=""
            />
          </div>
        ) : (
          <MenuBrowse
            menus={catalog.menus}
            currency={catalog.currency}
            locale={locale}
            onPick={(item, menu) => setSheetItem({ item, menu })}
          />
        )
      ) : (
        <div className="mt-6">
          {orders === null ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <StateShell
              icon={UtensilsCrossed}
              title={t('history.empty')}
              body=""
            />
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  locale={locale}
                  onOpen={() => setDetailId(order.id)}
                />
              ))}
            </ul>
          )}
          {ordersError ? (
            <p className="mt-3 text-center text-sm text-danger">
              {resolveError(ordersError)}
            </p>
          ) : null}
        </div>
      )}

      <ItemSheet
        entry={sheetItem}
        currency={catalog?.currency ?? 'EGP'}
        locale={locale}
        onClose={() => setSheetItem(null)}
        onAdd={addToCart}
      />
      <CartSheet
        open={cartOpen && !checkoutOpen}
        cart={cart}
        itemIndex={itemIndex}
        currency={catalog?.currency ?? 'EGP'}
        locale={locale}
        onClose={() => setCartOpen(false)}
        onChange={persist}
        onCheckout={() => setCheckoutOpen(true)}
      />
      {catalog ? (
        <CheckoutSheet
          open={checkoutOpen}
          profile={profile}
          catalog={catalog}
          cart={cart}
          itemIndex={itemIndex}
          locale={locale}
          prefill={prefill}
          onClose={() => setCheckoutOpen(false)}
          onPlaced={onPlaced}
        />
      ) : null}
      <OrderDetailSheet
        order={detailOrder}
        locale={locale}
        onClose={() => setDetailId(null)}
        onChanged={(row) => {
          applyLocal(row);
          void refresh();
        }}
      />
    </Screen>
  );
}

'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { formatMoney } from '@/i18n/format';
import { api } from '@/lib/api';
import type { GuestCart } from '@/lib/cart';
import { useApiError } from '@/lib/errors';
import type {
  FnbPaymentMethod,
  GuestFnbCatalog,
  GuestFnbOrder,
  GuestProfile,
} from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { usePushPrompt } from '../push/push-prompt-context';
import { Bdi } from '../ui';
import { cartTotal, type ItemIndex } from './cart-sheet';
import type { DiningPrefill } from './dining-screen';

/**
 * 16.5 AC4 + 16.4 AC2/AC3 — the checkout sheet: destination ("My room"
 * default, or a location with an optional spot; `?location`/`?spot` prefill
 * only, always editable), payment methods (single method preselected +
 * compact; a fully-included order skips payment entirely), place order →
 * optimistic success animation → tracking.
 */
export function CheckoutSheet({
  open,
  profile,
  catalog,
  cart,
  itemIndex,
  locale,
  prefill,
  onClose,
  onPlaced,
}: {
  open: boolean;
  profile: GuestProfile;
  catalog: GuestFnbCatalog;
  cart: GuestCart;
  itemIndex: ItemIndex;
  locale: Locale;
  prefill?: DiningPrefill;
  onClose: () => void;
  onPlaced: (order: GuestFnbOrder) => void;
}) {
  const t = useTranslations('dining');
  const resolveError = useApiError();
  const { maybePrompt } = usePushPrompt();

  // Prefill contract (16.5 AC6): the QR params only pre-select fields —
  // both stay editable, unknown/inactive keys fall back to "choose".
  const prefillLocation = catalog.locations.find(
    (l) => l.key === prefill?.location,
  );
  const [destination, setDestination] = useState<string>('room');
  const [spot, setSpot] = useState('');
  const [payment, setPayment] = useState<FnbPaymentMethod>('cash');
  const [placing, setPlacing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDestination(prefillLocation ? prefillLocation.id : 'room');
    setSpot(prefillLocation?.hasSpots && prefill?.spot ? prefill.spot : '');
    setPayment(catalog.paymentMethods[0] ?? 'cash');
    setConfirmed(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const total = cartTotal(cart, itemIndex);
  const fullyIncluded = total === 0;
  const location = catalog.locations.find((l) => l.id === destination) ?? null;
  const singleMethod = catalog.paymentMethods.length === 1;

  async function place() {
    setPlacing(true);
    setError(null);
    try {
      const order = await api<GuestFnbOrder>('/guest/fnb/orders', {
        method: 'POST',
        body: JSON.stringify({
          lines: cart.lines.map((line) => ({
            itemId: line.itemId,
            ...(line.variantKey ? { variantKey: line.variantKey } : {}),
            quantity: line.quantity,
            ...(line.note ? { note: line.note } : {}),
          })),
          destination:
            destination === 'room'
              ? { type: 'room' }
              : {
                  type: 'location',
                  locationId: destination,
                  ...(location?.hasSpots && spot.trim()
                    ? { spot: spot.trim() }
                    : {}),
                },
          ...(fullyIncluded ? {} : { paymentMethod: payment }),
        }),
      });
      // 16.5 AC4 — optimistic success beat (submit-sheet 1100ms pattern),
      // then straight to tracking. The push pre-prompt (Epic 23, Task 12,
      // 23.2 AC1 post_order moment) fires at the same handoff point, not
      // the instant the API resolves — triggering it mid-checkmark would
      // stack a second BottomSheet on top of this one's own confirmation.
      setConfirmed(true);
      setTimeout(() => {
        maybePrompt('post_order');
        onPlaced(order);
      }, 1100);
    } catch (err) {
      setError(resolveError(err));
      setPlacing(false);
    }
  }

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

  return (
    <BottomSheet open onClose={onClose} title={t('checkout.title')}>
      {/* Destination (16.5 AC4) */}
      <p className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
        {t('checkout.destination')}
      </p>
      <div className="mt-2 space-y-2">
        <DestinationOption
          selected={destination === 'room'}
          onSelect={() => setDestination('room')}
          testId="dest-room"
        >
          <Bdi>{t('checkout.myRoom', { room: profile.roomNumber })}</Bdi>
        </DestinationOption>
        {catalog.locations.map((l) => (
          <DestinationOption
            key={l.id}
            selected={destination === l.id}
            onSelect={() => setDestination(l.id)}
            testId={`dest-${l.key}`}
          >
            {l.name}
          </DestinationOption>
        ))}
      </div>
      {location?.hasSpots ? (
        <label className="mt-3 block">
          <span className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
            {location.spotLabel
              ? t('checkout.spotLabel', { label: location.spotLabel })
              : t('checkout.spotFallback')}
          </span>
          <input
            data-selectable
            data-testid="spot-input"
            dir="ltr"
            inputMode="numeric"
            value={spot}
            onChange={(e) => setSpot(e.target.value.slice(0, 10))}
            placeholder={t('checkout.spotPlaceholder')}
            className="mt-2 w-full rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </label>
      ) : null}

      {/* Payment (16.4 AC2/AC3) */}
      {fullyIncluded ? (
        <p className="mt-4 rounded-xl bg-success/10 p-3 text-sm font-medium text-success">
          {t('checkout.includedNote')}
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
            {t('checkout.payment')}
          </p>
          <div className="mt-2 space-y-2">
            {catalog.paymentMethods.map((method) => (
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
        data-testid="place-order"
        disabled={placing || cart.lines.length === 0}
        onClick={() => void place()}
        className="pressable mt-5 min-h-[48px] w-full rounded-full bg-accent font-semibold text-accent-contrast disabled:opacity-40"
      >
        {placing ? (
          t('checkout.placing')
        ) : fullyIncluded ? (
          t('checkout.place')
        ) : (
          <span dir="auto">
            {t('checkout.place')} ·{' '}
            <span dir="ltr">
              {formatMoney(total, catalog.currency, locale)}
            </span>
          </span>
        )}
      </button>
    </BottomSheet>
  );
}

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

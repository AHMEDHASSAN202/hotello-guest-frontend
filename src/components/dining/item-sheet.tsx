'use client';

/* eslint-disable @next/next/no-img-element */
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { formatMoney } from '@/i18n/format';
import { assetUrl } from '@/lib/api';
import type { CartLine } from '@/lib/cart';
import type { GuestFnbItem, GuestFnbMenu } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';

const MAX_QTY = 20;

/**
 * 16.5 AC2 — the item sheet: photo, description, variant selector (prices
 * per option or ✓Included), quantity stepper, note (when allowed), add with
 * live price feedback. Motion + press states per the Epic 14 standards.
 */
export function ItemSheet({
  entry,
  currency,
  locale,
  onClose,
  onAdd,
}: {
  entry: { item: GuestFnbItem; menu: GuestFnbMenu } | null;
  currency: string;
  locale: Locale;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const t = useTranslations('dining');
  const [quantity, setQuantity] = useState(1);
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    setQuantity(1);
    setVariantKey(entry?.item.variant?.options[0]?.key ?? null);
    setNote('');
  }, [entry]);

  if (!entry) return null;
  const { item, menu } = entry;
  const option = item.variant?.options.find((o) => o.key === variantKey);
  const unitPrice = option ? option.unitPrice : item.unitPrice;
  const included = option ? option.included : item.included;
  const total = unitPrice * quantity;
  const orderable = menu.availability.available;

  return (
    <BottomSheet open onClose={onClose} title={item.name}>
      {item.photoDetailUrl ? (
        <img
          src={assetUrl(item.photoDetailUrl) ?? undefined}
          alt=""
          className="h-44 w-full rounded-card object-cover"
        />
      ) : null}
      {item.description ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {item.description}
        </p>
      ) : null}

      {/* Variant selector (16.2 AC4 — absolute prices per option) */}
      {item.variant ? (
        <div className="mt-4">
          <p className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
            {item.variant.label}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.variant.options.map((o) => (
              <button
                key={o.key}
                onClick={() => setVariantKey(o.key)}
                aria-pressed={variantKey === o.key}
                className={`pressable rounded-full px-4 py-2 text-sm font-semibold ${
                  variantKey === o.key
                    ? 'bg-accent text-accent-contrast'
                    : 'bg-ink/[0.06] text-ink'
                }`}
              >
                {o.name}
                {!o.included ? (
                  <span dir="ltr"> · {formatMoney(o.unitPrice, currency, locale)}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Quantity stepper (submit-sheet pattern) */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
          {t('sheet.quantity')}
        </p>
        <div dir="ltr" className="flex items-center gap-3">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label={t('sheet.less')}
            className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-lg font-semibold text-ink disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center font-semibold tabular-nums text-ink">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
            disabled={quantity >= MAX_QTY}
            aria-label={t('sheet.more')}
            className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-lg font-semibold text-ink disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Note (16.2 AC5 — per-item toggle) */}
      {item.allowNotes ? (
        <label className="mt-4 block">
          <span className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
            {t('sheet.note')}
          </span>
          <textarea
            data-selectable
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder={t('sheet.notePlaceholder')}
            rows={2}
            className="mt-2 w-full rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </label>
      ) : null}

      {!orderable ? (
        <p className="mt-4 rounded-xl bg-ink/[0.05] p-3 text-sm text-ink-soft">
          {t('sheet.closedMenu', {
            time: menu.availability.opensAt ?? '—',
          })}
        </p>
      ) : null}

      <button
        data-testid="add-to-cart"
        disabled={!orderable}
        onClick={() =>
          onAdd({
            itemId: item.id,
            variantKey: option?.key ?? null,
            quantity,
            note: note.trim(),
          })
        }
        className="pressable mt-5 min-h-[48px] w-full rounded-full bg-accent font-semibold text-accent-contrast disabled:opacity-40"
      >
        {included ? (
          <>
            {t('sheet.add')} · {t('browse.included')}
          </>
        ) : (
          <span dir="auto">
            {t('sheet.addFor', {
              price: formatMoney(total, currency, locale),
            })}
          </span>
        )}
      </button>
    </BottomSheet>
  );
}

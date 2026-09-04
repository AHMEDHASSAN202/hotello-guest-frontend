'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { GuestCatalogItem, GuestRequest } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { usePushPrompt } from '../push/push-prompt-context';
import { Button } from '../ui';
import { requestIcon } from './request-icons';

/**
 * 15.2 AC3 — the submit sheet: option (quantity stepper / time picker) when
 * the item defines one, optional note, one big submit. In-flight disable is
 * the duplicate-tap protection (recorded decision); success shows a brief
 * confirmation beat before landing in "My requests".
 */
export function SubmitSheet({
  item,
  onClose,
  onSubmitted,
}: {
  item: GuestCatalogItem | null;
  onClose: () => void;
  onSubmitted: (request: GuestRequest) => void;
}) {
  const t = useTranslations('requests');
  const resolveError = useApiError();
  const { maybePrompt } = usePushPrompt();

  const [quantity, setQuantity] = useState(1);
  const [time, setTime] = useState('08:00');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<GuestRequest | null>(null);

  // Reset per item pick.
  useEffect(() => {
    setQuantity(item?.optionMin ?? 1);
    setTime('08:00');
    setNote('');
    setError(null);
    setBusy(false);
    setConfirmed(null);
  }, [item]);

  // Confirmation beat: ~1.1s of the checkmark, then hand off. The push
  // pre-prompt (Epic 23, Task 12, 23.2 AC1 post_request moment) fires here,
  // not the instant the API call resolves — triggering it mid-checkmark
  // would stack a second BottomSheet on top of this one's own confirmation.
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(() => {
      maybePrompt('post_request');
      onSubmitted(confirmed);
    }, 1100);
    return () => clearTimeout(timer);
  }, [confirmed, onSubmitted, maybePrompt]);

  if (!item) return null;
  const Icon = requestIcon(item.icon);

  async function submit() {
    if (!item || busy) return;
    setBusy(true);
    setError(null);
    try {
      const optionValue =
        item.optionType === 'quantity'
          ? String(quantity)
          : item.optionType === 'time'
            ? time
            : undefined;
      const saved = await api<GuestRequest>('/guest/requests', {
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          ...(optionValue !== undefined ? { optionValue } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      setConfirmed(saved);
    } catch (err) {
      setBusy(false);
      setError(resolveError(err instanceof ApiError ? err : new Error('')));
    }
  }

  const min = item.optionMin ?? 1;
  const max = item.optionMax ?? 9;

  return (
    <BottomSheet open onClose={busy || confirmed ? () => {} : onClose} title={item.name}>
      {confirmed ? (
        <div className="animate-fade-in flex flex-col items-center py-6 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <Check className="h-8 w-8 text-success" strokeWidth={2} aria-hidden />
          </span>
          <p className="text-[16px] font-semibold text-ink">{t('sheet.confirmed')}</p>
          <p className="mt-1 max-w-[32ch] text-[13px] text-ink-soft">
            {t('sheet.confirmedBody')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden />
            </span>
            {item.description ? (
              <p className="pt-1 text-[13px] leading-relaxed text-ink-soft">
                {item.description}
              </p>
            ) : null}
          </div>

          {item.optionType === 'quantity' ? (
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-medium text-ink">
                {t('sheet.quantity')}
              </span>
              <div className="flex items-center gap-4" dir="ltr">
                <button
                  aria-label={t('sheet.less')}
                  onClick={() => setQuantity((q) => Math.max(min, q - 1))}
                  disabled={quantity <= min}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] disabled:opacity-40"
                >
                  <Minus className="h-4 w-4 text-ink" aria-hidden />
                </button>
                <span className="w-6 text-center text-[18px] font-bold tabular-nums text-ink">
                  {quantity}
                </span>
                <button
                  aria-label={t('sheet.more')}
                  onClick={() => setQuantity((q) => Math.min(max, q + 1))}
                  disabled={quantity >= max}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4 text-ink" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}

          {item.optionType === 'time' ? (
            <label className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-medium text-ink">
                {t('sheet.time')}
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                data-selectable
                className="min-h-[44px] rounded-card border border-line bg-card px-3 text-[16px] font-semibold tabular-nums text-ink"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">
              {t('sheet.noteLabel')}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder={t('sheet.notePlaceholder')}
              rows={2}
              data-selectable
              className="w-full resize-none rounded-card border border-line bg-card p-3 text-[15px] text-ink placeholder:text-ink-faint"
            />
          </label>

          {error ? (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {error}
            </p>
          ) : null}

          <Button onClick={submit} loading={busy}>
            {busy ? t('sheet.sending') : t('sheet.submit')}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

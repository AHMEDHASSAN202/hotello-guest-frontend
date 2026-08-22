'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { isLocale, type Locale } from '@/i18n/config';
import { formatRelativeTime, formatTimeOfDay } from '@/i18n/format';
import { useApiError } from '@/lib/errors';
import type { GuestRequest } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { Button } from '../ui';

/**
 * 15.3 AC2/AC3 — the request detail: option/note, status timeline with
 * localized times, and cancel (only while `new`; afterwards a warm
 * explanation pointing at the front desk).
 */
export function RequestDetailSheet({
  request,
  language,
  onClose,
  onChanged,
}: {
  request: GuestRequest | null;
  language: string;
  onClose: () => void;
  onChanged: (request: GuestRequest) => void;
}) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');
  const resolveError = useApiError();
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale)
    ? activeLocale
    : isLocale(language)
      ? language
      : 'en';

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirming(false);
    setBusy(false);
    setError(null);
  }, [request?.id]);

  if (!request) return null;

  async function cancel() {
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<GuestRequest>(
        `/guest/requests/${request.id}/cancel`,
        { method: 'POST' },
      );
      onChanged(updated);
      onClose();
    } catch (err) {
      setBusy(false);
      setConfirming(false);
      setError(resolveError(err instanceof ApiError ? err : new Error('')));
    }
  }

  const steps: Array<{ key: string; at: string | null }> = [
    { key: 'submitted', at: request.createdAt },
    ...(request.status === 'cancelled'
      ? [{ key: 'cancelled', at: request.cancelledAt }]
      : [
          { key: 'started', at: request.startedAt },
          { key: 'completed', at: request.completedAt },
        ]),
  ];

  return (
    <BottomSheet open onClose={onClose} title={request.itemName}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
          {request.optionType === 'quantity' && request.optionValue ? (
            <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 font-medium tabular-nums">
              ×{request.optionValue}
            </span>
          ) : null}
          {request.optionType === 'time' && request.optionValue ? (
            <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 font-medium tabular-nums">
              {request.optionValue}
            </span>
          ) : null}
          <span>{formatRelativeTime(request.createdAt, locale)}</span>
        </div>

        {request.note ? (
          <div>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {t('detail.note')}
            </p>
            <p className="rounded-card bg-ink/[0.04] p-3 text-[14px] leading-relaxed text-ink">
              {request.note}
            </p>
          </div>
        ) : null}

        <ol className="flex flex-col gap-0">
          {steps.map(({ key, at }, index) => {
            const reached = at !== null;
            return (
              <li key={key} className="relative flex gap-3 pb-4 last:pb-0">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className={`absolute start-[7px] top-4 h-full w-0.5 ${
                      reached ? 'bg-accent/40' : 'bg-line'
                    }`}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                    reached
                      ? 'border-accent bg-accent'
                      : 'border-line bg-card'
                  }`}
                />
                <div className="flex flex-1 items-baseline justify-between gap-3">
                  <span
                    className={`text-[14px] font-medium ${
                      reached ? 'text-ink' : 'text-ink-faint'
                    }`}
                  >
                    {t(`detail.${key}`)}
                  </span>
                  {at ? (
                    <span className="text-[12px] tabular-nums text-ink-faint">
                      {formatTimeOfDay(at, locale)}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        {request.status === 'new' ? (
          confirming ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-[14px] font-medium text-ink">
                {t('detail.cancelConfirm')}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  {t('detail.cancelKeep')}
                </Button>
                <Button onClick={cancel} loading={busy}>
                  {t('detail.cancelYes')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              {t('detail.cancel')}
            </Button>
          )
        ) : request.status === 'in_progress' ? (
          <p className="text-center text-[13px] leading-relaxed text-ink-faint">
            {t('detail.noCancel')}{' '}
            <span className="font-medium text-accent">{tc('contactFrontDesk')}</span>
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

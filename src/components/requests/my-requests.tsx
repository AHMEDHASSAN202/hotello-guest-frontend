'use client';

import { ChevronDown, ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { ApiError } from '@/lib/api';
import { useLocale } from 'next-intl';
import { formatRelativeTime } from '@/i18n/format';
import { isLocale, type Locale } from '@/i18n/config';
import type { GuestRequest, GuestRequestStatus } from '@/lib/types';
import { Button, Skeleton } from '../ui';
import { requestIcon } from './request-icons';

const OPEN_STATUSES: GuestRequestStatus[] = ['new', 'in_progress'];

/**
 * 15.3 AC1 — active list with status chips + collapsed history. Rows re-key
 * on status so transitions fade in subtly. Ages tick every 30s.
 */
export function MyRequests({
  requests,
  language,
  error,
  onOpen,
  onRetry,
  onOrder,
}: {
  requests: GuestRequest[] | null;
  language: string;
  error: ApiError | null;
  onOpen: (request: GuestRequest) => void;
  onRetry: () => void;
  onOrder: () => void;
}) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale)
    ? activeLocale
    : isLocale(language)
      ? language
      : 'en';

  const [historyOpen, setHistoryOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (requests === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div className="pt-10 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <ClipboardList className="h-7 w-7 text-accent" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="mb-2 text-lg font-semibold text-ink">{t('mine.emptyTitle')}</h2>
        <p className="mx-auto mb-6 max-w-[34ch] text-[15px] leading-relaxed text-ink-soft">
          {t('mine.emptyBody')}
        </p>
        <Button onClick={onOrder} className="mx-auto max-w-[240px]">
          {t('mine.orderCta')}
        </Button>
        {error ? (
          <button onClick={onRetry} className="mt-4 text-[13px] font-medium text-accent">
            {tc('retry')}
          </button>
        ) : null}
      </div>
    );
  }

  const active = requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const history = requests.filter((r) => !OPEN_STATUSES.includes(r.status));

  return (
    <div className="flex flex-col gap-3">
      {active.map((request) => (
        <RequestRow
          key={`${request.id}-${request.status}`}
          request={request}
          locale={locale}
          now={now}
          onOpen={onOpen}
        />
      ))}

      {history.length > 0 ? (
        <div className="mt-2">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="pressable flex min-h-[44px] w-full items-center justify-between text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
          >
            {t('mine.history', { count: history.length })}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {historyOpen ? (
            <div className="animate-fade-in mt-2 flex flex-col gap-3">
              {history.map((request) => (
                <RequestRow
                  key={`${request.id}-${request.status}`}
                  request={request}
                  locale={locale}
                  now={now}
                  onOpen={onOpen}
                  muted
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_STYLES: Record<GuestRequestStatus, string> = {
  new: 'bg-accent-soft text-accent',
  in_progress: 'bg-accent text-accent-contrast',
  done: 'bg-success/10 text-success',
  cancelled: 'bg-ink/[0.06] text-ink-faint',
};

function RequestRow({
  request,
  locale,
  now,
  onOpen,
  muted = false,
}: {
  request: GuestRequest;
  locale: Locale;
  now: Date;
  onOpen: (request: GuestRequest) => void;
  muted?: boolean;
}) {
  const t = useTranslations('requests');
  const Icon = requestIcon(request.icon);
  return (
    <button
      data-testid={`request-row-${request.id}`}
      onClick={() => onOpen(request)}
      className={`pressable animate-fade-in flex w-full items-center gap-3 rounded-card bg-card p-4 text-start shadow-card ${
        muted ? 'opacity-75' : ''
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">
          {request.itemName}
          {request.optionType === 'quantity' && request.optionValue
            ? ` ×${request.optionValue}`
            : ''}
          {request.optionType === 'time' && request.optionValue
            ? ` · ${request.optionValue}`
            : ''}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-faint">
          {formatRelativeTime(request.createdAt, locale, now)}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[request.status]}`}
      >
        {t(`status.${request.status}`)}
      </span>
    </button>
  );
}

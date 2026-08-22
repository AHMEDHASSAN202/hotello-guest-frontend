'use client';

import {
  CloudOff,
  Hourglass,
  MapPinOff,
  Moon,
  Sparkles,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { formatCountdown } from '@/i18n/format';
import { Button, Screen } from './ui';

/**
 * Guest-facing dead ends (14.6): every one warm, branded, in the guest's
 * language, with the one action that helps. Copy NEVER mentions internal
 * concepts (trial, subscription, session, 401) — enforced by test.
 */

/** One illustration treatment for the whole family: a soft accent medallion. */
function Medallion({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-accent-soft" aria-hidden />
      <div
        className="absolute inset-2 rounded-full border border-dashed border-accent/25"
        aria-hidden
      />
      <Icon className="relative h-11 w-11 text-accent" strokeWidth={1.5} aria-hidden />
    </div>
  );
}

export function StateShell({
  icon,
  title,
  body,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <Screen className="items-center justify-center text-center">
      <Medallion icon={icon} />
      <h1 className="mb-2 text-xl font-semibold text-ink">{title}</h1>
      <p className="mb-6 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">{body}</p>
      {hint ? <p className="mb-4 text-[13px] font-medium text-accent">{hint}</p> : null}
      {children}
    </Screen>
  );
}

export function OfflineScreen({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations('states');
  const tc = useTranslations('common');
  return (
    <StateShell icon={WifiOff} title={t('offline.title')} body={t('offline.body')}>
      {onRetry ? (
        <Button onClick={onRetry} className="max-w-[240px]">
          {tc('retry')}
        </Button>
      ) : null}
    </StateShell>
  );
}

export function HotelNotFoundScreen() {
  const t = useTranslations('states');
  const tc = useTranslations('common');
  return (
    <StateShell
      icon={MapPinOff}
      title={t('notFound.title')}
      body={t('notFound.body')}
      hint={tc('contactFrontDesk')}
    />
  );
}

export function UnavailableScreen({ hotelName }: { hotelName?: string }) {
  const t = useTranslations('states');
  const tc = useTranslations('common');
  return (
    <Screen className="items-center justify-center text-center">
      {hotelName ? (
        <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          {hotelName}
        </p>
      ) : null}
      <Medallion icon={Moon} />
      <h1 className="mb-2 text-xl font-semibold text-ink">{t('unavailable.title')}</h1>
      <p className="mb-6 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">
        {t('unavailable.body')}
      </p>
      <p className="text-[13px] font-medium text-accent">{tc('contactFrontDesk')}</p>
    </Screen>
  );
}

/** Warm goodbye (14.2 AC5) — no error-red anywhere; entry form beneath. */
export function GoodbyeScreen({ children }: { children?: ReactNode }) {
  const t = useTranslations('states');
  return (
    <Screen>
      <div className="pt-10 text-center">
        <Medallion icon={Sparkles} />
        <h1 className="mb-2 text-xl font-semibold text-ink">{t('goodbye.title')}</h1>
        <p className="mx-auto mb-8 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">
          {t('goodbye.body')}
        </p>
      </div>
      {children}
    </Screen>
  );
}

/** Friendly lockout with a live countdown (14.2 AC3). */
export function RateLimitedScreen({
  retryAfterSeconds,
  onExpired,
}: {
  retryAfterSeconds: number;
  onExpired: () => void;
}) {
  const t = useTranslations('states');
  const [remaining, setRemaining] = useState(retryAfterSeconds);

  useEffect(() => {
    setRemaining(retryAfterSeconds);
    const timer = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (remaining === 0) onExpired();
  }, [remaining, onExpired]);

  return (
    <StateShell
      icon={Hourglass}
      title={t('rateLimited.title')}
      body={t('rateLimited.body', { time: formatCountdown(remaining) })}
    >
      <p
        role="timer"
        aria-live="polite"
        className="text-3xl font-semibold tabular-nums tracking-wider text-accent"
        dir="ltr"
      >
        {formatCountdown(remaining)}
      </p>
    </StateShell>
  );
}

export function GenericErrorScreen({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('states');
  const tc = useTranslations('common');
  return (
    <StateShell icon={CloudOff} title={t('error.title')} body={t('error.body')}>
      <Button onClick={onRetry} className="max-w-[240px]">
        {tc('retry')}
      </Button>
    </StateShell>
  );
}

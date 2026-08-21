'use client';

/* eslint-disable @next/next/no-img-element */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useHotel } from '@/components/hotel-provider';
import { api, ApiError, assetUrl } from '@/lib/api';
import type { GuestSessionResponse } from '@/lib/types';
import { CodeInput } from './code-input';
import { LanguageSwitcher } from './language-switcher';
import {
  OfflineScreen,
  RateLimitedScreen,
  UnavailableScreen,
} from './state-screens';
import { Bdi, Screen } from './ui';

type EntryPhase =
  | { kind: 'form' }
  | { kind: 'lockout'; retryAfterSeconds: number }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

/**
 * Entry (14.2): room + code, or code-only when the QR carried `?room=`.
 * Errors animate in place — this screen never navigates away, and the room
 * field survives every failure.
 */
export function EntryScreen({
  slug,
  initialRoom = '',
  roomLocked = false,
  compact = false,
  onEnter,
}: {
  slug: string;
  initialRoom?: string;
  /** AC1 — `?room=` pre-fills AND locks the room; code input only. */
  roomLocked?: boolean;
  /** Rendered beneath the goodbye message — no header block. */
  compact?: boolean;
  onEnter: (session: GuestSessionResponse) => void;
}) {
  const t = useTranslations('entry');
  const tc = useTranslations('common');
  const { hotel, hotelName } = useHotel();
  const [phase, setPhase] = useState<EntryPhase>({ kind: 'form' });
  const [room, setRoom] = useState(initialRoom);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const logo = assetUrl(hotel.logoUrl);

  async function submit(fullCode: string) {
    if (!room.trim() || submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const session = await api<GuestSessionResponse>(`/guest/${slug}/session`, {
        method: 'POST',
        body: JSON.stringify({ roomNumber: room.trim(), code: fullCode }),
      });
      onEnter(session);
    } catch (err) {
      setCode(''); // the code clears; the room NEVER does (AC2)
      if (err instanceof ApiError) {
        if (err.code === 'TOO_MANY_ATTEMPTS') {
          setPhase({ kind: 'lockout', retryAfterSeconds: err.retryAfterSeconds ?? 60 });
        } else if (err.code === 'HOTEL_UNAVAILABLE' || err.code === 'HOTEL_NOT_FOUND') {
          setPhase({ kind: 'unavailable' });
        } else if (err.code === 'NETWORK') {
          setPhase({ kind: 'offline' });
        } else if (err.code === 'INVALID_CODE') {
          setErrorKey('errors.INVALID_CODE');
        } else {
          setErrorKey('errors.generic');
        }
      } else {
        setErrorKey('errors.generic');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (phase.kind === 'lockout') {
    return (
      <RateLimitedScreen
        retryAfterSeconds={phase.retryAfterSeconds}
        onExpired={() => setPhase({ kind: 'form' })}
      />
    );
  }
  if (phase.kind === 'offline') {
    return <OfflineScreen onRetry={() => setPhase({ kind: 'form' })} />;
  }
  if (phase.kind === 'unavailable') {
    return <UnavailableScreen hotelName={hotelName} />;
  }

  const form = (
    <form
      aria-label="entry-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) submit(code);
      }}
      className="flex flex-col gap-5"
    >
      {roomLocked ? (
        // AC1: `?room=` locks the room — code input only, room shown as a chip.
        <div className="mx-auto flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-[14px] font-semibold text-ink">
          <span className="font-normal text-ink-soft">{t('roomLabel')}</span>
          <Bdi>{room}</Bdi>
        </div>
      ) : (
        <div>
          <label htmlFor="room" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
            {t('roomLabel')}
          </label>
          <input
            id="room"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('roomPlaceholder')}
            dir="ltr"
            className="h-14 w-full rounded-xl border-2 border-line bg-card px-4 text-center text-xl font-semibold tabular-nums text-ink placeholder:text-[15px] placeholder:font-normal placeholder:text-ink-faint focus:border-accent"
          />
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{t('codeLabel')}</span>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (errorKey) setErrorKey(null);
          }}
          onComplete={submit}
          error={Boolean(errorKey)}
          disabled={submitting}
        />
        <p
          role={errorKey ? 'alert' : undefined}
          className={`mt-2 min-h-5 text-center text-[13px] ${
            errorKey ? 'text-danger' : 'text-ink-faint'
          }`}
        >
          {submitting ? t('checking') : errorKey ? t(errorKey) : t('codeHint')}
        </p>
      </div>
    </form>
  );

  if (compact) return form;

  return (
    <Screen>
      <div className="flex justify-end pt-3">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col justify-center pb-16">
        <div className="mb-10 text-center">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="mx-auto mb-4 h-16 w-16 rounded-2xl object-contain"
            />
          ) : null}
          <h1 className="mb-1 text-2xl font-bold text-ink">
            {t('title', { hotel: hotelName })}
          </h1>
          <p className="text-[15px] text-ink-soft">{t('subtitle')}</p>
        </div>
        {form}
      </div>
      <p className="pb-2 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint">
        {tc('poweredBy')}
      </p>
    </Screen>
  );
}

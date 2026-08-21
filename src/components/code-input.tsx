'use client';

import { useEffect, useRef } from 'react';

const CODE_LENGTH = 6;

/**
 * Segmented 6-digit code entry (14.2 AC2). One REAL invisible input stretched
 * over six presentational boxes: native numeric keyboard, native paste, iOS
 * one-time-code autofill and screen-reader focus all come free — the boxes
 * are pure presentation. Auto-submits on the 6th digit via onComplete.
 * Digits render LTR in every locale (14.3 AC4).
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
}: {
  value: string;
  onChange: (digits: string) => void;
  onComplete: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
}) {
  const completedFor = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === CODE_LENGTH && completedFor.current !== value) {
      completedFor.current = value;
      onComplete(value);
    }
    if (value.length < CODE_LENGTH) completedFor.current = null;
  }, [value, onComplete]);

  return (
    <div className="relative">
      <div
        data-testid="code-boxes"
        dir="ltr"
        aria-hidden
        className={`flex justify-center gap-2 ${error ? 'animate-shake' : ''}`}
      >
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const filled = i < value.length;
          const active = i === value.length && !disabled;
          return (
            <div
              key={i}
              data-testid="code-box"
              className={`flex h-14 w-11 items-center justify-center rounded-xl border-2 bg-card text-xl font-semibold tabular-nums text-ink transition-colors ${
                error
                  ? 'border-danger/60'
                  : active
                    ? 'border-accent'
                    : filled
                      ? 'border-ink/25'
                      : 'border-line'
              }`}
            >
              {value[i] ?? ''}
            </div>
          );
        })}
      </div>
      <input
        aria-label="code-input"
        aria-invalid={error || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        dir="ltr"
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  );
}

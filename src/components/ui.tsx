'use client';

import { type ReactNode } from 'react';

/** Bidi isolation for room numbers, codes, names inside RTL text (14.3 AC4). */
export function Bdi({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <bdi className={`[unicode-bidi:isolate] ${className}`} dir="ltr">
      {children}
    </bdi>
  );
}

/**
 * The one button. Pressed state within 100ms on every variant (14.5 AC2),
 * ≥44px hit target (14.5 AC3), no browser focus ring (custom in globals.css).
 */
export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  loading?: boolean;
}) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-contrast shadow-card'
      : 'bg-transparent text-ink';
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`pressable inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-card px-6 text-[15px] font-semibold disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The one switch (Epic 20, 20.4) — an instant-apply toggle, not a form
 * control. ≥44×44px hit target around a 48×28 track (14.5 AC3), pressed
 * state (.pressable), accent track when on. RTL-safe: the thumb sits at the
 * flex start of the track (right edge in RTL) and travels toward the end via
 * `rtl:-translate-x-5`, so it moves left-to-right in LTR and right-to-left
 * in RTL without any physical left/right classes.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  className = '',
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...rest}
      className={`pressable flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-12 items-center rounded-full px-1 transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-card shadow-card transition-transform duration-200 ${
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

/** Skeletons for every loading state — never spinners alone (14.5 AC2). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-card bg-ink/[0.06] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent ${className}`}
    />
  );
}

/**
 * A guest "screen" — one state of the client state machine. Animates in
 * (200–300ms slide+fade, vertical so RTL needs no mirroring) and reserves
 * safe areas + the bottom-nav slot (14.5 AC3).
 */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`animate-screen-in flex min-h-dvh flex-col px-5 pt-safe pb-safe ${className}`}>
      {children}
    </div>
  );
}

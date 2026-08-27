'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

/**
 * Epic 17 — tap-to-copy with a copied-feedback beat (the temp-password
 * pattern, guest-styled: ≥44px target, pressable, aria-live announcement).
 */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — nothing to show.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? t('copy')}
      className="pressable inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-2 text-xs font-semibold text-ink-soft"
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
    </button>
  );
}

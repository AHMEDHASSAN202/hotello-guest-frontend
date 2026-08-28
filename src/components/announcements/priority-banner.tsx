'use client';

import { Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GuestAnnouncement } from '@/lib/types';

/**
 * 19.4 AC3 — the most recent UNREAD priority announcement as a dismissible
 * strip on home. Dismiss = mark read; tapping the body opens the inbox on
 * that item. Non-priority items rely on the bell.
 */
export function PriorityBanner({
  announcement,
  onOpen,
  onDismiss,
}: {
  announcement: GuestAnnouncement;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations('announcements');
  return (
    <div
      data-testid="priority-banner"
      className="animate-fade-in flex items-stretch gap-1 rounded-2xl bg-accent-soft p-1"
    >
      <button
        type="button"
        data-testid="priority-banner-open"
        onClick={onOpen}
        className="pressable flex min-h-[44px] flex-1 items-center gap-3 rounded-xl px-3 py-2 text-start"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast">
          <Megaphone className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
            {t('priority')}
          </span>
          <span className="block truncate text-[14px] font-semibold text-ink">
            {announcement.title}
          </span>
        </span>
      </button>
      <button
        type="button"
        data-testid="priority-banner-dismiss"
        aria-label={t('banner.dismiss')}
        onClick={onDismiss}
        className="pressable flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-faint"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

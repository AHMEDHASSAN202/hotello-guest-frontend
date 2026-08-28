'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * 19.4 AC1 — the header bell. Same pill language as the LanguageSwitcher;
 * the badge copies the requests-tab count pill. Rendered only when the
 * announcements module is enabled (AC4 — parent decides, never this file).
 */
export function AnnouncementsBell({
  unreadCount,
  onOpen,
  onCover = false,
}: {
  unreadCount: number;
  onOpen: () => void;
  /** True inside the cover-photo header — needs the translucent treatment. */
  onCover?: boolean;
}) {
  const t = useTranslations('announcements');
  return (
    <button
      type="button"
      data-testid="announcements-bell"
      aria-label={t('bell')}
      onClick={onOpen}
      className={`pressable relative inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-full ${
        onCover
          ? 'bg-white/20 text-white backdrop-blur'
          : 'bg-card/80 text-ink-soft shadow-card backdrop-blur'
      }`}
    >
      <Bell className="h-5 w-5" strokeWidth={1.75} />
      {unreadCount > 0 ? (
        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

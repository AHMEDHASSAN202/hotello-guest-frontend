'use client';

import { Compass, ConciergeBell, House, UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** 'announcements' is reached from the header bell, never a nav slot (19.4). */
export type GuestSection = 'home' | 'requests' | 'dining' | 'info' | 'announcements';

/**
 * The bottom nav (14.5 AC3, activated by Epic 15) — exists only once a
 * second section is live, so it renders exactly two slots today. Fixed to
 * the app frame (max-w mirrors #app-frame), safe-area padded, no labels
 * hidden: icon + label per slot, ≥44px targets.
 */
export function BottomNav({
  section,
  onSelect,
  requestsLive = true,
  diningLive = false,
  infoLive = false,
}: {
  section: GuestSection;
  onSelect: (section: GuestSection) => void;
  requestsLive?: boolean;
  diningLive?: boolean;
  infoLive?: boolean;
}) {
  const t = useTranslations('requests');
  const tDining = useTranslations('dining');
  const tInfo = useTranslations('info');
  const slots: Array<{
    key: GuestSection;
    icon: typeof House;
    label: string;
  }> = [
    { key: 'home', icon: House, label: t('nav.home') },
    ...(requestsLive
      ? [{ key: 'requests' as const, icon: ConciergeBell, label: t('nav.requests') }]
      : []),
    ...(diningLive
      ? [{ key: 'dining' as const, icon: UtensilsCrossed, label: tDining('title') }]
      : []),
    ...(infoLive
      ? [{ key: 'info' as const, icon: Compass, label: tInfo('title') }]
      : []),
  ];
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-line bg-card/95 pb-safe backdrop-blur"
    >
      <ul className="flex">
        {slots.map(({ key, icon: Icon, label }) => {
          const current = section === key;
          return (
            <li key={key} className="flex-1">
              <button
                onClick={() => onSelect(key)}
                aria-current={current ? 'page' : undefined}
                className="pressable flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5"
              >
                <Icon
                  className={`h-5 w-5 ${current ? 'text-accent' : 'text-ink-faint'}`}
                  strokeWidth={current ? 2 : 1.75}
                  aria-hidden
                />
                <span
                  className={`text-[11px] font-semibold ${
                    current ? 'text-accent' : 'text-ink-faint'
                  }`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

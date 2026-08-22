'use client';

import { useTranslations } from 'next-intl';
import type { GuestCatalogCategory, GuestCatalogItem } from '@/lib/types';
import { requestIcon } from './request-icons';

/**
 * 15.2 AC2 — categories → items, everything already in the guest's language
 * (server-localized). The three-tap promise: tile → item → submit.
 */
export function CatalogBrowse({
  categories,
  onPick,
}: {
  categories: GuestCatalogCategory[];
  onPick: (item: GuestCatalogItem) => void;
}) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');

  // 15.2 AC6 — everything disabled: warm hand-off, never a dead end.
  if (categories.length === 0) {
    return (
      <div className="pt-10 text-center">
        <h2 className="mb-2 text-lg font-semibold text-ink">
          {t('browse.emptyTitle')}
        </h2>
        <p className="mx-auto mb-4 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">
          {t('browse.emptyBody')}
        </p>
        <p className="text-[13px] font-medium text-accent">
          {tc('contactFrontDesk')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {categories.map((category) => (
        <section key={category.id}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">
            {category.name}
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {category.items.map((item) => {
              const Icon = requestIcon(item.icon);
              return (
                <li key={item.id}>
                  <button
                    data-testid={`catalog-item-${item.id}`}
                    onClick={() => onPick(item)}
                    className="pressable flex h-28 w-full flex-col items-start justify-between rounded-card bg-card p-4 text-start shadow-card"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
                      <Icon
                        className="h-5 w-5 text-accent"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </span>
                    <span className="text-[14px] font-semibold leading-tight text-ink">
                      {item.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

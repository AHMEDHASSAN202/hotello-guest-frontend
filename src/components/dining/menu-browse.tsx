'use client';

/* eslint-disable @next/next/no-img-element */
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatMoney } from '@/i18n/format';
import { assetUrl } from '@/lib/api';
import type { GuestFnbItem, GuestFnbMenu } from '@/lib/types';

/**
 * 16.5 AC1 — the menu browser: availability-aware menus (closed ones stay
 * browsable, marked with their opening time), items with photos, prices or
 * ✓Included, in the guest's language (server-localized).
 */
export function MenuBrowse({
  menus,
  currency,
  locale,
  onPick,
}: {
  menus: GuestFnbMenu[];
  currency: string;
  locale: Locale;
  onPick: (item: GuestFnbItem, menu: GuestFnbMenu) => void;
}) {
  const t = useTranslations('dining');

  return (
    <div className="mt-6 space-y-8">
      {menus.map((menu) => (
        <section key={menu.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-lg text-ink">{menu.name}</h2>
            {!menu.availability.available ? (
              <span className="flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-semibold text-ink-soft">
                <Clock className="h-3 w-3" aria-hidden />
                {menu.availability.opensAt
                  ? t('browse.opensAt', { time: menu.availability.opensAt })
                  : t('browse.closed')}
              </span>
            ) : null}
          </div>
          {menu.description ? (
            <p className="mt-0.5 text-sm text-ink-soft">{menu.description}</p>
          ) : null}

          {menu.sections.map((section) => (
            <div key={section.id} className="mt-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
                {section.name}
              </h3>
              <ul className="mt-2 space-y-2">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      data-testid={`fnb-item-${item.id}`}
                      onClick={() => onPick(item, menu)}
                      className="pressable flex w-full items-center gap-3 rounded-card bg-card p-3 text-start shadow-card"
                    >
                      {item.photoThumbUrl ? (
                        <img
                          src={assetUrl(item.photoThumbUrl) ?? undefined}
                          alt=""
                          loading="lazy"
                          className="h-16 w-20 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg"
                        >
                          🍽
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">
                          {item.name}
                        </span>
                        {item.description ? (
                          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink-soft">
                            {item.description}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-sm font-semibold">
                          {item.included ? (
                            <span className="text-success">
                              {t('browse.included')}
                            </span>
                          ) : item.variant ? (
                            <span className="text-ink" dir="ltr">
                              {t('browse.from', {
                                price: formatMoney(
                                  item.unitPrice,
                                  currency,
                                  locale,
                                ),
                              })}
                            </span>
                          ) : (
                            <span className="text-ink" dir="ltr">
                              {formatMoney(item.unitPrice, currency, locale)}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

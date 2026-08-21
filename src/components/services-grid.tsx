'use client';

import { useTranslations } from 'next-intl';
import { useHotel } from '@/components/hotel-provider';
import { visibleTiles } from '@/lib/tiles';

/**
 * The services grid (14.4 AC3): visible ambition, disabled interaction. One
 * tasteful "soon" treatment — full-color icon art on an accent-soft medallion,
 * a quiet chip, no gray sadness. Tiles are plan-gated via enabledModules.
 */
export function ServicesGrid() {
  const t = useTranslations('home');
  const { hotel } = useHotel();
  const tiles = visibleTiles(hotel.enabledModules);

  if (tiles.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold text-ink">{t('services.title')}</h2>
      <ul className="grid grid-cols-2 gap-3">
        {tiles.map(({ key, icon: Icon, live }) => (
          <li key={key}>
            <div
              data-testid={`tile-${key}`}
              role={live ? 'button' : undefined}
              aria-disabled={live ? undefined : 'true'}
              className={`relative flex h-28 flex-col items-start justify-between rounded-card bg-card p-4 shadow-card ${
                live ? 'pressable cursor-pointer' : ''
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
                <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-[14px] font-semibold text-ink">{t(`tiles.${key}`)}</span>
              {!live ? (
                <span className="absolute end-3 top-3 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                  {t('services.soon')}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

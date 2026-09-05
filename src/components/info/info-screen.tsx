'use client';

import {
  Clock,
  Compass,
  ConciergeBell,
  Dumbbell,
  KeyRound,
  MapPin,
  MessageCircle,
  Phone,
  ScrollText,
  Siren,
  Wifi,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, assetUrl } from '@/lib/api';
import { availability, hotelLocalMinutes } from '@/lib/hours';
import type { GuestHotelInfo, GuestInfoFacility } from '@/lib/types';
import { BottomSheet } from '../bottom-sheet';
import { CopyButton } from '../copy-button';
import { useHotel } from '../hotel-provider';
import { OfflineScreen, StateShell } from '../state-screens';
import { Bdi, Screen, Skeleton } from '../ui';

/**
 * Epic 17, Story 17.2 — the guest directory: guests' most-opened reference
 * page. Essentials pinned first with the pixel-polish treatment (AC5);
 * "Open now" badges are computed client-side from the raw windows in
 * hotel-local time and refreshed on a 30s tick.
 */
export function InfoScreen({
  initialEntryId = null,
}: {
  /** Epic 19 — announcement chip deep-link: scroll to this entry on load. */
  initialEntryId?: string | null;
} = {}) {
  const t = useTranslations('info');
  const tCommon = useTranslations('common');
  const { hotel } = useHotel();
  const router = useRouter();

  const [info, setInfo] = useState<GuestHotelInfo | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setInfo(await api<GuestHotelInfo>('/guest/hotel-info'));
    } catch (err) {
      setError(err as ApiError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live badges: re-render every 30s so "Open now" flips on time (AC2).
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Announcement chip deep-link (19.4 AC2): once content is in, scroll to
  // the linked entry. A dangling id is a silent no-op.
  useEffect(() => {
    if (!info || !initialEntryId || typeof document === 'undefined') return;
    document
      .getElementById(`info-entry-${initialEntryId}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [info, initialEntryId]);

  // Module disabled mid-stay: warm screen + one server-layout refresh so the
  // tile lands back on "soon" (the Epic 15 pattern).
  const moduleGone =
    !!error &&
    (error.code === 'MODULE_NOT_ENABLED' || error.code === 'HOTEL_UNAVAILABLE');
  const refreshed = useRef(false);
  useEffect(() => {
    if (moduleGone && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [moduleGone, router]);

  if (moduleGone) {
    return (
      <StateShell icon={Compass} title={t('soon.title')} body={t('soon.body')} />
    );
  }
  if (error && error.code === 'NETWORK') {
    return <OfflineScreen onRetry={load} />;
  }
  if (error) {
    return (
      <StateShell icon={Compass} title={t('error.title')} body={t('error.body')}>
        <button onClick={() => void load()} className="pressable mt-4 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast">
          {tCommon('retry')}
        </button>
      </StateShell>
    );
  }
  if (info === null) {
    return (
      <Screen>
        <h1 className="pt-4 text-xl font-bold text-ink">{t('title')}</h1>
        <div className="mt-5 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Screen>
    );
  }

  const empty =
    !info.essentials &&
    info.facilities.length === 0 &&
    info.services.length === 0 &&
    info.houseRules.length === 0 &&
    !info.about;
  if (empty) {
    // A live tile means content existed 60s ago — defensive only.
    return (
      <StateShell icon={Compass} title={t('empty.title')} body={t('empty.body')} />
    );
  }

  const minutes = hotelLocalMinutes(hotel.timezone);

  return (
    <Screen>
      <h1 className="pt-4 text-xl font-bold text-ink">{t('title')}</h1>
      <div className="mt-5 space-y-4 pb-6">
        {info.essentials ? <Essentials data={info.essentials} /> : null}

        {info.facilities.length > 0 ? (
          <section>
            <SectionTitle icon={Dumbbell} label={t('sections.facilities')} />
            <div className="space-y-3">
              {info.facilities.map((facility) => (
                <div key={facility.id} id={`info-entry-${facility.id}`}>
                  <FacilityCard
                    facility={facility}
                    minutes={minutes}
                    openNow={t('openNow')}
                    opensAt={(time) => t('opensAt', { time })}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {info.services.length > 0 ? (
          <section>
            <SectionTitle icon={ConciergeBell} label={t('sections.services')} />
            <div className="space-y-3">
              {info.services.map((service) => (
                <article
                  key={service.id}
                  id={`info-entry-${service.id}`}
                  className="rounded-card bg-card p-4 shadow-card"
                >
                  <h3 className="text-[15px] font-semibold text-ink">{service.name}</h3>
                  {service.description ? (
                    <p className="mt-1 text-sm text-ink-soft">{service.description}</p>
                  ) : null}
                  {service.howTo ? (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
                      <ConciergeBell className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <span>{service.howTo}</span>
                    </p>
                  ) : null}
                  {service.priceNote ? (
                    <p className="mt-1.5 text-xs font-semibold text-ink-soft">{service.priceNote}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {info.houseRules.length > 0 ? (
          <section>
            <SectionTitle icon={ScrollText} label={t('sections.houseRules')} />
            <div className="rounded-card bg-card p-4 shadow-card">
              <ul className="space-y-3">
                {info.houseRules.map((rule) => (
                  <li key={rule.id} id={`info-entry-${rule.id}`}>
                    <p className="text-[14px] font-semibold text-ink">{rule.name}</p>
                    {rule.description ? (
                      <p className="mt-0.5 text-sm text-ink-soft">{rule.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {info.about ? (
          <section>
            <SectionTitle icon={Compass} label={t('sections.about')} />
            <div className="rounded-card bg-card p-4 shadow-card">
              {info.about.text
                ? info.about.text.split(/\n{2,}/).map((paragraph, i) => (
                    <p key={i} className="mb-3 text-sm leading-relaxed text-ink last:mb-0">
                      {paragraph}
                    </p>
                  ))
                : null}
              {info.about.gallery.length > 0 ? (
                <div className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
                  {info.about.gallery.map((item) => (
                    <button
                      key={item.thumbUrl}
                      type="button"
                      onClick={() => setPhoto(assetUrl(item.detailUrl))}
                      className="pressable shrink-0 snap-start"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={assetUrl(item.thumbUrl) ?? undefined}
                        alt=""
                        loading="lazy"
                        className="h-24 w-32 rounded-xl object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <BottomSheet open={photo !== null} onClose={() => setPhoto(null)} title={t('sections.about')}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="max-h-[70vh] w-full rounded-xl object-contain" />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof Compass; label: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
      <Icon className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden />
      {label}
    </h2>
  );
}

/** AC2/AC5 — the pinned, pixel-polished Essentials card. */
function Essentials({
  data,
}: {
  data: NonNullable<GuestHotelInfo['essentials']>;
}) {
  const t = useTranslations('info');
  return (
    <section className="rounded-card bg-accent-soft p-4 shadow-card">
      <h2 className="mb-3 text-[15px] font-semibold text-ink">
        {t('essentials.title')}
      </h2>
      <div className="space-y-1">
        {data.wifiName ? (
          <EssentialRow icon={Wifi} label={t('essentials.wifi')}>
            <span data-selectable>
              <Bdi className="font-mono text-sm font-semibold text-ink">
                {data.wifiName}
              </Bdi>
            </span>
          </EssentialRow>
        ) : null}
        {data.wifiPassword ? (
          <EssentialRow icon={KeyRound} label={t('essentials.wifiPassword')}>
            <span className="flex items-center gap-2">
              <span data-selectable>
                <Bdi className="font-mono text-sm font-semibold text-ink">
                  {data.wifiPassword}
                </Bdi>
              </span>
              <CopyButton value={data.wifiPassword} />
            </span>
          </EssentialRow>
        ) : null}
        {data.receptionPhone ? (
          <PhoneRow icon={Phone} label={t('essentials.reception')} href={`tel:${data.receptionPhone}`} number={data.receptionPhone} />
        ) : null}
        {data.whatsapp ? (
          <PhoneRow
            icon={MessageCircle}
            label={t('essentials.whatsapp')}
            href={`https://wa.me/${data.whatsapp.replace(/[^0-9]/g, '')}`}
            number={data.whatsapp}
          />
        ) : null}
        {data.emergencyPhone ? (
          <PhoneRow icon={Siren} label={t('essentials.emergency')} href={`tel:${data.emergencyPhone}`} number={data.emergencyPhone} />
        ) : null}
        <EssentialRow icon={Clock} label={t('essentials.checkout')}>
          <Bdi className="text-sm font-semibold text-ink">
            {data.checkoutTime}
          </Bdi>
        </EssentialRow>
      </div>
    </section>
  );
}

function EssentialRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wifi;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden />
        {label}
      </span>
      {children}
    </div>
  );
}

function PhoneRow({
  icon,
  label,
  href,
  number,
}: {
  icon: typeof Phone;
  label: string;
  href: string;
  number: string;
}) {
  return (
    <EssentialRow icon={icon} label={label}>
      <a
        href={href}
        className="pressable flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-accent"
      >
        <Bdi>{number}</Bdi>
      </a>
    </EssentialRow>
  );
}

function FacilityCard({
  facility,
  minutes,
  openNow,
  opensAt,
}: {
  facility: GuestInfoFacility;
  minutes: number;
  openNow: string;
  opensAt: (time: string) => string;
}) {
  const badge =
    facility.windows.length > 0 ? availability(facility.windows, minutes) : null;
  return (
    <article className="flex gap-3 rounded-card bg-card p-4 shadow-card">
      {facility.photoThumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(facility.photoThumbUrl) ?? undefined}
          alt=""
          loading="lazy"
          className="h-20 w-24 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
          <Dumbbell className="h-6 w-6 text-accent" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-ink first-letter:uppercase">{facility.name}</h3>
          {badge ? (
            <span
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                badge.available
                  ? 'bg-success/10 text-success'
                  : 'bg-ink/[0.06] text-ink-soft'
              }`}
            >
              <Clock className="h-3 w-3" aria-hidden />
              {badge.available ? openNow : opensAt(badge.opensAt ?? '')}
            </span>
          ) : null}
        </div>
        {facility.locationNote ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
            <MapPin className="h-3 w-3" aria-hidden />
            {facility.locationNote}
          </p>
        ) : null}
        {facility.description ? (
          <p className="mt-1 text-sm text-ink-soft">{facility.description}</p>
        ) : null}
      </div>
    </article>
  );
}

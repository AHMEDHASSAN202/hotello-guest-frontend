'use client';

import { ConciergeBell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  GuestCatalogCategory,
  GuestCatalogItem,
  GuestProfile,
  GuestRequest,
} from '@/lib/types';
import { useGuestRequests } from '@/lib/use-guest-requests';
import { GenericErrorScreen, OfflineScreen, StateShell } from '../state-screens';
import { Screen, Skeleton } from '../ui';
import { CatalogBrowse } from './catalog-browse';
import { MyRequests } from './my-requests';
import { RequestDetailSheet } from './request-detail-sheet';
import { SubmitSheet } from './submit-sheet';

type Tab = 'browse' | 'mine';

/**
 * The Requests section (15.2/15.3) — one screen, two tabs (order / track),
 * sheets on top for submit + detail. Everything is a state transition; the
 * poller runs while this section is mounted.
 */
export function RequestsScreen({ profile }: { profile: GuestProfile }) {
  const t = useTranslations('requests');
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('browse');
  const [catalog, setCatalog] = useState<GuestCatalogCategory[] | null>(null);
  const [catalogError, setCatalogError] = useState<ApiError | null>(null);
  const [submitItem, setSubmitItem] = useState<GuestCatalogItem | null>(null);
  const [detail, setDetail] = useState<GuestRequest | null>(null);

  const { requests, error: listError, refresh, applyLocal } = useGuestRequests(true);
  const moduleGone =
    isModuleGone(catalogError) || isModuleGone(listError);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const result = await api<{ categories: GuestCatalogCategory[] }>(
        '/guest/catalog',
      );
      setCatalog(result.categories);
    } catch (err) {
      setCatalogError(err as ApiError);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // 15.2 AC6 — module disabled mid-stay: ask the server layout to re-read
  // the profile (tile returns to "soon" once it lands); show a warm screen
  // meanwhile. Fire once, not per poll tick.
  const refreshed = useRef(false);
  useEffect(() => {
    if (moduleGone && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [moduleGone, router]);

  // Keep the freshest copy of the open detail row as polls land.
  const detailId = detail?.id ?? null;
  useEffect(() => {
    if (!detailId || !requests) return;
    const fresh = requests.find((r) => r.id === detailId);
    if (fresh) setDetail(fresh);
  }, [detailId, requests]);

  if (moduleGone) {
    return (
      <StateShell
        icon={ConciergeBell}
        title={t('soon.title')}
        body={t('soon.body')}
      />
    );
  }
  if (catalogError && catalogError.code === 'NETWORK') {
    return <OfflineScreen onRetry={loadCatalog} />;
  }
  if (catalogError) {
    return <GenericErrorScreen onRetry={loadCatalog} />;
  }

  const activeCount =
    requests?.filter((r) => r.status === 'new' || r.status === 'in_progress')
      .length ?? 0;

  return (
    <Screen>
      <header className="pt-3">
        <h1 className="text-[22px] font-bold leading-snug text-ink">
          {t('title')}
        </h1>
        <div
          role="tablist"
          aria-label={t('title')}
          className="mt-4 flex gap-1 rounded-card bg-ink/[0.05] p-1"
        >
          {(['browse', 'mine'] as const).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`pressable flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[0.9rem] text-[14px] font-semibold ${
                tab === key ? 'bg-card text-ink shadow-card' : 'text-ink-soft'
              }`}
            >
              {t(`tabs.${key}`)}
              {key === 'mine' && activeCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-contrast">
                  {activeCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5 flex-1">
        {tab === 'browse' ? (
          catalog === null ? (
            <CatalogSkeleton />
          ) : (
            <CatalogBrowse categories={catalog} onPick={setSubmitItem} />
          )
        ) : (
          <MyRequests
            requests={requests}
            language={profile.language}
            onOpen={setDetail}
            onRetry={refresh}
            error={listError}
            onOrder={() => setTab('browse')}
          />
        )}
      </div>

      <SubmitSheet
        item={submitItem}
        onClose={() => setSubmitItem(null)}
        onSubmitted={(request) => {
          applyLocal(request);
          setSubmitItem(null);
          setTab('mine');
        }}
      />
      <RequestDetailSheet
        request={detail}
        language={profile.language}
        onClose={() => setDetail(null)}
        onChanged={applyLocal}
      />
    </Screen>
  );
}

function isModuleGone(err: ApiError | null): boolean {
  return (
    !!err &&
    (err.code === 'MODULE_NOT_ENABLED' || err.code === 'HOTEL_UNAVAILABLE')
  );
}

function CatalogSkeleton() {
  return (
    <div>
      <Skeleton className="h-5 w-32" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-5 w-28" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

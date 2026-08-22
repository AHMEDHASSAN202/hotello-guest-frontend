'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, onSessionDeath } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import type { GuestProfile, GuestSessionResponse } from '@/lib/types';
import { BottomNav, type GuestSection } from './bottom-nav';
import { EntryScreen } from './entry-screen';
import { HomeScreen } from './home-screen';
import { useHotel } from './hotel-provider';
import { LocaleSync } from './locale-sync';
import { RequestsScreen } from './requests/requests-screen';
import { GenericErrorScreen, GoodbyeScreen, OfflineScreen } from './state-screens';
import { Screen, Skeleton } from './ui';

type GuestState =
  | { phase: 'probing' }
  | { phase: 'entry' }
  | { phase: 'home'; profile: GuestProfile; section: GuestSection }
  | { phase: 'goodbye' }
  | { phase: 'error'; kind: 'offline' | 'generic' };

/**
 * The client-side session state machine (14.2). Screens are animated state
 * transitions inside one route — the app never navigates, so nothing flashes.
 */
export function GuestFlow({ slug, roomParam }: { slug: string; roomParam?: string }) {
  const { isModuleEnabled } = useHotel();
  // Boot decides instantly: a stored token means we probe (skeleton), never
  // the entry form — a valid session must not see a flash of login (AC4).
  const [state, setState] = useState<GuestState>(() =>
    tokenStore.get() ? { phase: 'probing' } : { phase: 'entry' },
  );

  const probe = useCallback(async () => {
    setState({ phase: 'probing' });
    try {
      const profile = await api<GuestProfile>('/guest/me');
      setState({ phase: 'home', profile, section: 'home' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NETWORK') {
        setState({ phase: 'error', kind: 'offline' });
      } else if (err instanceof ApiError && err.status === 401) {
        // Boot 401 (stale token after a past stay) — silently to entry;
        // the goodbye moment is only for mid-use deaths (AC5).
        setState({ phase: 'entry' });
      } else {
        setState({ phase: 'error', kind: 'generic' });
      }
    }
  }, []);

  useEffect(() => {
    if (tokenStore.get()) void probe();
  }, [probe]);

  // Mid-use session death (checkout/suspension — NOT regeneration, which the
  // backend deliberately survives): warm goodbye with the entry form beneath.
  const isHome = state.phase === 'home';
  useEffect(() => {
    if (!isHome) return;
    return onSessionDeath(() => setState({ phase: 'goodbye' }));
  }, [isHome]);

  const enter = useCallback((session: GuestSessionResponse) => {
    tokenStore.set(session.accessToken);
    // The ?room= param served its one purpose — drop it (contract).
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setState({ phase: 'home', profile: session.profile, section: 'home' });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const profile = await api<GuestProfile>('/guest/me');
      setState((prev) => ({
        phase: 'home',
        profile,
        section: prev.phase === 'home' ? prev.section : 'home',
      }));
    } catch {
      // A dead session already routed to goodbye via onSessionDeath;
      // transient errors keep the current view.
    }
  }, []);

  const setSection = useCallback((section: GuestSection) => {
    setState((prev) =>
      prev.phase === 'home' ? { ...prev, section } : prev,
    );
  }, []);

  switch (state.phase) {
    case 'probing':
      return <HomeSkeleton />;
    case 'entry':
      return (
        <EntryScreen
          slug={slug}
          initialRoom={roomParam ?? ''}
          roomLocked={Boolean(roomParam)}
          onEnter={enter}
        />
      );
    case 'goodbye':
      return (
        <GoodbyeScreen>
          <EntryScreen slug={slug} compact onEnter={enter} />
        </GoodbyeScreen>
      );
    case 'error':
      return state.kind === 'offline' ? (
        <OfflineScreen onRetry={probe} />
      ) : (
        <GenericErrorScreen onRetry={probe} />
      );
    case 'home': {
      // The nav exists only once a second section is live (14.5 AC3).
      const requestsLive = isModuleEnabled('requests');
      return (
        <>
          <LocaleSync stayLanguage={state.profile.language} />
          <div className={requestsLive ? 'pb-16' : ''}>
            {state.section === 'requests' && requestsLive ? (
              <RequestsScreen profile={state.profile} />
            ) : (
              <HomeScreen
                profile={state.profile}
                onRefresh={refresh}
                onOpenTile={(key) => {
                  if (key === 'requests' && requestsLive) setSection('requests');
                }}
              />
            )}
          </div>
          {requestsLive ? (
            <BottomNav section={state.section} onSelect={setSection} />
          ) : null}
        </>
      );
    }
  }
}

/** Boot skeleton mirroring the home layout — never a blank screen (AC4). */
function HomeSkeleton() {
  return (
    <Screen>
      <div className="flex items-center justify-between pt-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-8 h-7 w-52" />
      <Skeleton className="mt-5 h-40 w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </Screen>
  );
}

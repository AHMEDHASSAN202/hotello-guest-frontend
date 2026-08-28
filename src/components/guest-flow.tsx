'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, onSessionDeath } from '@/lib/api';
import { tokenStore } from '@/lib/auth';
import { cartStore } from '@/lib/cart';
import type { GuestProfile, GuestSessionResponse } from '@/lib/types';
import {
  latestUnreadPriority,
  useGuestAnnouncements,
} from '@/lib/use-guest-announcements';
import { BottomNav, type GuestSection } from './bottom-nav';
import type { DiningPrefill } from './dining/dining-screen';
import { EntryScreen } from './entry-screen';
import { HomeScreen } from './home-screen';
import { useHotel } from './hotel-provider';
import { LocaleSync } from './locale-sync';
import { RequestsScreen } from './requests/requests-screen';
import { GenericErrorScreen, GoodbyeScreen, OfflineScreen } from './state-screens';
import { Screen, Skeleton } from './ui';

// Dining rides a dynamic chunk — the /[slug] JS budget stays untouched for
// guests who never open it (Epic 16, bundle-budget law).
const DiningScreen = dynamic(
  () => import('./dining/dining-screen').then((m) => m.DiningScreen),
  { ssr: false },
);
const ActiveOrderStrip = dynamic(
  () =>
    import('./dining/active-order-strip').then((m) => m.ActiveOrderStrip),
  { ssr: false },
);
// Hotel Info rides its own dynamic chunk too (Epic 17, 17.2 AC4).
const InfoScreen = dynamic(
  () => import('./info/info-screen').then((m) => m.InfoScreen),
  { ssr: false },
);
// The announcements inbox is bell-only traffic — dynamic chunk (Epic 19).
const AnnouncementsScreen = dynamic(
  () =>
    import('./announcements/announcements-screen').then(
      (m) => m.AnnouncementsScreen,
    ),
  { ssr: false },
);

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
export function GuestFlow({
  slug,
  roomParam,
  locationParam,
  spotParam,
}: {
  slug: string;
  roomParam?: string;
  locationParam?: string;
  spotParam?: string;
}) {
  const { hotel, isModuleEnabled } = useHotel();
  const router = useRouter();
  // Boot decides instantly: a stored token means we probe (skeleton), never
  // the entry form — a valid session must not see a flash of login (AC4).
  const [state, setState] = useState<GuestState>(() =>
    tokenStore.get() ? { phase: 'probing' } : { phase: 'entry' },
  );
  // "Track order" intent: opens Dining directly on that order's sheet.
  const [diningOrderId, setDiningOrderId] = useState<string | null>(null);
  // Announcement chip intent: opens Hotel Info scrolled to that entry (19.4).
  const [infoEntryId, setInfoEntryId] = useState<string | null>(null);

  // ONE announcements poller app-wide (19.4 AC1 — bell, banner and inbox all
  // share this feed; never a poller per surface).
  const announcementsLive = isModuleEnabled('announcements');
  const announcementsFeed = useGuestAnnouncements(
    state.phase === 'home' && announcementsLive,
  );

  // 16.5 AC6 — ?location/?spot follow the ?room contract: captured once
  // into memory (they must survive into the checkout prefill even for an
  // already-sessioned guest), then dropped from the URL. Never identity.
  const diningPrefill = useRef<DiningPrefill | undefined>(
    locationParam || spotParam
      ? { location: locationParam, spot: spotParam }
      : undefined,
  );
  useEffect(() => {
    if (
      (locationParam || spotParam) &&
      typeof window !== 'undefined' &&
      window.location.search
    ) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // The stay's cart dies with the stay (Epic 16, note 9).
  const isHome = state.phase === 'home';
  useEffect(() => {
    if (!isHome) return;
    return onSessionDeath(() => {
      cartStore.clear();
      setState({ phase: 'goodbye' });
    });
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

  // Epic 20 (20.4) — DND is optimistic-apply with server echo (recorded
  // decision 10: no shared profile poller in this app). Seeded from the
  // profile, re-seeded whenever the profile refreshes (boot probe, entry,
  // pull-to-refresh) — that is the reconciliation path.
  const [dndActive, setDndActive] = useState(false);
  const [dndBusy, setDndBusy] = useState(false);
  const homeProfile = state.phase === 'home' ? state.profile : null;
  useEffect(() => {
    if (homeProfile) setDndActive(homeProfile.dndActive ?? false);
  }, [homeProfile]);

  // Module disabled mid-stay: ask the server layout to re-read the hotel
  // profile so the row disappears — once, not per tap (requests idiom).
  const dndModuleRefreshed = useRef(false);
  const toggleDnd = useCallback(
    async (active: boolean) => {
      if (dndBusy) return; // the switch is disabled too — belt and braces
      setDndBusy(true);
      setDndActive(active); // optimistic flip — instant apply (AC1)
      try {
        const result = await api<{ dndActive: boolean }>('/guest/dnd', {
          method: 'POST',
          body: JSON.stringify({ active }),
        });
        setDndActive(result.dndActive); // reconcile with the server echo
      } catch (err) {
        setDndActive(!active); // revert — no toast, the switch is the truth
        if (
          err instanceof ApiError &&
          (err.code === 'MODULE_NOT_ENABLED' ||
            err.code === 'HOTEL_UNAVAILABLE') &&
          !dndModuleRefreshed.current
        ) {
          dndModuleRefreshed.current = true;
          router.refresh();
        }
      } finally {
        setDndBusy(false);
      }
    },
    [dndBusy, router],
  );

  // A location-QR scan lands the guest straight in Dining — once.
  const prefillRouted = useRef(false);
  const diningLiveNow = isModuleEnabled('fnb');
  useEffect(() => {
    if (
      isHome &&
      diningLiveNow &&
      diningPrefill.current &&
      !prefillRouted.current
    ) {
      prefillRouted.current = true;
      setSection('dining');
    }
  }, [isHome, diningLiveNow, setSection]);

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
      const diningLive = isModuleEnabled('fnb');
      // Epic 17 AC4 tri-state: live only when enabled AND content exists.
      const infoLive =
        isModuleEnabled('hotel_info') && hotel.hotelInfoHasContent;
      const navLive = requestsLive || diningLive || infoLive;
      const housekeepingLive = isModuleEnabled('housekeeping');
      return (
        <>
          <LocaleSync stayLanguage={state.profile.language} />
          <div className={navLive ? 'pb-16' : ''}>
            {state.section === 'announcements' && announcementsLive ? (
              <AnnouncementsScreen
                feed={announcementsFeed}
                profile={state.profile}
                onBack={() => setSection('home')}
                onOpenInfo={(chip) => {
                  if (infoLive) {
                    setInfoEntryId(chip.entryId);
                    setSection('info');
                  }
                }}
              />
            ) : state.section === 'requests' && requestsLive ? (
              <RequestsScreen profile={state.profile} />
            ) : state.section === 'dining' && diningLive ? (
              <DiningScreen
                profile={state.profile}
                prefill={diningPrefill.current}
                initialOrderId={diningOrderId}
              />
            ) : state.section === 'info' && infoLive ? (
              <InfoScreen initialEntryId={infoEntryId} />
            ) : (
              <>
                <HomeScreen
                  profile={state.profile}
                  onRefresh={refresh}
                  announcements={
                    announcementsLive
                      ? {
                          unreadCount: announcementsFeed.unreadCount,
                          banner: latestUnreadPriority(
                            announcementsFeed.announcements,
                          ),
                          onOpenInbox: () => setSection('announcements'),
                          onOpenBanner: () => setSection('announcements'),
                          onDismissBanner: () => {
                            const banner = latestUnreadPriority(
                              announcementsFeed.announcements,
                            );
                            if (banner) announcementsFeed.markRead(banner.id);
                          },
                        }
                      : null
                  }
                  dnd={
                    housekeepingLive
                      ? {
                          active: dndActive,
                          busy: dndBusy,
                          onToggle: toggleDnd,
                          onRequestCleaning: requestsLive
                            ? () => setSection('requests')
                            : undefined,
                        }
                      : null
                  }
                  onOpenTile={(key) => {
                    if (key === 'requests' && requestsLive) {
                      setSection('requests');
                    } else if (key === 'dining' && diningLive) {
                      setSection('dining');
                    } else if (key === 'info' && infoLive) {
                      setSection('info');
                    }
                  }}
                />
                {diningLive ? (
                  <ActiveOrderStrip
                    onOpen={(orderId) => {
                      setDiningOrderId(orderId);
                      setSection('dining');
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
          {navLive ? (
            <BottomNav
              section={state.section}
              onSelect={(section) => {
                setDiningOrderId(null);
                setInfoEntryId(null);
                setSection(section);
              }}
              requestsLive={requestsLive}
              diningLive={diningLive}
              infoLive={infoLive}
            />
          ) : null}
        </>
      );
    }
  }
}

/** Boot skeleton mirroring the home layout — never a blank screen (AC4). */
function HomeSkeleton() {
  const { hotel } = useHotel();
  return (
    <Screen>
      {hotel.coverImageUrl ? <div className="-mx-5 aspect-[16/9] animate-pulse bg-line" /> : null}
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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { ApiError } from '@/lib/api';
import type {
  GuestAnnouncement,
  GuestEventBooking,
  GuestFnbOrder,
  GuestHotelProfile,
  GuestProfile,
} from '@/lib/types';
import { HotelProvider } from './hotel-provider';
import { GuestFlow } from './guest-flow';

const { apiMock, tokenStore, deathHandlers, pushLib } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  tokenStore: {
    get: vi.fn((): string | null => null),
    set: vi.fn(),
    clear: vi.fn(),
  },
  deathHandlers: new Set<() => void>(),
  pushLib: {
    getPushState: vi.fn(async () => 'unsupported' as const),
    unsubscribeFromPush: vi.fn(async () => {}),
  },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: apiMock,
    onSessionDeath: (h: () => void) => {
      deathHandlers.add(h);
      return () => deathHandlers.delete(h);
    },
  };
});
vi.mock('@/lib/auth', () => ({ tokenStore }));
// Epic 23, Task 13 (23.2 AC4) — the goodbye teardown reads/clears push
// state; mocked so these tests control it without touching jsdom's absent
// Notification/Push APIs. `NotificationsRow` (rendered inside StayCard on
// every home screen here) shares this same mock.
vi.mock('@/lib/push', () => ({
  getPushState: pushLib.getPushState,
  unsubscribeFromPush: pushLib.unsubscribeFromPush,
}));
vi.mock('@/i18n/locale', () => ({
  useSetLocale: () => ({ locale: 'en', setLocale: vi.fn(), pending: false }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const hotel: GuestHotelProfile = {
  slug: 'sunrise',
  nameEn: 'Sunrise',
  nameAr: 'شروق',
  logoUrl: null,
  status: 'active',
  brandAccentColor: null,
  checkoutTime: '12:00',
  timezone: 'Africa/Cairo',
  defaultLanguage: 'ar',
  currency: 'EGP',
  enabledModules: [],
  coverImageUrl: null,
  welcomeMessage: null,
};

const profile: GuestProfile = {
  guestName: 'Dmitry',
  roomNumber: '304',
  hotelNameEn: 'Sunrise',
  hotelNameAr: 'شروق',
  slug: 'sunrise',
  language: 'en',
  checkOutDate: '2030-01-05',
  stayType: 'all_inclusive',
  stayId: 'stay-1',
};

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <HotelProvider hotel={hotel}>{ui}</HotelProvider>
    </NextIntlClientProvider>,
  );
}

describe('GuestFlow boot branching (14.2 AC4)', () => {
  beforeEach(() => {
    apiMock.mockReset();
    tokenStore.get.mockReturnValue(null);
    tokenStore.set.mockClear();
    deathHandlers.clear();
    pushLib.getPushState.mockReset().mockResolvedValue('unsupported');
    pushLib.unsubscribeFromPush.mockReset().mockResolvedValue(undefined);
  });

  it('no token → entry screen immediately', () => {
    wrap(<GuestFlow slug="sunrise" />);
    expect(screen.getByLabelText('code-input')).toBeTruthy();
  });

  it('token → skeleton while probing, then home — never a flash of login', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    let resolveMe!: (p: GuestProfile) => void;
    apiMock.mockReturnValue(new Promise((res) => (resolveMe = res)));

    wrap(<GuestFlow slug="sunrise" />);
    expect(screen.queryByLabelText('code-input')).toBeNull(); // no login flash

    await act(async () => resolveMe(profile));
    expect(screen.getByTestId('home-root')).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('/guest/me');
  });

  it('boot 401 (stale token) → silently to entry, NOT goodbye', async () => {
    tokenStore.get.mockReturnValue('stale-token');
    apiMock.mockRejectedValue(new ApiError(401, 'Session ended', { code: 'SESSION_ENDED' }));
    wrap(<GuestFlow slug="sunrise" />);
    await waitFor(() => expect(screen.getByLabelText('code-input')).toBeTruthy());
    expect(screen.queryByText('This stay has ended')).toBeNull();
  });

  it('boot network failure → offline screen with retry', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockRejectedValue(new ApiError(0, 'offline', { code: 'NETWORK' }));
    wrap(<GuestFlow slug="sunrise" />);
    await waitFor(() => expect(screen.getByText("You're offline")).toBeTruthy());
  });

  it('mid-use session death → warm goodbye with the entry form beneath (AC5)', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);
    wrap(<GuestFlow slug="sunrise" />);
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    act(() => deathHandlers.forEach((h) => h()));
    expect(screen.getByText('This stay has ended')).toBeTruthy();
    expect(screen.getByLabelText('code-input')).toBeTruthy();
  });

  it('Epic 23, Task 13 (23.2 AC4) — goodbye teardown: transition is instant, unsubscribe never blocks it', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);
    // A getPushState() that never resolves — if the transition (or the
    // unsubscribe call) were gated on it, the goodbye screen would never
    // appear. It must show up anyway.
    pushLib.getPushState.mockReturnValue(new Promise<never>(() => {}));
    wrap(<GuestFlow slug="sunrise" />);
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    act(() => deathHandlers.forEach((h) => h()));
    expect(screen.getByText('This stay has ended')).toBeTruthy();
  });

  it('Epic 23, Task 13 (23.2 AC4) — had a live subscription: unsubscribes and shows the stopped note', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);
    pushLib.getPushState.mockResolvedValue('subscribed');
    wrap(<GuestFlow slug="sunrise" />);
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    act(() => deathHandlers.forEach((h) => h()));
    expect(screen.getByText('This stay has ended')).toBeTruthy();
    // The note arrives asynchronously (a beat after the instant transition)
    // once `getPushState()` resolves and confirms there was something to
    // stop.
    await waitFor(() =>
      expect(
        screen.getByText('Notifications for this stay have stopped automatically'),
      ).toBeTruthy(),
    );
    expect(pushLib.unsubscribeFromPush).toHaveBeenCalledTimes(1);
  });

  it('Epic 23, Task 13 (23.2 AC4) — no live subscription: unsubscribe is still called, but no stopped note', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);
    pushLib.getPushState.mockResolvedValue('off');
    wrap(<GuestFlow slug="sunrise" />);
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    act(() => deathHandlers.forEach((h) => h()));
    expect(screen.getByText('This stay has ended')).toBeTruthy();
    await waitFor(() => expect(pushLib.unsubscribeFromPush).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText('Notifications for this stay have stopped automatically'),
    ).toBeNull();
  });

  it('entering stores the token, strips ?room=, lands home (AC1/multi-device: no client-side lock)', async () => {
    window.history.replaceState(null, '', '/sunrise?room=304');
    apiMock.mockResolvedValue({ accessToken: 'fresh', profile });
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    wrap(<GuestFlow slug="sunrise" roomParam="304" />);
    // room locked (chip) — only the code input
    expect(screen.queryByLabelText('Room number')).toBeNull();
    fireEvent.change(screen.getByLabelText('code-input'), { target: { value: '123456' } });

    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());
    expect(tokenStore.set).toHaveBeenCalledWith('fresh');
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/sunrise');
    // The session body carried nothing device-identifying (13.5 AC5).
    expect(apiMock).toHaveBeenCalledWith('/guest/sunrise/session', {
      method: 'POST',
      body: JSON.stringify({ roomNumber: '304', code: '123456' }),
    });
    replaceSpy.mockRestore();
  });
});

describe('Epic 21 — Events tile/section wiring', () => {
  beforeEach(() => {
    apiMock.mockReset();
    tokenStore.get.mockReturnValue(null);
    tokenStore.set.mockClear();
    deathHandlers.clear();
  });

  it('an events-only plan still gives the guest a way back to home (bottom nav renders)', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['events'] }}>
          <GuestFlow slug="sunrise" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    // No requests/dining/info module is live, only events — the bottom nav
    // must still appear (navLive includes eventsLive) so there is a way
    // back once the guest opens the Events tile.
    fireEvent.click(screen.getByTestId('tile-events'));
    await waitFor(() => expect(screen.getByTestId('bottom-nav')).toBeTruthy());
    expect(screen.queryByTestId('home-root')).toBeNull();

    fireEvent.click(screen.getByText('Home'));
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());
  });
});

describe('Final-review fix — home strips stack instead of overlapping', () => {
  beforeEach(() => {
    apiMock.mockReset();
    tokenStore.get.mockReturnValue(null);
    tokenStore.set.mockClear();
    deathHandlers.clear();
  });

  const openOrder: GuestFnbOrder = {
    id: 'order-1',
    status: 'preparing',
    destinationType: 'room',
    locationName: null,
    spot: null,
    roomNumber: '304',
    paymentMethod: 'cash',
    totalAmount: 150,
    currency: 'EGP',
    slaTargetMinutes: 30,
    createdAt: '2026-08-30T09:00:00.000Z',
    startedAt: '2026-08-30T09:05:00.000Z',
    outForDeliveryAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelledReason: null,
    settled: false,
    updatedAt: '2026-08-30T09:05:00.000Z',
    lines: [
      { id: 'l1', itemName: 'Club Sandwich', variantOptionName: null, quantity: 1, unitPrice: 150, included: false, lineTotal: 150, note: null, photoThumbUrl: null },
    ],
  };

  const todayBooking: GuestEventBooking = {
    id: 'bk-1',
    eventId: 'ev-1',
    title: 'Sunset Yoga',
    startAtLocal: '2026-08-30 18:00',
    endAtLocal: null,
    locationText: 'Beach',
    partySize: 2,
    unitPrice: 300,
    included: false,
    totalAmount: 600,
    currency: 'EGP',
    paymentMethod: 'room_charge',
    status: 'booked',
    cancelledBy: null,
    cancelledAt: null,
    createdAt: '2026-08-29T10:00:00.000Z',
  };

  it('an active F&B order AND a today\'s-event booking both render, stacked (not overlapping) in one fixed column', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path === '/guest/fnb/orders') {
        return Promise.resolve({ data: [openOrder], serverTime: '2026-08-30T09:10:00.000Z' });
      }
      if (path.startsWith('/guest/events/bookings')) {
        const tab = new URL(path, 'http://x').searchParams.get('tab');
        return Promise.resolve({
          data: tab === 'upcoming' ? [todayBooking] : [],
          todayBooking: tab === 'upcoming' ? todayBooking : null,
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['fnb', 'events'] }}>
          <GuestFlow slug="sunrise" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    const activeOrderStrip = await screen.findByTestId('active-order-strip');
    const todayEventStrip = await screen.findByTestId('today-event-strip');
    // Both surfaces are present and tappable — neither silently covers the
    // other (final-review fix: both used to share byte-identical `fixed
    // inset-x-0 bottom-[64px]` coordinates).
    expect(activeOrderStrip).toBeTruthy();
    expect(todayEventStrip).toBeTruthy();

    // Both are laid out inside the single positioned column, in normal flow
    // (no `fixed`/`bottom-*` classes on the individual strips themselves) —
    // that column is what stacks them instead of overlapping.
    const strips = screen.getByTestId('home-strips');
    expect(strips.contains(activeOrderStrip)).toBe(true);
    expect(strips.contains(todayEventStrip)).toBe(true);
    expect(strips.className).toContain('flex-col');
    expect(activeOrderStrip.className).not.toMatch(/\bfixed\b/);
    expect(todayEventStrip.className).not.toMatch(/\bfixed\b/);

    // The column itself never takes a tap; each pill takes its own.
    expect(strips.className).toContain('pointer-events-none');
    expect(activeOrderStrip.className).toContain('pointer-events-auto');
    expect(todayEventStrip.className).toContain('pointer-events-auto');
  });

  it('with the modules live but NO strip content, the column swallows no taps (pointer-events-none)', async () => {
    // The column is gated on the modules being enabled, not on content, so
    // with nothing to show it is an invisible box hovering over the home
    // screen's last tile row — it must be transparent to touch.
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path === '/guest/fnb/orders') {
        return Promise.resolve({ data: [], serverTime: '2026-08-30T09:10:00.000Z' });
      }
      if (path.startsWith('/guest/events/bookings')) {
        return Promise.resolve({ data: [], todayBooking: null });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['fnb', 'events'] }}>
          <GuestFlow slug="sunrise" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());

    const strips = screen.getByTestId('home-strips');
    expect(screen.queryByTestId('active-order-strip')).toBeNull();
    expect(screen.queryByTestId('today-event-strip')).toBeNull();
    expect(strips.className).toContain('pointer-events-none');
  });
});

describe('Epic 20 — guest DND toggle (20.4)', () => {
  beforeEach(() => {
    apiMock.mockReset();
    tokenStore.get.mockReturnValue(null);
    tokenStore.set.mockClear();
    deathHandlers.clear();
  });

  it('toggling posts /guest/dnd with {active:true} and flips optimistically', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path === '/guest/dnd') return Promise.resolve({ dndActive: true });
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['housekeeping'] }}>
          <GuestFlow slug="sunrise" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('dnd-switch')).toBeTruthy());
    const sw = screen.getByTestId('dnd-switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(sw);
    // Optimistic flip — before the echo lands (recorded decision 10).
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/guest/dnd', {
        method: 'POST',
        body: JSON.stringify({ active: true }),
      }),
    );
    // The server echo confirms — the switch stays on.
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});

describe('Epic 23 — push notification `?open=` deep links (Task 10)', () => {
  beforeEach(() => {
    apiMock.mockReset();
    tokenStore.get.mockReturnValue(null);
    tokenStore.set.mockClear();
    deathHandlers.clear();
  });

  it('an already-sessioned guest with ?open=order:o1 lands directly on the dining section with that order', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path === '/guest/fnb/menus') return Promise.resolve({ menus: [], currency: 'EGP' });
      if (path === '/guest/fnb/orders') {
        return Promise.resolve({ data: [], serverTime: '2026-08-30T09:00:00.000Z' });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['fnb'] }}>
          <GuestFlow slug="sunrise" openParam="order:o1" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );

    // Straight to Dining's "orders" tab — never a flash of home.
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/guest/fnb/orders'));
    expect(screen.queryByTestId('home-root')).toBeNull();
  });

  it('?open=event:ev-9 lands on the events section', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path === '/guest/events') return Promise.resolve({ data: [] });
      if (path.startsWith('/guest/events/bookings')) {
        return Promise.resolve({ data: [], todayBooking: null });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['events'] }}>
          <GuestFlow slug="sunrise" openParam="event:ev-9" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/guest/events'));
    expect(screen.queryByTestId('home-root')).toBeNull();
  });

  it('?open=request:req-1 lands on the requests section', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path === '/guest/catalog') return Promise.resolve({ categories: [] });
      if (path.startsWith('/guest/requests')) {
        return Promise.resolve({ data: [], serverTime: '2026-08-30T09:00:00.000Z' });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['requests'] }}>
          <GuestFlow slug="sunrise" openParam="request:req-1" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole('tablist')).toBeTruthy());
    expect(screen.getByRole('tab', { name: /My requests/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('?open=announcement:ann-1 lands on the announcements inbox', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/me') return Promise.resolve(profile);
      if (path.startsWith('/guest/announcements')) {
        return Promise.resolve({
          data: [
            {
              id: 'ann-1',
              title: 'Pool closed tomorrow',
              body: 'Maintenance from 9 to 12.',
              priority: false,
              infoChip: null,
              eventChip: null,
              publishedAt: '2026-01-15T09:00:00.000Z',
              readAt: null,
              active: true,
            },
          ],
          unreadCount: 1,
          serverTime: '2026-01-15T09:00:00.000Z',
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['announcements'] }}>
          <GuestFlow slug="sunrise" openParam="announcement:ann-1" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Pool closed tomorrow')).toBeTruthy());
    expect(screen.getByTestId('announcements-back')).toBeTruthy();
  });

  it('?open=home is a no-op — the guest lands on the regular home screen', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);

    wrap(<GuestFlow slug="sunrise" openParam="home" />);
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());
  });

  it('a malformed ?open= value is silently ignored — home renders normally', async () => {
    tokenStore.get.mockReturnValue('stored-token');
    apiMock.mockResolvedValue(profile);

    wrap(<GuestFlow slug="sunrise" openParam="garbage" />);
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());
  });

  it('survives the entry→home transition: no session yet, deep link applies only after login succeeds', async () => {
    // No stored token — boots straight to the entry screen, not probing.
    apiMock.mockImplementation((path: string) => {
      if (path === '/guest/sunrise/session') {
        return Promise.resolve({ accessToken: 'fresh', profile });
      }
      if (path === '/guest/fnb/menus') return Promise.resolve({ menus: [], currency: 'EGP' });
      if (path === '/guest/fnb/orders') {
        return Promise.resolve({ data: [], serverTime: '2026-08-30T09:00:00.000Z' });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={{ ...hotel, enabledModules: ['fnb'] }}>
          <GuestFlow slug="sunrise" openParam="order:o1" roomParam="304" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    // Still on the entry screen — the deep link has NOT fired yet.
    expect(screen.getByLabelText('code-input')).toBeTruthy();
    expect(apiMock).not.toHaveBeenCalledWith('/guest/fnb/orders');

    fireEvent.change(screen.getByLabelText('code-input'), { target: { value: '123456' } });

    // Once login lands on `home`, the held deep link applies — straight
    // through to Dining's orders tab, never a flash of the home screen.
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/guest/fnb/orders'),
    );
    expect(screen.queryByTestId('home-root')).toBeNull();
  });
});

describe('Final-review fix — announcement chips are never dead taps', () => {
  beforeEach(() => {
    apiMock.mockReset();
    tokenStore.get.mockReturnValue('stored-token');
    tokenStore.set.mockClear();
    deathHandlers.clear();
  });

  const announcement: GuestAnnouncement = {
    id: 'ann-1',
    title: 'Sunrise yoga is on',
    body: 'Meet at the beach deck.',
    priority: false,
    infoChip: { entryId: 'entry-1', section: 'facilities', name: 'Beach deck' },
    eventChip: {
      eventId: 'evt-1',
      title: 'Sunrise Yoga',
      startAtLocal: '2030-01-02 07:00',
    },
    publishedAt: '2026-01-15T09:00:00.000Z',
    readAt: null,
    active: true,
  };

  /**
   * Drives the REAL `GuestFlow`, not `AnnouncementsScreen` in isolation: the
   * bug this guards was in the wiring (guest-flow handed down a handler that
   * silently no-opped), so a component-level test that merely honours a null
   * it is given cannot catch a regression here.
   */
  async function openDetail(enabledModules: string[]) {
    apiMock.mockImplementation((url: string) =>
      url.startsWith('/guest/announcements')
        ? Promise.resolve({
            data: [announcement],
            unreadCount: 1,
            serverTime: '2026-01-15T09:00:00.000Z',
          })
        : Promise.resolve(profile),
    );
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider
          hotel={{ ...hotel, enabledModules, hotelInfoHasContent: true }}
        >
          <GuestFlow slug="sunrise" />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('home-root')).toBeTruthy());
    fireEvent.click(screen.getByTestId('announcements-bell'));
    await waitFor(() =>
      expect(screen.getByText('Sunrise yoga is on')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('Sunrise yoga is on'));
    await waitFor(() => expect(screen.getByTestId('bottom-sheet')).toBeTruthy());
  }

  it('renders both chips when their sections are live', async () => {
    await openDetail(['announcements', 'events', 'hotel_info']);
    expect(screen.getByText(/Sunrise Yoga/)).toBeTruthy();
    expect(screen.getByText(/Beach deck/)).toBeTruthy();
  });

  it('renders neither chip when their sections are not live', async () => {
    // The backend attaches both chips regardless of the hotel's plan; with
    // the modules off, a rendered chip would be a tap that does nothing.
    await openDetail(['announcements']);
    // The sheet really did open with its body — the chips below are absent
    // because they were not rendered, not because there is nothing on screen.
    expect(screen.getAllByText('Meet at the beach deck.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sunrise Yoga/)).toBeNull();
    expect(screen.queryByText(/Beach deck/)).toBeNull();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { ApiError } from '@/lib/api';
import type { GuestHotelProfile, GuestProfile } from '@/lib/types';
import { HotelProvider } from './hotel-provider';
import { GuestFlow } from './guest-flow';

const { apiMock, tokenStore, deathHandlers } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  tokenStore: {
    get: vi.fn((): string | null => null),
    set: vi.fn(),
    clear: vi.fn(),
  },
  deathHandlers: new Set<() => void>(),
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

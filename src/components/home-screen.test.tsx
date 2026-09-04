import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import ru from '../../messages/ru';
import { todayInTimezone } from '@/i18n/format';
import type { GuestHotelProfile, GuestProfile } from '@/lib/types';
import { HomeScreen } from './home-screen';
import { HotelProvider } from './hotel-provider';
import { ServicesGrid } from './services-grid';

vi.mock('@/i18n/locale', () => ({
  useSetLocale: () => ({ locale: 'en', setLocale: vi.fn(), pending: false }),
}));

const baseHotel: GuestHotelProfile = {
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
  enabledModules: [
    'requests',
    'fnb',
    'housekeeping',
    'transportation',
    'hotel_info',
  ],
  hotelInfoHasContent: true,
  coverImageUrl: null,
  welcomeMessage: null,
};

const futureDate = (days: number) => {
  const [y, m, d] = todayInTimezone('Africa/Cairo').split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const profile: GuestProfile = {
  guestName: 'Dmitry',
  roomNumber: '304',
  hotelNameEn: 'Sunrise',
  hotelNameAr: 'شروق',
  slug: 'sunrise',
  language: 'ru',
  checkOutDate: futureDate(3),
  stayType: 'all_inclusive',
  stayId: 'stay-1',
};

function wrap(ui: ReactNode, hotel = baseHotel, locale = 'en', messages: typeof en = en) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HotelProvider hotel={hotel}>{ui}</HotelProvider>
    </NextIntlClientProvider>,
  );
}

describe('HomeScreen (14.4)', () => {
  it('AC2 — greeting, large room number, nights, checkout date + hotel time', () => {
    wrap(<HomeScreen profile={profile} />);
    expect(screen.getByText('Welcome, Dmitry!')).toBeTruthy();
    expect(screen.getByText('304')).toBeTruthy();
    expect(screen.getByText('3 nights remaining')).toBeTruthy();
    expect(screen.getByText(/12:00/)).toBeTruthy();
  });

  it('AC4 — last day shows the gentle checkout-today note instead of nights', () => {
    wrap(<HomeScreen profile={{ ...profile, checkOutDate: futureDate(0) }} />);
    expect(
      screen.getByText('Checkout today at 12:00 — we hope you enjoyed your stay'),
    ).toBeTruthy();
    expect(screen.queryByText(/nights remaining/)).toBeNull();
  });

  it('renders Russian nights plural from the real bundle', () => {
    wrap(<HomeScreen profile={profile} />, baseHotel, 'ru', ru as unknown as typeof en);
    expect(screen.getByText(/3 ночи/)).toBeTruthy();
  });
});

describe('ServicesGrid gating (14.4 AC3)', () => {
  it('shows all four tiles when every module is enabled', () => {
    wrap(<ServicesGrid />);
    for (const key of ['requests', 'dining', 'transport', 'info']) {
      expect(screen.getByTestId(`tile-${key}`)).toBeTruthy();
    }
  });

  it('hides plan-gated tiles when their module is missing (fnb → no dining)', () => {
    wrap(<ServicesGrid />, { ...baseHotel, enabledModules: ['requests'] });
    expect(screen.getByTestId('tile-requests')).toBeTruthy();
    expect(screen.queryByTestId('tile-dining')).toBeNull();
    expect(screen.queryByTestId('tile-transport')).toBeNull();
  });

  it('Epic 17 AC4 — info tile shows as "soon" when the module is disabled', () => {
    wrap(<ServicesGrid />, { ...baseHotel, enabledModules: [] });
    const tile = screen.getByTestId('tile-info');
    expect(tile.getAttribute('aria-disabled')).toBe('true');
    expect(tile.getAttribute('role')).toBeNull();
  });

  it('Epic 17 AC4 — info tile is hidden entirely when enabled but empty', () => {
    wrap(<ServicesGrid />, { ...baseHotel, hotelInfoHasContent: false });
    expect(screen.queryByTestId('tile-info')).toBeNull();
  });

  it('Epic 17 AC1 — info tile is live and fires onOpen when content exists', () => {
    const onOpen = vi.fn();
    wrap(<ServicesGrid onOpen={onOpen} />);
    const tile = screen.getByTestId('tile-info');
    expect(tile.getAttribute('role')).toBe('button');
    fireEvent.click(tile);
    expect(onOpen).toHaveBeenCalledWith('info');
  });

  it('soon tiles are visibly ambitious but inert: aria-disabled, no button role', () => {
    wrap(<ServicesGrid />);
    const tile = screen.getByTestId('tile-transport');
    expect(tile.getAttribute('aria-disabled')).toBe('true');
    expect(tile.getAttribute('role')).toBeNull();
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
  });

  it('Epic 16 — the dining tile is live and fires onOpen', () => {
    const onOpen = vi.fn();
    wrap(<ServicesGrid onOpen={onOpen} />);
    const tile = screen.getByTestId('tile-dining');
    expect(tile.getAttribute('role')).toBe('button');
    fireEvent.click(tile);
    expect(onOpen).toHaveBeenCalledWith('dining');
  });

  it('Epic 15 — the live requests tile is a button and fires onOpen', () => {
    const onOpen = vi.fn();
    wrap(<ServicesGrid onOpen={onOpen} />);
    const tile = screen.getByTestId('tile-requests');
    expect(tile.getAttribute('role')).toBe('button');
    expect(tile.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(tile);
    expect(onOpen).toHaveBeenCalledWith('requests');
  });

  it('guest-polish-v1 item B7 — spans the last tile full-width when the visible count is odd (5 tiles)', () => {
    wrap(<ServicesGrid />, {
      ...baseHotel,
      enabledModules: [...baseHotel.enabledModules, 'events'],
    });
    const tiles = screen.getAllByTestId(/^tile-/);
    expect(tiles.length).toBe(5);
    const lastLi = tiles[tiles.length - 1].closest('li');
    expect(lastLi?.className).toContain('col-span-2');
    // every earlier tile's <li> must NOT be spanned
    tiles.slice(0, -1).forEach((tile) => {
      expect(tile.closest('li')?.className ?? '').not.toContain('col-span-2');
    });
  });

  it('guest-polish-v1 item B7 — does not span any tile when the visible count is even (4 tiles)', () => {
    wrap(<ServicesGrid />); // baseHotel yields exactly 4 tiles, per the existing "shows all four tiles" test above
    const tiles = screen.getAllByTestId(/^tile-/);
    expect(tiles.length).toBe(4);
    tiles.forEach((tile) => {
      expect(tile.closest('li')?.className ?? '').not.toContain('col-span-2');
    });
  });
});

describe('Epic 19 — bell + priority banner (19.4 AC1/AC3/AC4)', () => {
  const announcement = {
    id: 'ann-1',
    title: 'Pool closed tomorrow',
    body: 'Maintenance 9-12',
    priority: true,
    infoChip: null,
    eventChip: null,
    publishedAt: '2026-01-15T09:00:00.000Z',
    readAt: null,
    active: true,
  };
  const feed = (over: Partial<Parameters<typeof HomeScreen>[0]['announcements'] & object> = {}) => ({
    unreadCount: 3,
    banner: null,
    onOpenInbox: vi.fn(),
    onOpenBanner: vi.fn(),
    onDismissBanner: vi.fn(),
    ...over,
  });

  it('AC1 — bell renders with the unread badge and opens the inbox', () => {
    const f = feed();
    wrap(<HomeScreen profile={profile} announcements={f} />);
    const bell = screen.getByTestId('announcements-bell');
    expect(bell.textContent).toContain('3');
    fireEvent.click(bell);
    expect(f.onOpenInbox).toHaveBeenCalled();
  });

  it('AC1 — no badge at zero unread; bell still present', () => {
    wrap(<HomeScreen profile={profile} announcements={feed({ unreadCount: 0 })} />);
    const bell = screen.getByTestId('announcements-bell');
    expect(bell).toBeTruthy();
    expect(bell.textContent).not.toContain('0');
  });

  it('AC4 — module off (no announcements prop) → bell absent entirely', () => {
    wrap(<HomeScreen profile={profile} />);
    expect(screen.queryByTestId('announcements-bell')).toBeNull();
  });

  it('AC3 — unread priority banner renders, opens, and dismisses (= mark read)', () => {
    const f = feed({ banner: announcement });
    wrap(<HomeScreen profile={profile} announcements={f} />);
    const banner = screen.getByTestId('priority-banner');
    expect(banner.textContent).toContain('Pool closed tomorrow');
    expect(banner.textContent).toContain('Important');
    fireEvent.click(screen.getByTestId('priority-banner-open'));
    expect(f.onOpenBanner).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('priority-banner-dismiss'));
    expect(f.onDismissBanner).toHaveBeenCalled();
  });

  it('AC3 — no banner strip without an unread priority announcement', () => {
    wrap(<HomeScreen profile={profile} announcements={feed()} />);
    expect(screen.queryByTestId('priority-banner')).toBeNull();
  });
});

describe('Epic 18 — branding application (18.2)', () => {
  it('AC2 — renders the cover header with scrim when coverImageUrl is set', () => {
    wrap(<HomeScreen profile={profile} />, {
      ...baseHotel,
      coverImageUrl: 'files/branding/h1/x-detail.webp',
    });
    const cover = screen.getByTestId('home-cover');
    expect(cover).toBeTruthy();
    expect(cover.querySelector('img')?.getAttribute('src')).toContain('branding/h1/x-detail.webp');
  });

  it('AC3 — no cover keeps the current clean header', () => {
    wrap(<HomeScreen profile={profile} />, baseHotel);
    expect(screen.queryByTestId('home-cover')).toBeNull();
    expect(screen.getByText('Sunrise')).toBeTruthy();
  });

  it('AC3 — a broken image URL falls back silently to the clean header', () => {
    wrap(<HomeScreen profile={profile} />, {
      ...baseHotel,
      coverImageUrl: 'files/branding/h1/broken.webp',
    });
    fireEvent.error(screen.getByTestId('home-cover').querySelector('img')!);
    expect(screen.queryByTestId('home-cover')).toBeNull();
    expect(screen.getByText('Sunrise')).toBeTruthy();
  });

  it('a replaced cover resets the failure latch — new URL is shown again after the old one errored', () => {
    const hotelA = { ...baseHotel, coverImageUrl: 'files/branding/h1/broken.webp' };
    const result = wrap(<HomeScreen profile={profile} />, hotelA);
    fireEvent.error(screen.getByTestId('home-cover').querySelector('img')!);
    expect(screen.queryByTestId('home-cover')).toBeNull();

    const hotelB = { ...baseHotel, coverImageUrl: 'files/branding/h1/new-cover.webp' };
    result.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <HotelProvider hotel={hotelB}>
          <HomeScreen profile={profile} />
        </HotelProvider>
      </NextIntlClientProvider>,
    );
    const cover = screen.getByTestId('home-cover');
    expect(cover).toBeTruthy();
    expect(cover.querySelector('img')?.getAttribute('src')).toContain('new-cover.webp');
  });

  it('AC2 — welcome message renders under the greeting in the guest language', () => {
    wrap(<HomeScreen profile={profile} />, {
      ...baseHotel,
      welcomeMessage: { ar: 'أهلاً بكم', en: 'Welcome to the heart of Hurghada' },
    });
    expect(screen.getByText('Welcome to the heart of Hurghada')).toBeTruthy();
  });

  it('AC1/AC3 — untranslated locale falls back to English; absent message renders nothing', () => {
    // Render with locale 'ru' + real ru messages (the file already imports messages/ru for another case).
    wrap(
      <HomeScreen profile={profile} />,
      { ...baseHotel, welcomeMessage: { ar: 'أهلاً', en: 'Welcome' } },
      'ru',
      ru as unknown as typeof en,
    );
    expect(screen.getByText('Welcome')).toBeTruthy();
    cleanup();
    wrap(<HomeScreen profile={profile} />, baseHotel);
    expect(screen.queryByTestId('home-welcome')).toBeNull();
  });
});

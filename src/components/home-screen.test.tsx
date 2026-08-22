import { fireEvent, render, screen } from '@testing-library/react';
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
  enabledModules: ['requests', 'fnb', 'housekeeping', 'transportation'],
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
  it('shows all five tiles when every module is enabled', () => {
    wrap(<ServicesGrid />);
    for (const key of ['requests', 'dining', 'housekeeping', 'transport', 'info']) {
      expect(screen.getByTestId(`tile-${key}`)).toBeTruthy();
    }
  });

  it('hides plan-gated tiles when their module is missing (fnb → no dining)', () => {
    wrap(<ServicesGrid />, { ...baseHotel, enabledModules: ['requests'] });
    expect(screen.getByTestId('tile-requests')).toBeTruthy();
    expect(screen.queryByTestId('tile-dining')).toBeNull();
    expect(screen.queryByTestId('tile-housekeeping')).toBeNull();
    expect(screen.queryByTestId('tile-transport')).toBeNull();
  });

  it('the info tile is unconditional', () => {
    wrap(<ServicesGrid />, { ...baseHotel, enabledModules: [] });
    expect(screen.getByTestId('tile-info')).toBeTruthy();
  });

  it('soon tiles are visibly ambitious but inert: aria-disabled, no button role', () => {
    wrap(<ServicesGrid />);
    const tile = screen.getByTestId('tile-dining');
    expect(tile.getAttribute('aria-disabled')).toBe('true');
    expect(tile.getAttribute('role')).toBeNull();
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
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
});

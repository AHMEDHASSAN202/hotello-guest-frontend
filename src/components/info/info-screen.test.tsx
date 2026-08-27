import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import { HotelProvider } from '../hotel-provider';
import type { GuestHotelInfo, GuestHotelProfile } from '@/lib/types';

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

// Pin the hotel-local clock to 10:00 so badge assertions are deterministic.
vi.mock('@/lib/hours', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/hours')>();
  return { ...mod, hotelLocalMinutes: () => 10 * 60 };
});

import { InfoScreen } from './info-screen';
import { ApiError } from '@/lib/api';

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
  enabledModules: ['hotel_info'],
  hotelInfoHasContent: true,
};

const INFO: GuestHotelInfo = {
  essentials: {
    wifiName: 'Sunrise Guest',
    wifiPassword: 'sunrise2026',
    receptionPhone: '+20 100 000 0000',
    whatsapp: '+20 100 111 1111',
    emergencyPhone: null,
    checkoutTime: '11:30',
  },
  facilities: [
    {
      id: 'f1',
      name: 'Pool',
      description: 'Heated in winter.',
      windows: [{ start: '08:00', end: '20:00' }],
      locationNote: 'Building B',
      photoThumbUrl: null,
      photoDetailUrl: null,
    },
    {
      id: 'f2',
      name: 'Spa',
      description: null,
      windows: [{ start: '16:00', end: '22:00' }],
      locationNote: null,
      photoThumbUrl: null,
      photoDetailUrl: null,
    },
  ],
  services: [],
  houseRules: [
    { id: 'r1', name: 'Quiet hours', description: '22:00–08:00' },
  ],
  about: {
    text: 'A calm beach hotel.\n\nSince 1998.',
    gallery: [],
  },
};

function renderScreen() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <HotelProvider hotel={hotel}>
        <InfoScreen />
      </HotelProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.api.mockResolvedValue(INFO);
});

describe('InfoScreen (17.2)', () => {
  it('AC2 — essentials pinned with copy affordance and tap-to-call links', async () => {
    renderScreen();
    expect(await screen.findByText('sunrise2026')).toBeTruthy();
    // copy button next to the password
    expect(screen.getByRole('button', { name: en.common.copy })).toBeTruthy();
    // reception is tel:, whatsapp is wa.me
    const reception = screen.getByText('+20 100 000 0000').closest('a')!;
    expect(reception.getAttribute('href')).toBe('tel:+20 100 000 0000');
    const whatsapp = screen.getByText('+20 100 111 1111').closest('a')!;
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/201001111111');
    // checkout time from the response, not the profile
    expect(screen.getByText('11:30')).toBeTruthy();
  });

  it('AC2 — facility badges: open now at 10:00 for 08–20, opens-at for 16–22', async () => {
    renderScreen();
    await screen.findByText('Pool');
    expect(screen.getByText(en.info.openNow)).toBeTruthy();
    expect(
      screen.getByText(en.info.opensAt.replace('{time}', '16:00')),
    ).toBeTruthy();
    expect(screen.getByText('Building B')).toBeTruthy();
  });

  it('AC4 — empty sections are simply absent', async () => {
    renderScreen();
    await screen.findByText('Pool');
    expect(screen.queryByText(en.info.sections.services)).toBeNull();
    expect(screen.getByText(en.info.sections.houseRules)).toBeTruthy();
  });

  it('renders about as separate paragraphs', async () => {
    renderScreen();
    await screen.findByText('A calm beach hotel.');
    expect(screen.getByText('Since 1998.')).toBeTruthy();
  });

  it('AC4 — module disabled mid-stay shows the soon screen and refreshes the layout once', async () => {
    apiMock.api.mockRejectedValue(
      new ApiError(403, 'off', { code: 'MODULE_NOT_ENABLED' }),
    );
    renderScreen();
    expect(await screen.findByText(en.info.soon.title)).toBeTruthy();
    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
  });
});

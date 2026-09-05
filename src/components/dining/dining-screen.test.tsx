import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { GuestProfile } from '@/lib/types';

/** Epic 16, Stories 16.5/16.4 — browse, cart, checkout (the demo flow). */

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

import { DiningScreen } from './dining-screen';

const profile: GuestProfile = {
  guestName: 'Dmitry',
  roomNumber: '304',
  hotelNameEn: 'Sunrise',
  hotelNameAr: 'شروق',
  slug: 'sunrise',
  language: 'en',
  checkOutDate: '2026-08-25',
  stayType: 'all_inclusive',
  stayId: 'stay-1',
};

const CATALOG = {
  stayType: 'all_inclusive',
  currency: 'EGP',
  paymentMethods: ['cash', 'room_charge'],
  locations: [
    {
      id: 'loc-1',
      key: 'pool',
      name: 'Pool',
      hasSpots: true,
      spotLabel: 'Umbrella',
    },
  ],
  menus: [
    {
      id: 'menu-1',
      name: 'Pool Bar',
      description: null,
      availability: { available: true, opensAt: null },
      windows: [],
      prepSlaMinutes: 20,
      sections: [
        {
          id: 'section-1',
          name: 'Drinks',
          items: [
            {
              id: 'item-inc',
              name: 'Fresh Juice',
              description: null,
              photoThumbUrl: null,
              photoDetailUrl: null,
              included: true,
              unitPrice: 0,
              allowNotes: true,
              variant: null,
            },
            {
              id: 'item-paid',
              name: 'Imported Whiskey',
              description: null,
              photoThumbUrl: null,
              photoDetailUrl: null,
              included: false,
              unitPrice: 250,
              allowNotes: false,
              variant: null,
            },
          ],
        },
      ],
    },
    {
      id: 'menu-closed',
      name: 'Breakfast',
      description: null,
      availability: { available: false, opensAt: '07:00' },
      windows: [{ start: '07:00', end: '11:00' }],
      prepSlaMinutes: 15,
      sections: [
        {
          id: 'section-2',
          name: 'Morning',
          items: [
            {
              id: 'item-omelette',
              name: 'Omelette',
              description: null,
              photoThumbUrl: null,
              photoDetailUrl: null,
              included: true,
              unitPrice: 0,
              allowNotes: true,
              variant: null,
            },
          ],
        },
      ],
    },
  ],
};

function wrap(
  prefill?: { location?: string; spot?: string },
  initialOrderId?: string,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <DiningScreen
        profile={profile}
        prefill={prefill}
        initialOrderId={initialOrderId}
      />
    </NextIntlClientProvider>,
  );
}

const DELIVERED_RC_ORDER = {
  id: 'order-rc',
  status: 'delivered',
  destinationType: 'room',
  locationName: null,
  spot: null,
  roomNumber: '304',
  paymentMethod: 'room_charge',
  totalAmount: 460,
  currency: 'EGP',
  slaTargetMinutes: 20,
  createdAt: '2026-08-26T10:00:00.000Z',
  startedAt: '2026-08-26T10:05:00.000Z',
  outForDeliveryAt: '2026-08-26T10:15:00.000Z',
  deliveredAt: '2026-08-26T10:20:00.000Z',
  cancelledAt: null,
  cancelledReason: null,
  settled: false,
  updatedAt: '2026-08-26T10:20:00.000Z',
  lines: [
    {
      id: 'l1',
      itemName: 'Burger',
      variantOptionName: null,
      quantity: 2,
      unitPrice: 230,
      included: false,
      lineTotal: 460,
      note: null,
      photoThumbUrl: null,
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  apiMock.api.mockReset();
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.startsWith('/guest/fnb/menus')) return CATALOG;
    if (path.startsWith('/guest/fnb/orders'))
      return { data: [], serverTime: new Date().toISOString() };
    return {};
  });
});

describe('DiningScreen (16.5)', () => {
  it('AC1 — items render ✓Included or a price; closed menus are marked, browsable, not orderable', async () => {
    wrap();
    expect(await screen.findByText('Fresh Juice')).toBeTruthy();
    const juice = screen
      .getByTestId('fnb-item-item-inc')
      .textContent as string;
    expect(juice).toContain('✓ Included');
    const whiskey = screen
      .getByTestId('fnb-item-item-paid')
      .textContent as string;
    expect(whiskey).toMatch(/250/);

    // Closed menu: visible + marked with its opening time (browse, AC1).
    expect(screen.getByText('Opens at 07:00')).toBeTruthy();
    fireEvent.click(screen.getByTestId('fnb-item-item-omelette'));
    const addButton = await screen.findByTestId('add-to-cart');
    expect(addButton.hasAttribute('disabled')).toBe(true);
  });

  it('AC2/AC5 — the note field hides when the item disallows notes', async () => {
    wrap();
    await screen.findByText('Fresh Juice');
    fireEvent.click(screen.getByTestId('fnb-item-item-paid'));
    await screen.findByTestId('add-to-cart');
    expect(screen.queryByPlaceholderText('e.g. no onions')).toBeNull();
  });

  it('AC3/AC4 — add to cart → checkout: paid-only total, room default, QR prefill wins the location', async () => {
    wrap({ location: 'pool', spot: '12' });
    await screen.findByText('Fresh Juice');

    // Included item + paid item in one cart (mixed carts fine).
    fireEvent.click(screen.getByTestId('fnb-item-item-inc'));
    fireEvent.click(await screen.findByTestId('add-to-cart'));
    fireEvent.click(screen.getByTestId('fnb-item-item-paid'));
    fireEvent.click(await screen.findByTestId('add-to-cart'));

    fireEvent.click(screen.getByTestId('cart-button'));
    const total = await screen.findByText('Total to pay');
    expect(
      (total.parentElement as HTMLElement).textContent,
    ).toMatch(/250/); // included line contributes 0

    fireEvent.click(screen.getByTestId('go-checkout'));

    // 16.5 AC4/AC6 — ?location pre-selects the pool, ?spot pre-fills, editable.
    const spot = (await screen.findByTestId('spot-input')) as HTMLInputElement;
    expect(spot.value).toBe('12');
    const pool = screen.getByTestId('dest-pool');
    expect(pool.getAttribute('aria-pressed')).toBe('true');

    // Both payment methods offered (16.4 AC2).
    expect(screen.getByTestId('pay-cash')).toBeTruthy();
    expect(screen.getByTestId('pay-room_charge')).toBeTruthy();

    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.destination).toEqual({
          type: 'location',
          locationId: 'loc-1',
          spot: '12',
        });
        expect(body.paymentMethod).toBe('cash');
        expect(body.lines).toHaveLength(2);
        return {
          id: 'order-1',
          status: 'new',
          destinationType: 'location',
          locationName: 'Pool',
          spot: '12',
          roomNumber: '304',
          paymentMethod: 'cash',
          totalAmount: 250,
          currency: 'EGP',
          slaTargetMinutes: 20,
          createdAt: new Date().toISOString(),
          startedAt: null,
          outForDeliveryAt: null,
          deliveredAt: null,
          cancelledAt: null,
          cancelledReason: null,
          updatedAt: new Date().toISOString(),
          lines: [],
        };
      }
      if (path.startsWith('/guest/fnb/menus')) return CATALOG;
      return { data: [], serverTime: new Date().toISOString() };
    });

    fireEvent.click(screen.getByTestId('place-order'));
    expect(await screen.findByText('Order received!')).toBeTruthy();
    // The cart cleared on success (AC3 — persists only until ordered).
    // The success beat holds ~1.1s before onPlaced clears the cart.
    await waitFor(
      () => expect(localStorage.getItem('gxp_guest_cart_v1')).toBeNull(),
      { timeout: 3000 },
    );
  });

  it('16.4 AC3 — a fully-included cart skips the payment step entirely', async () => {
    wrap();
    await screen.findByText('Fresh Juice');
    fireEvent.click(screen.getByTestId('fnb-item-item-inc'));
    fireEvent.click(await screen.findByTestId('add-to-cart'));
    fireEvent.click(screen.getByTestId('cart-button'));
    fireEvent.click(await screen.findByTestId('go-checkout'));

    expect(
      await screen.findByText(
        'Everything in this order is included in your stay.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('pay-cash')).toBeNull();
  });

  it('search filters items across menus; no-results state appears', async () => {
    wrap();
    await screen.findByText('Fresh Juice');

    fireEvent.change(screen.getByTestId('menu-search'), {
      target: { value: 'whis' },
    });
    expect(screen.queryByText('Fresh Juice')).toBeNull();
    expect(screen.getByText('Imported Whiskey')).toBeTruthy();

    fireEvent.change(screen.getByTestId('menu-search'), {
      target: { value: 'sushi' },
    });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('the room-bill balance shows unsettled delivered room-charge totals (16.8 guest side)', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/guest/fnb/menus')) return CATALOG;
      if (path.startsWith('/guest/fnb/orders'))
        return {
          data: [
            DELIVERED_RC_ORDER,
            { ...DELIVERED_RC_ORDER, id: 'order-settled', settled: true },
            { ...DELIVERED_RC_ORDER, id: 'order-cash', paymentMethod: 'cash' },
          ],
          serverTime: new Date().toISOString(),
        };
      return {};
    });
    wrap(undefined, 'order-rc'); // also lands on the orders tab
    const banner = await screen.findByTestId('room-bill-balance');
    // Only the unsettled room-charge order counts: 460, not 1380.
    expect(banner.textContent).toMatch(/460/);
    expect(banner.textContent).not.toMatch(/920|1,?380/);
    expect(banner.textContent).toContain('Pay at checkout at the front desk.');
  });

  it('an initialOrderId (Track order) opens the orders tab with that order sheet', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/guest/fnb/menus')) return CATALOG;
      if (path.startsWith('/guest/fnb/orders'))
        return {
          data: [{ ...DELIVERED_RC_ORDER, id: 'order-track', status: 'preparing' }],
          serverTime: new Date().toISOString(),
        };
      return {};
    });
    wrap(undefined, 'order-track');
    // The tracking bottom sheet is open on the order, no extra taps.
    const sheet = await screen.findByTestId('bottom-sheet');
    expect(sheet.textContent).toContain('Preparing');
    expect(sheet.textContent).toContain('Burger');
  });

  it('renders the item photo at card width using the detail rendition when available (guest-polish-v1 item B4)', async () => {
    const catalogWithPhoto = {
      ...CATALOG,
      menus: CATALOG.menus.map((menu) => ({
        ...menu,
        sections: menu.sections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.id === 'item-inc'
              ? { ...item, photoDetailUrl: '/files/item-inc-detail.jpg', photoThumbUrl: '/files/item-inc-thumb.jpg' }
              : item,
          ),
        })),
      })),
    };
    apiMock.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/guest/fnb/menus')) return catalogWithPhoto;
      if (path.startsWith('/guest/fnb/orders'))
        return { data: [], serverTime: new Date().toISOString() };
      return {};
    });

    wrap();
    await screen.findByText('Fresh Juice');
    const img = screen.getByTestId('fnb-item-item-inc').querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('item-inc-detail.jpg');
    expect(img?.className).toContain('w-full');
    expect(img?.className).toContain('aspect-[4/3]');
    expect(img?.getAttribute('srcset')).toContain('480w');
    expect(img?.getAttribute('srcset')).toContain('1200w');
  });
});

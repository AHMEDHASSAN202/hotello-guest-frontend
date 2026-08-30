import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { GuestEventBooking } from '@/lib/types';

/**
 * Epic 21 (21.5), Task 22 — the home-screen "today's booking" strip,
 * mirroring the `ActiveOrderStrip` pattern: renders only when a today
 * booking exists, no dismiss affordance, tap opens the detail sheet.
 */

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

import { TodayEventStrip } from './today-event-strip';

function makeBooking(overrides: Partial<GuestEventBooking> = {}): GuestEventBooking {
  return {
    id: 'bk-1',
    eventId: 'ev-1',
    title: 'Sunset Yoga',
    startAtLocal: '2026-01-15 18:00',
    endAtLocal: null,
    locationText: 'Beach — Building B',
    partySize: 2,
    unitPrice: 300,
    included: false,
    totalAmount: 600,
    currency: 'EGP',
    paymentMethod: 'room_charge',
    status: 'booked',
    cancelledBy: null,
    cancelledAt: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

/** Routes the three tab-filtered bookings calls the hook makes. */
function stubApi(todayBooking: GuestEventBooking | null) {
  apiMock.api.mockImplementation(async (path: string) => {
    if (path.startsWith('/guest/events/bookings')) {
      return { data: [], todayBooking };
    }
    throw new Error(`unmocked ${path}`);
  });
}

function wrap(onOpen = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <TodayEventStrip onOpen={onOpen} />
    </NextIntlClientProvider>,
  );
  return { onOpen };
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('TodayEventStrip (Task 22)', () => {
  it('renders nothing while the feed is loading and there is no today booking', async () => {
    stubApi(null);
    wrap();
    expect(screen.queryByTestId('today-event-strip')).toBeNull();
    // Let the initial load settle — still nothing to show.
    await waitFor(() => expect(apiMock.api).toHaveBeenCalled());
    expect(screen.queryByTestId('today-event-strip')).toBeNull();
  });

  it("shows the pill once the feed resolves today's booking, with no dismiss control", async () => {
    stubApi(makeBooking());
    wrap();
    const strip = await screen.findByTestId('today-event-strip');
    expect(strip.textContent).toContain('Sunset Yoga');
    expect(strip.textContent).toContain('18:00');
    // Non-dismissable: nothing but the one tappable pill itself.
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).toBeNull();
  });

  it('tapping the pill opens the booking by id', async () => {
    stubApi(makeBooking({ id: 'bk-today' }));
    const { onOpen } = wrap();
    const strip = await screen.findByTestId('today-event-strip');
    fireEvent.click(strip);
    expect(onOpen).toHaveBeenCalledWith('bk-today');
  });
});

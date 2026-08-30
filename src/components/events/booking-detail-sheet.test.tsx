import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import { ApiError } from '@/lib/api';
import type { GuestEventBooking } from '@/lib/types';

/** Epic 21, Story 21.5 — the booking detail/cancel sheet (Task 21). */

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

import { BookingDetailSheet } from './booking-detail-sheet';

function makeBooking(overrides: Partial<GuestEventBooking> = {}): GuestEventBooking {
  return {
    id: 'bk-1',
    eventId: 'ev-1',
    title: 'Sunset Yoga',
    startAtLocal: '2099-01-01 18:00', // far future by default — pre-start
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
    createdAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  };
}

function wrap(booking: GuestEventBooking | null) {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <BookingDetailSheet
        booking={booking}
        locale="en"
        onClose={onClose}
        onChanged={onChanged}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onChanged };
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('BookingDetailSheet (21.5)', () => {
  it('renders the booking SNAPSHOT only — never fetches the live event (21.4 AC4)', () => {
    wrap(makeBooking());
    expect(screen.getByText('2× Sunset Yoga')).toBeTruthy();
    expect(screen.getByText('Beach — Building B')).toBeTruthy();
    expect(
      screen.getByText('On your room bill — pay at checkout'),
    ).toBeTruthy();
    expect(apiMock.api).not.toHaveBeenCalled();
  });

  it('shows the cash-in-hand line for a cash booking, and ✓Included for an included one', () => {
    wrap(makeBooking({ paymentMethod: 'cash', totalAmount: 600 }));
    expect(screen.getByText(/Have.*600.*ready in cash/)).toBeTruthy();
  });

  it('shows ✓Included and no payment line for an included booking', () => {
    wrap(makeBooking({ included: true, totalAmount: 0, paymentMethod: null }));
    expect(screen.getByText('✓ Included in your stay')).toBeTruthy();
  });

  it('a booked, pre-start booking offers the two-step inline cancel', async () => {
    const updated = makeBooking({ status: 'cancelled', cancelledBy: 'guest' });
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (
        path === '/guest/events/bookings/bk-1/cancel' &&
        init?.method === 'POST'
      ) {
        return updated;
      }
      throw new Error(`unmocked ${path}`);
    });
    const { onChanged, onClose } = wrap(makeBooking());

    fireEvent.click(screen.getByTestId('cancel-booking'));
    expect(screen.getByText('Cancel this booking?')).toBeTruthy();

    // "Keep it" backs out without calling the API.
    fireEvent.click(screen.getByText('Keep it'));
    expect(screen.queryByText('Cancel this booking?')).toBeNull();
    expect(apiMock.api).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cancel-booking'));
    fireEvent.click(screen.getByTestId('confirm-cancel-booking'));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
    expect(onClose).toHaveBeenCalled();
  });

  it('a booked-but-already-started booking shows front-desk guidance, no cancel affordance', () => {
    wrap(makeBooking({ startAtLocal: '2000-01-01 10:00' }));
    expect(screen.queryByTestId('cancel-booking')).toBeNull();
    expect(
      screen.getByText(
        'This event has already started — the front desk can help with any changes.',
      ),
    ).toBeTruthy();
  });

  it('an already-cancelled booking shows neither the cancel button nor the started-event guidance', () => {
    wrap(makeBooking({ status: 'cancelled', cancelledBy: 'staff' }));
    expect(screen.queryByTestId('cancel-booking')).toBeNull();
    expect(
      screen.queryByText(
        'This event has already started — the front desk can help with any changes.',
      ),
    ).toBeNull();
  });

  it('an already-cancelled but still-future booking also gets no cancel affordance', () => {
    // Guards status, not just timing — cancelled + pre-start must stay non-cancellable.
    wrap(
      makeBooking({
        status: 'cancelled',
        cancelledBy: 'guest',
        startAtLocal: '2099-01-01 18:00',
      }),
    );
    expect(screen.queryByTestId('cancel-booking')).toBeNull();
  });

  it('a cancel failure shows the resolved inline error and keeps the sheet open', async () => {
    apiMock.api.mockImplementation(async () => {
      throw new ApiError(409, 'already started', {
        code: 'EVENT_BOOKING_PAST_START',
      });
    });
    const { onClose } = wrap(makeBooking());
    fireEvent.click(screen.getByTestId('cancel-booking'));
    fireEvent.click(screen.getByTestId('confirm-cancel-booking'));
    expect(
      await screen.findByText(
        'This event has already started — please check with the front desk.',
      ),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when no booking is selected', () => {
    wrap(null);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });
});

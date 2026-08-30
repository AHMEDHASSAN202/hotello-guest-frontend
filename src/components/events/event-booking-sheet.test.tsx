import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import { ApiError } from '@/lib/api';
import type { GuestEvent, GuestEventBooking, GuestEventDetail } from '@/lib/types';

/** Epic 21, Story 21.4 — the merged booking sheet (Task 21). */

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

import { EventBookingSheet } from './event-booking-sheet';

function makeEvent(overrides: Partial<GuestEvent> = {}): GuestEvent {
  return {
    id: 'ev-1',
    title: 'Sunset Yoga',
    photoThumbUrl: null,
    startAtLocal: '2099-01-01 18:00',
    endAtLocal: null,
    locationText: 'Beach — Building B',
    capacity: 20,
    spotsLeft: 12,
    soldOut: false,
    price: { included: false, unitPrice: 300 },
    currency: 'EGP',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<GuestEventDetail> = {}): GuestEventDetail {
  return {
    ...makeEvent(),
    status: 'published',
    description: 'A relaxing sunrise yoga session on the beach.',
    photoDetailUrl: null,
    maxPartySize: 6,
    paymentMethods: ['cash', 'room_charge'],
    ...overrides,
  };
}

function makeBooking(overrides: Partial<GuestEventBooking> = {}): GuestEventBooking {
  return {
    id: 'bk-1',
    eventId: 'ev-1',
    title: 'Sunset Yoga',
    startAtLocal: '2099-01-01 18:00',
    endAtLocal: null,
    locationText: 'Beach — Building B',
    partySize: 1,
    unitPrice: 300,
    included: false,
    totalAmount: 300,
    currency: 'EGP',
    paymentMethod: 'cash',
    status: 'booked',
    cancelledBy: null,
    cancelledAt: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  };
}

function wrap(event: GuestEvent | null = makeEvent()) {
  const onClose = vi.fn();
  const onBooked = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventBookingSheet
        event={event}
        locale="en"
        onClose={onClose}
        onBooked={onBooked}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onBooked };
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('EventBookingSheet (21.4)', () => {
  it('fetches the event detail on open and renders photo/description', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1') return makeDetail();
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    expect(await screen.findByText(/relaxing sunrise yoga/i)).toBeTruthy();
  });

  it('bounds the stepper at min 1 and caps at spotsLeft when tighter than maxPartySize', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1')
        return makeDetail({ spotsLeft: 3, capacity: 10 });
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    const minus = (await screen.findByTestId('party-minus')) as HTMLButtonElement;
    const plus = screen.getByTestId('party-plus') as HTMLButtonElement;
    expect(minus.disabled).toBe(true); // starts at 1, can't go lower

    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByTestId('party-size').textContent).toBe('3');
    expect(plus.disabled).toBe(true); // capped at spotsLeft=3
    expect(minus.disabled).toBe(false);
  });

  it('caps the stepper at maxPartySize (6) when spotsLeft is larger', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1')
        return makeDetail({ spotsLeft: 20, capacity: 20 });
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    const plus = (await screen.findByTestId('party-plus')) as HTMLButtonElement;
    for (let i = 0; i < 8; i += 1) fireEvent.click(plus);
    expect(screen.getByTestId('party-size').textContent).toBe('6');
    expect(plus.disabled).toBe(true);
  });

  it('skips the payment section entirely when the price is included', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1')
        return makeDetail({ price: { included: true, unitPrice: 0 } });
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    await screen.findByTestId('party-size');
    expect(screen.queryByTestId('pay-cash')).toBeNull();
    expect(
      screen.getByText('This event is included in your stay.'),
    ).toBeTruthy();
  });

  it('auto-compacts to a single, pre-selected option when only one payment method exists', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1')
        return makeDetail({ paymentMethods: ['cash'] });
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    const cash = await screen.findByTestId('pay-cash');
    expect(cash.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('pay-room_charge')).toBeNull();
  });

  it('recomputes the live total on stepper change (display-only)', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1') return makeDetail();
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    const plus = await screen.findByTestId('party-plus');
    expect(screen.getByTestId('book-event').textContent).toMatch(/300/);
    fireEvent.click(plus);
    expect(screen.getByTestId('book-event').textContent).toMatch(/600/);
  });

  it('books successfully: optimistic success beat, then onBooked with the server booking', async () => {
    const booking = makeBooking();
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/guest/events/ev-1') return makeDetail();
      if (path === '/guest/events/ev-1/book' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.partySize).toBe(1);
        expect(body.paymentMethod).toBe('cash');
        return booking;
      }
      throw new Error(`unmocked ${path}`);
    });
    const { onBooked } = wrap();
    fireEvent.click(await screen.findByTestId('book-event'));
    expect(await screen.findByText("You're booked!")).toBeTruthy();
    await waitFor(() => expect(onBooked).toHaveBeenCalledWith(booking), {
      timeout: 3000,
    });
  });

  it('a fully-included booking omits paymentMethod from the request body', async () => {
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/guest/events/ev-1')
        return makeDetail({ price: { included: true, unitPrice: 0 } });
      if (path === '/guest/events/ev-1/book' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body).toEqual({ partySize: 1 });
        return makeBooking({ included: true, totalAmount: 0, paymentMethod: null });
      }
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    fireEvent.click(await screen.findByTestId('book-event'));
    expect(await screen.findByText("You're booked!")).toBeTruthy();
  });

  it('409 EVENT_SOLD_OUT shows the friendly message and refreshes spots-left, not a generic error', async () => {
    let bookAttempts = 0;
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/guest/events/ev-1') {
        return bookAttempts === 0
          ? makeDetail({ spotsLeft: 5 })
          : makeDetail({ spotsLeft: 0, soldOut: true });
      }
      if (path === '/guest/events/ev-1/book' && init?.method === 'POST') {
        bookAttempts += 1;
        throw new ApiError(409, 'sold out', { code: 'EVENT_SOLD_OUT' });
      }
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    fireEvent.click(await screen.findByTestId('book-event'));

    expect(await screen.findByTestId('sold-out-notice')).toHaveProperty(
      'textContent',
      'Spots just filled up',
    );
    // The sheet refetches the event and re-renders as fully sold out — the
    // stepper/payment/submit disappear rather than sitting behind a generic
    // error banner.
    await waitFor(() => expect(screen.queryByTestId('book-event')).toBeNull());
    expect(
      screen.queryByText('Something went wrong. Please try again.'),
    ).toBeNull();
  });

  it('a generic booking error (e.g. EVENT_NOT_BOOKABLE) shows the resolved inline error', async () => {
    apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/guest/events/ev-1') return makeDetail();
      if (path === '/guest/events/ev-1/book' && init?.method === 'POST') {
        throw new ApiError(409, 'not bookable', { code: 'EVENT_NOT_BOOKABLE' });
      }
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    fireEvent.click(await screen.findByTestId('book-event'));
    expect(
      await screen.findByText('This event is no longer open for booking.'),
    ).toBeTruthy();
    // Not the sold-out path — the stepper/submit stay put for a normal retry.
    expect(screen.queryByTestId('sold-out-notice')).toBeNull();
    expect(screen.getByTestId('book-event')).toBeTruthy();
  });

  it('a detail load failure shows an error state with retry', async () => {
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1') throw new ApiError(500, 'boom');
      throw new Error(`unmocked ${path}`);
    });
    wrap();
    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeTruthy();

    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events/ev-1') return makeDetail();
      throw new Error(`unmocked ${path}`);
    });
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByTestId('party-size')).toBeTruthy();
  });

  it('renders nothing when no event is selected', () => {
    wrap(null);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  // FINAL-REVIEW CRITICAL FIX — the sheet used to render the bookable UI off
  // spotsLeft/maxPartySize alone, never checking status or start time, so a
  // deep-linked past/non-published event stayed fully bookable. Mirrors
  // events-screen.test.tsx's "already started" pattern.
  describe('ended event guard (final-review CRITICAL fix)', () => {
    it('a non-published event (e.g. cancelled) shows the ended state, no bookable submit', async () => {
      apiMock.api.mockImplementation(async (path: string) => {
        if (path === '/guest/events/ev-1') return makeDetail({ status: 'cancelled' });
        throw new Error(`unmocked ${path}`);
      });
      wrap();
      expect(await screen.findByTestId('event-ended-notice')).toHaveProperty(
        'textContent',
        'This event has ended',
      );
      expect(screen.queryByTestId('party-size')).toBeNull();
      expect(screen.queryByTestId('book-event')).toBeNull();
      expect(screen.queryByTestId('pay-cash')).toBeNull();
    });

    it('an event whose startAtLocal has already passed shows the ended state, no bookable submit', async () => {
      apiMock.api.mockImplementation(async (path: string) => {
        if (path === '/guest/events/ev-1')
          return makeDetail({ startAtLocal: '2000-01-01 08:00' });
        throw new Error(`unmocked ${path}`);
      });
      wrap();
      expect(await screen.findByTestId('event-ended-notice')).toHaveProperty(
        'textContent',
        'This event has ended',
      );
      expect(screen.queryByTestId('party-size')).toBeNull();
      expect(screen.queryByTestId('book-event')).toBeNull();
    });

    it('does not attempt to book — the sheet never sends a request past the ended guard', async () => {
      const bookSpy = vi.fn();
      apiMock.api.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path === '/guest/events/ev-1')
          return makeDetail({ startAtLocal: '2000-01-01 08:00' });
        if (path === '/guest/events/ev-1/book' && init?.method === 'POST') {
          bookSpy();
          return makeBooking();
        }
        throw new Error(`unmocked ${path}`);
      });
      wrap();
      await screen.findByTestId('event-ended-notice');
      expect(bookSpy).not.toHaveBeenCalled();
    });
  });
});

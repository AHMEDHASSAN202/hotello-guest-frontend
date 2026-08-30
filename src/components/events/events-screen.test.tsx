import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import { ApiError } from '@/lib/api';
import type { GuestEvent, GuestEventBooking, GuestEventDetail } from '@/lib/types';

/** Epic 21, Stories 21.4/21.5 — browse + bookings (Task 19's stub replaced). */

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, api: apiMock.api };
});

import { EventsScreen } from './events-screen';

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

function wrap(props: Parameters<typeof EventsScreen>[0] = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <EventsScreen {...props} />
    </NextIntlClientProvider>,
  );
}

/**
 * Routes the events browse call, the three tab-filtered bookings calls, and
 * (Task 23) `GET /guest/events/:id` — the direct-fetch fallback for a
 * deep-linked event id the browse catalog doesn't contain (e.g. it already
 * started). `byId` entries not present 404, matching a genuinely dangling
 * or cross-hotel id.
 */
function stubApi({
  events = [makeEvent()],
  upcoming = [] as GuestEventBooking[],
  past = [] as GuestEventBooking[],
  cancelled = [] as GuestEventBooking[],
  eventsError = null as ApiError | null,
  bookingsError = null as ApiError | null,
  byId = {} as Record<string, GuestEventDetail>,
}: {
  events?: GuestEvent[];
  upcoming?: GuestEventBooking[];
  past?: GuestEventBooking[];
  cancelled?: GuestEventBooking[];
  eventsError?: ApiError | null;
  bookingsError?: ApiError | null;
  byId?: Record<string, GuestEventDetail>;
} = {}) {
  apiMock.api.mockImplementation(async (path: string) => {
    if (path === '/guest/events') {
      if (eventsError) throw eventsError;
      return { data: events };
    }
    if (path.startsWith('/guest/events/bookings')) {
      if (bookingsError) throw bookingsError;
      const tab = new URL(path, 'http://x').searchParams.get('tab');
      const data = tab === 'past' ? past : tab === 'cancelled' ? cancelled : upcoming;
      return { data, todayBooking: null };
    }
    const idMatch = /^\/guest\/events\/([^/]+)$/.exec(path);
    if (idMatch) {
      const detail = byId[idMatch[1]];
      if (!detail) throw new ApiError(404, 'not found', { code: 'EVENT_NOT_FOUND' });
      return detail;
    }
    throw new Error(`unmocked ${path}`);
  });
}

beforeEach(() => {
  apiMock.api.mockReset();
});

describe('EventsScreen — browse (21.4 AC1)', () => {
  it('shows a skeleton while loading, then the event card with a price and no dead end', async () => {
    let resolveEvents!: (v: { data: GuestEvent[] }) => void;
    apiMock.api.mockImplementation(async (path: string) => {
      if (path === '/guest/events') {
        return new Promise((res) => (resolveEvents = res));
      }
      return { data: [], todayBooking: null };
    });
    wrap();
    // Pending: no card yet, no crash, no dead end.
    expect(screen.queryByTestId('event-card-ev-1')).toBeNull();

    await act(async () => resolveEvents({ data: [makeEvent()] }));
    expect(await screen.findByText('Sunset Yoga')).toBeTruthy();
    const card = screen.getByTestId('event-card-ev-1');
    expect(card.textContent).toMatch(/300/);
    expect(card.textContent).toContain('Beach — Building B');
  });

  it('renders ✓Included and a free label for the other two price states', async () => {
    stubApi({
      events: [
        makeEvent({ id: 'ev-inc', price: { included: true, unitPrice: 0 } }),
        makeEvent({ id: 'ev-free', price: { included: false, unitPrice: 0 } }),
      ],
    });
    wrap();
    expect(await screen.findByTestId('event-card-ev-inc')).toBeTruthy();
    expect(screen.getByTestId('event-card-ev-inc').textContent).toContain(
      '✓ Included',
    );
    expect(screen.getByTestId('event-card-ev-free').textContent).toContain(
      'Free',
    );
  });

  it('shows the spots-left hint only when capacity is tight (≤5), not at 12', async () => {
    stubApi({
      events: [
        makeEvent({ id: 'ev-tight', spotsLeft: 3 }),
        makeEvent({ id: 'ev-loose', spotsLeft: 12 }),
      ],
    });
    wrap();
    expect(await screen.findByTestId('event-card-ev-tight')).toBeTruthy();
    expect(screen.getByTestId('event-card-ev-tight').textContent).toContain(
      '3 spots left',
    );
    expect(screen.getByTestId('event-card-ev-loose').textContent).not.toMatch(
      /spot/,
    );
  });

  it('sold-out events show the pill and are not tappable', async () => {
    stubApi({ events: [makeEvent({ id: 'ev-sold', soldOut: true, spotsLeft: 0 })] });
    wrap();
    const card = (await screen.findByTestId(
      'event-card-ev-sold',
    )) as HTMLButtonElement;
    expect(card.textContent).toContain('Sold out');
    expect(card.disabled).toBe(true);
  });

  it('a past event that slipped through is dimmed and not tappable (defensive)', async () => {
    stubApi({
      events: [makeEvent({ id: 'ev-past', startAtLocal: '2000-01-01 10:00' })],
    });
    wrap();
    const card = (await screen.findByTestId(
      'event-card-ev-past',
    )) as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    expect(card.className).toContain('opacity-70');
    expect(card.textContent).toContain('This event has ended');
  });

  it('an open card opens the booking sheet (Task 21 wiring)', async () => {
    stubApi({ events: [makeEvent()] });
    wrap();
    const card = (await screen.findByTestId(
      'event-card-ev-1',
    )) as HTMLButtonElement;
    expect(card.disabled).toBe(false);
    fireEvent.click(card);
    // Awaiting lets the sheet's own detail fetch settle within `act` —
    // the sheet itself (party size, payment, submit) is Task 21's own
    // component and gets its full coverage in event-booking-sheet.test.tsx.
    expect(await screen.findByTestId('bottom-sheet')).toBeTruthy();
  });

  it('Task 23 — initialEventId opens that event\'s own detail sheet once the catalog loads', async () => {
    stubApi({
      events: [makeEvent({ id: 'ev-1' }), makeEvent({ id: 'ev-2', title: 'Cooking Class' })],
    });
    wrap({ initialEventId: 'ev-2' });
    const sheet = await screen.findByTestId('bottom-sheet');
    expect(sheet.textContent).toContain('Cooking Class');
  });

  it('Task 23 — an event that already started (not in the browse catalog) still opens via the direct-fetch fallback', async () => {
    // `GET /guest/events` only returns upcoming events, so an announcement's
    // eventChip pointing at one that already started is legitimately absent
    // from `events` here — the screen must fall back to `GET
    // /guest/events/:id`, which the backend still serves for past events.
    stubApi({
      events: [makeEvent({ id: 'ev-1' })], // catalog: no ev-started
      byId: {
        'ev-started': makeDetail({
          id: 'ev-started',
          title: 'Morning Yoga (started)',
          startAtLocal: '2000-01-01 08:00',
        }),
      },
    });
    wrap({ initialEventId: 'ev-started' });
    const sheet = await screen.findByTestId('bottom-sheet');
    expect(sheet.textContent).toContain('Morning Yoga (started)');
  });

  it('Task 23 — a genuinely dangling initialEventId (404s on direct fetch too) shows an unavailable notice, not a dead tap', async () => {
    stubApi({ events: [makeEvent({ id: 'ev-1' })] }); // no byId entry → 404
    wrap({ initialEventId: 'ev-missing' });
    expect(await screen.findByText('Sunset Yoga')).toBeTruthy(); // catalog still renders
    const sheet = await screen.findByTestId('bottom-sheet');
    expect(sheet.textContent).toContain("We couldn't load this event.");
  });

  it('a load error shows the retry state, which re-fetches on tap', async () => {
    stubApi({ eventsError: new ApiError(500, 'boom') });
    wrap();
    expect(await screen.findByText("We couldn't load the events.")).toBeTruthy();

    stubApi({ events: [makeEvent()] });
    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('Sunset Yoga')).toBeTruthy();
  });

  it('an empty catalog shows the empty state, not a blank screen', async () => {
    stubApi({ events: [] });
    wrap();
    expect(
      await screen.findByText('No events right now — check back soon.'),
    ).toBeTruthy();
  });
});

describe('EventsScreen — bookings (21.5)', () => {
  it('upcoming bookings render first; past/cancelled collapse into a history disclosure', async () => {
    stubApi({
      upcoming: [makeBooking()],
      past: [makeBooking({ id: 'bk-past', status: 'booked' })],
      cancelled: [makeBooking({ id: 'bk-cancelled', status: 'cancelled' })],
    });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: 'My bookings' }));

    expect(await screen.findByTestId('event-booking-row-bk-1')).toBeTruthy();
    // History rows start collapsed.
    expect(screen.queryByTestId('event-booking-row-bk-past')).toBeNull();
    expect(screen.queryByTestId('event-booking-row-bk-cancelled')).toBeNull();
    expect(screen.getByText('2 earlier bookings')).toBeTruthy();

    fireEvent.click(screen.getByText('2 earlier bookings'));
    expect(screen.getByTestId('event-booking-row-bk-past')).toBeTruthy();
    expect(screen.getByTestId('event-booking-row-bk-cancelled')).toBeTruthy();
  });

  it('a booking row shows party size, total, room-charge badge and status', async () => {
    stubApi({ upcoming: [makeBooking()] });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: 'My bookings' }));
    const row = await screen.findByTestId('event-booking-row-bk-1');
    expect(row.textContent).toContain('Booked');
    expect(row.textContent).toContain('2×');
    expect(row.textContent).toMatch(/600/);
    expect(row.textContent).toContain('Room bill');

    // Task 21 wiring — opens the booking detail sheet on its snapshot; full
    // coverage of the sheet itself lives in booking-detail-sheet.test.tsx.
    fireEvent.click(row);
    const sheet = await screen.findByTestId('bottom-sheet');
    expect(sheet.textContent).toContain('Sunset Yoga');
  });

  it('an included booking shows ✓Included instead of a price', async () => {
    stubApi({
      upcoming: [makeBooking({ included: true, totalAmount: 0, paymentMethod: null })],
    });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: 'My bookings' }));
    const row = await screen.findByTestId('event-booking-row-bk-1');
    expect(row.textContent).toContain('✓ Included');
  });

  it('a bookings load error shows the retry state', async () => {
    stubApi({ bookingsError: new ApiError(500, 'boom') });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: 'My bookings' }));
    expect(
      await screen.findByText("We couldn't load your bookings."),
    ).toBeTruthy();
  });

  it('no bookings at all shows the empty state with a way back to Events', async () => {
    stubApi({ upcoming: [], past: [], cancelled: [] });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: 'My bookings' }));
    expect(
      await screen.findByText('No bookings yet — reserve a spot from Events.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByText('Browse events'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Events' }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  });
});

'use client';

import { ChevronDown, PartyPopper, Ticket } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { isLocale } from '@/i18n/config';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  GuestEvent,
  GuestEventBooking,
  GuestEventBookingsResponse,
  GuestEventsCatalog,
} from '@/lib/types';
import { Button, Screen, Skeleton } from '../ui';
import { StateShell } from '../state-screens';
import { BookingDetailSheet } from './booking-detail-sheet';
import { BookingRow } from './booking-row';
import { EventBookingSheet } from './event-booking-sheet';
import { EventCard } from './event-card';

/**
 * Events (Epic 21, 21.4/21.5) — replaces Task 19's stub. The Dining shell
 * pattern (dining-screen.tsx) applied to Events: fetch on mount → skeleton →
 * error + retry → empty → content, under a two-tab pill row (`events` |
 * `bookings`, the same `aria-pressed` idiom as `menu`/`orders`).
 *
 * Bookings tab detail: `GET guest/events/bookings` is tab-filtered
 * server-side (`?tab=upcoming|past|cancelled`, ListGuestEventsQueryDto) —
 * there is no single "everything" response. Upcoming is fetched for the
 * primary list; past + cancelled are fetched alongside and merged into one
 * "history" list (newest-created first) behind the `my-requests.tsx`
 * collapsed-disclosure pattern, so a guest sees active bookings first
 * without a second round trip when they open the disclosure.
 *
 * Task 21: `selectedEvent`/`selectedBookingId` mirror dining-screen.tsx's
 * `sheetItem`/`detailId` exactly (an object for the item being configured, a
 * bare id for the detail lookup) — `selectedBookingId` looks up the booking
 * from the already-loaded `bookings` lists (dining's `detailOrder` pattern;
 * there's no `GET .../bookings/:id`, only the tab-filtered list). Booking
 * changes tab-switch into "My bookings" and re-fetch both lists (the new
 * booking reduces the event's own spots-left too); cancellation just
 * re-fetches the bookings lists (the detail sheet renders its own snapshot
 * so nothing needs a local patch before that resolves).
 */
export function EventsScreen() {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const resolveError = useApiError();
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale) ? activeLocale : 'en';

  const [tab, setTab] = useState<'events' | 'bookings'>('events');

  const [events, setEvents] = useState<GuestEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const loadEvents = useCallback(async () => {
    setEventsError(null);
    try {
      const catalog = await api<GuestEventsCatalog>('/guest/events');
      setEvents(catalog.data);
    } catch (err) {
      setEvents(null);
      setEventsError(resolveError(err));
    }
  }, [resolveError]);
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const [bookings, setBookings] = useState<{
    upcoming: GuestEventBooking[];
    history: GuestEventBooking[];
  } | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const loadBookings = useCallback(async () => {
    setBookingsError(null);
    try {
      const [upcoming, past, cancelled] = await Promise.all([
        api<GuestEventBookingsResponse>('/guest/events/bookings?tab=upcoming'),
        api<GuestEventBookingsResponse>('/guest/events/bookings?tab=past'),
        api<GuestEventBookingsResponse>('/guest/events/bookings?tab=cancelled'),
      ]);
      const history = [...past.data, ...cancelled.data].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      setBookings({ upcoming: upcoming.data, history });
    } catch (err) {
      setBookings(null);
      setBookingsError(resolveError(err));
    }
  }, [resolveError]);
  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const [historyOpen, setHistoryOpen] = useState(false);

  // Task 21 — see file doc above.
  const [selectedEvent, setSelectedEvent] = useState<GuestEvent | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const selectedBooking =
    bookings?.upcoming.find((b) => b.id === selectedBookingId) ??
    bookings?.history.find((b) => b.id === selectedBookingId) ??
    null;

  function onBooked() {
    setSelectedEvent(null);
    setTab('bookings');
    void loadEvents();
    void loadBookings();
  }

  return (
    <Screen>
      <div className="flex items-center justify-between pt-3">
        <h1 className="font-semibold text-xl text-ink">{t('title')}</h1>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {(['events', 'bookings'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`pressable rounded-full px-4 py-2 text-sm font-semibold ${
              tab === key
                ? 'bg-accent text-accent-contrast'
                : 'bg-ink/[0.06] text-ink'
            }`}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'events' ? (
        eventsError ? (
          <div className="mt-8">
            <StateShell icon={PartyPopper} title={t('browse.loadError')} body="">
              <button
                onClick={() => void loadEvents()}
                className="pressable mt-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast"
              >
                {tc('retry')}
              </button>
            </StateShell>
          </div>
        ) : events === null ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : events.length === 0 ? (
          <div className="mt-8">
            <StateShell icon={PartyPopper} title={t('browse.empty')} body="" />
          </div>
        ) : (
          <EventCard events={events} locale={locale} onPick={setSelectedEvent} />
        )
      ) : (
        <div className="mt-6">
          {bookingsError ? (
            <StateShell icon={Ticket} title={t('bookings.loadError')} body="">
              <button
                onClick={() => void loadBookings()}
                className="pressable mt-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast"
              >
                {tc('retry')}
              </button>
            </StateShell>
          ) : bookings === null ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : bookings.upcoming.length === 0 && bookings.history.length === 0 ? (
            <StateShell icon={Ticket} title={t('bookings.empty')} body="">
              <Button onClick={() => setTab('events')} className="max-w-[240px]">
                {t('bookings.browseCta')}
              </Button>
            </StateShell>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.upcoming.length === 0 ? (
                <p className="text-center text-sm text-ink-soft">
                  {t('bookings.noUpcoming')}
                </p>
              ) : (
                bookings.upcoming.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    locale={locale}
                    onOpen={() => setSelectedBookingId(booking.id)}
                  />
                ))
              )}

              {bookings.history.length > 0 ? (
                <div className="mt-2">
                  <button
                    onClick={() => setHistoryOpen((v) => !v)}
                    aria-expanded={historyOpen}
                    className="pressable flex min-h-[44px] w-full items-center justify-between text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
                  >
                    {t('bookings.history', { count: bookings.history.length })}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {historyOpen ? (
                    <div className="animate-fade-in mt-2 flex flex-col gap-3">
                      {bookings.history.map((booking) => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          locale={locale}
                          onOpen={() => setSelectedBookingId(booking.id)}
                          muted
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <EventBookingSheet
        event={selectedEvent}
        locale={locale}
        onClose={() => setSelectedEvent(null)}
        onBooked={onBooked}
      />
      <BookingDetailSheet
        booking={selectedBooking}
        locale={locale}
        onClose={() => setSelectedBookingId(null)}
        onChanged={() => void loadBookings()}
      />
    </Screen>
  );
}

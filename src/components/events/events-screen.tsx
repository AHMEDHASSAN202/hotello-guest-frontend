'use client';

import { ChevronDown, PartyPopper, Ticket } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { isLocale } from '@/i18n/config';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type { GuestEvent, GuestEventBooking, GuestEventsCatalog } from '@/lib/types';
import { useGuestEventBookings } from '@/lib/use-guest-event-bookings';
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
 * there is no single "everything" response. Task 22's `useGuestEventBookings`
 * (`@/lib/use-guest-event-bookings`) owns the three-parallel-call fetch, the
 * "past + cancelled merged into one history list" logic, and the
 * `todayBooking` field the home strip reads — this screen only renders what
 * the hook hands back (dining-screen.tsx's `useGuestFnbOrders` precedent).
 *
 * Task 21: `selectedEventId`/`selectedBookingId` both look up their object
 * from the already-loaded lists (dining's `detailOrder` pattern; there's no
 * `GET .../bookings/:id`, only the tab-filtered list, and the browse list is
 * already in memory once the events tab has loaded) — deriving from an id
 * rather than stashing the picked object means a deep-linked id (Task 23's
 * `initialEventId`) resolves the same way a card tap does, once the list is
 * in.
 * `initialBookingId` (Task 22 — the home strip's "today" tap) seeds both the
 * tab and the selection the same way `dining-screen.tsx`'s `initialOrderId`
 * does. `initialEventId` (Task 23 — an announcement's event chip) does the
 * same for the events tab. A fresh booking applies instantly via
 * `applyLocal` (dining's `onPlaced` precedent — no forced re-fetch, the poll
 * confirms it); a cancellation applies locally AND triggers a background
 * `refresh` (dining's `OrderDetailSheet.onChanged` precedent, since a
 * cancellation can also free up a spot for other guests visible on the
 * events tab).
 */
export function EventsScreen({
  initialBookingId,
  initialEventId,
}: {
  /** "Today's booking" strip intent — opens the bookings tab on this booking's detail sheet. */
  initialBookingId?: string | null;
  /** An announcement's event chip intent — opens the events tab on this event's detail sheet. */
  initialEventId?: string | null;
} = {}) {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const resolveError = useApiError();
  const activeLocale = useLocale();
  const locale: Locale = isLocale(activeLocale) ? activeLocale : 'en';

  const [tab, setTab] = useState<'events' | 'bookings'>(
    initialBookingId ? 'bookings' : 'events',
  );

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

  // Task 22 — the shared delta-polling bookings hook (replaces Task 20's
  // ad-hoc 3-parallel-`api()`-calls that lived inline here).
  const {
    feed: bookings,
    error: bookingsErrorRaw,
    refresh: refreshBookings,
    applyLocal,
  } = useGuestEventBookings(true);
  const bookingsError = bookingsErrorRaw ? resolveError(bookingsErrorRaw) : null;

  const [historyOpen, setHistoryOpen] = useState(false);

  // Task 21/23 — see file doc above.
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialEventId ?? null,
  );
  const selectedEvent: GuestEvent | null =
    events?.find((e) => e.id === selectedEventId) ?? null;
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialBookingId ?? null,
  );
  const selectedBooking =
    bookings?.upcoming.find((b) => b.id === selectedBookingId) ??
    bookings?.history.find((b) => b.id === selectedBookingId) ??
    null;

  function onBooked(booking: GuestEventBooking) {
    setSelectedEventId(null);
    setTab('bookings');
    applyLocal(booking);
    void loadEvents(); // a fresh booking moves the event's own spots-left
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
          <EventCard
            events={events}
            locale={locale}
            onPick={(event) => setSelectedEventId(event.id)}
          />
        )
      ) : (
        <div className="mt-6">
          {bookingsError ? (
            <StateShell icon={Ticket} title={t('bookings.loadError')} body="">
              <button
                onClick={() => void refreshBookings()}
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
        onClose={() => setSelectedEventId(null)}
        onBooked={onBooked}
      />
      <BookingDetailSheet
        booking={selectedBooking}
        locale={locale}
        onClose={() => setSelectedBookingId(null)}
        onChanged={(booking) => {
          applyLocal(booking);
          void refreshBookings();
        }}
      />
    </Screen>
  );
}

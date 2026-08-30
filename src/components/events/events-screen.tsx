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
  GuestEventDetail,
  GuestEventsCatalog,
} from '@/lib/types';
import { useGuestEventBookings } from '@/lib/use-guest-event-bookings';
import { Button, Screen, Skeleton } from '../ui';
import { BottomSheet } from '../bottom-sheet';
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
 * same for the events tab — BUT `GET /guest/events` (the loaded catalog)
 * only returns `published` events that haven't started yet, while an
 * announcement's `eventChip` is only nulled server-side for `cancelled`
 * events, not for ones that have already started. So a chip can legitimately
 * point at an id the catalog will never contain. When the catalog has
 * settled (loaded or errored) and the id still isn't in it, `events-screen`
 * falls back to `GET /guest/events/:id` directly — the same endpoint
 * `EventBookingSheet` itself already trusts over the list snapshot, and one
 * that explicitly still serves past events — so the sheet still opens with
 * that event's real detail. If even that direct fetch fails (id genuinely
 * gone), a small sheet says so instead of the tap doing nothing.
 * A fresh booking applies instantly via `applyLocal` (dining's `onPlaced`
 * precedent — no forced re-fetch, the poll confirms it); a cancellation
 * applies locally AND triggers a background `refresh` (dining's
 * `OrderDetailSheet.onChanged` precedent, since a cancellation can also free
 * up a spot for other guests visible on the events tab).
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

  // Task 21/23 — see file doc above. The catalog is the primary source; a
  // direct-by-id fetch is the fallback for an id the catalog doesn't (and,
  // for an already-started event, never will) contain.
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialEventId ?? null,
  );
  const [fallbackEvent, setFallbackEvent] = useState<GuestEventDetail | null>(
    null,
  );
  const [fallbackEventError, setFallbackEventError] = useState(false);
  const catalogSettled = events !== null || eventsError !== null;

  // Reset the fallback whenever the selection changes to a different id.
  useEffect(() => {
    setFallbackEvent(null);
    setFallbackEventError(false);
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (!catalogSettled) return; // give the primary catalog lookup a chance first
    if (events?.some((e) => e.id === selectedEventId)) return; // resolved via the catalog
    if (fallbackEvent || fallbackEventError) return; // already resolved (or failed) for this id
    let cancelled = false;
    void api<GuestEventDetail>(`/guest/events/${selectedEventId}`)
      .then((detail) => {
        if (!cancelled) setFallbackEvent(detail);
      })
      .catch(() => {
        if (!cancelled) setFallbackEventError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, catalogSettled, events, fallbackEvent, fallbackEventError]);

  const selectedEvent: GuestEvent | null =
    events?.find((e) => e.id === selectedEventId) ??
    (fallbackEvent?.id === selectedEventId ? fallbackEvent : null);
  // The chip's id resolved to neither the catalog nor the direct fetch —
  // a genuinely dead reference. Say so instead of a silent dead tap.
  const selectedEventUnavailable =
    selectedEventId !== null &&
    catalogSettled &&
    !selectedEvent &&
    fallbackEventError;

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
          {/* FINAL-REVIEW FIX (whole-branch review) — the error shell is
              reachable ONLY while there is nothing to show. A failed FULL
              refresh (e.g. the background one an optimistic cancel triggers)
              used to replace an already-populated, perfectly valid bookings
              list with the "couldn't load" shell on a transient network blip.
              With a feed in hand we keep rendering it; the next poll tick
              self-heals the staleness and clears the error. (Dining's
              precedent: `dining-screen.tsx` also never lets `ordersError`
              displace a loaded orders list.) */}
          {bookingsError && bookings === null ? (
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
                // `BookingRow` emits an `<li>` (order-row.tsx's shape), so it
                // needs a real list parent — dining-screen.tsx's `<ul>` around
                // `OrderRow`. The `flex flex-col gap-3` moves onto the list so
                // the rendered spacing is byte-identical to the old flat map.
                <ul className="flex flex-col gap-3">
                  {bookings.upcoming.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      locale={locale}
                      onOpen={() => setSelectedBookingId(booking.id)}
                    />
                  ))}
                </ul>
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
                    <ul className="animate-fade-in mt-2 flex flex-col gap-3">
                      {bookings.history.map((booking) => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          locale={locale}
                          onOpen={() => setSelectedBookingId(booking.id)}
                          muted
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {/* A refresh that failed while we already have a list to show: the
              list stays (above), but staleness still has to be visible —
              silence would present optimistic state as authoritative. Same
              placement and treatment as dining's `ordersError` line. */}
          {bookingsError && bookings !== null ? (
            <p
              data-testid="bookings-stale"
              className="mt-3 text-center text-sm text-danger"
            >
              {bookingsError}
            </p>
          ) : null}
        </div>
      )}

      <EventBookingSheet
        event={selectedEvent}
        locale={locale}
        onClose={() => setSelectedEventId(null)}
        onBooked={onBooked}
      />
      <BottomSheet
        open={selectedEventUnavailable}
        onClose={() => setSelectedEventId(null)}
      >
        <p role="alert" className="py-6 text-center text-sm text-danger">
          {t('sheet.loadError')}
        </p>
      </BottomSheet>
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

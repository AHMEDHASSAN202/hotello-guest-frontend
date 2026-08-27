/**
 * Epic 17 — client-side "Open now / Opens at" (spec note 2: the API returns
 * raw windows so responses stay cacheable; the client owns the clock).
 * Ported from the backend's fnb-availability.ts + stay-time.ts so both sides
 * agree on the boundary semantics.
 */

export interface HoursWindow {
  /** 'HH:MM' hotel-local wall clock. start > end spans midnight. */
  start: string;
  end: string;
}

export interface Availability {
  available: boolean;
  /** 'HH:MM' of the nearest upcoming window start when closed. */
  opensAt: string | null;
}

/** 'HH:MM' → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes since midnight in the hotel's timezone. */
export function hotelLocalMinutes(timezone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  // Some ICU builds report midnight as '24' — normalize.
  const hour =
    Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** Start-inclusive, end-exclusive; start > end spans midnight; equal = always. */
export function isWithinWindow(w: HoursWindow, minutes: number): boolean {
  const start = minutesOf(w.start);
  const end = minutesOf(w.end);
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

/** Empty windows = always open (same rule as menus). */
export function availability(
  windows: HoursWindow[],
  minutes: number,
): Availability {
  if (windows.length === 0) return { available: true, opensAt: null };
  if (windows.some((w) => isWithinWindow(w, minutes))) {
    return { available: true, opensAt: null };
  }
  const next = windows
    .map((w) => ({
      start: w.start,
      delta: (minutesOf(w.start) - minutes + 1440) % 1440,
    }))
    .sort((a, b) => a.delta - b.delta)[0];
  return { available: false, opensAt: next.start };
}

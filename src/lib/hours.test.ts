import { describe, expect, it } from 'vitest';
import {
  availability,
  hotelLocalMinutes,
  isWithinWindow,
  minutesOf,
} from './hours';

/** Epic 17 spec note 6 — open-now boundaries incl. overnight windows. */
describe('hours (17.2 AC2)', () => {
  const day = { start: '07:00', end: '11:00' };
  const overnight = { start: '20:00', end: '02:00' };

  it('day window is start-inclusive, end-exclusive', () => {
    expect(isWithinWindow(day, minutesOf('07:00'))).toBe(true);
    expect(isWithinWindow(day, minutesOf('10:59'))).toBe(true);
    expect(isWithinWindow(day, minutesOf('11:00'))).toBe(false);
    expect(isWithinWindow(day, minutesOf('06:59'))).toBe(false);
  });

  it('overnight window wraps midnight', () => {
    expect(isWithinWindow(overnight, minutesOf('23:00'))).toBe(true);
    expect(isWithinWindow(overnight, minutesOf('01:59'))).toBe(true);
    expect(isWithinWindow(overnight, minutesOf('02:00'))).toBe(false);
    expect(isWithinWindow(overnight, minutesOf('12:00'))).toBe(false);
  });

  it('degenerate equal start/end means always open', () => {
    expect(isWithinWindow({ start: '09:00', end: '09:00' }, 0)).toBe(true);
  });

  it('no windows = always open', () => {
    expect(availability([], minutesOf('03:00'))).toEqual({
      available: true,
      opensAt: null,
    });
  });

  it('closed → nearest upcoming start, wrapping across midnight', () => {
    expect(availability([overnight], minutesOf('12:00'))).toEqual({
      available: false,
      opensAt: '20:00',
    });
    // 03:00 with a 07:00 window and a 20:00 window → 07:00 is nearer
    expect(availability([overnight, day], minutesOf('03:00'))).toEqual({
      available: false,
      opensAt: '07:00',
    });
  });

  it('hotelLocalMinutes converts a UTC instant into hotel wall-clock minutes', () => {
    // 2026-01-15T10:00:00Z is 12:00 in Africa/Cairo (UTC+2 in winter).
    const noonish = new Date('2026-01-15T10:00:00Z');
    expect(hotelLocalMinutes('Africa/Cairo', noonish)).toBe(12 * 60);
    // Midnight normalization ('24' ICU quirk) — 22:00Z = 00:00 Cairo.
    const midnight = new Date('2026-01-14T22:00:00Z');
    expect(hotelLocalMinutes('Africa/Cairo', midnight)).toBe(0);
  });
});

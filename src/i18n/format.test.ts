import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../messages/ar';
import ru from '../../messages/ru';
import {
  formatCheckoutDate,
  formatCountdown,
  isCheckoutDay,
  nightsRemaining,
  todayInTimezone,
} from './format';

describe('Russian plural rules (14.3 AC6 — the test case)', () => {
  const t = createTranslator({ locale: 'ru', messages: ru, namespace: 'home' });

  it('1 ночь (one)', () => {
    expect(t('stayCard.nights', { count: 1 })).toContain('1 ночь');
  });
  it('2 ночи (few)', () => {
    expect(t('stayCard.nights', { count: 2 })).toContain('2 ночи');
  });
  it('5 ночей (many)', () => {
    expect(t('stayCard.nights', { count: 5 })).toContain('5 ночей');
  });
  it('21 ночь (one again — the trap)', () => {
    expect(t('stayCard.nights', { count: 21 })).toContain('21 ночь');
  });
});

describe('Arabic plural rules', () => {
  const t = createTranslator({ locale: 'ar', messages: ar, namespace: 'home' });

  it('dual form for 2', () => {
    expect(t('stayCard.nights', { count: 2 })).toBe('ليلتان متبقيتان');
  });
  it('few form for 3', () => {
    expect(t('stayCard.nights', { count: 3 })).toContain('3');
  });
});

describe('formatCheckoutDate (14.3 AC6)', () => {
  it('en: "Sat, 24 Aug" shape', () => {
    const out = formatCheckoutDate('2026-08-24', 'en');
    expect(out).toMatch(/Mon/);
    expect(out).toMatch(/24/);
    expect(out).toMatch(/Aug/);
  });
  it('ru: «до сб, 24 авг.» shape', () => {
    const out = formatCheckoutDate('2026-08-24', 'ru');
    expect(out).toContain('24');
    expect(out.toLowerCase()).toContain('авг');
  });
  it('ar: Latin digits, never Eastern Arabic numerals', () => {
    const out = formatCheckoutDate('2026-08-24', 'ar');
    expect(out).toContain('24');
    expect(out).not.toMatch(/[٠-٩]/);
  });
});

describe('nightsRemaining / isCheckoutDay', () => {
  const tz = 'Africa/Cairo';
  const shift = (days: number) => {
    const [y, m, d] = todayInTimezone(tz).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().slice(0, 10);
  };

  it('3 nights until a checkout 3 days out', () => {
    expect(nightsRemaining(shift(3), tz)).toBe(3);
  });
  it('0 nights on the checkout day itself', () => {
    expect(nightsRemaining(shift(0), tz)).toBe(0);
    expect(isCheckoutDay(shift(0), tz)).toBe(true);
  });
  it('not checkout day while nights remain', () => {
    expect(isCheckoutDay(shift(2), tz)).toBe(false);
  });
  it('never negative after checkout has passed', () => {
    expect(nightsRemaining(shift(-1), tz)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats mm:ss', () => {
    expect(formatCountdown(605)).toBe('10:05');
    expect(formatCountdown(59)).toBe('00:59');
  });
  it('clamps at zero', () => {
    expect(formatCountdown(-4)).toBe('00:00');
  });
});

import { describe, expect, it } from 'vitest';
import { resolveLocale } from './resolve-locale';

describe('resolveLocale (14.3 AC2 — resolution order)', () => {
  it('explicit user choice wins over everything', () => {
    expect(
      resolveLocale({ explicit: 'de', stay: 'ru', acceptLanguage: 'fr-FR,fr;q=0.9' }),
    ).toBe('de');
  });

  it("the stay's guest language beats Accept-Language", () => {
    expect(resolveLocale({ stay: 'ru', acceptLanguage: 'de-DE,de;q=0.9' })).toBe('ru');
  });

  it('falls back to the best Accept-Language match pre-login', () => {
    expect(resolveLocale({ acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' })).toBe('fr');
  });

  it('matches regional tags to their base language (de-AT → de)', () => {
    expect(resolveLocale({ acceptLanguage: 'de-AT,en;q=0.5' })).toBe('de');
  });

  it('respects q-value ordering, not listing order', () => {
    expect(resolveLocale({ acceptLanguage: 'ja;q=0.9,it;q=1.0,es;q=0.8' })).toBe('it');
  });

  it('skips unsupported languages until one of the seven matches', () => {
    expect(resolveLocale({ acceptLanguage: 'ja-JP,zh;q=0.9,es-MX;q=0.8' })).toBe('es');
  });

  it('ignores an invalid explicit cookie and keeps resolving', () => {
    expect(resolveLocale({ explicit: 'xx', stay: 'it' })).toBe('it');
  });

  it('ignores an invalid stay language', () => {
    expect(resolveLocale({ stay: 'tlh', acceptLanguage: 'ar' })).toBe('ar');
  });

  it('defaults to en when nothing matches', () => {
    expect(resolveLocale({ acceptLanguage: 'ja-JP,zh;q=0.9' })).toBe('en');
  });

  it('defaults to en on garbage or empty input', () => {
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ acceptLanguage: ';;;===,,,' })).toBe('en');
    expect(resolveLocale({ explicit: null, stay: null, acceptLanguage: null })).toBe('en');
  });
});

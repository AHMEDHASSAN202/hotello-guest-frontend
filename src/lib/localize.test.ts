import { describe, expect, it } from 'vitest';
import { localizeField } from './localize';

describe('localizeField (18.2 AC2/AC3 — EN fallback chain)', () => {
  const map = { ar: 'أهلاً', en: 'Welcome' };

  it('returns the requested locale when present', () => {
    expect(localizeField(map, 'ar')).toBe('أهلاً');
  });

  it('falls back to English for untranslated locales', () => {
    expect(localizeField(map, 'ru')).toBe('Welcome');
    expect(localizeField(map, 'de')).toBe('Welcome');
  });

  it('returns null when there is nothing to show (no empty gap)', () => {
    expect(localizeField(null, 'en')).toBeNull();
    expect(localizeField(undefined, 'en')).toBeNull();
    expect(localizeField({}, 'en')).toBeNull();
    expect(localizeField({ en: '' }, 'en')).toBeNull();
  });
});

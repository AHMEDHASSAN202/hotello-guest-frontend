import { describe, expect, it } from 'vitest';
import { GXP_NAVY, accentVars } from './color';

describe('accentVars (14.4/14.5 continuity, locked by Epic 18)', () => {
  it('uses the hotel accent when valid — theme-color follows it (18.2 AC3)', () => {
    const vars = accentVars('#0F6B5C');
    expect(vars['--accent']).toBe('#0F6B5C');
    expect(vars['--accent-soft']).toBe('color-mix(in srgb, #0F6B5C 8%, white)');
    expect(vars['--accent-contrast']).toBe('#FFFFFF');
  });

  it('falls back to GXP navy for null, missing, or malformed accents', () => {
    expect(accentVars(null)['--accent']).toBe(GXP_NAVY);
    expect(accentVars(undefined)['--accent']).toBe(GXP_NAVY);
    expect(accentVars('#12345')['--accent']).toBe(GXP_NAVY);
    expect(accentVars('red')['--accent']).toBe(GXP_NAVY);
  });

  it('flips to dark contrast text over light accents', () => {
    expect(accentVars('#FFFFFF')['--accent-contrast']).toBe('#1A1D21');
    expect(accentVars('#0E2A47')['--accent-contrast']).toBe('#FFFFFF');
  });
});

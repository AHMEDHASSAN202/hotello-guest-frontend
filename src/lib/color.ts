/** GXP navy — the default accent when a hotel has no branding module. */
export const GXP_NAVY = '#0E2A47';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** WCAG relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * The three accent CSS custom properties, computed server-side from the
 * hotel's accent (or the GXP default). All three are set together on the app
 * frame: `--accent-soft` embeds the literal hex because a var() inside a
 * :root-level custom property would not re-resolve against a descendant's
 * `--accent` override.
 */
export function accentVars(brandAccentColor: string | null | undefined): Record<string, string> {
  const accent = brandAccentColor && HEX_RE.test(brandAccentColor) ? brandAccentColor : GXP_NAVY;
  return {
    '--accent': accent,
    '--accent-soft': `color-mix(in srgb, ${accent} 8%, white)`,
    '--accent-contrast': luminance(accent) > 0.45 ? '#1A1D21' : '#FFFFFF',
  };
}

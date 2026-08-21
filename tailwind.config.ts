import type { Config } from 'tailwindcss';

/**
 * Guest App design tokens (14.5 AC4) — deliberately NOT the dashboard's set.
 * Premium-hospitality feel: warm paper canvas, generous radii, one accent
 * injected at runtime from the hotel profile (CSS custom properties set in
 * src/app/[slug]/layout.tsx; defaults live in globals.css).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          contrast: 'var(--accent-contrast)',
        },
        canvas: '#F6F5F2',
        card: '#FFFFFF',
        ink: { DEFAULT: '#1A1D21', soft: '#5A6068', faint: '#9AA1A9' },
        line: '#ECEAE5',
        danger: '#B3402A',
        success: '#2F7D4F',
      },
      borderRadius: {
        card: '1.25rem',
        sheet: '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(26 29 33 / 0.04), 0 8px 24px rgb(26 29 33 / 0.06)',
        sheet: '0 -8px 40px rgb(26 29 33 / 0.16)',
      },
      fontFamily: {
        // Set by next/font in the root layout; Arabic falls through per glyph.
        sans: ['var(--font-sans)', 'var(--font-arabic)', 'sans-serif'],
      },
      keyframes: {
        'screen-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'screen-in': 'screen-in 0.24s cubic-bezier(0.2, 0.8, 0.3, 1)',
        'sheet-in': 'sheet-in 0.28s cubic-bezier(0.2, 0.8, 0.3, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;

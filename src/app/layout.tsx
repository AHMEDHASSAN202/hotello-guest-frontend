import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { SwRegister } from '@/components/sw-register';
import { dirFor, type Locale } from '@/i18n/config';
import './globals.css';

/**
 * Three-script type system (14.3 AC5): one Latin+Cyrillic family and its
 * Arabic companion, matched in weight. next/font self-hosts with per-script
 * unicode-range splits, so a Russian guest never downloads Arabic glyphs.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  title: 'GXP',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Safe-area insets only exist under viewport-fit=cover (14.1 AC2).
  viewportFit: 'cover',
  // Keyboard must not jump the layout on the code input (14.5 AC5).
  interactiveWidget: 'resizes-content',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dirFor(locale)} className={`${plexSans.variable} ${plexArabic.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <main id="app-frame">{children}</main>
        </NextIntlClientProvider>
        <SwRegister />
      </body>
    </html>
  );
}

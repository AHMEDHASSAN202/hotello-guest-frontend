import type { Metadata, Viewport } from 'next';
import { getLocale } from 'next-intl/server';
import { HotelProvider, hotelDisplayName } from '@/components/hotel-provider';
import { HotelNotFoundScreen, UnavailableScreen } from '@/components/state-screens';
import { accentVars } from '@/lib/color';
import type { GuestHotelProfile } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Server-side branding bootstrap (14.1 AC5 / 14.4 AC1): resolve the hotel
 * before anything renders. Next dedupes this fetch across layout, metadata,
 * and viewport within one request; revalidate matches the backend's 60s cache.
 */
async function fetchHotelProfile(slug: string): Promise<GuestHotelProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/guest/${encodeURIComponent(slug)}/profile`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GuestHotelProfile;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const hotel = await fetchHotelProfile(params.slug);
  if (!hotel) return { title: 'GXP' };
  const locale = await getLocale();
  return {
    title: hotelDisplayName(hotel, locale),
    manifest: `/${hotel.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default' },
  };
}

/** Status bar blends with the header — theme-color = the hotel accent (14.5 AC5). */
export async function generateViewport({
  params,
}: {
  params: { slug: string };
}): Promise<Viewport> {
  const hotel = await fetchHotelProfile(params.slug);
  return { themeColor: String(accentVars(hotel?.brandAccentColor)['--accent']) };
}

export default async function HotelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const hotel = await fetchHotelProfile(params.slug);
  const locale = await getLocale();

  // Unknown/inactive hotel — branded not-found, rendered in place so the
  // guest keeps the URL (a re-scan of a fixed QR just works).
  if (!hotel) return <HotelNotFoundScreen />;

  const style = accentVars(hotel.brandAccentColor) as React.CSSProperties;

  // Suspended or expired (indistinguishable to guests): every child route,
  // login included, shows the clean unavailable screen — URLs never break.
  if (hotel.status === 'unavailable') {
    return (
      <div style={style} className="min-h-dvh">
        <UnavailableScreen hotelName={hotelDisplayName(hotel, locale)} />
      </div>
    );
  }

  return (
    <div style={style} className="min-h-dvh">
      <HotelProvider hotel={hotel}>{children}</HotelProvider>
    </div>
  );
}

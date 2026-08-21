import { accentVars, GXP_NAVY } from '@/lib/color';
import type { GuestHotelProfile } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Per-hotel PWA manifest (14.1 AC2): the installed app carries the HOTEL's
 * name and accent, not GXP's — hotel-first branding.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  let hotel: GuestHotelProfile | null = null;
  try {
    const res = await fetch(`${API_BASE}/guest/${encodeURIComponent(params.slug)}/profile`, {
      next: { revalidate: 60 },
    });
    if (res.ok) hotel = (await res.json()) as GuestHotelProfile;
  } catch {
    /* manifest degrades to defaults */
  }
  if (!hotel) return new Response('Not found', { status: 404 });

  const accent = String(accentVars(hotel.brandAccentColor)['--accent'] ?? GXP_NAVY);
  const manifest = {
    name: hotel.nameEn,
    short_name: hotel.nameEn,
    id: `/${hotel.slug}`,
    start_url: `/${hotel.slug}`,
    scope: `/${hotel.slug}`,
    display: 'standalone',
    orientation: 'portrait',
    theme_color: accent,
    background_color: '#F6F5F2',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return Response.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

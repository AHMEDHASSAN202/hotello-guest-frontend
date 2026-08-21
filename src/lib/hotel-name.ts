/**
 * Locale-aware hotel display name — Arabic UI shows nameAr, all others
 * nameEn. Lives outside any 'use client' module so server components
 * (layout metadata, manifest) can call it as a plain function.
 */
export function hotelDisplayName(
  hotel: { nameEn: string; nameAr: string },
  locale: string,
): string {
  return locale === 'ar' ? hotel.nameAr : hotel.nameEn;
}

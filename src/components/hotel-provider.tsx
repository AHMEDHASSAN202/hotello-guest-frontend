'use client';

import { useLocale } from 'next-intl';
import { createContext, useContext, type ReactNode } from 'react';
import { hotelDisplayName } from '@/lib/hotel-name';
import type { GuestHotelProfile } from '@/lib/types';

interface HotelContextValue {
  hotel: GuestHotelProfile;
  /** Locale-aware display name — Arabic UI shows nameAr, all others nameEn. */
  hotelName: string;
  isModuleEnabled: (key: string) => boolean;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({
  hotel,
  children,
}: {
  hotel: GuestHotelProfile;
  children: ReactNode;
}) {
  const locale = useLocale();
  const value: HotelContextValue = {
    hotel,
    hotelName: hotelDisplayName(hotel, locale),
    isModuleEnabled: (key) => hotel.enabledModules.includes(key),
  };
  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be used inside <HotelProvider>');
  return ctx;
}

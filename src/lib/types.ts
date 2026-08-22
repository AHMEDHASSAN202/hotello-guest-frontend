/**
 * Backend contract shapes — mirrored from the Epic 13.5 / 14 specs, NEVER
 * redefined elsewhere in this app. camelCase per the recorded 13.5 decision.
 */

/** `POST /guest/{slug}/session` profile + `GET /guest/me` response. */
export interface GuestProfile {
  guestName: string;
  roomNumber: string;
  hotelNameEn: string;
  hotelNameAr: string;
  slug: string;
  /** One of the seven GUEST_LANGUAGES. */
  language: string;
  /** 'YYYY-MM-DD'. */
  checkOutDate: string;
}

export interface GuestSessionResponse {
  accessToken: string;
  profile: GuestProfile;
}

/* ---- Guest Requests (Epic 15) ---- */

export type GuestRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

/** `GET /guest/catalog` — names/descriptions pre-localized server-side. */
export interface GuestCatalogItem {
  id: string;
  name: string;
  description: string | null;
  /** lucide icon name; unknown names fall back client-side. */
  icon: string;
  optionType: 'quantity' | 'time' | null;
  optionMin: number | null;
  optionMax: number | null;
}

export interface GuestCatalogCategory {
  id: string;
  name: string;
  icon: string;
  items: GuestCatalogItem[];
}

/** `GET /guest/requests` rows (`data` + `serverTime` delta cursor). */
export interface GuestRequest {
  id: string;
  itemName: string;
  icon: string;
  optionType: 'quantity' | 'time' | null;
  optionValue: string | null;
  note: string | null;
  status: GuestRequestStatus;
  slaTargetMinutes: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  updatedAt: string;
}

/** `GET /guest/{slug}/profile` — public branding bootstrap (14.4 AC1). */
export interface GuestHotelProfile {
  slug: string;
  nameEn: string;
  nameAr: string;
  /** Relative to the API base: `files/{key}`, or null. */
  logoUrl: string | null;
  /** Suspended and expired are indistinguishable to guests. */
  status: 'active' | 'unavailable';
  /** Non-null only when the plan includes `guest_app_branding`. */
  brandAccentColor: string | null;
  /** 'HH:MM', hotel-local. */
  checkoutTime: string;
  /** IANA timezone. */
  timezone: string;
  defaultLanguage: string;
  enabledModules: string[];
}

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

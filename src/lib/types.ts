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
  /** Board basis (Epic 16, 16.1 AC4) — prices menus without extra calls. */
  stayType: string;
  /** Keys the client-persisted cart per stay (Epic 16, note 9). */
  stayId: string;
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
  /** ISO currency code — F&B prices format with it (Epic 16). */
  currency: string;
  enabledModules: string[];
}


/* ---- F&B Ordering (Epic 16) ---- */

export type FnbOrderStatus =
  | 'new'
  | 'preparing'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export const OPEN_FNB_ORDER_STATUSES: FnbOrderStatus[] = [
  'new',
  'preparing',
  'on_the_way',
];

export type FnbPaymentMethod = 'cash' | 'room_charge';

/** `GET /guest/fnb/menus` — everything pre-localized + priced server-side
 * for THIS guest's stay type; client totals are display-only. */
export interface GuestFnbVariantOption {
  key: string;
  name: string;
  included: boolean;
  unitPrice: number;
}

export interface GuestFnbItem {
  id: string;
  name: string;
  description: string | null;
  /** Relative to the API base (`files/{key}`), or null → placeholder. */
  photoThumbUrl: string | null;
  photoDetailUrl: string | null;
  included: boolean;
  /** Lowest applicable price ("from X" for variants); 0 when included. */
  unitPrice: number;
  allowNotes: boolean;
  variant: { label: string; options: GuestFnbVariantOption[] } | null;
}

export interface GuestFnbSection {
  id: string;
  name: string;
  items: GuestFnbItem[];
}

export interface GuestFnbMenu {
  id: string;
  name: string;
  description: string | null;
  availability: { available: boolean; opensAt: string | null };
  windows: Array<{ start: string; end: string }>;
  prepSlaMinutes: number;
  sections: GuestFnbSection[];
}

export interface GuestFnbLocation {
  id: string;
  key: string;
  name: string;
  hasSpots: boolean;
  spotLabel: string | null;
}

export interface GuestFnbCatalog {
  stayType: string;
  currency: string;
  paymentMethods: FnbPaymentMethod[];
  locations: GuestFnbLocation[];
  menus: GuestFnbMenu[];
}

/** `GET /guest/fnb/orders` rows (`data` + `serverTime` delta cursor). */
export interface GuestFnbOrderLine {
  id: string;
  itemName: string;
  variantOptionName: string | null;
  quantity: number;
  unitPrice: number;
  included: boolean;
  lineTotal: number;
  note: string | null;
  photoThumbUrl: string | null;
}

export interface GuestFnbOrder {
  id: string;
  status: FnbOrderStatus;
  destinationType: 'room' | 'location';
  locationName: string | null;
  spot: string | null;
  roomNumber: string;
  paymentMethod: FnbPaymentMethod | null;
  totalAmount: number;
  currency: string;
  slaTargetMinutes: number;
  createdAt: string;
  startedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  /** Room-charge orders flip true once the front desk collects (16.8). */
  settled: boolean;
  updatedAt: string;
  lines: GuestFnbOrderLine[];
}

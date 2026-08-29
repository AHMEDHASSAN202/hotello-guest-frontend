import {
  CarFront,
  Compass,
  ConciergeBell,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

/**
 * Config-driven services grid (14.4 AC3). Epic 15 activates Requests by
 * flipping `live: true` — nothing else changes. `moduleKey: null` = the tile
 * is unconditional; otherwise the hotel's plan `enabledModules` gates it.
 */
export interface GuestTile {
  key: 'requests' | 'dining' | 'transport' | 'info';
  icon: LucideIcon;
  moduleKey: string | null;
  live: boolean;
}

export const GUEST_TILES: GuestTile[] = [
  // Epic 15 (15.2 AC1) — the first live tile.
  { key: 'requests', icon: ConciergeBell, moduleKey: 'requests', live: true },
  { key: 'dining', icon: UtensilsCrossed, moduleKey: 'fnb', live: true },
  { key: 'transport', icon: CarFront, moduleKey: 'transportation', live: false },
  // Epic 17 (17.2 AC1) — live, with the AC4 tri-state applied in visibleTiles.
  { key: 'info', icon: Compass, moduleKey: 'hotel_info', live: true },
];

/**
 * Epic 17 AC4 tri-state for the info tile: module off → "soon" (unlike other
 * gated tiles, which hide); module on + zero content → hidden entirely (an
 * empty directory is worse than none); on + content → live.
 */
export function visibleTiles(
  enabledModules: string[],
  hotelInfoHasContent = false,
): GuestTile[] {
  return GUEST_TILES.flatMap((tile) => {
    if (tile.key === 'info') {
      if (!enabledModules.includes('hotel_info')) {
        return [{ ...tile, live: false }];
      }
      return hotelInfoHasContent ? [tile] : [];
    }
    return tile.moduleKey === null || enabledModules.includes(tile.moduleKey)
      ? [tile]
      : [];
  });
}

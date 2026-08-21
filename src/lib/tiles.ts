import {
  CarFront,
  Compass,
  ConciergeBell,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

/**
 * Config-driven services grid (14.4 AC3). Epic 15 activates Requests by
 * flipping `live: true` — nothing else changes. `moduleKey: null` = the tile
 * is unconditional; otherwise the hotel's plan `enabledModules` gates it.
 */
export interface GuestTile {
  key: 'requests' | 'dining' | 'housekeeping' | 'transport' | 'info';
  icon: LucideIcon;
  moduleKey: string | null;
  live: boolean;
}

export const GUEST_TILES: GuestTile[] = [
  { key: 'requests', icon: ConciergeBell, moduleKey: 'requests', live: false },
  { key: 'dining', icon: UtensilsCrossed, moduleKey: 'fnb', live: false },
  { key: 'housekeeping', icon: Sparkles, moduleKey: 'housekeeping', live: false },
  { key: 'transport', icon: CarFront, moduleKey: 'transportation', live: false },
  { key: 'info', icon: Compass, moduleKey: null, live: false },
];

export function visibleTiles(enabledModules: string[]): GuestTile[] {
  return GUEST_TILES.filter(
    (tile) => tile.moduleKey === null || enabledModules.includes(tile.moduleKey),
  );
}

import {
  AlarmClock,
  Baby,
  BedDouble,
  Bell,
  Cloud,
  ConciergeBell,
  Droplet,
  Droplets,
  Hourglass,
  Layers,
  Lightbulb,
  Luggage,
  Package,
  Plug,
  Shirt,
  Sparkles,
  Star,
  Thermometer,
  Tv,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Server-sent lucide icon names → components (the platform catalog ships
 * names, custom items may carry anything). Unknown names fall back to the
 * concierge bell — never a broken tile.
 */
const ICONS: Record<string, LucideIcon> = {
  'alarm-clock': AlarmClock,
  baby: Baby,
  'bed-double': BedDouble,
  bell: Bell,
  cloud: Cloud,
  droplet: Droplet,
  droplets: Droplets,
  hourglass: Hourglass,
  layers: Layers,
  lightbulb: Lightbulb,
  luggage: Luggage,
  package: Package,
  plug: Plug,
  shirt: Shirt,
  sparkles: Sparkles,
  star: Star,
  thermometer: Thermometer,
  tv: Tv,
  wrench: Wrench,
};

export function requestIcon(name: string): LucideIcon {
  return ICONS[name] ?? ConciergeBell;
}

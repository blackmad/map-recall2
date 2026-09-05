import type { LucideIcon } from 'lucide-react';
import {
  Bike,
  Compass,
  Crosshair,
  Gauge,
  Home,
  Navigation2,
  Ship,
  Shuffle,
  SlidersHorizontal,
  Train,
} from 'lucide-react';
import type { CanalPreferences } from '../game/preferences.ts';

const SIZE = 18;
const STROKE = 2;

export function EnamelIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return <Icon className="enamel-icon" size={SIZE} strokeWidth={STROKE} aria-hidden focusable="false" data-label={label} />;
}

export const TRAVEL_ICONS: Record<CanalPreferences['travelMode'], LucideIcon> = {
  boat: Ship,
  car: Bike,
  transit: Train,
};

export const VIEW_ICONS: Record<CanalPreferences['viewMode'], LucideIcon> = {
  north: Compass,
  heading: Navigation2,
  chase: Crosshair,
  cockpit: Gauge,
};

export const ROUTE_ICONS: Record<CanalPreferences['routePattern'], LucideIcon> = {
  surprise: Shuffle,
  home: Home,
};

export const DIFFICULTY_ICONS: Record<CanalPreferences['difficulty'], LucideIcon | null> = {
  easy: null,
  medium: null,
  hard: null,
  expert: null,
  custom: SlidersHorizontal,
};

// The own map's cartography: colours and zoom-dependent widths per class,
// MapLibre-style (a few zoom stops, interpolated geometrically like
// `['interpolate', ['exponential', 2], ['zoom'], …]`). Pure data + maths.

import type { StreetClass } from './overviewFormat';

export type Stops = ReadonlyArray<readonly [number, number]>;

/** Exponential interpolation between stops (geometric in the value). */
export function interpolateStops(stops: Stops, zoom: number): number {
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z1, v1] = stops[i];
    if (zoom <= z1) {
      const [z0, v0] = stops[i - 1];
      const t = (zoom - z0) / (z1 - z0);
      return v0 > 0 && v1 > 0 ? v0 * (v1 / v0) ** t : v0 + (v1 - v0) * t;
    }
  }
  return stops[stops.length - 1][1];
}

export interface LineStyle { fill: string; casing: string | null; width: Stops; casingExtra: number; order: number }

// Colours chosen to read like the game's current Liberty basemap (cream
// land, blue water, pale-green parks, white minor roads, warm major roads).
export const PALETTE = {
  land: '#f4f0e8',
  water: '#a3c6e3',
  park: '#d2e6b5',
  building: '#d9d0c6',
  buildingOutline: '#c4b8ab',
  route: '#38BDF8',
  routeCasing: 'rgba(3,18,28,0.75)',
} as const;

export const STREET_STYLE: Record<StreetClass, LineStyle> = {
  major: { fill: '#fcd68f', casing: '#d9a861', width: [[9, 0.6], [11, 1.1], [12, 1.6], [14, 4.5], [16, 11], [18, 30], [20, 100]], casingExtra: 2, order: 6 },
  secondary: { fill: '#fdeaae', casing: '#d8c17d', width: [[10, 0.4], [12, 1.1], [14, 3.5], [16, 9], [18, 24], [20, 80]], casingExtra: 2, order: 5 },
  tertiary: { fill: '#ffffff', casing: '#cfc5b6', width: [[11, 0.4], [13, 1.2], [14, 2.6], [16, 7], [18, 20], [20, 66]], casingExtra: 1.6, order: 4 },
  minor: { fill: '#ffffff', casing: '#d6cec2', width: [[12, 0.25], [14, 1.3], [16, 4.5], [18, 15], [20, 50]], casingExtra: 1.4, order: 3 },
  service: { fill: '#ffffff', casing: '#ddd6cb', width: [[13, 0.2], [15, 0.9], [16, 2.2], [18, 8], [20, 26]], casingExtra: 1.2, order: 2 },
  cycle: { fill: '#e7a59b', casing: null, width: [[13, 0.25], [15, 0.8], [16, 1.4], [18, 4], [20, 12]], casingExtra: 0, order: 1 },
  path: { fill: '#c8bba9', casing: null, width: [[14, 0.3], [16, 1], [18, 3], [20, 9]], casingExtra: 0, order: 0 },
};

/** Below this many px a line is skipped rather than drawn as noise. */
export const MIN_LINE_PX = 0.35;

export const ROUTE_WIDTH: Stops = [[10, 3], [13, 4], [16, 6], [18, 9], [20, 18]];

/** Building raster (coarse, z12 footprints) fades out as vector footprints fade in. */
export const BUILDING_RASTER_FADE: [number, number] = [13.4, 14.1];
/** Vector footprints (z14 building tiles) from this zoom. */
export const FOOTPRINT_MIN_ZOOM = 13.5;
/** Near field (own-ground 3D) blends in over this zoom range. */
export const NEAR_FIELD_FADE: [number, number] = [16.0, 16.8];

export const fade = (zoom: number, [a, b]: [number, number]) => Math.max(0, Math.min(1, (zoom - a) / (b - a)));

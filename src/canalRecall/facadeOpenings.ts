// Where a building's painted windows and front door sit inside one bay, so 3D dressing (sills,
// hoods, frames, door surrounds) lands on the openings the texture already shows.
//
// Two sources draw the walls: the bay looks (photo, storybook, cartoon; bayTextures.ts, one
// 520 x 310 px storey and 520 x 340 px ground floor per bay) and the procedural cells
// (facadeCells.ts, painted in metres). The numbers below are read off those painters; keep
// them in step when a painter moves a window (scripts/check-facade-extras.ts pins a few).
// Everything is a fraction: across a bay for axes and widths, up a storey (or the ground
// floor) for sills and heads, measured from the bottom.

import { BAY_STYLES } from './bayLook.js';
import { hashSeed } from './wallBays.js';
import type { FacadeStyle } from './genericFacades.js';

export type OpeningRow = { axes: number[]; width: number; sill: number; head: number; arch?: boolean };
export type DoorOpening = { axis: number; width: number; bottom: number; top: number; fanlight: boolean };
export type Openings = {
  upper: OpeningRow;
  /** Ground-floor windows on a plain bay; null for a ribbon or a shopfront. */
  ground: OpeningRow | null;
  /** The window beside the door in a door bay. */
  doorWindow: OpeningRow | null;
  door: DoorOpening;
  /** Ribbon windows (one band across the bay): no per-window dressing. */
  ribbon?: boolean;
};

// --- Bay looks (bayTextures.ts) --------------------------------------------------------
const BAY_W = 520, STOREY_H = 310, GROUND_H = 340;
const rowPx = (n: number, y: number, h: number, H: number, widthPx: number): OpeningRow => ({
  axes: Array.from({ length: n }, (_, i) => (i + 0.5) / n), width: widthPx / BAY_W, sill: (H - y - h) / H, head: (H - y) / H,
});
/** `layoutWindows`: 150 / 112 / 82 px for one, two or three windows. */
const bayWidthPx = (n: number) => (n === 1 ? 150 : n === 2 ? 112 : 82);
/** `doorAt`: 118 px wide from 0.14 of the bay, 226 px tall standing 24 px above the foot. */
const BAY_DOOR: DoorOpening = { axis: (0.14 * BAY_W + 59) / BAY_W, width: 118 / BAY_W, bottom: 24 / GROUND_H, top: (24 + 226) / GROUND_H, fanlight: true };

export function bayLookOpenings(id: string, style: FacadeStyle): Openings {
  if (style === 'modern' || style === 'postwar' || style === 'tower') {
    return { upper: { axes: [0.5], width: 0.9, sill: (STOREY_H - 210) / STOREY_H, head: (STOREY_H - 70) / STOREY_H }, ground: rowPx(1, 80, 140, GROUND_H, 140),
      doorWindow: null, door: { axis: (0.62 * BAY_W + 59) / BAY_W, width: 118 / BAY_W, bottom: BAY_DOOR.bottom, top: BAY_DOOR.top, fanlight: true }, ribbon: true };
  }
  const archetype = style === 'school' ? 'school' : 'canal';
  const styles = BAY_STYLES[archetype], v = styles[(hashSeed(id) >>> 4) % styles.length];
  const upper = archetype === 'school'
    ? { axes: [0.3, 0.7], width: 76 / BAY_W, sill: (STOREY_H - 248) / STOREY_H, head: (STOREY_H - 68) / STOREY_H }
    : { ...rowPx(v.windows, 62, 188, STOREY_H, bayWidthPx(v.windows)), arch: v.shape === 'arch' };
  const doorWindow: OpeningRow = { axes: [0.64], width: 150 / BAY_W, sill: (GROUND_H - 226) / GROUND_H, head: (GROUND_H - 76) / GROUND_H };
  return { upper, ground: rowPx(v.windows, 70, 150, GROUND_H, bayWidthPx(v.windows)), doorWindow, door: BAY_DOOR };
}

// --- Procedural cells (facadeCells.ts, nominal STYLE_DIMS) --------------------------------
const PROCEDURAL: Record<FacadeStyle, Openings> = {
  canal: { upper: { axes: [0.3, 0.7], width: 1.1 / 5, sill: 0.42 / 3.1, head: 2.47 / 3.1 }, ground: { axes: [0.3, 0.7], width: 1.0 / 5, sill: 0.95 / 3.3, head: 2.85 / 3.3 },
    doorWindow: { axes: [0.7], width: 1.0 / 5, sill: 0.95 / 3.3, head: 2.85 / 3.3 }, door: { axis: 0.3, width: 1.12 / 5, bottom: 0, top: 2.35 / 3.3, fanlight: true } },
  c19: { upper: { axes: [0.5], width: 1.35 / 4.4, sill: 0.6 / 3, head: 2.45 / 3 }, ground: { axes: [0.5], width: 1.4 / 4.4, sill: 1.3 / 3.6, head: 3.15 / 3.6 },
    doorWindow: null, door: { axis: 0.5, width: 1.2 / 4.4, bottom: 0, top: 2.3 / 3.6, fanlight: false } },
  school: { upper: { axes: [0.5], width: 3.52 / 4.8, sill: 0.95 / 3, head: 2.3 / 3 }, ground: null, doorWindow: null,
    door: { axis: 0.5, width: 1.1 / 4.8, bottom: 0, top: 2.2 / 3, fanlight: false }, ribbon: true },
  postwar: { upper: { axes: [0.5], width: 3.0 / 3.6, sill: 0.95 / 2.85, head: 2.35 / 2.85 }, ground: null, doorWindow: null,
    door: { axis: 0.95 / 3.6, width: 1.1 / 3.6, bottom: 0, top: 2.2 / 2.9, fanlight: false }, ribbon: true },
  modern: { upper: { axes: [1.4 / 4.2], width: 2.0 / 4.2, sill: 0.5 / 3, head: 2.5 / 3 }, ground: null, doorWindow: null,
    door: { axis: 3.5 / 4.2, width: 1.0 / 4.2, bottom: 0, top: 2.3 / 3.8, fanlight: false }, ribbon: true },
  tower: { upper: { axes: [0.5], width: 2.4 / 3, sill: 0.6 / 3.2, head: 2.5 / 3.2 }, ground: null, doorWindow: null,
    door: { axis: 0.5, width: 1.1 / 3, bottom: 0, top: 2.3 / 3.2, fanlight: false }, ribbon: true },
};

export const proceduralOpenings = (style: FacadeStyle): Openings => PROCEDURAL[style];

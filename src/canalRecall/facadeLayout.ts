// Wall layout for the three.js building layer: where the bays, storeys and
// doors of one wall fall, so openings line up with the building instead of
// being cut off by it.
//
// MapLibre's pattern fill tiles an image by absolute distance and elevation,
// so a window can sit across a corner or a floor line can miss the eaves. Here
// every wall gets a *whole number* of bays (the cell is stretched by at most
// half a bay over the wall) and the building a whole number of storeys, so
// the pattern starts and ends on a pier and the top row of windows ends at the
// cornice. Doors sit on bay boundaries of the same grid, so each door stands
// under a window column, never between two.

import { STYLE_DIMS } from './facadeCells.js';
import type { FacadeStyle } from './genericFacades.js';

export type WallLayout = {
  bays: number;
  bayWidthM: number;
  /** Height of the ground-floor row in metres (the rest is `storeys` rows). */
  groundM: number;
  storeys: number;
  storeyM: number;
  /** Bay indices that carry a front door, ascending. */
  doorBays: number[];
};

/** Walls shorter than this get no facade cells (chamfers, notches). */
export const MIN_FACADE_EDGE_M = 1.1;
/** Walls with less exposed height than this get none either (sheds). */
export const MIN_FACADE_WALL_M = 2.6;

/**
 * Layout for a wall `lengthM` long whose exposed height (above any
 * `min_height` overhang) is `exposedM`. `seed` (0..1) only chooses which end a
 * door goes at; `groundLevel` is false for a part that floats above the street.
 */
/** Per-building multipliers on the style's nominal bay width, storey and ground-floor height. */
export type LayoutScale = { bay: number; storey: number; ground: number };
const NO_SCALE: LayoutScale = { bay: 1, storey: 1, ground: 1 };

export function layoutWall(style: FacadeStyle, lengthM: number, exposedM: number, seed: number, groundLevel = true, scale: LayoutScale = NO_SCALE): WallLayout | null {
  if (!(lengthM >= MIN_FACADE_EDGE_M) || !(exposedM >= MIN_FACADE_WALL_M)) return null;
  const nominal = STYLE_DIMS[style];
  const dims = { ...nominal, bay: nominal.bay * scale.bay, storey: nominal.storey * scale.storey, ground: nominal.ground * scale.ground };
  const bays = Math.max(1, Math.round(lengthM / dims.bay));
  const bayWidthM = lengthM / bays;
  // Ground floor: nominal height, but never more than the wall allows, and a
  // wall barely taller than a ground floor is all ground floor.
  let groundM = Math.min(dims.ground, exposedM);
  if (exposedM - groundM < dims.storey * 0.6) groundM = exposedM;
  const upperM = exposedM - groundM;
  const storeys = upperM > 0 ? Math.max(1, Math.round(upperM / dims.storey)) : 0;
  const storeyM = storeys ? upperM / storeys : dims.storey;
  const doorBays: number[] = [];
  if (groundLevel && lengthM >= 2.4 && bayWidthM >= 2.4) {
    // A door a bay in from one end: the end bay is the corner pier on narrow
    // houses. Long walls repeat the door (stair cores) every `doorEvery` bays.
    const first = bays <= 2 ? (seed < 0.5 ? 0 : bays - 1) : Math.min(bays - 1, 1 + Math.floor(seed * 2));
    for (let b = first; b < bays; b += dims.doorEvery) doorBays.push(b);
    if (doorBays.length === 0) doorBays.push(first);
  }
  return { bays, bayWidthM, groundM, storeys, storeyM, doorBays };
}

/** Runs of consecutive plain ground-floor bays between the door bays. */
export function groundRuns(layout: WallLayout): Array<{ from: number; to: number; door: boolean }> {
  const runs: Array<{ from: number; to: number; door: boolean }> = [];
  let b = 0;
  const doors = new Set(layout.doorBays);
  while (b < layout.bays) {
    if (doors.has(b)) { runs.push({ from: b, to: b + 1, door: true }); b++; continue; }
    let e = b;
    while (e < layout.bays && !doors.has(e)) e++;
    runs.push({ from: b, to: e, door: false });
    b = e;
  }
  return runs;
}

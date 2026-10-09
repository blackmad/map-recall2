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
export type LayoutScale = { bay: number; storey: number; ground: number; /** Bays between doors on a long wall (large tier: one entrance per run). */ doorEvery?: number };
const NO_SCALE: LayoutScale = { bay: 1, storey: 1, ground: 1 };

export function layoutWall(style: FacadeStyle, lengthM: number, exposedM: number, seed: number, groundLevel = true, scale: LayoutScale = NO_SCALE): WallLayout | null {
  if (!(lengthM >= MIN_FACADE_EDGE_M) || !(exposedM >= MIN_FACADE_WALL_M)) return null;
  const nominal = STYLE_DIMS[style];
  const dims = { ...nominal, bay: nominal.bay * scale.bay, storey: nominal.storey * scale.storey, ground: nominal.ground * scale.ground, doorEvery: scale.doorEvery ?? nominal.doorEvery };
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

/**
 * One facade laid out over a run of wall edges that read as one wall (a curved or
 * slightly kinked frontage): one bay width and one storey grid for the whole run, so
 * window spacing no longer jumps at each kink (user report 2026-10-02, a curved block
 * on Da Costakade whose segments alternated wide and thin bays). `edgeStartM[i]` is
 * where edge i begins along the run. A door is kept only on a bay that lies mostly on one
 * edge (DOOR_ON_EDGE; never split across a corner) and on an edge `doorAllowed` permits (street side).
 */
/** Share of a door's bay that must lie on one edge of a run. */
export const DOOR_ON_EDGE = 0.5;

export type RunLayout = WallLayout & { lengthM: number; edgeStartM: number[] };

export function layoutRun(style: FacadeStyle, lengthsM: readonly number[], exposedM: number, seed: number, groundLevel = true, scale: LayoutScale = NO_SCALE, doorAllowed?: readonly boolean[]): RunLayout | null {
  const edgeStartM: number[] = [];
  let lengthM = 0;
  for (const len of lengthsM) { edgeStartM.push(lengthM); lengthM += len; }
  const base = layoutWall(style, lengthM, exposedM, seed, groundLevel, scale);
  if (!base) return null;
  const { bayWidthM } = base;
  // The edge holding most of a bay; on a gentle curve a door may fold over a small kink, but
  // the edge holding at least half of it decides.
  const edgeOf = (bay: number): number => {
    const a0 = bay * bayWidthM, a1 = a0 + bayWidthM;
    for (let i = 0; i < lengthsM.length; i++) {
      const overlap = Math.min(a1, edgeStartM[i] + lengthsM[i]) - Math.max(a0, edgeStartM[i]);
      if (overlap >= bayWidthM * DOOR_ON_EDGE) return i;
    }
    return -1;
  };
  const allowed = (bay: number) => { const e = edgeOf(bay); return e >= 0 && (!doorAllowed || doorAllowed[e]); };
  let doorBays = base.doorBays.filter(allowed);
  if (base.doorBays.length && !doorBays.length) {
    // The grid's doors fell on a kink or a back edge: keep one, on the first bay that can carry it.
    // Off the corner pier when the run is wide enough to have one.
    const bays = Array.from({ length: base.bays }, (_, b) => b).filter(allowed);
    const first = bays.find(b => base.bays <= 2 || b > 0) ?? bays[0];
    if (first !== undefined) doorBays = [first];
  }
  return { ...base, doorBays, lengthM, edgeStartM };
}

/** The ground-floor pieces of edge `edge` in a run, split at bay lines: door bays alone, plain bays merged. */
export function edgeGroundPieces(run: RunLayout, edge: number, edgeLenM: number): Array<{ a0: number; a1: number; door: boolean }> {
  const s = run.edgeStartM[edge], e = s + edgeLenM, bw = run.bayWidthM, doors = new Set(run.doorBays), out: Array<{ a0: number; a1: number; door: boolean }> = [];
  for (let bay = Math.max(0, Math.floor(s / bw + 1e-6)); bay * bw < e - 1e-6; bay++) {
    const a0 = Math.max(s, bay * bw), a1 = Math.min(e, (bay + 1) * bw), door = doors.has(bay);
    const last = out[out.length - 1];
    if (last && !door && !last.door && Math.abs(last.a1 - a0) < 1e-6) last.a1 = a1; else out.push({ a0, a1, door });
  }
  return out;
}

/** An edge's own whole-bay layout inside a run (for the facade extras, which work per wall). */
export function edgeLayout(run: RunLayout, edge: number, edgeLenM: number): WallLayout {
  const bays = Math.max(1, Math.round(edgeLenM / run.bayWidthM)), bayWidthM = edgeLenM / bays, s = run.edgeStartM[edge];
  const doorBays = run.doorBays.map(b => (b + 0.5) * run.bayWidthM - s).filter(c => c > 0 && c < edgeLenM).map(c => Math.min(bays - 1, Math.floor(c / bayWidthM)));
  return { bays, bayWidthM, groundM: run.groundM, storeys: run.storeys, storeyM: run.storeyM, doorBays: [...new Set(doorBays)] };
}

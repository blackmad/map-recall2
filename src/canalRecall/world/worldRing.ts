/**
 * The world-v1 fetch ring (#130, 2026-11-01): which 1 km cells the building streamer reads.
 *
 * Before the ring, the streamer read every cell under every planned z14 tile. A z14 tile is about 1.5 km and not
 * aligned with the cell grid, so it needs 1-9 cells (mostly 4-6), and the ride camera's ~600 m view near a tile
 * corner planned 2-4 tiles: Free Ride read 27 cells (2.0 MB) for 202 m of riding. The ring reads only the cells
 * the ride can show: those under the view box at ride zoom, grown by `WORLD_RING_MARGIN_M`, plus the look-ahead
 * boxes. A tile is cut from the ring cells it has and topped up (the same feature objects plus the new cell's)
 * when the ring reaches a further cell of it.
 *
 * The margin keeps every top-up out of the near ring. A building belongs to the cell of its first vertex, the
 * same vertex the three.js layer keys its chunks by, so a newly read cell changes only chunks at its own edge:
 * a z17 near chunk (~190 m) straddling it is at least margin - 190 m outside the view box, and the rider sits
 * >= ~100 m inside every edge of the ride view box (measured: 110-120 m behind, up to ~520 m ahead or aside).
 *
 * During the intro the camera is at the overview zoom, whose box is about twice the ride's; the ring then uses
 * a ride-sized square around the rider (`RIDE_HALF_M` each way, any heading), not the overview box.
 * `?worldRing=0` reads whole tiles as before (A/B and fallback).
 */
import { CELL_GRID, cellsCovering } from './cellGrid.js';

export type RingBounds = { west: number; south: number; east: number; north: number };

/** Metres the view box grows by before choosing cells. */
export const WORLD_RING_MARGIN_M = 300;
/** Below this camera zoom (the intro overview is 17, riding ~17.8) the view box is not the ride's. */
export const RIDE_ZOOM_MIN = 17.5;
/** Half-size of the ride-zoom stand-in box around the rider during the intro: the ride view box reaches ~520 m. */
export const RIDE_HALF_M = 530;

export function worldRingEnabled(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  try { return new URLSearchParams(search).get('worldRing') !== '0'; } catch { return true; }
}

const [M_LNG, M_LAT] = CELL_GRID.metresPerDegree;

/** `b` grown by `m` metres on every side (grid metres, as the cells are cut). */
export function grow(b: RingBounds, m: number): RingBounds {
  return { west: b.west - m / M_LNG, south: b.south - m / M_LAT, east: b.east + m / M_LNG, north: b.north + m / M_LAT };
}

/**
 * The view box the ring is built from: the camera's at ride zoom, else a ride-sized square around `rider` while the
 * camera looks at the rider (the intro overview, centred on it). A camera looking where the rider is not (a free look,
 * a landmark fly-to, a spec's jumpTo) reads its own view, as before the ring: the stand-in kept every building away
 * from the rider unread (building-click-perf, #129 round 21).
 */
export function rideBox(view: RingBounds, zoom: number, rider: readonly [number, number] | null): RingBounds {
  if (zoom >= RIDE_ZOOM_MIN || !rider) return view;
  if (rider[0] < view.west || rider[0] > view.east || rider[1] < view.south || rider[1] > view.north) return view;
  return grow({ west: rider[0], south: rider[1], east: rider[0], north: rider[1] }, RIDE_HALF_M);
}

/** The ring's cells: the ride box grown by `marginM`, plus every look-ahead box (as planned, not grown). */
export function ringCells(ride: RingBounds, ahead: readonly RingBounds[], marginM: number = WORLD_RING_MARGIN_M): Set<string> {
  const out = new Set<string>();
  const add = (b: RingBounds) => { for (const c of cellsCovering(b.west, b.south, b.east, b.north)) out.add(c); };
  add(grow(ride, marginM));
  for (const b of ahead) add(b);
  return out;
}

/**
 * `?ringFollow=0` (or `window.__canalRecallRingFollow = false`): the streamer re-plans only when its z14 tiles change,
 * as before (A/B). On (lane E4, #217), the ring's own cells join the streamer's follow signature, so the ring follows
 * the rider: a z14 tile is ~1.5 km and 1 km cells change inside it, and before this a cell the ring had reached was read
 * only once the next z14 tile came into view, ~60 m from the rider (Koninginneweg → Van Baerlestraat, the seeded
 * ride: 1,586 buildings arrived in coarse:8413/5385 at 57 m, and 112 in the detailed tile 33654/21541 at 59 m).
 */
export function ringFollowEnabled(): boolean {
  try {
    const g = globalThis as { __canalRecallRingFollow?: boolean; location?: { search?: string } };
    if (g.__canalRecallRingFollow === false) return false;
    return new URLSearchParams(g.location?.search ?? '').get('ringFollow') !== '0';
  } catch { return true; }
}

/** A stable key of a ring's cells (sorted), for a follow signature. */
export function ringSignature(ring: ReadonlySet<string> | null): string {
  return ring ? [...ring].sort().join(',') : '';
}


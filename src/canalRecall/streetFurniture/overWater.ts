/**
 * Street furniture over open water (feedback ee2b30, 2026-11-19, Haparandadam: "missing land under lightposts").
 *
 * The registers place every lamp where it stands; the own ground draws the water from a generalised snapshot
 * (elevation-v1) that has no jetties, so a lamp on an unmapped structure stood in open water. Piers OSM maps are now drawn
 * (ownGround/piers.ts) and the furniture on them stands on their deck. What is left over the water is classified here and
 * only the plain open-water case is dropped:
 *
 *   land       the base is not over mapped water
 *   pier       on an OSM pier (drawn, piers.ts)
 *   bridge     within BRIDGE_REACH_M of a bridge way or inside a bridge outline (the water runs on under every deck)
 *   shore      within SHORE_M of the water's edge (the snapshot is generalised by a metre or more at the quays)
 *   open       none of these: dropped
 *
 * Pure: the caller hands the geometry tests (scripts/street-furniture/drop-over-water.ts reads the extracts).
 */
import type { FurnitureRecord } from './extract.js';

export type WaterClass = 'land' | 'pier' | 'bridge' | 'shore' | 'open';

/** A bridge way this close (metres) carries the furniture (a lamp on the parapet stands up to ~half the deck width off it). */
export const BRIDGE_REACH_M = 9;
/** Within this of the water's edge (metres) the base is on the quay the generalised water overlaps. */
export const SHORE_M = 3;

export interface WaterTests {
  /** Inside a mapped water polygon. */
  wet(lng: number, lat: number): boolean;
  /** On an OSM pier's outline (piers.ts placePiers). */
  onPier(lng: number, lat: number): boolean;
  /** Distance to the nearest bridge way or inside a bridge outline (0), metres; Infinity when none is near. */
  bridgeDistance(lng: number, lat: number): number;
  /** Distance to the nearest water edge (the polygon boundary), metres. */
  shoreDistance(lng: number, lat: number): number;
}

export function classifyOverWater(r: Pick<FurnitureRecord, 'lng' | 'lat'>, t: WaterTests): WaterClass {
  if (!t.wet(r.lng, r.lat)) return 'land';
  if (t.onPier(r.lng, r.lat)) return 'pier';
  if (t.bridgeDistance(r.lng, r.lat) <= BRIDGE_REACH_M) return 'bridge';
  if (t.shoreDistance(r.lng, r.lat) < SHORE_M) return 'shore';
  return 'open';
}

/** Records kept (everything but `open`) and the count per class, with the dropped ids. */
export function dropOverWater<T extends Pick<FurnitureRecord, 'id' | 'lng' | 'lat' | 'kind'>>(records: readonly T[], t: WaterTests): { kept: T[]; dropped: T[]; counts: Record<WaterClass, number> } {
  const counts: Record<WaterClass, number> = { land: 0, pier: 0, bridge: 0, shore: 0, open: 0 };
  const kept: T[] = [], dropped: T[] = [];
  for (const r of records) {
    const c = classifyOverWater(r, t);
    counts[c]++;
    (c === 'open' ? dropped : kept).push(r);
  }
  return { kept, dropped, counts };
}

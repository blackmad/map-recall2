// The generic place of worship (2026-10-03, "temples mosques and churches"): a church, mosque,
// synagogue or temple that no hand-modelled kit covers.
//
// Before this, such a building took whatever the city's generic rules gave it: a non-landmark
// church the house facade and roof (canal-house gable, house windows, a ribbon of shop glass),
// an old landmark up to 26 m the period house front, a bigger one a bare box (user 2026-10-03,
// on a church in house windows: "the textures on it are bizarre ... why does it have windows???").
//
// Now each one, listed by scripts/build-worship-buildings.ts from OSM worship *buildings*
// (building=church|chapel|mosque|synagogue|temple|..., never a prayer room tagged on a node inside
// a block of flats) into worshipBuildingData.ts, is drawn as a small kit: plain walls in its era's
// brick, and, when the footprint is a plain rectangle and the building is older than 1960, a
// steep nave roof over it with a row of tall round-headed windows. Slender parts (towers),
// small parts (chapels of a bigger church), odd plans and modern buildings keep their height and
// flat lid in plain walls: no openings is honest where we do not know them, and never a house.

import type { Kit, KitWindowRow } from './landmarkKits.js';
import { WORSHIP_BUILDINGS, type WorshipEntry } from './worshipBuildingData.js';

export type WorshipEra = 'o' | 'e' | 'm';
/** Wall brick per era: pre-1900 dark red-brown, 1900-1959 brown, 1960 on a lighter brown. */
export const WORSHIP_WALL: Record<WorshipEra, string> = { o: '#7a4535', e: '#83503d', m: '#9b7a62' };

/**
 * What the staging script measured for one footprint. `osmPart`: an OSM building part, whose
 * height is its top (the ridge) rather than the 3D BAG's 70th percentile, with its own
 * `roofHeightM` when mapped.
 */
export type WorshipInput = { heightM: number; year: number | null; areaM2: number; rect: { len: number; wid: number; coverage: number; maxDev: number } | null; osmPart?: boolean; roofHeightM?: number };
/**
 * `h` hall: plain walls to `eavesM`, a roof `riseM` high over the fitted rectangle, tall windows.
 * `w` walled: an older building whose plan is too odd for one roof (a cross, a tower in the same
 * footprint) keeps its height and flat lid, in plain brick with tall windows. `b` body: plain
 * walls and the flat lid only (a tower, a small part of a bigger church, a modern building).
 */
export type WorshipPlan = { mode: 'h' | 'w' | 'b'; eavesM: number; riseM: number; era: WorshipEra };
/** A fitted roof needs a rectangle covering this much of the footprint, no vertex further out than FIT_MAX_DEV_M. */
export const FIT_COVERAGE = 0.78, FIT_MAX_DEV_M = 6;

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * The generic plan for one worship footprint. A BAG footprint's tile height is the 3D BAG's 70th
 * percentile of the roof, which on a gable roof sits 70% of the way from eaves to ridge, so a
 * steep roof (rise 0.55 of the span, about 48 degrees) puts the eaves at height - 0.7 rise and
 * the ridge 0.3 rise above the tile height. An OSM part's height is its ridge: eaves at height -
 * rise, using the part's own mapped roof height when it has one.
 */
export function planWorship(input: WorshipInput): WorshipPlan {
  const { heightM, year, areaM2, rect } = input;
  const era: WorshipEra = year === null || year < 1900 ? 'o' : year < 1960 ? 'e' : 'm';
  const body: WorshipPlan = { mode: 'b', eavesM: round1(heightM), riseM: 0, era };
  if (areaM2 < 60 || !rect) return body;
  // A tower, or the tower part of a church mapped in pieces.
  if (heightM > 2.2 * Math.sqrt(areaM2)) return body;
  if (era === 'm') return body;
  const walled: WorshipPlan = { ...body, mode: 'w' };
  if (rect.coverage < FIT_COVERAGE || rect.maxDev > FIT_MAX_DEV_M) return walled;
  const share = input.osmPart ? 1 : 0.7;
  let rise = input.osmPart && input.roofHeightM && input.roofHeightM > 0 ? input.roofHeightM : Math.min(14, Math.max(3, 0.55 * rect.wid));
  if (heightM - share * rise < 5) rise = (heightM - 5) / share;
  if (rise < 2.5) return walled;
  return { mode: 'h', eavesM: round1(heightM - share * rise), riseM: round1(rise), era };
}

/** Tall round-headed windows under the eaves, or none when the wall is too low for them. */
export function worshipWindows(eavesM: number): KitWindowRow[] {
  const z0 = Math.max(1.5, eavesM * 0.22), z1 = Math.min(eavesM - 1, z0 + 9);
  if (z1 - z0 < 2.5) return [];
  const widthM = Math.min(1.8, Math.max(0.9, (z1 - z0) / 3.2));
  return [{ z0: round1(z0), z1: round1(z1), widthM: round1(widthM), bayM: round1(Math.max(3.2, widthM * 2.6)), head: 'round' }];
}

const KIND_NAME = { c: 'church', m: 'mosque', s: 'synagogue', t: 'temple' } as const;

export function worshipKit([id, kind, mode, eavesM, riseM, era]: WorshipEntry): Kit {
  const name = `Generic ${KIND_NAME[kind]} ${id}`, hex = WORSHIP_WALL[era];
  const rows = worshipWindows(eavesM);
  // Walls too low for a window and no roof to add: plain walls are all there is.
  if (mode === 'b' || (mode === 'w' && !rows.length)) return { name, wall: { plain: true, hex }, tiers: [], stacks: [], roofs: [], body: [id] };
  return {
    name, wall: { plain: true, hex }, tiers: [], stacks: [], roofs: [],
    halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === 'h', eavesM, riseM, mat: era === 'o' ? 'slate' : 'tile', windows: rows.length ? { rows, glassHex: '#3a434c' } : undefined }],
  };
}

export const GENERIC_WORSHIP_KITS: Kit[] = WORSHIP_BUILDINGS.map(worshipKit);

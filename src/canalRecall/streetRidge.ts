// Turn a pre-1940 saddle roof's ridge across its street front.
//
// User report 2026-10-23 (feedback 74dc761d, Marnixstraat at the Lijnbaansgracht): "buildings have gables pointing the
// wrong way". An Amsterdam house of before 1940 runs its ridge perpendicular to its street front, so its gable (stepped,
// necked, bell, a cornice front) faces the street; a wide pand that is really several houses has several parallel
// transverse saddles, each with its gable to the street. The city tier fits each saddle to its footprint box's LONG
// axis (roofMesh.ts fitRect), so a shallow wide pand (the 1872 row on Marnixstraat: 11.6 m front, 7.2 m deep) drew its
// ridge along the street and its triangles at the neighbours.
//
// The rule, pure and deterministic (it runs in the chunk worker, with the same street test as front doors and crowns):
//  - only plans `planRoof` marked `streetRidge` (canal and c19 styles, a pitched, mansard or gable saddle, no OSM roof
//    tag but an orientation-free `gabled`/`double_saltbox`, no register gable): hipped, mansard-hip, half-hipped and
//    other tagged roofs are left alone;
//  - a long side of the box sees a street and neither end does: the front is the long side, turn the ridge;
//  - an end and a long side both see a street (a corner): a narrow box (≤ 8.5 m wide, 1.25× as deep) keeps its narrow
//    end as the front, as Amsterdam corner houses do; a wider box takes the longer street, its long side, as the front;
//  - otherwise (the ridge already runs across, or no street is known): unchanged, the same object.
// A box deeper than TURN_MAX_DEPTH_M is a block, not houses, and keeps its roof.
// A front up to TURN_MAX_FRONT_M turns as one saddle; a wider front splits into N transverse saddles of about 6 m (4.9–7.5 m). Every
// turned saddle is a `gable` piece (its street end crowned, its rear a plain triangle, streetGableEnds.ts) with the
// plan's rise, so the eaves and the ridge height stay those the tile decorator lowered the walls to.

import type { GableShape, Rect, RoofPlan } from './roofMesh.js';
import { gableEndWalls, type StreetFacing } from './streetGableEnds.js';

/** A front up to this wide (about two house widths) turns as one saddle; wider fronts split. */
export const TURN_MAX_FRONT_M = 14;
/** Deeper than this (front ≥ depth by construction), a pand is a 19th-century block (the Pijp's 50 × 18 m rows), not
 *  merged houses: its roof stays as planned rather than becoming a row of house gables. */
export const TURN_MAX_DEPTH_M = 12;
/** Split saddles are about this wide, metres (an Amsterdam house front). */
export const BAY_TARGET_M = 6;

/** The box with its axes swapped: u along the old v (across the old ridge). */
export const turnRect = (r: Rect): Rect => ({ ...r, ux: -r.uy, uy: r.ux, len: r.wid, wid: r.len });

/** How many transverse saddles a front of `frontM` metres splits into (1 up to TURN_MAX_FRONT_M). */
export function bayCount(frontM: number): number {
  // The count nearest BAY_TARGET_M wide: 4.9–7.5 m from 14 m up (no whole count fits 5–7 between 14 and 15 m).
  return frontM <= TURN_MAX_FRONT_M ? 1 : Math.max(2, Math.round(frontM / BAY_TARGET_M));
}

/**
 * The saddles of a `streetRidge` piece with its ridge turned across its street front, or null to keep the piece as
 * planned. `rect` is the piece in the mesh frame (the frame `facing` measures in).
 */
export function turnRidgeToStreet(rect: Rect, plan: RoofPlan, facing: StreetFacing): Array<{ rect: Rect; plan: RoofPlan }> | null {
  const sr = plan.streetRidge;
  if (!sr || rect.wid > TURN_MAX_DEPTH_M) return null;
  const sides = gableEndWalls(turnRect(rect));
  if (!sides.some(w => facing(w) < Infinity)) return null;
  const narrow = rect.wid <= 8.5 && rect.len >= 1.25 * rect.wid;
  if (narrow && gableEndWalls(rect).some(w => facing(w) < Infinity)) return null;
  const n = bayCount(rect.len), bay = rect.len / n;
  const out: Array<{ rect: Rect; plan: RoofPlan }> = [];
  for (let i = 0; i < n; i++) {
    const offset = -rect.len / 2 + (i + 0.5) * bay;
    const gable: GableShape = i === 0 ? plan.gable : sr.gables[(i - 1) % sr.gables.length];
    const piece: Rect = { ...turnRect(rect), cx: rect.cx + rect.ux * offset, cy: rect.cy + rect.uy * offset, wid: bay };
    out.push({ rect: piece, plan: {
      ...plan, kind: 'gable', gable, dormers: false, streetRidge: undefined, streetEnds: undefined,
      seed: i === 0 ? plan.seed : `${plan.seed}:bay${i}`,
      shutters: gable === 'spout' && i === 0 ? plan.shutters : undefined, shutterHex: gable === 'spout' && i === 0 ? plan.shutterHex : undefined,
    } });
  }
  return out;
}

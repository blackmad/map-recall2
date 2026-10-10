/**
 * Shared-mesh instancing for recipe-built houses.
 *
 * Identical designs (equal canonical intent, or one the left-right mirror of
 * the other) are compiled once, in a *frontage frame*, and placed per house:
 *
 *   frame origin  = midpoint of the street frontage
 *   frame +X      = along the frontage, left to right as seen from the street
 *   frame +Z      = outward normal (towards the street)
 *   frame +Y      = up
 *
 * With that frame a placement is just {anchor, northOffsetDegrees, mirror}:
 * `northOffsetDegrees` is what the ordinary runtime already accepts (the mesh
 * +X axis lands on compass bearing 90 + offset) and `mirror` flips X, which
 * reverses triangle winding (the runtime applies scale.x = -1 to the clone, and
 * three.js flips the front face for a negative determinant).
 *
 * Pure functions only; the CLI (scripts/building-recipes/compile.ts) and the
 * browser adapter both import this module.
 */
import {canonicalIntentKey} from './compile.ts';
import type {CanalHouseIntent, FrontIntent} from './intent.ts';

export type RD = [number, number];
export interface FrontFrame { midRD: RD; uRD: RD; nRD: RD }
export type DesignMatch = 'same' | 'mirror' | null;

const unit = (v: number[]): RD => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };

/** Frontage frame from a front's survey endpoints (left→right) and outward normal. */
export function frontFrame(front: {endpointsRD: [number[], number[]]; outwardNormalRD: number[]}): FrontFrame {
  const [a, b] = front.endpointsRD;
  return {midRD: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], uRD: unit([b[0] - a[0], b[1] - a[1]]), nRD: unit(front.outwardNormalRD)};
}

/**
 * Column-major-free 3x4 affine matrix (row-major, three.js `Matrix4.set` order for rows x,y,z) taking a
 * recipe-local point (x east, y up, z south from `anchorRD`) into the frontage frame.
 */
export function localToFrameMatrix(frame: FrontFrame, anchorRD: RD): number[] {
  const [ux, uy] = frame.uRD, [nx, ny] = frame.nRD;
  const dx = anchorRD[0] - frame.midRD[0], dy = anchorRD[1] - frame.midRD[1];
  // x' = (A - m)·u + x·ux - z·uy ;  z' = (A - m)·n + x·nx - z·ny   (RD point = A + (x, -z))
  return [ux, 0, -uy, dx * ux + dy * uy,  0, 1, 0, 0,  nx, 0, -ny, dx * nx + dy * ny];
}

/** Left-right mirror of a design, or null when the layout cannot be mirrored one-to-one (storeys with different bay counts around a mirrored feature). */
export function mirrorIntent(intent: CanalHouseIntent): CanalHouseIntent | null {
  const fronts: FrontIntent[] = [];
  // Lettering and side-specific shop doors cannot be mirrored one-to-one.
  if (intent.fronts.some(f => f.shopfront && (f.shopfront.sign || f.shopfront.residentialDoor || (f.shopfront.entrance && !/^(none|centre|centre-recessed)$/.test(f.shopfront.entrance))))) return null;
  for (const f of intent.fronts) {
    const bays = Array.isArray(f.bays) ? f.bays : Array(f.storeys).fill(f.bays);
    const flip = (bay: number, storeys: number[]) => storeys.every(s => bays[s] === bays[0]) ? bays[0] - 1 - bay : NaN;
    const out: FrontIntent = {...f};
    if (f.doorBay !== null) out.doorBay = bays[0] - 1 - f.doorBay;
    if (f.bayWindows) { const bay = flip(f.bayWindows.bay, f.bayWindows.storeys); if (Number.isNaN(bay)) return null; out.bayWindows = {...f.bayWindows, bay}; }
    if (f.balconies) {
      const bs = f.balconies.bays.map(b => flip(b, f.balconies!.storeys));
      if (bs.some(Number.isNaN)) return null;
      out.balconies = {...f.balconies, bays: bs.sort((p, q) => p - q)};
    }
    // Stoops, hoists and repeat alternation have no mirrored equivalent worth sharing.
    if (f.repeat?.mirrorAlternate || f.share !== undefined) return null;
    fronts.push(out);
  }
  return {...intent, fronts};
}

/** Does `member` have the same design as `master`, or its mirror image? */
export function matchDesign(master: CanalHouseIntent, member: CanalHouseIntent): DesignMatch {
  const key = canonicalIntentKey(master);
  if (canonicalIntentKey(member) === key) return 'same';
  const mirrored = mirrorIntent(member);
  if (mirrored && canonicalIntentKey(mirrored) === key) return 'mirror';
  return null;
}

/** Compass bearing (degrees clockwise from north) of an RD direction, given the local RD→north convergence in degrees (0 when unknown). */
export const bearingDegrees = (v: number[], convergenceDeg = 0): number => ((Math.atan2(v[0], v[1]) * 180 / Math.PI + convergenceDeg) % 360 + 360) % 360;

export interface InstancePlacement { anchor: [number, number]; northOffsetDegrees: number; mirror: boolean }

/**
 * Placement of a frontage-frame mesh for one house. `rdToLngLat` supplies the
 * projection; the bearing is measured from two projected points so RD grid
 * convergence is included.
 */
export function placementFor(frame: FrontFrame, mirror: boolean, rdToLngLat: (p: RD) => [number, number]): InstancePlacement {
  const anchor = rdToLngLat(frame.midRD), ahead = rdToLngLat([frame.midRD[0] + frame.uRD[0] * 10, frame.midRD[1] + frame.uRD[1] * 10]);
  const east = (ahead[0] - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), north = (ahead[1] - anchor[1]) * 111320;
  const bearing = bearingDegrees([east, north]);
  return {anchor, northOffsetDegrees: +(((bearing - 90) % 360 + 360) % 360).toFixed(4), mirror};
}

/** Frame-local ring (x along frontage, z outward) of a house's footprint in RD. */
export const ringToFrame = (ring: number[][], frame: FrontFrame): number[][] => ring.map(p => {
  const dx = p[0] - frame.midRD[0], dy = p[1] - frame.midRD[1];
  return [dx * frame.uRD[0] + dy * frame.uRD[1], dx * frame.nRD[0] + dy * frame.nRD[1]];
});

/** Raster IoU (10 cm grid) of two sets of frame-local rings, the second optionally mirrored in X; `depthM` limits it to the first metres behind the front (what a player sees). */
export function frameFootprintIoU(a: number[][][], b: number[][][], mirrorB: boolean, step = 0.1, depthM = Infinity): number {
  const bb = mirrorB ? b.map(r => r.map(([x, z]) => [-x, z])) : b;
  const all = [...a.flat(), ...bb.flat()];
  const x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), z0 = Math.max(Math.min(...all.map(p => p[1])), -depthM), z1 = Math.max(...all.map(p => p[1]));
  const inside = (rings: number[][][], x: number, z: number) => rings.reduce((s, r) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
    return s + (c ? 1 : 0);
  }, 0) % 2 === 1;
  let inter = 0, union = 0;
  for (let x = x0 + step / 2; x < x1; x += step) for (let z = z0 + step / 2; z < z1; z += step) {
    const p = inside(a, x, z), q = inside(bb, x, z);
    if (p && q) inter++;
    if (p || q) union++;
  }
  return union ? inter / union : 0;
}

export const SHARE_DIMENSION_TOLERANCE_M = 0.3;
/** Whole-footprint IoU floor. Rows differ at the rear (courtyard notches); the front zone below must still match closely. */
export const SHARE_MIN_FOOTPRINT_IOU = 0.6;
export const SHARE_MIN_FRONT_IOU = 0.9;
export const SHARE_FRONT_ZONE_M = 8;

/**
 * 3DBAG facts for one pand: roof form and ridge direction from the LoD2.2 roof
 * surfaces, plus the generator parameters (storeys, eaves, ridge) from the
 * b3_* attributes. Pure: callers fetch and cache the 3DBAG item.
 */
import {minimumRotatedRectangle, type Pt, type Rect} from './geometry.ts';
import type {GenerateParams} from './generate.ts';
import type {TypeSpec} from './spec.ts';

export interface CityJsonItem {
  feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; type: string; boundaries: any; semantics?: {surfaces: {type: string}[]; values: any}}[]}>; vertices: number[][]};
  metadata: {transform: {scale: number[]; translate: number[]}};
}

export interface Bag3dAttributes {
  b3_bouwlagen?: number | null;
  b3_dak_type?: string | null;
  b3_h_dak_max?: number | null;
  b3_h_dak_50p?: number | null;
  b3_h_dak_min?: number | null;
  b3_h_maaiveld?: number | null;
  b3_h_nok?: number | null;
}

export interface RoofFacts {
  form: 'flat' | 'gable' | 'hip';
  /** Ridge direction as a unit vector in RD (east, north); null for flat roofs. */
  ridgeDirRD: Pt | null;
  slopeDeg: number | null;
  /** Count of slanted roof planes (> 10 degrees, > 3 m2). */
  slantedPlanes: number;
  roofAreaM2: number;
}

interface RoofPlane { normal: [number, number, number]; area: number }

const SLANT_MIN_DEG = 10, AREA_MIN_M2 = 3;

function planeOf(ring: number[][]): RoofPlane {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const m = Math.hypot(nx, ny, nz) || 1;
  const sign = nz < 0 ? -1 : 1; // roof normals point up
  return {normal: [sign * nx / m, sign * ny / m, sign * nz / m], area: m / 2};
}

export function decodeRoofPlanes(item: CityJsonItem): RoofPlane[] {
  const t = item.metadata.transform, verts = item.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
  const planes: RoofPlane[] = [];
  for (const o of Object.values(item.feature.CityObjects)) for (const g of o.geometry ?? []) {
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    const shells = g.boundaries as number[][][][];
    for (let si = 0; si < shells.length; si++) for (let j = 0; j < shells[si].length; j++) {
      if (g.semantics.surfaces[g.semantics.values[si][j]]?.type !== 'RoofSurface') continue;
      planes.push(planeOf(shells[si][j][0].map(k => verts[k])));
    }
  }
  return planes;
}

export function roofFactsFromPlanes(planes: RoofPlane[]): RoofFacts {
  const total = planes.reduce((s, p) => s + p.area, 0);
  const slanted = planes.filter(p => Math.hypot(p.normal[0], p.normal[1]) / Math.max(1e-9, p.normal[2]) > Math.tan(SLANT_MIN_DEG * Math.PI / 180) && p.area > AREA_MIN_M2);
  if (!slanted.length) return {form: 'flat', ridgeDirRD: null, slopeDeg: null, slantedPlanes: 0, roofAreaM2: total};
  const main = slanted.reduce((a, b) => (b.area > a.area ? b : a));
  const fall: Pt = [main.normal[0], main.normal[1]], fl = Math.hypot(fall[0], fall[1]);
  const ridgeDirRD: Pt = [-fall[1] / fl, fall[0] / fl];
  // Hip ends: slanted planes whose fall is along the ridge carry >= 8 % of the slanted area.
  const alongRidge = slanted.filter(p => Math.abs((p.normal[0] * ridgeDirRD[0] + p.normal[1] * ridgeDirRD[1]) / Math.hypot(p.normal[0], p.normal[1])) > Math.cos(30 * Math.PI / 180));
  const slantArea = slanted.reduce((s, p) => s + p.area, 0), hipArea = alongRidge.reduce((s, p) => s + p.area, 0);
  const slope = Math.atan(fl / main.normal[2]) * 180 / Math.PI;
  return {form: hipArea >= 0.08 * slantArea ? 'hip' : 'gable', ridgeDirRD, slopeDeg: slope, slantedPlanes: slanted.length, roofAreaM2: total};
}

export const roofFactsFromItem = (item: CityJsonItem): RoofFacts => roofFactsFromPlanes(decodeRoofPlanes(item));

/** 'long' when the ridge runs within 45 degrees of the rectangle's long side. RD (east, north) -> local (east, south). */
export function ridgeAlongOf(rect: Rect, ridgeDirRD: Pt): 'long' | 'short' {
  const r: Pt = [ridgeDirRD[0], -ridgeDirRD[1]];
  return Math.abs(r[0] * rect.long[0] + r[1] * rect.long[1]) >= Math.SQRT1_2 ? 'long' : 'short';
}

/** Storeys under the eaves: the count within one of the type's that puts the storey height nearest 2.95 m (post-war floor + slab). */
export function storeysFromHeight(eavesM: number, nominal: number, typical = 2.95): number {
  let best = nominal;
  for (const n of [nominal - 1, nominal + 1]) if (n >= 2 && Math.abs(eavesM / n - typical) < Math.abs(eavesM / best - typical) - 0.05) best = n;
  return best;
}

export interface ParamsResult {
  params: GenerateParams;
  warnings: string[];
}

/**
 * Generator parameters from facts. `eavesM` and `ridgeM` are heights above the pand's own ground (b3_h_maaiveld).
 * Storeys come from the type (all members share them by construction) and are cross-checked against 3DBAG.
 */
export function paramsFromFacts(spec: TypeSpec, rect: Rect, attrs: Bag3dAttributes, roof: RoofFacts | null, overrides: Partial<GenerateParams> = {}): ParamsResult {
  const warnings: string[] = [];
  const ground = attrs.b3_h_maaiveld ?? 0;
  const pitchedType = spec.roof.form !== 'flat';
  const form: 'flat' | 'gable' | 'hip' = roof ? roof.form : spec.roof.form;
  if (roof && (form === 'flat') !== !pitchedType) warnings.push(`3DBAG roof is ${form} but the type is ${spec.roof.form}: using the type's roof class with 3DBAG heights`);
  const roofForm = pitchedType ? (form === 'flat' ? spec.roof.form : form) : 'flat';
  const top = pitchedType ? attrs.b3_h_dak_min : attrs.b3_h_dak_50p ?? attrs.b3_h_dak_max;
  let eavesM = (top ?? NaN) - ground;
  if (!Number.isFinite(eavesM)) { eavesM = spec.storeys * 2.9; warnings.push('no 3DBAG roof height: eaves from the storey count x 2.9 m'); }
  let ridgeM: number | undefined;
  if (pitchedType) {
    const nok = attrs.b3_h_nok ?? attrs.b3_h_dak_max;
    ridgeM = nok != null ? nok - ground : undefined;
    if (ridgeM !== undefined && ridgeM <= eavesM + 0.3) { warnings.push(`ridge ${ridgeM.toFixed(2)} m barely above eaves ${eavesM.toFixed(2)} m: using the type's pitch`); ridgeM = undefined; }
  }
  const storeys = storeysFromHeight(eavesM, spec.storeys), sh = eavesM / storeys;
  if (storeys !== spec.storeys) warnings.push(`eaves ${eavesM.toFixed(2)} m say ${storeys} storeys, the type has ${spec.storeys} (3DBAG bouwlagen ${attrs.b3_bouwlagen ?? '?'} counts the attic)`);
  else if (attrs.b3_bouwlagen != null && attrs.b3_bouwlagen !== storeys) warnings.push(`3DBAG bouwlagen ${attrs.b3_bouwlagen} != type storeys ${storeys}`);
  if (sh < 2.6 || sh > 3.4) warnings.push(`storey height ${sh.toFixed(2)} m outside 2.6-3.4 m`);
  const ridge = roof?.ridgeDirRD ? ridgeAlongOf(rect, roof.ridgeDirRD) : spec.roof.ridge;
  return {params: {lengthM: rect.length, widthM: rect.width, eavesM, ridgeM, storeys, roofForm, ridge, ...overrides}, warnings};
}

/** Footprint ring (local metres) to its rectangle: re-exported so callers need one import. */
export const rectOf = (ring: Pt[]) => minimumRotatedRectangle(ring);

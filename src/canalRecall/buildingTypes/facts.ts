/**
 * 3DBAG facts for one pand: roof form and ridge direction from the LoD2.2 roof
 * surfaces, plus the generator parameters (storeys, eaves, ridge) from the
 * b3_* attributes. Pure: callers fetch and cache the 3DBAG item.
 */
import {minimumRotatedRectangle, type Pt, type Rect} from './geometry.ts';
import type {GenerateParams} from './generate.ts';
import type {TypeSpec} from './spec.ts';
import {pandGroundNap, type TerrainAt} from '../bag3dCityJson.ts';

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
  /** Read by the terrain rule (`trustedGroundNap`): roof clearance and the AHN vintage. */
  b3_h_dak_70p?: number | null;
  oorspronkelijkbouwjaar?: number | null;
}

/** Where the trusted ground is read: the AHN terrain field and the pand's footprint ring in RD New. */
export interface GroundEvidence { terrainAt?: TerrainAt | null; ringRd?: readonly (readonly number[])[] | null }

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

/**
 * Eaves of the two main roof slopes, read from the LoD2.2 roof planes: the lowest point of the largest slanted plane and of the
 * largest one falling the opposite way (within 37 degrees). `frontRD` is the facade's outward normal in RD (east, north); the plane
 * falling towards it is the front slope. Heights are metres NAP; null without two opposite slopes. A catslide (one slope carried
 * down over a lean-to) or a front slope swept down to the ground storey shows as eaves that differ by metres, where
 * b3_h_dak_min only sees the lowest of them.
 */
export function slopeEavesFromItem(item: CityJsonItem, frontRD: Pt): {frontNap: number; backNap: number} | null {
  const t = item.metadata.transform, verts = item.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
  const planes: (RoofPlane & {minZ: number})[] = [];
  for (const o of Object.values(item.feature.CityObjects)) for (const g of o.geometry ?? []) {
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    const shells = g.boundaries as number[][][][];
    for (let si = 0; si < shells.length; si++) for (let j = 0; j < shells[si].length; j++) {
      if (g.semantics.surfaces[g.semantics.values[si][j]]?.type !== 'RoofSurface') continue;
      const pts = shells[si][j][0].map(k => verts[k]);
      planes.push({...planeOf(pts), minZ: Math.min(...pts.map(p => p[2]))});
    }
  }
  const fall = (p: RoofPlane): Pt => { const h = Math.hypot(p.normal[0], p.normal[1]) || 1; return [p.normal[0] / h, p.normal[1] / h]; };
  const slanted = planes.filter(p => Math.hypot(p.normal[0], p.normal[1]) / Math.max(1e-9, p.normal[2]) > Math.tan(SLANT_MIN_DEG * Math.PI / 180) && p.area > AREA_MIN_M2).sort((a, b) => b.area - a.area);
  if (slanted.length < 2) return null;
  const a = slanted[0], fa = fall(a), b = slanted.find(p => { const f = fall(p); return f[0] * fa[0] + f[1] * fa[1] < -0.8; });
  if (!b) return null;
  const aFront = fa[0] * frontRD[0] + fa[1] * frontRD[1] > 0;
  return {frontNap: aFront ? a.minZ : b.minZ, backNap: aFront ? b.minZ : a.minZ};
}

/**
 * The side a single-pitch roof falls to, seen from the front: the largest slanted LoD2.2 roof plane's fall direction against the
 * front facade's left-to-right tangent `tangentRD` (RD east, north). 'right' when it falls towards +tangent, 'left' towards
 * -tangent, null when it falls front or back (within 45 degrees) or there is no slanted plane. A pair gable's house falls to its
 * free side (pairGable in generate.ts).
 */
export function fallSideFromItem(item: CityJsonItem, tangentRD: Pt): 'left' | 'right' | null {
  const slanted = decodeRoofPlanes(item).filter(p => Math.hypot(p.normal[0], p.normal[1]) / Math.max(1e-9, p.normal[2]) > Math.tan(SLANT_MIN_DEG * Math.PI / 180) && p.area > AREA_MIN_M2);
  if (!slanted.length) return null;
  const a = slanted.reduce((x, y) => (y.area > x.area ? y : x)), h = Math.hypot(a.normal[0], a.normal[1]);
  const along = (a.normal[0] * tangentRD[0] + a.normal[1] * tangentRD[1]) / h / (Math.hypot(tangentRD[0], tangentRD[1]) || 1);
  return along > Math.SQRT1_2 ? 'right' : along < -Math.SQRT1_2 ? 'left' : null;
}

export const roofFactsFromItem = (item: CityJsonItem): RoofFacts => roofFactsFromPlanes(decodeRoofPlanes(item));

/** 'long' when the ridge runs within 45 degrees of the rectangle's long side. RD (east, north) -> local (east, south). */
export function ridgeAlongOf(rect: Rect, ridgeDirRD: Pt): 'long' | 'short' {
  const r: Pt = [ridgeDirRD[0], -ridgeDirRD[1]];
  return Math.abs(r[0] * rect.long[0] + r[1] * rect.long[1]) >= Math.SQRT1_2 ? 'long' : 'short';
}

const roofFromRidge = (rect: Rect, roof: RoofFacts) => (roof.ridgeDirRD ? ridgeAlongOf(rect, roof.ridgeDirRD) : 'long');

/** Storeys under the eaves: the count within one of the type's that puts the storey height nearest 2.95 m (post-war floor + slab). */
export function storeysFromHeight(eavesM: number, nominal: number, typical = 2.95): number {
  let best = nominal;
  for (const n of [nominal - 1, nominal + 1, nominal - 2]) if (n >= 2 && Math.abs(eavesM / n - typical) < Math.abs(eavesM / best - typical) - 0.05) best = n;
  return best;
}

export interface ParamsResult {
  params: GenerateParams;
  warnings: string[];
  /** The ground eaves and ridge stand on, metres NAP (`pandGroundNap`); place the generated house at this height. */
  groundNapM: number;
}

/**
 * Generator parameters from facts. `eavesM` and `ridgeM` are heights above the pand's trusted ground (`pandGroundNap`:
 * 3DBAG's b3_h_maaiveld unless that is a failed estimate under the AHN terrain given in `evidence`).
 * Storeys come from the type (all members share them by construction) and are cross-checked against 3DBAG.
 */
export function paramsFromFacts(spec: TypeSpec, rect: Rect, attrs: Bag3dAttributes, roof: RoofFacts | null, overrides: Partial<GenerateParams> = {}, evidence: GroundEvidence = {}): ParamsResult {
  const warnings: string[] = [];
  const trusted = pandGroundNap(attrs as Record<string, unknown>, evidence.terrainAt, evidence.ringRd);
  const ground = trusted.groundNapM ?? 0;
  if (trusted.source === 'terrain') warnings.push(`3DBAG ground ${attrs.b3_h_maaiveld?.toFixed(2)} NAP is a failed estimate under the terrain: heights from the terrain at ${ground.toFixed(2)} NAP`);
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
    // b3_h_dak_min is the lowest roof point: a lean-to, canopy or LoD artefact drags it to ~3 m on some members.
    // For a gable whose ridge runs along the long side the eaves follow from ridge, half the width and the slope.
    if (ridgeM !== undefined && roof?.slopeDeg && roofForm === 'gable') {
      // terraced houses (frontOnShort): dak_min stays the eaves unless implausible; 3DBAG's main-plane slope of a dormered roof is not the real pitch.
      // frontOnShort types have the ridge across or along the (swapped) rectangle; half-span = half the extent across the ridge.
      const span = spec.frontOnShort && (roofFromRidge(rect, roof) === 'short') ? rect.length : rect.width;
      const est = ridgeM - (span / 2) * Math.tan(roof.slopeDeg * Math.PI / 180);
      if (Math.abs(est - eavesM) > 1.2 && est > 2 && (!spec.frontOnShort || eavesM < 4.6 || eavesM > ridgeM - 1.2)) { warnings.push(`b3_h_dak_min eaves ${eavesM.toFixed(2)} m disagree with ridge ${ridgeM.toFixed(2)} m - slope: using ${est.toFixed(2)} m`); eavesM = est; }
    }
    if (ridgeM !== undefined && ridgeM <= eavesM + 0.3) { warnings.push(`ridge ${ridgeM.toFixed(2)} m barely above eaves ${eavesM.toFixed(2)} m: using the type's pitch`); ridgeM = undefined; }
  }
  const storeys = storeysFromHeight(eavesM, spec.storeys), sh = eavesM / storeys;
  if (storeys !== spec.storeys) warnings.push(`eaves ${eavesM.toFixed(2)} m say ${storeys} storeys, the type has ${spec.storeys} (3DBAG bouwlagen ${attrs.b3_bouwlagen ?? '?'} counts the attic)`);
  else if (attrs.b3_bouwlagen != null && attrs.b3_bouwlagen !== storeys) warnings.push(`3DBAG bouwlagen ${attrs.b3_bouwlagen} != type storeys ${storeys}`);
  if (sh < 2.6 || sh > 3.4) warnings.push(`storey height ${sh.toFixed(2)} m outside 2.6-3.4 m`);
  // A flat roof has no ridge: a stepped 3DBAG roof (stair heads, lift rooms) must not split flat instances into 'long'/'short' units.
  const ridge = roofForm === 'flat' ? spec.roof.ridge : roof?.ridgeDirRD ? ridgeAlongOf(rect, roof.ridgeDirRD) : spec.roof.ridge;
  return {params: {lengthM: rect.length, widthM: rect.width, eavesM, ridgeM, storeys, roofForm, ridge, ...overrides}, warnings, groundNapM: ground};
}

/** Footprint ring (local metres) to its rectangle: re-exported so callers need one import. */
export const rectOf = (ring: Pt[]) => minimumRotatedRectangle(ring);

/** A roof surface in local metres: outer ring, mean height (NAP) and plan area. */
export interface RoofPolygon { ring: Pt[]; z: number; area: number }

/** LoD2.2 roof surfaces of a 3DBAG item, mapped to local metres by `toLocal(rdX, rdY)`. */
export function roofPolygons(item: CityJsonItem, toLocal: (x: number, y: number) => Pt): RoofPolygon[] {
  const t = item.metadata.transform, verts = item.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
  const out: RoofPolygon[] = [];
  for (const o of Object.values(item.feature.CityObjects)) for (const g of o.geometry ?? []) {
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    const shells = g.boundaries as number[][][][];
    for (let si = 0; si < shells.length; si++) for (let j = 0; j < shells[si].length; j++) {
      if (g.semantics.surfaces[g.semantics.values[si][j]]?.type !== 'RoofSurface') continue;
      const pts = shells[si][j][0].map(k => verts[k]), ring = pts.map(p => toLocal(p[0], p[1]));
      const area = Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
      out.push({ring, z: pts.reduce((s, p) => s + p[2], 0) / pts.length, area});
    }
  }
  return out;
}

const insideRing = (p: Pt, ring: Pt[]): boolean => {
  let r = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
};

/**
 * The tall body of a pand whose BAG ring also holds low annexes (a garage row, entrance halls, stair and lift towers): the
 * roof surfaces at the main roof level (within `tolM` of the largest surface's height) are cut into cross-sections across the
 * `axis` rectangle's long axis every `stepM`; the body spans the median cross-section across, and along the axis as far as the
 * cross-sections are at least 60 % of that width. Local protrusions of the roof outline (a lift shaft, a mapping sliver) do not
 * move it. Returns null when there is no roof surface.
 */
export function bodyRectFromRoof(roofs: RoofPolygon[], axis: Rect, tolM = 0.6, stepM = 0.5): Rect | null {
  if (!roofs.length) return null;
  const main = roofs.reduce((a, b) => (b.area > a.area ? b : a));
  const toST = (p: Pt): Pt => { const dx = p[0] - axis.center[0], dz = p[1] - axis.center[1]; return [dx * axis.long[0] + dz * axis.long[1], dx * axis.short[0] + dz * axis.short[1]]; };
  const st = roofs.filter(r => Math.abs(r.z - main.z) <= tolM).map(r => r.ring.map(toST));
  // scan the axis rectangle and every selected surface (an absorbed end bay may lie beyond the ring's rectangle)
  const all = st.flat(), s0 = Math.min(-axis.length / 2, ...all.map(p => p[0])) - 1, s1 = Math.max(axis.length / 2, ...all.map(p => p[0])) + 1;
  const t0 = Math.min(-axis.width / 2, ...all.map(p => p[1])) - 1, t1 = Math.max(axis.width / 2, ...all.map(p => p[1])) + 1, dt = 0.1;
  const sections: {s: number; lo: number; hi: number}[] = [];
  for (let s = s0 + stepM / 2; s < s1; s += stepM) {
    let lo = Infinity, hi = -Infinity;
    for (let t = t0; t <= t1; t += dt) if (st.some(r => insideRing([s, t], r))) { lo = Math.min(lo, t); hi = Math.max(hi, t); }
    if (hi > lo) sections.push({s, lo, hi});
  }
  if (!sections.length) return null;
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const lo = med(sections.map(x => x.lo)), hi = med(sections.map(x => x.hi)) + dt, width = hi - lo;
  const full = sections.filter(x => x.hi - x.lo >= 0.6 * width);
  const sa = Math.min(...full.map(x => x.s)) - stepM / 2, sb = Math.max(...full.map(x => x.s)) + stepM / 2, length = sb - sa;
  const cs = (sa + sb) / 2, ct = (lo + hi) / 2;
  const center: Pt = [axis.center[0] + axis.long[0] * cs + axis.short[0] * ct, axis.center[1] + axis.long[1] * cs + axis.short[1] * ct];
  const corner = (a: number, b: number): Pt => [center[0] + axis.long[0] * a + axis.short[0] * b, center[1] + axis.long[1] * a + axis.short[1] * b];
  const L = length / 2, W = width / 2;
  return {center, long: axis.long, short: axis.short, length, width, corners: [corner(-L, -W), corner(L, -W), corner(L, W), corner(-L, W)]};
}

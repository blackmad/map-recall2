/**
 * Facts: everything metric about one BAG Pand, derived from a 3DBAG item
 * (LoD0 = BAG footprint, LoD2.2 ground/roof/wall surfaces) and the routing
 * street extract. Pure; the CLI in scripts/building-recipes/facts.ts fetches
 * and caches the inputs and writes facts.json.
 *
 * The roof/footprint section deliberately has the same shape as the
 * canalhouse `*-survey.json` files so `surveyRecipe` consumes it unchanged.
 */
import {discoverCompleteFrontage} from '../../../scripts/canalhouse-recipes/complete-frontage.ts';

export type RD = [number, number];
export interface CityJsonItem {
  feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; type: string; boundaries: any; semantics?: {surfaces: {type: string}[]; values: any}}[]}>; vertices: number[][]};
  metadata: {transform: {scale: number[]; translate: number[]}};
}
export interface StreetPath { name: string; paths: [number, number][][] }

export interface FrontFacts {
  street: string;
  /** Left-to-right as seen from the street, ground-ring vertices of the LoD2.2 footprint. */
  endpointsRD: [RD, RD];
  /** Every ring vertex along the frontage, left to right. */
  chainRD: RD[];
  widthM: number;
  outwardNormalRD: RD;
  streetDistanceM: number;
  /** Roof height above ground sampled 5 cm inside the frontage, left to right. */
  topProfile: {alongM: number; heightM: number}[];
  eavesM: number;
  topM: number;
  uncertainty: string[];
}

export interface BuildingFacts {
  schemaVersion: 1;
  pandId: string;
  source: {threeDBag: string; fetchedAt: string; streets: string};
  attributes: Record<string, unknown> & {b3_h_maaiveld: number};
  bagFootprintRD: RD[][];
  surveyFootprintPolygonsRD: RD[][][];
  roofsRD: {surfaceId: string; vertices: number[][]; ringsRD: number[][][]; slopeDeg: number; areaM2: number}[];
  heights: {groundNAP: number; roofMinM: number; roofMaxM: number; ridgeM: number; dak50pM: number; dak70pM: number; storeys: number | null; builtYear: number | null};
  fronts: FrontFacts[];
  /**
   * Eaves (cornice top / gable foot) per intent front id, in metres above this pand's ground, measured on a rectified
   * photo (block-face `continuity.measuredEaves` on the strip). Replaces the 3DBAG profile estimate in the fit.
   */
  measuredEavesM?: Record<string, number>;
  /**
   * Where `roofsRD` came from when it is not 3DBAG: `recipe` = generated from the house design and plot depth
   * (blockFace/recipeRoof.ts); 3DBAG is then an upper bound only (`surveyRoofMaxM`, main-body p95 `capM`).
   */
  roofSource?: {kind: 'recipe'; surveyRoofMaxM: number; capM: number};
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const signedArea = (ring: number[][]) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const open = <P extends number[]>(ring: P[]) => ring.length > 1 && dist(ring[0], ring.at(-1)!) < 1e-8 ? ring.slice(0, -1) : ring;

export function pointInRing(p: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Least-squares plane z = c0 + c1*x + c2*y through a ring (x,y centred for stability). */
export function fitPlane(points: number[][]): (x: number, y: number) => number {
  const n = points.length, mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n, mz = points.reduce((s, p) => s + p[2], 0) / n;
  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0;
  for (const p of points) { const x = p[0] - mx, y = p[1] - my, z = p[2] - mz; sxx += x * x; sxy += x * y; syy += y * y; sxz += x * z; syz += y * z; }
  const det = sxx * syy - sxy * sxy;
  const a = Math.abs(det) < 1e-12 ? 0 : (sxz * syy - syz * sxy) / det, b = Math.abs(det) < 1e-12 ? 0 : (syz * sxx - sxz * sxy) / det;
  return (x, y) => mz + a * (x - mx) + b * (y - my);
}

/** Decode LoD0 footprint, LoD2.2 ground polygons and roof surfaces (with holes) from one 3DBAG item. */
export function decodeThreeDBag(item: CityJsonItem) {
  const t = item.metadata.transform, verts = item.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
  let attributes: Record<string, unknown> | undefined;
  const bag: RD[][] = [], ground: RD[][][] = [], roofs: BuildingFacts['roofsRD'] = [];
  for (const [objectId, o] of Object.entries(item.feature.CityObjects)) {
    if (o.type === 'Building') attributes = o.attributes;
    for (const g of o.geometry ?? []) {
      if (String(g.lod) === '0') for (const surface of g.boundaries as number[][][]) bag.push(open(surface[0].map(k => [verts[k][0], verts[k][1]] as RD)));
      if (String(g.lod) !== '2.2' || !g.semantics) continue;
      const shells = g.boundaries as number[][][][];
      for (let si = 0; si < shells.length; si++) for (let j = 0; j < shells[si].length; j++) {
        const type = g.semantics.surfaces[g.semantics.values[si][j]]?.type;
        const rings = shells[si][j].map(r => r.map(k => verts[k]));
        if (type === 'GroundSurface') ground.push(rings.map(r => r.map(p => [p[0], p[1]] as RD)));
        if (type === 'RoofSurface') {
          const outer = rings[0], plane = fitPlane(outer);
          // Slope from the fitted plane gradient.
          const gx = plane(outer[0][0] + 1, outer[0][1]) - plane(outer[0][0], outer[0][1]), gy = plane(outer[0][0], outer[0][1] + 1) - plane(outer[0][0], outer[0][1]);
          roofs.push({surfaceId: `${objectId}:lod22:roof:${j}`, vertices: outer, ringsRD: rings, slopeDeg: Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI, areaM2: Math.abs(signedArea(outer)) - rings.slice(1).reduce((s, r) => s + Math.abs(signedArea(r)), 0)});
        }
      }
    }
  }
  if (!attributes) throw Error('3DBAG item has no Building attributes');
  if (!ground.length) throw Error('3DBAG item has no LoD2.2 ground surface');
  return {attributes: attributes as BuildingFacts['attributes'], bag, ground, roofs};
}

/** Closest point on a street (paths are [lat,lng]) to an RD point, using a lng/lat→RD converter. */
function nearestStreetPoint(streets: StreetPath[], name: string, toRD: (lngLat: [number, number]) => RD, near: RD) {
  let best: {point: RD; distance: number} | null = null;
  for (const s of streets) {
    if (s.name.toLowerCase() !== name.toLowerCase()) continue;
    for (const path of s.paths) {
      const pts = path.map(([lat, lng]) => toRD([lng, lat]));
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
        const t = den ? Math.max(0, Math.min(1, ((near[0] - a[0]) * dx + (near[1] - a[1]) * dy) / den)) : 0;
        const p: RD = [a[0] + t * dx, a[1] + t * dy], d = dist(p, near);
        if (!best || d < best.distance) best = {point: p, distance: d};
      }
    }
  }
  if (!best) throw Error(`Street "${name}" not found in the routing extract`);
  return best;
}

/** Height of the highest roof surface covering an RD point, relative to ground. */
export function roofHeightAt(roofs: BuildingFacts['roofsRD'], p: number[], ground: number): number | null {
  let h: number | null = null;
  for (const r of roofs) {
    const [outer, ...holes] = r.ringsRD;
    if (!pointInRing(p, outer) || holes.some(hole => pointInRing(p, hole))) continue;
    const z = fitPlane(outer)(p[0], p[1]) - ground;
    if (h === null || z > h) h = z;
  }
  return h;
}

/**
 * Find the street-facing frontage: seed with the outward edge that best faces
 * the named street and lies closest to it, then extend with the canalhouse
 * `discoverCompleteFrontage` rules (jogs ≤ 0.35 m, facade angle ≤ 35°).
 */
export function findFrontage(ground: RD[][][], roofs: BuildingFacts['roofsRD'], groundNAP: number, streets: StreetPath[], street: string, toRD: (lngLat: [number, number]) => RD): FrontFacts {
  const uncertainty: string[] = [];
  const all = ground.flatMap(p => open(p[0]));
  const centroid: RD = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
  const target = nearestStreetPoint(streets, street, toRD, centroid);
  // Every ground edge, to test that a candidate front sees the street unobstructed.
  const allEdges = ground.flatMap(p => p.flatMap(r => { const ring = open(r); return ring.map((a, i) => [a, ring[(i + 1) % ring.length]] as [RD, RD]); }));
  const crosses = (p: number[], q: number[], e: [RD, RD]) => {
    const c = (a: number[], b: number[], x: number[]) => (b[0] - a[0]) * (x[1] - a[1]) - (b[1] - a[1]) * (x[0] - a[0]);
    return c(p, q, e[0]) * c(p, q, e[1]) < 0 && c(e[0], e[1], p) * c(e[0], e[1], q) < 0;
  };
  let seed: {score: number; a: RD; b: RD; normal: RD} | null = null;
  for (const poly of ground) {
    const ring = open(poly[0]), sign = signedArea(ring) > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], len = dist(a, b);
      if (len < 1) continue;
      const normal: RD = [sign * (b[1] - a[1]) / len, -sign * (b[0] - a[0]) / len];
      const mid: RD = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], local = nearestStreetPoint(streets, street, toRD, mid).point;
      const toStreet = [local[0] - mid[0], local[1] - mid[1]], d = Math.hypot(toStreet[0], toStreet[1]);
      const alignment = d ? (normal[0] * toStreet[0] + normal[1] * toStreet[1]) / d : 0;
      if (alignment < Math.cos(35 * Math.PI / 180)) continue;
      // Courtyard and re-entrant edges: the sightline to the street crosses the footprint.
      const start = [mid[0] + normal[0] * 0.05, mid[1] + normal[1] * 0.05];
      if (allEdges.some(e => crosses(start, local, e))) continue;
      // Prefer the nearest, then longer and better-aligned edges.
      const score = d - 0.5 * Math.min(len, 6) - 3 * alignment;
      if (!seed || score < seed.score) seed = {score, a, b, normal};
    }
  }
  if (!seed) throw Error(`No footprint edge faces ${street}`);
  const streetNormal: RD = seed.normal;
  let discovery = discoverCompleteFrontage(ground, [seed.a, seed.b], {streetNormalRD: streetNormal, maxAddedWidthM: 60, maxEdges: 64});
  // A near-parallel facade beyond a jog of at most 1 m is usually the same front
  // (the canalhouse 82/88 partial-front failures); retry with the bounded 1 m jog limit.
  if (discovery.possiblePartialFront) {
    const wide = discoverCompleteFrontage(ground, [seed.a, seed.b], {streetNormalRD: streetNormal, maxJogM: 1, maxAddedWidthM: 60, maxEdges: 64});
    if ((wide.candidate?.widthM ?? 0) > (discovery.candidate?.widthM ?? 0) + 0.3) { discovery = wide; uncertainty.push('Frontage extended across a native jog of up to 1 m (possible partial front at the default 0.35 m).'); }
  }
  const chain = (discovery.candidate?.orderedVerticesRD ?? [seed.a, seed.b]) as RD[];
  if (!discovery.candidate) uncertainty.push('Frontage discovery found no complete candidate; seed edge only.');
  uncertainty.push(...discovery.uncertainty.filter((u: string) => !u.startsWith('Candidate requires')));
  // Order left-to-right as seen from the street: viewer looks along -normal.
  let [a, b] = [chain[0], chain.at(-1)!];
  const tangent = [b[0] - a[0], b[1] - a[1]], n = discovery.streetNormalRD;
  // A viewer facing the building looks along f = -n; their right hand points along (f.y, -f.x).
  const right = [-n[1], n[0]];
  const ordered = tangent[0] * right[0] + tangent[1] * right[1] >= 0 ? chain : [...chain].reverse();
  [a, b] = [ordered[0], ordered.at(-1)!];
  const width = dist(a, b), u = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const ground0 = groundNAP;
  const topProfile: FrontFacts['topProfile'] = [];
  // Sample along the frontage polyline (not the chord, which can leave the footprint at jogs).
  const segs = ordered.slice(1).map((q, i) => ({p: ordered[i], q, len: dist(ordered[i], q)})), total = segs.reduce((s, x) => s + x.len, 0);
  for (let k = 0; k <= 40; k++) {
    let t = total * (0.01 + 0.98 * k / 40), seg = segs[0];
    for (seg of segs) { if (t <= seg.len) break; t -= seg.len; }
    const f = seg.len ? Math.min(1, t / seg.len) : 0, on = [seg.p[0] + (seg.q[0] - seg.p[0]) * f, seg.p[1] + (seg.q[1] - seg.p[1]) * f];
    const p = [on[0] - n[0] * 0.08, on[1] - n[1] * 0.08], along = (on[0] - a[0]) * u[0] + (on[1] - a[1]) * u[1];
    const h = roofHeightAt(roofs, p, ground0);
    if (h !== null) topProfile.push({alongM: along, heightM: h});
  }
  if (topProfile.length < 10) uncertainty.push('Roof surfaces cover less than a quarter of the frontage profile.');
  const hs = topProfile.map(p => p.heightM).sort((x, y) => x - y);
  return {street, endpointsRD: [a, b], chainRD: ordered, widthM: width, outwardNormalRD: [n[0], n[1]], streetDistanceM: target.distance,
    topProfile, eavesM: hs[Math.floor(hs.length * 0.1)] ?? NaN, topM: hs.at(-1) ?? NaN, uncertainty};
}

export function buildFacts(pandId: string, item: CityJsonItem, streets: StreetPath[], frontStreets: string[], toRD: (lngLat: [number, number]) => RD, meta: BuildingFacts['source']): BuildingFacts {
  const {attributes, bag, ground, roofs} = decodeThreeDBag(item);
  const g = Number(attributes.b3_h_maaiveld);
  if (!Number.isFinite(g)) throw Error('Missing b3_h_maaiveld');
  const rel = (v: unknown) => Number(v) - g;
  const roofZ = roofs.flatMap(r => r.vertices.map(v => v[2] - g));
  const unique = [...new Set(frontStreets)];
  return {
    schemaVersion: 1, pandId, source: meta, attributes, bagFootprintRD: bag, surveyFootprintPolygonsRD: ground, roofsRD: roofs,
    heights: {groundNAP: g, roofMinM: Math.min(...roofZ), roofMaxM: Math.max(...roofZ), ridgeM: Number.isFinite(Number(attributes.b3_h_nok)) && attributes.b3_h_nok !== null ? Math.max(rel(attributes.b3_h_nok), rel(attributes.b3_h_dak_max)) : rel(attributes.b3_h_dak_max), dak50pM: rel(attributes.b3_h_dak_50p), dak70pM: rel(attributes.b3_h_dak_70p),
      storeys: Number.isFinite(Number(attributes.b3_bouwlagen)) ? Number(attributes.b3_bouwlagen) : null, builtYear: Number.isFinite(Number(attributes.oorspronkelijkbouwjaar)) ? Number(attributes.oorspronkelijkbouwjaar) : null},
    fronts: unique.map(s => findFrontage(ground, roofs, g, streets, s, toRD)),
  };
}

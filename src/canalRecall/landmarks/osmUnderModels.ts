/**
 * Does the plain OSM/BAG extrusion draw through a placed model?
 *
 * The city building layer (building-tiles/14) hides a building only when its
 * id is in a placed model's `suppressOsmIds`. A building standing inside the
 * model's footprint but missing from that list is extruded straight through the
 * model (Piet Hein / Bercylaan 801, 2026-10-11). This module is the pure part
 * of that audit: ground footprints per model, and the overlap measure. The CLI
 * is scripts/check-osm-under-models.ts.
 *
 * Overlap is the fraction of the OSM polygon's AREA inside the model footprint
 * (not the centroid), so a neighbour whose centroid just clips the model's
 * bounding rectangle is not a hit.
 */

export type LngLat = readonly [number, number];
export type Ring = readonly LngLat[];

/** Minimum share of the OSM polygon inside the model footprint to count as "drawn through". */
export const MIN_OVERLAP_FRACTION = 0.5;

const M_PER_DEG_LAT = 111_320;

export const pointInRing = (p: LngLat, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const ringBounds = (ring: Ring) => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return {w, s, e, n};
};

/** Footprint rectangle (OrientedFootprint) as a lng/lat ring. Heading = bearing of the long side, clockwise from north. */
export function orientedRectRing(centre: LngLat, headingDegrees: number, lengthMetres: number, widthMetres: number): Ring {
  const mx = M_PER_DEG_LAT * Math.cos((centre[1] * Math.PI) / 180), h = (headingDegrees * Math.PI) / 180;
  const along = [Math.sin(h), Math.cos(h)], across = [Math.cos(h), -Math.sin(h)]; // [east, north]
  const corner = (a: number, b: number): LngLat => [
    centre[0] + (along[0] * a * lengthMetres + across[0] * b * widthMetres) / mx,
    centre[1] + (along[1] * a * lengthMetres + across[1] * b * widthMetres) / M_PER_DEG_LAT];
  return [corner(-.5, -.5), corner(.5, -.5), corner(.5, .5), corner(-.5, .5)];
}

/** `*-footprints.json` nativeRing: [east, south] metres from the anchor. */
export function nativeRingToLngLat(nativeRing: readonly (readonly [number, number])[], anchor: LngLat): Ring {
  const mx = M_PER_DEG_LAT * Math.cos((anchor[1] * Math.PI) / 180), my = 110_574;
  return nativeRing.map(([e, s]) => [anchor[0] + e / mx, anchor[1] - s / my] as LngLat);
}

/** Outer rings of a GeoJSON Polygon / MultiPolygon (holes ignored: a courtyard is inside the model's mass). */
export function outerRings(geometry: {type: string; coordinates: unknown} | null | undefined): Ring[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [(geometry.coordinates as LngLat[][])[0]];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as LngLat[][][]).map(p => p[0]);
  return [];
}

/** A model's ground footprint: a bounding box (cheap reject) and a point test. */
export interface Footprint {
  readonly bounds: {w: number; s: number; e: number; n: number};
  contains(p: LngLat): boolean;
}

/** Footprint from polygon rings (any ring contains the point). */
export function ringsFootprint(rings: readonly Ring[]): Footprint {
  const boxes = rings.map(ringBounds);
  const bounds = {w: Math.min(...boxes.map(b => b.w)), s: Math.min(...boxes.map(b => b.s)), e: Math.max(...boxes.map(b => b.e)), n: Math.max(...boxes.map(b => b.n))};
  return {bounds, contains: p => rings.some((r, k) => p[0] >= boxes[k].w && p[0] <= boxes[k].e && p[1] >= boxes[k].s && p[1] <= boxes[k].n && pointInRing(p, r))};
}

/** Union of footprints. */
export const unionFootprint = (parts: readonly Footprint[]): Footprint => ({
  bounds: {w: Math.min(...parts.map(f => f.bounds.w)), s: Math.min(...parts.map(f => f.bounds.s)), e: Math.max(...parts.map(f => f.bounds.e)), n: Math.max(...parts.map(f => f.bounds.n))},
  contains: p => parts.some(f => p[0] >= f.bounds.w && p[0] <= f.bounds.e && p[1] >= f.bounds.s && p[1] <= f.bounds.n && f.contains(p)),
});

/**
 * Occupancy footprint of a triangle soup placed on the map the way the game
 * places a surveyed model: glTF +X east, +Z south, origin at `anchor`, turned
 * clockwise by `northOffsetDegrees` (signaturePlacement.surveyedPlacement),
 * optionally mirrored in X. Only triangles reaching `minTopMetres` above the
 * model origin count, so flat paving and ground pads are not "the building".
 * `cellMetres` is the raster resolution; each triangle is sampled at cell
 * centres and its vertices/edges are stamped so thin walls survive.
 */
export function soupFootprint(
  positions: ArrayLike<number>, indices: ArrayLike<number>, anchor: LngLat, northOffsetDegrees: number,
  opts: {mirror?: boolean; minTopMetres?: number; cellMetres?: number; basis?: {x: readonly [number, number]; y: readonly [number, number]}} = {},
): Footprint | null {
  const cell = opts.cellMetres ?? .5, minTop = opts.minTopMetres ?? 2.5, n = (northOffsetDegrees * Math.PI) / 180, c = Math.cos(n), s = Math.sin(n);
  // glTF +X -> (east, south) = xv, glTF +Z -> zv. A horizontalBasis gives Blender X/Y (glTF +X, -Z) in the same units.
  const xv = opts.basis ? opts.basis.x : [c, s], zv = opts.basis ? [-opts.basis.y[0], -opts.basis.y[1]] : [-s, c], mir = opts.mirror ? -1 : 1;
  const E = (x: number, z: number) => xv[0] * x * mir + zv[0] * z, S = (x: number, z: number) => xv[1] * x * mir + zv[1] * z;
  const tris: number[][] = [];
  let minE = Infinity, maxE = -Infinity, minS = Infinity, maxS = -Infinity;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const v = [indices[t], indices[t + 1], indices[t + 2]].map(i => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]]);
    if (Math.max(v[0][1], v[1][1], v[2][1]) < minTop) continue;
    const pts = v.map(([x, , z]) => [E(x, z), S(x, z)]);
    tris.push(pts.flat());
    for (const [e, so] of pts) { if (e < minE) minE = e; if (e > maxE) maxE = e; if (so < minS) minS = so; if (so > maxS) maxS = so; }
  }
  if (!tris.length) return null;
  const W = Math.ceil((maxE - minE) / cell) + 3, H = Math.ceil((maxS - minS) / cell) + 3, grid = new Uint8Array(W * H);
  const mark = (e: number, so: number) => { const i = Math.floor((e - minE) / cell) + 1, j = Math.floor((so - minS) / cell) + 1; if (i >= 0 && j >= 0 && i < W && j < H) grid[j * W + i] = 1; };
  for (const [ae, as, be, bs, ce, cs] of tris) {
    const lo = Math.floor((Math.min(ae, be, ce) - minE) / cell), hi = Math.floor((Math.max(ae, be, ce) - minE) / cell);
    const lj = Math.floor((Math.min(as, bs, cs) - minS) / cell), hj = Math.floor((Math.max(as, bs, cs) - minS) / cell);
    const den = (bs - cs) * (ae - ce) + (ce - be) * (as - cs);
    for (let j = lj; j <= hj; j++) for (let i = lo; i <= hi; i++) {
      const pe = minE + (i + .5) * cell, ps = minS + (j + .5) * cell;
      if (Math.abs(den) < 1e-9) continue; // vertical wall: stamped by its edges below
      const l1 = ((bs - cs) * (pe - ce) + (ce - be) * (ps - cs)) / den, l2 = ((cs - as) * (pe - ce) + (ae - ce) * (ps - cs)) / den;
      if (l1 >= -.01 && l2 >= -.01 && 1 - l1 - l2 >= -.01) mark(pe, ps);
    }
    for (const [p, q] of [[[ae, as], [be, bs]], [[be, bs], [ce, cs]], [[ce, cs], [ae, as]]]) {
      const steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (cell / 2)));
      for (let k = 0; k <= steps; k++) mark(p[0] + ((q[0] - p[0]) * k) / steps, p[1] + ((q[1] - p[1]) * k) / steps);
    }
  }
  const mx = 111_320 * Math.cos((anchor[1] * Math.PI) / 180), my = 110_574;
  return {
    bounds: {w: anchor[0] + minE / mx, e: anchor[0] + maxE / mx, s: anchor[1] - maxS / my, n: anchor[1] - minS / my},
    contains: ([lng, lat]) => {
      const e = (lng - anchor[0]) * mx, so = (anchor[1] - lat) * my, i = Math.floor((e - minE) / cell) + 1, j = Math.floor((so - minS) / cell) + 1;
      return i >= 0 && j >= 0 && i < W && j < H && grid[j * W + i] === 1;
    },
  };
}

/**
 * Share (0..1) of `subject`'s area that lies inside `footprint`, by a fixed
 * sampling grid over the subject's bounding box (deterministic; ~1 m cells for
 * a 30 m house).
 */
export function overlapFraction(subject: Ring, footprint: Footprint | readonly Ring[], grid = 32): number {
  const fp = Array.isArray(footprint) ? ringsFootprint(footprint as readonly Ring[]) : (footprint as Footprint);
  const b = ringBounds(subject), f = fp.bounds;
  if (!(f.w < b.e && f.e > b.w && f.s < b.n && f.n > b.s)) return 0;
  let total = 0, inside = 0;
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const p: LngLat = [b.w + ((i + .5) / grid) * (b.e - b.w), b.s + ((j + .5) / grid) * (b.n - b.s)];
    if (!pointInRing(p, subject)) continue;
    total++;
    if (fp.contains(p)) inside++;
  }
  if (!total) return fp.contains(subject[0]) ? 1 : 0; // sliver thinner than a cell
  return inside / total;
}

export interface TileBuilding { id: string; height: number | undefined; rings: Ring[] }

export interface UnderHit { id: string; overlap: number; height: number | undefined; areaM2: number }

export const ringAreaM2 = (ring: Ring): number => {
  const mx = M_PER_DEG_LAT * Math.cos((ring[0][1] * Math.PI) / 180);
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * mx * ring[i][1] * M_PER_DEG_LAT - ring[i][0] * mx * ring[j][1] * M_PER_DEG_LAT;
  return Math.abs(a) / 2;
};

/**
 * OSM/BAG buildings that overlap a model footprint by >= `min` of their area but
 * are not in `suppressed`. `claimedElsewhere` ids (suppressed by another placed
 * model) are not reported: they are hidden by that model.
 */
export function unsuppressedUnder(
  footprint: Footprint | readonly Ring[], candidates: readonly TileBuilding[], suppressed: ReadonlySet<string>,
  claimedElsewhere: ReadonlySet<string> = new Set(), min = MIN_OVERLAP_FRACTION,
): UnderHit[] {
  const hits: UnderHit[] = [], fp = Array.isArray(footprint) ? ringsFootprint(footprint as readonly Ring[]) : (footprint as Footprint);
  for (const c of candidates) {
    if (suppressed.has(c.id) || claimedElsewhere.has(c.id)) continue;
    let total = 0, weighted = 0;
    for (const r of c.rings) { const area = ringAreaM2(r); total += area; weighted += area * overlapFraction(r, fp); }
    if (!total) continue;
    const overlap = weighted / total;
    if (overlap >= min) hits.push({id: c.id, overlap, height: c.height, areaM2: total});
  }
  return hits.sort((a, b) => b.overlap - a.overlap);
}

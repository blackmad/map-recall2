// Surveyed road surfaces on the own ground (pure, DOM-free; built in the ground
// worker). Roads runtime lane 2026-10-16, docs: .claude/plans/parsed-inventing-magpie.md Part 1.
//
// The OSM centreline bands (streets.ts) draw every way as its own cross-section,
// and the only junction model is one fill per shared node: ways that cross
// without a node, compound junctions, dual carriageways and separate paths
// overlap, so red cycle bands lay over the grey, pavement wedges sat inside
// junctions and zebras ran across them (user screenshot 2026-10-16,
// Marnixstraat / Lijnbaansgracht). roads-v1 (roadCells.ts) carries the
// municipality's surveyed partition instead: BGT `wegdeel` polygons, one class
// and one mesh each, nothing overlapping at one height. This module draws that
// partition as it is, no polygon booleans:
//
//   polygons  earcut + drapeBisect on the land surface (h = 0) or the deck
//             surface (h ≥ 1, when a measured deck or water lies under it; else
//             skipped and counted), lifted by class: carriage / parking at the
//             carriageway lift, cycle paths a centimetre over, footways and
//             pedestrian areas and inritten at the sidewalk top
//   kerbs     a kerb face along every shared low/high edge the extract lists,
//             facing the lower side, with the 0.15 m granite line on top, and
//             Amsterdammertjes along canal-side kerbs
//   index     RoadIndex: which polygon, class and height lies under a point
//             (the street pass clips paint, rails and lane ribbons by it), and a
//             raster for the land culling under the cell's own polygons
//
// OSM stays for routing, paint and the fallback: covered ways (roadCells
// coverWays) emit no bands; cells without the extract and the far ring keep bands.

import { densify, edgeWall, emptyMesh, ribbon, stations, vertex, type MeshArrays } from './drape.js';
import { interiorPoint, SurfaceIndex, type SurfaceRaster } from './parks.js';
import { bollards, LIFT, ROAD_MARK_LIFT } from './streets.js';
import { KERB_LOW_CLASSES, type RoadCell, type RoadClass, type RoadMesh, type RoadSurface } from './roadCells.js';
import { GroundSurface, type HeightFn, type Vec2 } from './surface.js';

/** Sidewalk top over the relief: osmGround's raised sidewalk band (LIFT.raisedBase + KERB_M 0.11). */
export const SIDEWALK_TOP = LIFT.raisedBase + 0.11;
/** Lift over the relief per class, metres: the same planes the OSM bands use, so a band and a polygon never z-fight by class. */
export const ROAD_LIFT: Record<RoadClass, number> = {
  carriage: LIFT.carriageway, parking: LIFT.carriageway, cycle: LIFT.path, foot: SIDEWALK_TOP, pedestrian: SIDEWALK_TOP, driveway: SIDEWALK_TOP,
};
/** The kerb face runs from the sidewalk top down to just under the carriageway plane. */
export const KERB_FACE_BOTTOM = LIFT.carriageway - 0.01;
/** Granite kerb line width (as streets.ts draws along raised bands). */
export const KERB_LINE_M = 0.15;
/** Either side of a kerb line the class is read this far off it. */
export const KERB_PROBE_M = 0.2;

const isLow = (c: RoadClass | null) => c !== null && (KERB_LOW_CLASSES as readonly RoadClass[]).includes(c);
/** The fast lookup raster's texel (metres): paint and rails end within a quarter metre of the kerb. */
export const FAST_RES_M = 0.5;
/**
 * Ground polygons (h = 0): a triangle is split while the land at an edge midpoint or the centroid lies more than
 * `sag` under its plane (the land would show through: the lift minus a margin) or more than `float` over it (a plane
 * over a hollow would swallow the markings the band model lays on the land surface). Only the carriageway carries
 * paint, lane ribbons and rails, which in roads mode take ROAD_MARK_LIFT above its plane's float; the fietspad and the
 * parkeervlak carry none and float freely; the pavements carry the kerb lines (KERB_TOP), so theirs is bounded.
 * DRAPE_MAX_EDGE caps the chord, DRAPE_MIN_EDGE is the finest split. Measured on -3_-1 against the cell without
 * roads (lane roads-runtime 2026-10-16): every class two-sided at 0.012 1.30×; carriageway 0.02, fietspad and
 * parkeervlak free 1.15× (1.10× with the land culled under several polygons and no pockets on the survey); earlier,
 * cutting the polygons along the land grid's facets (exact) 2.2–2.7×, earcut's slivers crossing many facets each.
 */
export const DRAPE_TOL: Record<RoadClass, { sag: number; float: number }> = {
  carriage: { sag: ROAD_LIFT.carriage - 0.008, float: 0.02 }, parking: { sag: ROAD_LIFT.parking - 0.008, float: Infinity }, cycle: { sag: ROAD_LIFT.cycle - 0.008, float: Infinity },
  foot: { sag: 0.1, float: 0.03 }, pedestrian: { sag: 0.1, float: 0.03 }, driveway: { sag: 0.1, float: 0.03 },
};
export const DRAPE_MAX_EDGE_M = 24, DRAPE_MIN_EDGE_M = 3;
/**
 * The kerb wall's top and the granite line over SIDEWALK_TOP: the pavement plane may float DRAPE_TOL.foot.float over
 * the land, so the wall reaches above it (a kerb stone's lip where it does not) and the line lies over both.
 */
export const KERB_TOP = SIDEWALK_TOP + DRAPE_TOL.foot.float, KERB_LINE_Z = KERB_TOP + 0.004;
/** Deck polygons (h ≥ 1) follow the hump both ways: a 1 m hump over 20 m sags 25 cm under an 8 m chord. */
export const DECK_DRAPE_TOL_M = 0.01, DECK_DRAPE_MAX_EDGE_M = 6;
/** Kerb runs are simplified to this before drawing (the survey's 0.1 m vertices are 4 triangles each), then densified to KERB_STEP_M. */
export const KERB_SIMPLIFY_M = 0.2, KERB_STEP_M = 4;

/**
 * Earcut triangles draped where the relief needs it: a triangle is split at its longest edge while that edge is
 * longer than `maxEdge`, or longer than `minEdge` with the surface at any edge's midpoint or the centroid more than
 * `tol` off the triangle's plane (`sagOnly`: only a surface rising over the plane counts, the land showing through;
 * a plane floating over a hollow is left). parks.ts drapeBisect splits by length alone (8 m), which on the survey's
 * slivers cost 3.4× the earcut triangles of a cell (203k against 60k on -2_-1); streets are graded flat, so most
 * triangles pass the test unsplit, and the ramps, humps and quay edges get the splits. Testing the longest edge alone
 * left the Kinkerstraat asphalt 2.3 cm under the land at a quay mouth. Winding CCW from above, as drapeBisect.
 */
export function drapeAdaptive(m: MeshArrays, coords: ArrayLike<number>, tris: ArrayLike<number>, height: HeightFn, lift: number, maxEdge: number, tol: number, minEdge: number, floatTol = tol): void {
  const max2 = maxEdge * maxEdge, min2 = minEdge * minEdge;
  // Each corner carries its height and its emitted vertex (-1: not yet): the earcut corners are drawn once and shared
  // by every triangle on them, and every height is asked once per corner (the tested midpoint becomes the split's).
  const nv = coords.length >> 1, zs = new Float64Array(nv), ids = new Int32Array(nv).fill(-1);
  for (let v = 0; v < nv; v++) zs[v] = height(coords[v * 2], coords[v * 2 + 1]);
  const stack: number[] = [];
  const bad = (d: number) => d > tol || -d > floatTol;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b0 = tris[t + 1], c0 = tris[t + 2];
    const cross = (coords[b0 * 2] - coords[a * 2]) * (coords[c0 * 2 + 1] - coords[a * 2 + 1]) - (coords[b0 * 2 + 1] - coords[a * 2 + 1]) * (coords[c0 * 2] - coords[a * 2]);
    // earcut's zero-area triangles on a ring's repeated or collinear vertices: nothing to draw (a sliver of one surface
    // lying on its neighbour's edge, under the pavement, in the junction-overlap probe).
    if (Math.abs(cross) < 1e-6) continue;
    const ccw = cross > 0;
    const b = ccw ? b0 : c0, c = ccw ? c0 : b0;
    // Corner records (x, y, z, earcut index or -1) × 3.
    stack.push(coords[a * 2], coords[a * 2 + 1], zs[a], a, coords[b * 2], coords[b * 2 + 1], zs[b], b, coords[c * 2], coords[c * 2 + 1], zs[c], c);
    while (stack.length) {
      const k3 = stack.pop()!, z3 = stack.pop()!, y3 = stack.pop()!, x3 = stack.pop()!, k2 = stack.pop()!, z2 = stack.pop()!, y2 = stack.pop()!, x2 = stack.pop()!, k1 = stack.pop()!, z1 = stack.pop()!, y1 = stack.pop()!, x1 = stack.pop()!;
      const e1 = (x2 - x1) ** 2 + (y2 - y1) ** 2, e2 = (x3 - x2) ** 2 + (y3 - y2) ** 2, e3 = (x1 - x3) ** 2 + (y1 - y3) ** 2;
      const longest = Math.max(e1, e2, e3), edge = longest === e1 ? 1 : longest === e2 ? 2 : 3;
      // The longest edge's midpoint first: its height is the split vertex's if the triangle splits.
      const mx = edge === 1 ? (x1 + x2) / 2 : edge === 2 ? (x2 + x3) / 2 : (x3 + x1) / 2, my = edge === 1 ? (y1 + y2) / 2 : edge === 2 ? (y2 + y3) / 2 : (y3 + y1) / 2;
      let mz = NaN, split = longest > max2;
      if (!split && longest > min2) {
        mz = height(mx, my);
        split = bad(mz - (edge === 1 ? (z1 + z2) : edge === 2 ? (z2 + z3) : (z3 + z1)) / 2)
          || (edge !== 1 && bad(height((x1 + x2) / 2, (y1 + y2) / 2) - (z1 + z2) / 2))
          || (edge !== 2 && bad(height((x2 + x3) / 2, (y2 + y3) / 2) - (z2 + z3) / 2))
          || (edge !== 3 && bad(height((x3 + x1) / 2, (y3 + y1) / 2) - (z3 + z1) / 2))
          || bad(height((x1 + x2 + x3) / 3, (y1 + y2 + y3) / 3) - (z1 + z2 + z3) / 3);
      }
      if (!split || stack.length > 1.2e6) {
        const i = k1 >= 0 ? (ids[k1] >= 0 ? ids[k1] : (ids[k1] = vertex(m, x1, y1, z1 + lift))) : vertex(m, x1, y1, z1 + lift);
        const j = k2 >= 0 ? (ids[k2] >= 0 ? ids[k2] : (ids[k2] = vertex(m, x2, y2, z2 + lift))) : vertex(m, x2, y2, z2 + lift);
        const k = k3 >= 0 ? (ids[k3] >= 0 ? ids[k3] : (ids[k3] = vertex(m, x3, y3, z3 + lift))) : vertex(m, x3, y3, z3 + lift);
        m.indices.push(i, j, k);
        continue;
      }
      if (Number.isNaN(mz)) mz = height(mx, my);
      if (edge === 1) stack.push(x1, y1, z1, k1, mx, my, mz, -1, x3, y3, z3, k3, mx, my, mz, -1, x2, y2, z2, k2, x3, y3, z3, k3);
      else if (edge === 2) stack.push(x1, y1, z1, k1, x2, y2, z2, k2, mx, my, mz, -1, x1, y1, z1, k1, mx, my, mz, -1, x3, y3, z3, k3);
      else stack.push(x1, y1, z1, k1, x2, y2, z2, k2, mx, my, mz, -1, mx, my, mz, -1, x2, y2, z2, k2, x3, y3, z3, k3);
    }
  }
}

/** A height function memoised on a 1 cm grid of its arguments (the drape asks the same points many times). */
export function memoHeight(height: HeightFn): HeightFn {
  const cache = new Map<number, number>();
  return (x, y) => {
    const k = (Math.round(x * 100) + 8_388_608) * 16_777_216 + (Math.round(y * 100) + 8_388_608);
    let z = cache.get(k);
    if (z === undefined) { z = height(x, y); cache.set(k, z); }
    return z;
  };
}

/** Douglas–Peucker on an open polyline, `tol` metres. */
export function simplifyLine(pts: readonly Vec2[], tol: number): Vec2[] {
  if (pts.length <= 2) return pts.map(p => [p[0], p[1]] as Vec2);
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true; keep[pts.length - 1] = true;
  const todo: [number, number][] = [[0, pts.length - 1]];
  while (todo.length) {
    const [a, b] = todo.pop()!;
    if (b - a < 2) continue;
    const p = pts[a], q = pts[b], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = l > 1e-9 ? Math.abs((pts[i][0] - p[0]) * dy - (pts[i][1] - p[1]) * dx) / l : Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol && at > 0) { keep[at] = true; todo.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]).map(p => [p[0], p[1]] as Vec2);
}

/**
 * Point lookup over the roads-v1 polygons of a cell neighbourhood (parks.ts SurfaceIndex over RoadSurface
 * records). Polygons [0, own) are the first cell's: the ones its build draws.
 */
/** Largest footway polygon between parking bays that draws as street (RoadIndex.parkingIslands). */
export const PARKING_ISLAND_MAX_M2 = 40;
export class RoadIndex extends SurfaceIndex<RoadSurface> {
  /** `within`: the neighbours' polygons only where the build can ask (the cell, its own ways' reach): earcut of the full 3×3 was a fifth of the roads cost. */
  constructor(cells: readonly (RoadCell | null | undefined)[], within?: readonly [number, number, number, number]) { super(cells, () => true, within); }

  /** Meshes the runtime overrides (parkingIslands): polygon id → mesh. */
  private readonly meshOver = new Map<number, RoadMesh>();
  /**
   * The mesh polygon `k` is drawn with: the extract's (which decides a fietsstraat's red per section, roadCells
   * fietsstraatSection), unless parkingIslands overrode it.
   */
  mesh(k: number): RoadMesh { return this.meshOver.get(k) ?? this.records[k].k; }

  /** Classes the runtime overrides (parkingIslands): polygon id → class drawn. */
  private readonly classOver = new Map<number, RoadClass>();
  /** The class polygon `k` is drawn and probed as (the extract's, unless overridden). */
  drawClass(k: number): RoadClass { return this.classOver.get(k) ?? this.records[k].c; }
  /**
   * Small footway polygons between parking bays (the pale islands and tree pits between the bays of a quay street)
   * draw as part of the street: the parking bays' mesh, at road height, without kerbs. User 2026-10-16 on the
   * Prinsengracht by the Pulitzer: "I don't think we need to draw parking spots" — every bay read as a stripe
   * because the islands between them were raised pale paving with granite kerb lines. A foot polygon of at most
   * `maxArea` m² whose perimeter borders parking for at least `minShare` of its length. Returns the count.
   */
  parkingIslands(maxArea = PARKING_ISLAND_MAX_M2, minShare = 0.5): number {
    let n = 0;
    for (let k = 0; k < this.records.length; k++) {
      const r = this.records[k];
      if (r.c !== 'foot' || this.classOver.has(k)) continue;
      const ring = this.ringsOf(k)[0];
      if (!ring || ring.length < 3) continue;
      let a2 = 0;
      for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
      if (Math.abs(a2) / 2 > maxArea) continue;
      let total = 0, park = 0; const parkMesh = new Map<RoadMesh, number>();
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len < 1e-6) continue;
        total += len;
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
        for (const s of [1, -1]) {
          const hit = this.findAll(mx + s * nx * 0.3, my + s * ny * 0.3).find(j => j !== k);
          if (hit !== undefined && this.records[hit].c === 'parking') { park += len; parkMesh.set(this.mesh(hit), (parkMesh.get(this.mesh(hit)) ?? 0) + len); break; }
        }
      }
      if (!total || park / total < minShare) continue;
      const mesh = [...parkMesh.entries()].sort((x, y) => y[1] - x[1])[0][0];
      this.classOver.set(k, 'parking'); this.meshOver.set(k, mesh); n++;
    }
    return n;
  }

  private fast: { raster: SurfaceRaster; box: readonly [number, number, number, number] } | null = null;
  /**
   * A raster of polygon ids over `box` at `res` (FAST_RES_M) that answers the point lookups inside it (a texel
   * takes the polygon under its centre): the street pass asks for the class under every paint dash, rail station
   * and band station, and an exact ring test against a 3,000-vertex pavement polygon per ask made the pass seconds
   * long. Outside the box, and for a deck/ground level the texel's polygon does not have, the exact test runs.
   */
  prepareFast(box: readonly [number, number, number, number], res = FAST_RES_M): SurfaceRaster {
    const raster = this.raster(box, res);
    this.fast = { raster, box };
    return raster;
  }

  /**
   * The polygon under (x, y) at the wanted level: `bridge` prefers a deck polygon (h ≥ 1), else a ground one
   * (h = 0); when none at that level, whatever lies there. -1: none.
   */
  findAtLevel(x: number, y: number, bridge = false): number {
    const f = this.fast;
    if (f && x >= f.box[0] && x < f.box[2] && y >= f.box[1] && y < f.box[3]) {
      const k = f.raster.find(x, y);
      if (k < 0) return -1;
      const h = this.records[k].h;
      if (bridge ? h >= 1 : h === 0) return k;
    }
    const all = this.findAll(x, y);
    if (!all.length) return -1;
    const want = all.find(k => (bridge ? this.records[k].h >= 1 : this.records[k].h === 0));
    return want ?? all[0];
  }
  /** Any polygon under the point (the fast raster inside its box). */
  findFast(x: number, y: number): number {
    const f = this.fast;
    if (f && x >= f.box[0] && x < f.box[2] && y >= f.box[1] && y < f.box[3]) return f.raster.find(x, y);
    return this.find(x, y);
  }
  classAt(x: number, y: number, bridge = false): RoadClass | null { const k = this.findAtLevel(x, y, bridge); return k < 0 ? null : this.drawClass(k); }
  heightAt(x: number, y: number, bridge = false): number | null { const k = this.findAtLevel(x, y, bridge); return k < 0 ? null : this.records[k].h; }
  meshAt(x: number, y: number, bridge = false): RoadMesh | null { const k = this.findAtLevel(x, y, bridge); return k < 0 ? null : this.mesh(k); }
  /** May road paint, a rail or a lane ribbon lie here: a carriageway or parking polygon, or no survey at all (the bands' fallback). */
  onRoad(x: number, y: number, bridge = false): boolean { const c = this.classAt(x, y, bridge); return c === null || c === 'carriage' || c === 'parking'; }
  /** Is any deck polygon (h ≥ 1) under the point? */
  onDeck(x: number, y: number): boolean { return this.findAll(x, y).some(k => this.records[k].h >= 1); }
  /**
   * Is a band's station covered by the survey: any polygon under the point is the surface there (a footway band over
   * a rijbaan, a carriageway band over a voetpad: the survey wins), except a cycle band over a rijbaan or parkeervlak,
   * which stays as the painted lane on the road (the data lane: cycleway ways are fietspad for ~60 % of their length
   * and cross rijbaan for the rest). Off the survey nothing is covered (streets.ts coverCuts).
   */
  coversBand(x: number, y: number, surface: RoadMesh, bridge = false): boolean {
    const c = this.classAt(x, y, bridge);
    if (c === null) return false;
    if (surface === 'cycle') return c !== 'carriage' && c !== 'parking';
    return true;
  }
  /** Does the index hold any deck polygon at all (the deck-top rule asks before probing)? */
  get hasDecks(): boolean { return this.records.some(r => r.h >= 1); }
}

export interface RoadBuildStats {
  /** Polygons drawn, by class. */
  drawn: Record<RoadClass, number>;
  /** Deck polygons (h ≥ 1) drawn on the deck surface. */
  onDeck: number;
  /** Deck polygons over neither a measured deck nor water: not drawn. */
  skippedHigh: number;
  /** Polygons too small to triangulate. */
  degenerate: number;
  kerbs: number;
  kerbM: number;
  /** Kerb lines whose lower side could not be told (no low class on exactly one side): drawn without a face. */
  kerbUnsided: number;
  bollards: number;
  ms: number;
}

export type RoadLayer = RoadMesh | 'brick' | 'kerb' | 'bollard';

/**
 * The layer a polygon draws in: its mesh, except klinker inritten and parking bays (and the footway islands drawn
 * with them), which take the muted grey `brick` (road look v2, 2026-10-16: on the orthophoto they read as greyish
 * brick close to the pavement; drawn as the klinker carriageway they were saturated brown wedges across pavements).
 */
export function surfaceLayer(cls: RoadClass, mesh: RoadMesh): RoadLayer {
  return mesh === 'klinker' && (cls === 'driveway' || cls === 'parking') ? 'brick' : mesh;
}

export interface RoadBuildInput {
  /** The land surface the h = 0 polygons drape on (groundCell `onLand`). */
  height: HeightFn;
  /** The riding surface with the decks (GroundSurface.height), for h ≥ 1 polygons; see `deckLevelHeight`. */
  deckHeight: HeightFn;
  /** 1 on a measured deck, 0 off every deck (GroundSurface.deckWeight). */
  deckWeight: (x: number, y: number) => number;
  overWater: (x: number, y: number) => boolean;
  lod: 0 | 1;
  /** Ground drape sag / float tolerance overrides for the road classes (measurement scripts); the defaults are DRAPE_TOL. */
  drapeTol?: number;
  drapeFloatTol?: number;
  /** Canal-side test for the Amsterdammertjes (streets.ts bollards); near ring only. */
  canalSide?: (x: number, y: number) => boolean;
}

/**
 * A height for the deck polygons: the riding surface, never under the deck's own level at that station (beside
 * the road's half-width GroundSurface.height falls back to the relief, which under a bridge is the canal; a
 * voetpad polygon at the parapet would drape into the water). The decks whose box meets `rect` ± `pad`.
 */
export function deckLevelHeight(surface: GroundSurface, rect: readonly [number, number, number, number], pad = 60): HeightFn {
  const decks = surface.decks.filter(d => { const [x0, y0, x1, y1] = d.profile.bbox; return !(x1 < rect[0] - pad || x0 > rect[2] + pad || y1 < rect[1] - pad || y0 > rect[3] + pad); });
  const P = 15;
  return (x, y) => {
    let z = surface.height(x, y);
    for (const d of decks) {
      const [x0, y0, x1, y1] = d.profile.bbox;
      if (x < x0 - P || x > x1 + P || y < y0 - P || y > y1 + P) continue;
      const at = GroundSurface.locate(d, x, y);
      if (at.d === Infinity) continue;
      z = Math.max(z, at.z);
    }
    return z;
  };
}

/**
 * The road meshes of one cell: the index's own polygons [0, own) and the cell's kerb lines. Returns the layers,
 * the stats and the ids of the own polygons that were not drawn (the land under them must stay).
 */
export function buildRoadSurfaces(cell: RoadCell, index: RoadIndex, input: RoadBuildInput): { layers: Partial<Record<RoadLayer, MeshArrays>>; stats: RoadBuildStats; skipped: Set<number> } {
  const t0 = Date.now();
  const layers: Partial<Record<RoadLayer, MeshArrays>> = {};
  const get = (l: RoadLayer) => (layers[l] ??= emptyMesh());
  const stats: RoadBuildStats = { drawn: { carriage: 0, foot: 0, cycle: 0, pedestrian: 0, parking: 0, driveway: 0 }, onDeck: 0, skippedHigh: 0, degenerate: 0, kerbs: 0, kerbM: 0, kerbUnsided: 0, bollards: 0, ms: 0 };
  const skipped = new Set<number>();
  const far = input.lod === 1;
  // The drape carries each corner's height and asks once per corner and tested point (drapeAdaptive); a 1 cm memo
  // of the heights on top cost more in Map lookups than the land grid's own lookup (the deck surface keeps it).
  const landHeight = input.height, deckHeight = memoHeight(input.deckHeight);
  /** The surface a deck polygon (or a kerb on one) drapes on, or null when nothing carries it. */
  const deckSurface = (p: Vec2 | null): HeightFn | null => (p && (input.deckWeight(p[0], p[1]) > 0 || input.overWater(p[0], p[1])) ? deckHeight : null);
  for (let k = 0; k < index.own; k++) {
    const rec = index.records[k];
    // The index's own earcut of the polygon (SurfaceIndex flatOf): the raster and the drawn mesh are the same triangles.
    const { flat, tris } = index.flatOf(k);
    if (flat.length < 6) { stats.degenerate++; skipped.add(k); continue; }
    if (!tris.length) { stats.degenerate++; skipped.add(k); continue; }
    let height = landHeight;
    if (rec.h >= 1) {
      const on = deckSurface(interiorPoint(index.ringsOf(k)));
      if (!on) { stats.skippedHigh++; skipped.add(k); continue; }
      height = on;
      stats.onDeck++;
    }
    const cls = index.drawClass(k);
    const layer = get(surfaceLayer(cls, index.mesh(k)));
    if (rec.h >= 1) drapeAdaptive(layer, flat, tris, height, ROAD_LIFT[cls], far ? 2 * DECK_DRAPE_MAX_EDGE_M : DECK_DRAPE_MAX_EDGE_M, DECK_DRAPE_TOL_M, 1.5);
    else {
      const tol = DRAPE_TOL[cls], low = isLow(cls);
      drapeAdaptive(layer, flat, tris, height, ROAD_LIFT[cls], far ? 2 * DRAPE_MAX_EDGE_M : DRAPE_MAX_EDGE_M, (low && input.drapeTol) || tol.sag, DRAPE_MIN_EDGE_M, far ? Infinity : (low && input.drapeFloatTol) || tol.float);
    }
    stats.drawn[cls]++;
  }
  // Kerbs: the face toward the lower side, the granite line on the upper edge, posts along canal-side pavements.
  const kerb = get('kerb');
  for (const e of cell.kerbs) {
    const line = decodeKerb(e);
    if (line.length < 2) continue;
    const st = stations(line), total = st[st.length - 1];
    if (total < 0.3) continue;
    const mid = Math.floor(line.length / 2), a = line[Math.max(0, mid - 1)], b = line[Math.min(line.length - 1, mid)];
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const h = index.heightAt(cx, cy) ?? 0, bridge = h >= 1;
    const left = index.classAt(cx + nx * KERB_PROBE_M, cy + ny * KERB_PROBE_M, bridge), right = index.classAt(cx - nx * KERB_PROBE_M, cy - ny * KERB_PROBE_M, bridge);
    // Both sides low: a kerb of a footway island drawn as street (parkingIslands); the street has none there.
    if (isLow(left) && isLow(right)) continue;
    const lowLeft = isLow(left) && !isLow(right), lowRight = isLow(right) && !isLow(left);
    let height = landHeight;
    if (bridge) { const on = deckSurface([cx, cy]); if (!on) continue; height = on; }
    stats.kerbs++; stats.kerbM += total;
    if (!lowLeft && !lowRight) {
      // No face: the line alone (a kerb between two pavements of different heights the survey does not say).
      stats.kerbUnsided++;
      ribbon(kerb, line, 0, KERB_LINE_M, height, KERB_LINE_Z, { step: KERB_STEP_M });
      continue;
    }
    const facing: 1 | -1 = lowLeft ? 1 : -1, into = lowLeft ? -1 : 1; // `into`: toward the upper side (way-left is +)
    edgeWall(kerb, line, 0, height, KERB_TOP, KERB_FACE_BOTTOM, facing, { step: KERB_STEP_M });
    ribbon(kerb, line, into * KERB_LINE_M / 2, KERB_LINE_M, height, KERB_LINE_Z, { step: KERB_STEP_M });
    if (input.canalSide && input.lod === 0) {
      const before = get('bollard').positions.length;
      bollards(get('bollard'), line, into * 0.3, height, KERB_TOP, input.canalSide);
      stats.bollards += (get('bollard').positions.length - before) / 27;
    }
  }
  for (const l of Object.keys(layers) as RoadLayer[]) if (!layers[l]!.indices.length) delete layers[l];
  stats.ms = Date.now() - t0;
  return { layers, stats, skipped };
}

/** A kerb run as metres (roadCells decodeRoadLine), simplified to KERB_SIMPLIFY_M and densified to KERB_STEP_M so the face follows the relief. */
function decodeKerb(e: readonly number[]): Vec2[] {
  const out: Vec2[] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < e.length; i += 2) { x += e[i]; y += e[i + 1]; out.push([x / 10, y / 10]); }
  return out.length >= 2 ? densify(simplifyLine(out, KERB_SIMPLIFY_M), KERB_STEP_M) : out;
}

// ------------------------------------------------------------------ extractor helpers (also the fixture and tests)

/**
 * Shared edges between a low-class and a high-class polygon at equal `h` (roadCells kerbBetween), merged into
 * runs. Vertices match exactly after rounding to `tol` metres (the survey's neighbours share vertices to the
 * centimetre within one bronhouder). Returns polylines in metres.
 */
export function kerbEdges(polys: readonly { c: RoadClass; h: number; rings: readonly (readonly Vec2[])[] }[], tol = 0.01): Vec2[][] {
  const q = (v: number) => Math.round(v / tol);
  const vkey = (p: readonly number[]) => `${q(p[0])},${q(p[1])}`;
  const edges = new Map<string, { a: Vec2; b: Vec2; owners: number[] }>();
  polys.forEach((poly, k) => {
    for (const ring of poly.rings) {
      const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ka = vkey(a), kb = vkey(b);
        if (ka === kb) continue;
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const e = edges.get(key);
        if (e) e.owners.push(k); else edges.set(key, { a: [a[0], a[1]], b: [b[0], b[1]], owners: [k] });
      }
    }
  });
  const low = (c: RoadClass) => (KERB_LOW_CLASSES as readonly RoadClass[]).includes(c);
  const segs: [Vec2, Vec2][] = [];
  for (const e of edges.values()) {
    if (e.owners.length !== 2) continue;
    const p = polys[e.owners[0]], r = polys[e.owners[1]];
    if (p.h !== r.h || low(p.c) === low(r.c)) continue;
    // Both classes must be kerb classes (a parking bay beside a carriageway is low/low, skipped above; a driveway beside a footway high/high).
    segs.push([e.a, e.b]);
  }
  // Chain segments into runs by shared endpoints.
  const byEnd = new Map<string, number[]>();
  segs.forEach((s, i) => { for (const p of s) { const k = vkey(p); (byEnd.get(k) ?? byEnd.set(k, []).get(k)!).push(i); } });
  const used = new Set<number>(), out: Vec2[][] = [];
  const extend = (run: Vec2[], fromEnd: boolean) => {
    for (;;) {
      const tip = fromEnd ? run[run.length - 1] : run[0], k = vkey(tip);
      const next = (byEnd.get(k) ?? []).find(i => !used.has(i));
      if (next === undefined) return;
      used.add(next);
      const [a, b] = segs[next], other = vkey(a) === k ? b : a;
      if (fromEnd) run.push(other); else run.unshift(other);
    }
  };
  segs.forEach((s, i) => {
    if (used.has(i)) return;
    used.add(i);
    const run: Vec2[] = [s[0], s[1]];
    extend(run, true); extend(run, false);
    out.push(run);
  });
  return out;
}

/**
 * Share of a polyline's stations (every `step` metres, the ends included) lying inside a polygon `inside`
 * accepts: the cover test for roadCells coverWays (≥ 0.8 → the way emits no bands).
 */
export function coveredShare(line: readonly Vec2[], inside: (x: number, y: number) => boolean, step = 2): number {
  const st = stations(line), total = st[st.length - 1];
  if (!(total > 0)) return 0;
  let n = 0, hit = 0;
  for (let s = 0; s <= total + 1e-6; s += step) {
    const t = Math.min(s, total);
    let i = 1; while (i < st.length - 1 && st[i] < t) i++;
    const u = (t - st[i - 1]) / ((st[i] - st[i - 1]) || 1), p: Vec2 = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * u, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * u];
    n++;
    if (inside(p[0], p[1])) hit++;
  }
  return hit / n;
}
export const COVER_SHARE = 0.8;

/** Douglas–Peucker simplification of an open or closed ring to `tol` metres (the extract's 0.1 m). */
export function simplifyRing(pts: readonly Vec2[], tol: number): Vec2[] {
  if (pts.length <= 4) return pts.map(p => [p[0], p[1]]);
  const closed = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const open = closed ? pts.slice(0, -1) : pts;
  // A closed ring: split at the farthest vertex from the first so both halves are open chains.
  let far = 1, best = -1;
  for (let i = 1; i < open.length; i++) { const d = (open[i][0] - open[0][0]) ** 2 + (open[i][1] - open[0][1]) ** 2; if (d > best) { best = d; far = i; } }
  const dp = (a: number, b: number, keep: boolean[]) => {
    if (b - a < 2) return;
    const p = open[a], q = open[b], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = l > 1e-9 ? Math.abs((open[i][0] - p[0]) * dy - (open[i][1] - p[1]) * dx) / l : Math.hypot(open[i][0] - p[0], open[i][1] - p[1]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol && at > 0) { keep[at] = true; dp(a, at, keep); dp(at, b, keep); }
  };
  const keep = new Array<boolean>(open.length).fill(false);
  keep[0] = true; keep[far] = true; keep[open.length - 1] = true;
  dp(0, far, keep); dp(far, open.length - 1, keep);
  const out = open.filter((_, i) => keep[i]).map(p => [p[0], p[1]] as Vec2);
  // Consecutive duplicates (the survey repeats vertices) go; the closing vertex is not repeated.
  const dedup: Vec2[] = [];
  for (const p of out) if (!dedup.length || Math.hypot(p[0] - dedup[dedup.length - 1][0], p[1] - dedup[dedup.length - 1][1]) > 1e-9) dedup.push(p);
  if (dedup.length > 1 && Math.hypot(dedup[0][0] - dedup[dedup.length - 1][0], dedup[0][1] - dedup[dedup.length - 1][1]) <= 1e-9) dedup.pop();
  return dedup;
}

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

import earcut from 'earcut';
import { densify, edgeWall, emptyMesh, ribbon, stations, type MeshArrays } from './drape.js';
import { drapeBisect, flatten, interiorPoint, SurfaceIndex } from './parks.js';
import { bollards, LIFT } from './streets.js';
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

/**
 * Point lookup over the roads-v1 polygons of a cell neighbourhood (parks.ts SurfaceIndex over RoadSurface
 * records). Polygons [0, own) are the first cell's: the ones its build draws.
 */
export class RoadIndex extends SurfaceIndex<RoadSurface> {
  constructor(cells: readonly (RoadCell | null | undefined)[]) { super(cells, () => true); }

  /**
   * The polygon under (x, y) at the wanted level: `bridge` prefers a deck polygon (h ≥ 1), else a ground one
   * (h = 0); when none at that level, whatever lies there. -1: none.
   */
  findAtLevel(x: number, y: number, bridge = false): number {
    const all = this.findAll(x, y);
    if (!all.length) return -1;
    const want = all.find(k => (bridge ? this.records[k].h >= 1 : this.records[k].h === 0));
    return want ?? all[0];
  }
  classAt(x: number, y: number, bridge = false): RoadClass | null { const k = this.findAtLevel(x, y, bridge); return k < 0 ? null : this.records[k].c; }
  heightAt(x: number, y: number, bridge = false): number | null { const k = this.findAtLevel(x, y, bridge); return k < 0 ? null : this.records[k].h; }
  meshAt(x: number, y: number, bridge = false): RoadMesh | null { const k = this.findAtLevel(x, y, bridge); return k < 0 ? null : this.records[k].k; }
  /** May road paint, a rail or a lane ribbon lie here: a carriageway or parking polygon, or no survey at all (the bands' fallback). */
  onRoad(x: number, y: number, bridge = false): boolean { const c = this.classAt(x, y, bridge); return c === null || c === 'carriage' || c === 'parking'; }
  /** Is any deck polygon (h ≥ 1) under the point? */
  onDeck(x: number, y: number): boolean { return this.findAll(x, y).some(k => this.records[k].h >= 1); }
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

export type RoadLayer = RoadMesh | 'kerb' | 'bollard';

export interface RoadBuildInput {
  /** The land surface the h = 0 polygons drape on (groundCell `onLand`). */
  height: HeightFn;
  /** The riding surface with the decks (GroundSurface.height), for h ≥ 1 polygons; see `deckLevelHeight`. */
  deckHeight: HeightFn;
  /** 1 on a measured deck, 0 off every deck (GroundSurface.deckWeight). */
  deckWeight: (x: number, y: number) => number;
  overWater: (x: number, y: number) => boolean;
  lod: 0 | 1;
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
  const maxEdge = input.lod === 0 ? 8 : 20;
  /** The surface a deck polygon (or a kerb on one) drapes on, or null when nothing carries it. */
  const deckSurface = (p: Vec2 | null): HeightFn | null => (p && (input.deckWeight(p[0], p[1]) > 0 || input.overWater(p[0], p[1])) ? input.deckHeight : null);
  for (let k = 0; k < index.own; k++) {
    const rec = index.records[k], rings = index.ringsOf(k);
    const { flat, holes } = flatten(rings);
    if (flat.length < 6) { stats.degenerate++; skipped.add(k); continue; }
    const tris = earcut(flat, holes);
    if (!tris.length) { stats.degenerate++; skipped.add(k); continue; }
    let height = input.height;
    if (rec.h >= 1) {
      const on = deckSurface(interiorPoint(rings));
      if (!on) { stats.skippedHigh++; skipped.add(k); continue; }
      height = on;
      stats.onDeck++;
    }
    drapeBisect(get(rec.k), flat, tris, height, ROAD_LIFT[rec.c], maxEdge);
    stats.drawn[rec.c]++;
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
    const lowLeft = isLow(left) && !isLow(right), lowRight = isLow(right) && !isLow(left);
    let height = input.height;
    if (bridge) { const on = deckSurface([cx, cy]); if (!on) continue; height = on; }
    stats.kerbs++; stats.kerbM += total;
    if (!lowLeft && !lowRight) {
      // No face: the line alone (a kerb between two pavements of different heights the survey does not say).
      stats.kerbUnsided++;
      ribbon(kerb, line, 0, KERB_LINE_M, height, SIDEWALK_TOP + 0.002, { step: 3 });
      continue;
    }
    const facing: 1 | -1 = lowLeft ? 1 : -1, into = lowLeft ? -1 : 1; // `into`: toward the upper side (way-left is +)
    edgeWall(kerb, line, 0, height, SIDEWALK_TOP, KERB_FACE_BOTTOM, facing, { step: 3 });
    ribbon(kerb, line, into * KERB_LINE_M / 2, KERB_LINE_M, height, SIDEWALK_TOP + 0.002, { step: 3 });
    if (input.canalSide && input.lod === 0) {
      const before = get('bollard').positions.length;
      bollards(get('bollard'), line, into * 0.3, height, SIDEWALK_TOP, input.canalSide);
      stats.bollards += (get('bollard').positions.length - before) / 27;
    }
  }
  for (const l of Object.keys(layers) as RoadLayer[]) if (!layers[l]!.indices.length) delete layers[l];
  stats.ms = Date.now() - t0;
  return { layers, stats, skipped };
}

/** A kerb run as metres (roadCells decodeRoadLine), densified to 3 m so the face follows the relief. */
function decodeKerb(e: readonly number[]): Vec2[] {
  const out: Vec2[] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < e.length; i += 2) { x += e[i]; y += e[i + 1]; out.push([x / 10, y / 10]); }
  return out.length >= 2 ? densify(out, 3) : out;
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

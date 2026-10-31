// rail-v1: railway tracks on their own corridor (pure, dependency-free; shared by scripts/own-ground/build-rail-tracks.ts,
// the ground store and groundCell.ts).
//
// The own-ground OSM extract carries highways only, so the raised rail corridors (Dijksgracht - Piet Heinkade east of
// Centraal, the Muiderpoort and Amstel embankments, the metro viaducts) drew as empty beige land (user 2026-10-30,
// issue #124: "we need to draw train tracks especially where they are separated otherwise it looks incorrectly empty").
// Source: the archived OpenStreetMap Amsterdam extract (.cache/osm-source/Amsterdam.osm.pbf, © OpenStreetMap
// contributors, ODbL), railway=rail / light_rail / subway / narrow_gauge / tram ways, filtered with osmium at build
// time; the game never calls an API. Tunnels (any tunnel tag but `no`, and layer < 0 off a bridge) are dropped at build
// time; a tram way is kept only where it runs on its own bed (not on a street that draws its embedded rails already).
//
// Cell file: { version: 1, key, w: [code, n, x0, y0, x1, y1, ...] } per way, flattened: the KIND code plus BRIDGE
// flag, the point count, then the points in the game's local frame in whole decimetres (groundStore toLocal). A way
// is listed in every own-ground cell it passes through; the mesh keeps only the pieces whose middle lies in the cell.
//
// Mesh (one track = one way): a ballast bed (a 3.1 m top carrying the sleepers as a texture, shoulders sloping to the
// ground 0.75 m further out) and two rails at standard gauge. The bed's level comes from railProfile.ts (`levels`: the
// relief's envelope at the track's grade, bridge decks between their approaches); a bridge way's bed rides on a
// concrete slab, and so does a track the envelope lifts clear of the relief (an approach over the fill's dip). Where
// the track crosses a street at grade (a level crossing) the bed is flat with the road and only the rails show.
//
// Never under the ground (lane rail-look 2026-10-31, "train tracks buried by surface" at the Piet Heinkade): the bed
// is a chord between stations 12 m apart (24 m far), the land a 5 m (10 m) grid, so where the land bulged between
// two stations, or rose across the bed on an embankment's flank, it drew over the ballast and the rails. The level
// (railProfile.ts) is already the highest land across the bed every 4 m; each piece's chord is then checked against
// the land sampled every FLOOR_SAMPLE_M along it (centre and both top edges) and both its stations raised by the
// worst deficit, and each toe stands `toeLift` over the highest land along its edge.

import { emptyMesh, vertexNormals, type MeshArrays } from './drape.js';
import { levelAt, type WayLevel } from './railProfile.js';
import type { HeightFn, Vec2 } from './surface.js';

export const RAIL_VERSION = 1 as const;
export const RAIL_EXTRACT = 'rail-v1';
export const RAIL_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

export const RAIL_KIND = { rail: 1, subway: 2, light_rail: 3, narrow_gauge: 4, tram: 5 } as const;
export type RailKind = keyof typeof RAIL_KIND;
/** Added to the kind code of a way on a bridge (bridge=* but `no`). */
export const RAIL_BRIDGE = 16;
/** Added to the kind code of a siding, yard track, spur or crossover (drawn a hair lower, under the running lines). */
export const RAIL_SERVICE = 32;

export interface RailCell { version: typeof RAIL_VERSION; key: string; w: number[] }
export interface RailManifest { version: typeof RAIL_VERSION; cells: string[]; source: string; attribution: string; counts?: Record<string, number> }
export interface RailWay { kind: RailKind; bridge: boolean; service: boolean; points: Vec2[] }

const KIND_OF: Record<number, RailKind> = Object.fromEntries(Object.entries(RAIL_KIND).map(([k, v]) => [v, k as RailKind]));

/** The way's class from its OSM tags; null when it is not drawn (tunnel, underground, abandoned, another railway value). */
export function railOf(tags: Record<string, string>): { kind: RailKind; bridge: boolean; service: boolean } | null {
  const kind = tags.railway as RailKind;
  if (!(kind in RAIL_KIND)) return null;
  const bridge = !!tags.bridge && tags.bridge !== 'no';
  if (tags.tunnel && tags.tunnel !== 'no') return null;
  if (tags.covered === 'yes' && !bridge) return null;
  if (!bridge && Number(tags.layer ?? 0) < 0) return null;
  if (tags.location === 'underground') return null;
  const service = ['siding', 'yard', 'spur', 'crossover'].includes(tags.service ?? '');
  return { kind, bridge, service };
}

export function encodeRail(ways: readonly RailWay[]): number[] {
  const out: number[] = [];
  for (const w of ways) {
    out.push(RAIL_KIND[w.kind] + (w.bridge ? RAIL_BRIDGE : 0) + (w.service ? RAIL_SERVICE : 0), w.points.length);
    for (const [x, y] of w.points) out.push(Math.round(x * 10), Math.round(y * 10));
  }
  return out;
}

export function decodeRail(cell: RailCell): RailWay[] {
  const out: RailWay[] = [], w = cell.w;
  for (let i = 0; i + 1 < w.length;) {
    const code = w[i], n = w[i + 1];
    const points: Vec2[] = [];
    for (let j = 0; j < n; j++) points.push([w[i + 2 + 2 * j] / 10, w[i + 3 + 2 * j] / 10]);
    i += 2 + 2 * n;
    const kind = KIND_OF[code & 15];
    if (kind && points.length >= 2) out.push({ kind, bridge: (code & RAIL_BRIDGE) !== 0, service: (code & RAIL_SERVICE) !== 0, points });
  }
  return out;
}

export const isRailCell = (c: unknown): c is RailCell => !!c && typeof c === 'object' && (c as RailCell).version === RAIL_VERSION && Array.isArray((c as RailCell).w);

/** Cross-section (metres): half the bed's top, the shoulder's toe, the top over the ground, the rails. */
// serviceDrop 0 (issue #145): the 3 cm step under the yard tracks drew dark ridges across Centraal's throat.
export const RAIL_SECTION = { topHalf: 1.55, toeHalf: 2.3, topLift: 0.32, serviceDrop: 0, toeLift: 0.03, gauge: 1.435, railWidth: 0.14, railHeight: 0.16, flatLift: 0.05, slabDepth: 1.1, slabHalf: 2.45 } as const;
/** Max piece length along a track (metres): fine and far builds. Fine 6 (was 12, issue #145): a 12 m chord sagged under the 5 m land grid on the embankment crowns and the land drew over the bed (4.2 % of the Oostertoegang bed samples, 0.6 % at 6 m). */
export const RAIL_STEP_M = { fine: 6, far: 24 } as const;
/** rail-v1 as it shipped (build 04e3c88): 12 m fine pieces, the bed on the centreline's relief (`legacy`, the regressions' pre-fix build). */
export const RAIL_STEP_V1_M = 12;
/** A track this far over the relief (metres, the envelope's lift) stands on a slab whose sides reach down to the ground. */
export const RAISED_M = 0.8;
/** A piece takes the level's stations where the level leaves its chord by more than this (metres): fine and far builds. */
export const LEVEL_TOL_M = { fine: 0.1, far: 0.3 } as const;
/** Spacing of the land samples under a piece (metres) for the never-under-the-ground floor (the land grid is 5 m). */
export const FLOOR_SAMPLE_M = 2;
/** The sleeper texture's tile (metres): the bed top's u runs 0..2·topHalf across it, v along the track. */
export const SLEEPER_TILE_M = 3.1;
/** Tones (sRGB 0..255): the ballast's grey-brown gravel, the concrete sleepers on it, the rails (also the flat overview tones). */
// Issue #145: the sleepers were +44 levels over the ballast and read as a grey hatch from the chase camera (5-10 px a
// sleeper at 40-80 m); now +16, a texture up close that the mips average away, and the rails are what stays dark.
export const RAIL_TONES = { ballast: [126, 117, 106] as const, sleeper: [142, 136, 127] as const, track: [88, 82, 77] as const };
/**
 * The rails painted into the bed's texture (issue #145): a dark stripe per rail at the gauge, `half` m each side of the
 * rail's centre (head, foot and its shadow), in `tone`. Constant along the track, so the mips keep it a continuous
 * dark line far past where the 0.14 m ridge rail is a pixel (it broke into dashes there, or vanished).
 */
export const RAIL_STRIPE = { half: 0.12, tone: [62, 56, 52] as const };
/** The stripes' u ranges across the bed's top (u 0..2·topHalf = one SLEEPER_TILE_M tile). */
export function railStripes(): [number, number][] {
  const c = RAIL_SECTION.topHalf, g = RAIL_SECTION.gauge / 2;
  return [c - g, c + g].map(u => [u - RAIL_STRIPE.half, u + RAIL_STRIPE.half] as [number, number]);
}
/** Colours (sRGB): the bridge slab's concrete sides and soffit. */
export const RAIL_COLOURS = { slab: [0.6, 0.59, 0.56] as [number, number, number], soffit: [0.46, 0.46, 0.44] as [number, number, number] };

/**
 * Yard beds (issue #145, Oostertoegang / Dijksgracht: separate beds with beige sand and water between them read as
 * ribbons, not a railway). Where another track of the same deck (both on a bridge, or both not) runs within
 * `maxM` metres centre to centre on one side, roughly parallel (within `maxDeg`), the bed's top runs on as plain ballast
 * to the midpoint (plus `overlap`) and that side has no shoulder: adjacent tracks share one bed, one shoulder pair
 * for the group. Real yard and main-line centres are 4.0-6.5 m; separate corridors are 10 m+ apart.
 */
export const RAIL_MERGE = { maxM: 7, maxDeg: 25, overlap: 0.05 } as const;

/** Segments of every way, bucketed for the side-gap ray test. */
export interface RailSegIndex { grid: Map<string, { way: number; a: Vec2; b: Vec2 }[]>; cellM: number }
export function railSegIndex(ways: readonly RailWay[], cellM = 16): RailSegIndex {
  const grid = new Map<string, { way: number; a: Vec2; b: Vec2 }[]>();
  ways.forEach((w, way) => {
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i], b = w.points[i + 1];
      const gx0 = Math.floor(Math.min(a[0], b[0]) / cellM), gx1 = Math.floor(Math.max(a[0], b[0]) / cellM);
      const gy0 = Math.floor(Math.min(a[1], b[1]) / cellM), gy1 = Math.floor(Math.max(a[1], b[1]) / cellM);
      if ((gx1 - gx0 + 1) * (gy1 - gy0 + 1) > 400) continue;
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) { const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ way, a, b }); }
    }
  });
  return { grid, cellM };
}

/**
 * Distance (m) from `p` along the unit direction `dir` to the nearest segment of another way of the same deck that
 * runs within RAIL_MERGE.maxDeg of `tangent`; Infinity when none lies within RAIL_MERGE.maxM.
 */
export function sideGap(index: RailSegIndex, ways: readonly RailWay[], self: number, p: Vec2, dir: Vec2, tangent: Vec2): number {
  const max = RAIL_MERGE.maxM, cos = Math.cos(RAIL_MERGE.maxDeg * Math.PI / 180), c = index.cellM;
  const q: Vec2 = [p[0] + dir[0] * max, p[1] + dir[1] * max];
  const gx0 = Math.floor(Math.min(p[0], q[0]) / c), gx1 = Math.floor(Math.max(p[0], q[0]) / c);
  const gy0 = Math.floor(Math.min(p[1], q[1]) / c), gy1 = Math.floor(Math.max(p[1], q[1]) / c);
  let best = Infinity;
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) for (const s of index.grid.get(`${gx}:${gy}`) ?? []) {
    if (s.way === self || ways[s.way].bridge !== ways[self].bridge) continue;
    const ex = s.b[0] - s.a[0], ey = s.b[1] - s.a[1], el = Math.hypot(ex, ey);
    if (el < 1e-6 || Math.abs((ex * tangent[0] + ey * tangent[1]) / el) < cos) continue;
    // p + t·dir = a + u·e
    const den = dir[0] * ey - dir[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = s.a[0] - p[0], wy = s.a[1] - p[1];
    const t = (wx * ey - wy * ex) / den, u = (wx * dir[1] - wy * dir[0]) / den;
    if (t > 0.01 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best <= max ? best : Infinity;
}

/** How far the bed's top reaches on one side (m from the centreline) for a side gap: the midpoint, never under topHalf. */
export function yardReach(gap: number): number | null {
  return gap < RAIL_MERGE.maxM ? Math.max(RAIL_SECTION.topHalf, gap / 2 + RAIL_MERGE.overlap) : null;
}

export interface RailMeshes { ballast: MeshArrays; track: MeshArrays; slab: MeshArrays; stats: RailBuildStats }
export interface RailBuildStats { ways: number; metres: number; bridgeMetres: number; levelCrossingMetres: number; byKind: Record<string, number>; /** Bridge metres drawn on the relief without a slab (railProfile.ts `plain`: no approach places the deck). */ plainBridgeMetres?: number; /** Metres on a slab off a bridge (the envelope lifted the track over RAISED_M). */ raisedMetres?: number; /** railProfile.ts stats. */ profile?: import('./railProfile.js').RailProfileStats }

export interface RailBuildInput {
  ways: readonly RailWay[];
  /** Is this point the cell's own (pieces are kept by their middle)? */
  inCell: (x: number, y: number) => boolean;
  /** The riding surface (land grid, decks). */
  height: HeightFn;
  /** Does this piece of track cross a street at grade (a level crossing): flat bed, rails only, at both its ends. */
  atGrade?: (a: Vec2, b: Vec2) => boolean;
  /** Far build (LOD 1): coarser pieces, no rails. */
  far?: boolean;
  /** Draw the rails (default true; off far away on touch devices). */
  rails?: boolean;
  /** The beds' levels (railProfile.ts railLevels); a way without one rides the relief (a bridge: the line between its ends). */
  levels?: ReadonlyMap<RailWay, WayLevel>;
  /** The bed never under the land along its pieces (default true; false: issue #145's per-station ridge only). */
  floor?: boolean;
  /** rail-v1 as it shipped in build 04e3c88 (12 m pieces, bed on the centreline's relief, bridges on their ends' line): the regressions' pre-fix build only. */
  legacy?: boolean;
  /** Points whose floor is measured (a tunnel cut's box): no floor raise there (the trench's sides are not under the bed). */
  measured?: (x: number, y: number) => boolean;
}

/** Split every segment into equal pieces of at most `step` metres (deterministic per way, so neighbour cells meet). */
function densifyEven(pts: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}

function quad(m: MeshArrays, a: number, b: number, c: number, d: number): void { m.indices.push(a, b, c, a, c, d); }
function v(m: MeshArrays, x: number, y: number, z: number, u: number, w: number, colour?: [number, number, number]): number {
  m.positions.push(x, y, z); m.uvs.push(u, w);
  if (m.colors) m.colors.push(...(colour ?? [1, 1, 1]));
  return m.positions.length / 3 - 1;
}

/** The tracks' meshes for one cell. */
export function railMeshes(input: RailBuildInput): RailMeshes {
  const S = RAIL_SECTION;
  const ballast = emptyMesh(), track = emptyMesh(), slab = emptyMesh(true);
  const stats: RailBuildStats = { ways: 0, metres: 0, bridgeMetres: 0, levelCrossingMetres: 0, byKind: {} };
  const drawRails = input.rails !== false && !input.far;
  const segs = railSegIndex(input.ways);
  for (let wi = 0; wi < input.ways.length; wi++) {
    const way = input.ways[wi];
    const coarse = densifyEven(way.points, input.far ? RAIL_STEP_M.far : input.legacy ? RAIL_STEP_V1_M : RAIL_STEP_M.fine);
    // Which pieces are the cell's own (by the even piece's middle); nothing to do when none is.
    const coarseOwn: boolean[] = [];
    let any = false;
    for (let i = 0; i + 1 < coarse.length; i++) { const o = input.inCell((coarse[i][0] + coarse[i + 1][0]) / 2, (coarse[i][1] + coarse[i + 1][1]) / 2); coarseOwn.push(o); any ||= o; }
    if (!any) continue;
    stats.ways++;
    // Where the level bends inside a piece (a deck meeting its approach, a ramp's foot), the piece takes the level's
    // own stations, so the bed follows it and two ways meeting there meet at one height.
    const level = input.levels?.get(way);
    const pts: Vec2[] = [coarse[0]], own: boolean[] = [];
    for (let i = 0, s0 = 0; i + 1 < coarse.length; i++) {
      const a = coarse[i], b = coarse[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), s1 = s0 + len;
      if (level) {
        const inner = level.s.map((s, j) => j).filter(j => level.s[j] > s0 + 0.05 && level.s[j] < s1 - 0.05);
        const za = levelAt(level, s0), zb = levelAt(level, s1);
        if (inner.some(j => Math.abs(level.z[j] - (za + (zb - za) * (level.s[j] - s0) / (len || 1))) > (input.far ? LEVEL_TOL_M.far : LEVEL_TOL_M.fine))) {
          for (const j of inner) { const f = (level.s[j] - s0) / (len || 1); pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); own.push(coarseOwn[i]); }
        }
      }
      pts.push(b); own.push(coarseOwn[i]);
      s0 = s1;
    }
    const n = pts.length;
    const normals = vertexNormals(pts, 1.6);
    const along: number[] = [0];
    for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = along[n - 1];
    // Ground under the centreline; the bed's level from the profile (a bridge without one rides the straight line
    // between its ends' heights, never under the surface it crosses).
    const ground = pts.map(p => input.height(p[0], p[1]));
    const bridge = way.bridge && !level?.plain;
    const z = level ? along.map(s => levelAt(level, s)) : way.bridge ? ground.map((g, i) => Math.max(g, ground[0] + (ground[n - 1] - ground[0]) * (total > 0 ? along[i] / total : 0))) : ground;
    const flat = pts.map(() => false);
    if (!way.bridge && input.atGrade) for (let i = 0; i + 1 < n; i++) if ((own[i] || (i > 0 && own[i - 1]) || (i + 2 < n && own[i + 1])) && input.atGrade(pts[i], pts[i + 1])) flat[i] = flat[i + 1] = true;
    // Never under the ground: each piece's chord (centre and both top edges) stays over the land sampled along it,
    // both its stations raised by the piece's worst deficit; each toe over the highest land along its edge.
    const needed = (i: number) => (i > 0 && own[i - 1]) || (i < n - 1 && own[i]);
    const raise = new Float64Array(n), toeL = new Float64Array(n - 1).fill(-Infinity), toeR = new Float64Array(n - 1).fill(-Infinity);
    const zb = (i: number) => (flat[i] ? ground[i] : z[i]);
    if (input.floor !== false && !input.legacy) for (let i = 0; i + 1 < n; i++) {
      if ((!needed(i) && !needed(i + 1)) || input.measured?.(pts[i][0], pts[i][1]) || input.measured?.(pts[i + 1][0], pts[i + 1][1])) continue;
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = along[i + 1] - along[i], nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      const k = Math.max(1, Math.ceil(len / FLOOR_SAMPLE_M));
      let deficit = 0;
      for (let j = 0; j <= k; j++) {
        const f = j / k, x = ax + (bx - ax) * f, y = ay + (by - ay) * f, chord = zb(i) * (1 - f) + zb(i + 1) * f;
        for (const o of [-S.topHalf, 0, S.topHalf]) deficit = Math.max(deficit, input.height(x + nx * o, y + ny * o) - chord);
        toeL[i] = Math.max(toeL[i], input.height(x + nx * S.toeHalf, y + ny * S.toeHalf));
        toeR[i] = Math.max(toeR[i], input.height(x - nx * S.toeHalf, y - ny * S.toeHalf));
      }
      if (!flat[i]) raise[i] = Math.max(raise[i], deficit);
      if (!flat[i + 1]) raise[i + 1] = Math.max(raise[i + 1], deficit);
    }
    const both = (a: Float64Array, i: number) => Math.max(i > 0 ? a[i - 1] : -Infinity, i < n - 1 ? a[i] : -Infinity);
    // Without the floor (`floor: false`, the build of issue #145) the bed stands topLift over the highest land under its
    // top at each station (centre and both edges); rail-v1 (`legacy`) on the centreline's relief alone.
    const ridge = (i: number) => (way.bridge || flat[i] ? z[i] : Math.max(z[i], ...[S.topHalf, -S.topHalf].map(o => { const [nx, ny, k] = normals[i]; return input.height(pts[i][0] + nx * o * k, pts[i][1] + ny * o * k); })));
    const base = (i: number) => (input.legacy ? zb(i) : input.floor === false ? ridge(i) : zb(i) + raise[i]);
    const top = (i: number) => base(i) + (flat[i] ? S.flatLift : S.topLift - (way.service ? S.serviceDrop : 0));
    // On a slab: a bridge, or a track lifted clear of the land across its bed (an approach over the fill's dip).
    const across = (i: number) => { const [nx, ny, k] = normals[i]; return Math.max(ground[i], input.height(pts[i][0] + nx * S.topHalf * k, pts[i][1] + ny * S.topHalf * k), input.height(pts[i][0] - nx * S.topHalf * k, pts[i][1] - ny * S.topHalf * k)); };
    const slabbed = (i: number) => bridge || (!flat[i] && z[i] - across(i) > RAISED_M);
    const at = (i: number, off: number): Vec2 => { const [nx, ny, k] = normals[i]; return [pts[i][0] + nx * off * k, pts[i][1] + ny * off * k]; };
    // Yard beds: the top runs on to the midpoint where a neighbouring track lies within RAIL_MERGE.maxM (not at a level crossing).
    const reach = (i: number, side: 1 | -1): number | null => {
      if (flat[i]) return null;
      const [nx, ny] = normals[i], j = Math.min(i, n - 2), tx = pts[j + 1][0] - pts[j][0], ty = pts[j + 1][1] - pts[j][1], tl = Math.hypot(tx, ty) || 1;
      return yardReach(sideGap(segs, input.ways, wi, pts[i], [nx * side, ny * side], [tx / tl, ty / tl]));
    };
    // Per station: the bed's five vertices (toe, top edge, top edge, toe) and the rails.
    const bedReach: [number | null, number | null][] = [];
    const bedIdx: number[][] = [], railIdx: number[][] = [], slabIdx: number[][] = [];
    for (let i = 0; i < n; i++) {
      if (!needed(i)) { bedReach.push([null, null]); bedIdx.push([]); railIdx.push([]); slabIdx.push([]); continue; }
      const t = top(i), vv = along[i], onSlab = slabbed(i);
      const toeZ = (p: Vec2, edge: Float64Array) => (onSlab ? t - S.topLift + S.toeLift : flat[i] ? t : Math.min(t, Math.max(input.height(p[0], p[1]), both(edge, i)) + S.toeLift));
      const le = at(i, S.topHalf), re = at(i, -S.topHalf);
      // Yard bed: the top's plain-ballast run to the midpoint (its height there the neighbour's, so the two meet),
      // and no shoulder on that side (the toe sits on the run's edge).
      const lr = reach(i, 1), rr = reach(i, -1);
      const lx = at(i, lr ?? S.topHalf), rx = at(i, -(rr ?? S.topHalf));
      const runZ = (p: Vec2) => (onSlab ? t : Math.max(t - 0.25, input.height(p[0], p[1]) + S.topLift));
      const lxz = lr == null ? t : runZ(lx), rxz = rr == null ? t : runZ(rx);
      const lt = lr == null ? at(i, S.toeHalf) : lx, rt = rr == null ? at(i, -S.toeHalf) : rx;
      // u: the shoulders sample the gravel column at the tile's edge, the top runs across the sleepers.
      bedIdx.push([
        v(ballast, lt[0], lt[1], lr == null ? toeZ(lt, toeL) : lxz, 0.05, vv),
        v(ballast, le[0], le[1], t, 0, vv),
        v(ballast, re[0], re[1], t, 2 * S.topHalf, vv),
        v(ballast, rt[0], rt[1], rr == null ? toeZ(rt, toeR) : rxz, 2 * S.topHalf - 0.05, vv),
        // The shoulders' own copies of the top edges (u in the gravel column, so no sleeper ends smear down the slope).
        v(ballast, le[0], le[1], t, 0.05, vv),
        v(ballast, re[0], re[1], t, 2 * S.topHalf - 0.05, vv),
        // The yard runs' outer edges (on the top edge when the side has no neighbour).
        v(ballast, lx[0], lx[1], lxz, 0.05, vv),
        v(ballast, rx[0], rx[1], rxz, 2 * S.topHalf - 0.05, vv),
      ]);
      bedReach.push([lr, rr]);
      if (drawRails) {
        const r: number[] = [];
        for (const c of [S.gauge / 2, -S.gauge / 2]) {
          // A low-poly rail: a ridge (two faces) over the bed, its head at the centre.
          const o = at(i, c + S.railWidth / 2), m = at(i, c), ii = at(i, c - S.railWidth / 2);
          r.push(v(track, o[0], o[1], t, 0, vv), v(track, m[0], m[1], t + S.railHeight, 0, vv), v(track, ii[0], ii[1], t, 0, vv));
        }
        railIdx.push(r);
      } else railIdx.push([]);
      if (onSlab) {
        // A yard of bridge tracks shares one deck: the slab runs on under the bed's yard run (no water between tracks).
        // A bridge's slab is slabDepth deep; a raised track's reaches down into the ground beside it.
        const sl = at(i, lr == null ? S.slabHalf : lr + RAIL_MERGE.overlap), sr = at(i, -(rr == null ? S.slabHalf : rr + RAIL_MERGE.overlap)), st = t - S.topLift;
        const sb = bridge ? st - S.slabDepth : Math.min(st - S.slabDepth, input.height(sl[0], sl[1]), input.height(sr[0], sr[1])) - 0.2;
        slabIdx.push([
          v(slab, sl[0], sl[1], st, 0, vv, RAIL_COLOURS.slab), v(slab, sl[0], sl[1], sb, 0, vv, RAIL_COLOURS.slab),
          v(slab, sr[0], sr[1], st, 0, vv, RAIL_COLOURS.slab), v(slab, sr[0], sr[1], sb, 0, vv, RAIL_COLOURS.slab),
          v(slab, sl[0], sl[1], sb, 0, vv, RAIL_COLOURS.soffit), v(slab, sr[0], sr[1], sb, 0, vv, RAIL_COLOURS.soffit),
          // A deck top on the slab under the bed's toes (the bed's shoulders end on it).
          v(slab, sl[0], sl[1], st + 0.01, 0, vv, RAIL_COLOURS.slab), v(slab, sr[0], sr[1], st + 0.01, 0, vv, RAIL_COLOURS.slab),
        ]);
      } else slabIdx.push([]);
    }
    for (let i = 0; i + 1 < n; i++) {
      if (!own[i]) continue;
      const len = along[i + 1] - along[i];
      stats.metres += len;
      stats.byKind[way.kind] = (stats.byKind[way.kind] ?? 0) + len;
      if (way.bridge) stats.bridgeMetres += len;
      if (way.bridge && !bridge) stats.plainBridgeMetres = (stats.plainBridgeMetres ?? 0) + len;
      if (!bridge && slabbed(i) && slabbed(i + 1)) stats.raisedMetres = (stats.raisedMetres ?? 0) + len;
      if (flat[i] && flat[i + 1]) stats.levelCrossingMetres += len;
      const a = bedIdx[i], b = bedIdx[i + 1];
      // Left normal is +offset: a[0] toe left, a[1] top left, a[2] top right, a[3] toe right. CCW from above.
      // Left: the yard run (top edge → run edge), then the shoulder (run edge → toe); right mirrored. A run or
      // shoulder that is degenerate at both ends (no neighbour / merged on that side) is skipped.
      quad(ballast, a[2], b[2], b[1], a[1]);
      const [ra0, rb0] = [bedReach[i], bedReach[i + 1]];
      if (ra0[0] != null || rb0[0] != null) quad(ballast, a[4], b[4], b[6], a[6]);
      if (ra0[0] == null || rb0[0] == null) quad(ballast, a[6], b[6], b[0], a[0]);
      if (ra0[1] != null || rb0[1] != null) quad(ballast, a[7], b[7], b[5], a[5]);
      if (ra0[1] == null || rb0[1] == null) quad(ballast, a[3], b[3], b[7], a[7]);
      const ra = railIdx[i], rb = railIdx[i + 1];
      if (ra.length && rb.length) for (const o of [0, 3]) {
        // Per rail: the face towards +normal, the face towards -normal.
        quad(track, ra[o], rb[o], rb[o + 1], ra[o + 1]);
        quad(track, ra[o + 1], rb[o + 1], rb[o + 2], ra[o + 2]);
      }
      const sa = slabIdx[i], sb = slabIdx[i + 1];
      if (sa.length && sb.length) {
        quad(slab, sa[0], sa[1], sb[1], sb[0]); // left side (faces +normal)
        quad(slab, sa[3], sa[2], sb[2], sb[3]); // right side
        quad(slab, sa[4], sa[5], sb[5], sb[4]); // soffit (faces down)
        quad(slab, sa[7], sb[7], sb[6], sa[6]); // top
      }
    }
  }
  return { ballast, track, slab, stats };
}

/** A segment-crossing grid for the level-crossing test: does a piece of track cross any of these street segments? */
export function crossingTest(segments: readonly [Vec2, Vec2][], cellM = 32): (a: Vec2, b: Vec2) => boolean {
  const grid = new Map<string, [Vec2, Vec2][]>();
  const cells = (a: Vec2, b: Vec2, f: (k: string) => void) => {
    const gx0 = Math.floor(Math.min(a[0], b[0]) / cellM), gx1 = Math.floor(Math.max(a[0], b[0]) / cellM);
    const gy0 = Math.floor(Math.min(a[1], b[1]) / cellM), gy1 = Math.floor(Math.max(a[1], b[1]) / cellM);
    if ((gx1 - gx0 + 1) * (gy1 - gy0 + 1) > 400) return;
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) f(`${gx}:${gy}`);
  };
  for (const s of segments) cells(s[0], s[1], k => { (grid.get(k) ?? grid.set(k, []).get(k)!).push(s); });
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  return (a, b) => {
    let hit = false;
    cells(a, b, k => {
      if (hit) return;
      for (const [c, d] of grid.get(k) ?? []) {
        const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
        if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) { hit = true; return; }
      }
    });
    return hit;
  };
}

/** Highway classes whose surface a track crosses at grade (a level crossing): carriageways and the paths beside them. */
export const AT_GRADE_HIGHWAYS: ReadonlySet<string> = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'road', 'busway', 'pedestrian', 'cycleway', 'footway', 'path', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

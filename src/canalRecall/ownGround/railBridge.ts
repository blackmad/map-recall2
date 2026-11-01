// Rail bridge structure (pure, no DOM): what stands under and beside a rail deck (lane rail-look round 3, 2026-10-31).
//
// Before: a rail deck was a level slab 1.1 m deep with nothing under it (railTracks.ts railMeshes `slab`). The
// panoramas (data.amsterdam.nl 2025) show two families on the city's lines:
//
//   viaduct    over streets and land (the Amstel approach viaduct, the Droogbak passage, the Oostertoegang over the
//              Piet Heinkade): a concrete deck with a dark edge beam, a steel railing on its edge, carried on rows of
//              slender concrete columns under a crosshead every ~12-15 m
//   girder     over water (the Dijksgracht, the Weespertrekvaart, the Amstel): steel plate girders along both deck
//              edges, their top over the ballast (a through girder, the side the passenger sees), on concrete piers on
//              the banks
//
// Rules, city-wide:
//   - A pier stands only where the land under its whole footprint is land: never in water (a fairway or any canal),
//     never on a carriageway, cycle track or footway (`blocked`), never on another track at grade.
//   - Piers greedily as far apart as the type's span allows (RAIL_PIER_SPAN_M); where no land lies within the span
//     (a long water crossing), the girder spans to the next land.
//   - A pier needs at least MIN_CLEAR_M from the land to the soffit: where the deck runs on its embankment there is none.
//   - A span with water under it is a girder span (through plate girders replace the railing); otherwise viaduct.
//   - Far ring (LOD 1): piers as single walls, girders as plain plates, no railing posts.
//
// A side that shares its slab with a neighbouring track (a yard on one deck, railTracks RAIL_MERGE) has no railing
// and no girder on that side; each track draws the piers under its own half.

import { box, face, type RGB } from './bridgeKit.js';
import { emptyMesh, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

type V3 = [number, number, number];

/** One station across a bridge deck: centre, left unit normal (with its miter scale), the slab top, its edges' offsets. */
export interface RailDeckStation {
  p: Vec2;
  n: Vec2;
  /** Miter scale of the normal (railTracks vertexNormals' k). */
  k: number;
  /** Distance along the way, metres. */
  s: number;
  /** Slab top (under the ballast), soffit. */
  top: number;
  soffit: number;
  /** Slab edges: left (+n) and right (−n) offsets. */
  left: number;
  right: number;
  /** The side is shared with a neighbouring track's slab (no railing, no girder there). */
  sharedL: boolean;
  sharedR: boolean;
}

export type UnderKind = 'water' | 'road' | 'rail' | 'land';
export interface RailBridgeInput {
  /** One run of consecutive deck stations along a way. */
  stations: readonly RailDeckStation[];
  /** Which pieces (station i → i + 1) are the cell's own. */
  own: readonly boolean[];
  ground: HeightFn;
  /** What lies at (x, y) under the deck. */
  under: (x: number, y: number) => UnderKind;
  far: boolean;
}

export interface RailBridgeStats { runs: number; piers: number; girderMetres: number; viaductMetres: number; railingMetres: number; triangles: number }

/** Greatest distance between piers, metres: viaduct (column rows) and girder spans. */
export const RAIL_PIER_SPAN_M = { viaduct: 14, girder: 30 } as const;
/** Least land-to-soffit clearance for a pier, metres (less: the deck is on its embankment there). */
export const MIN_CLEAR_M = 1.2;
/** Pier footprint along the track (half), and the margin round it that must be clear land, metres. */
export const PIER = { halfLen: 0.45, margin: 0.6, column: 0.35, columnStep: 4.2, crosshead: 0.7 } as const;
/** Through plate girder: its top over the slab top, its bottom under the soffit, its half thickness, metres. */
export const GIRDER = { rise: 1.25, drop: 0.45, half: 0.22 } as const;
/** Edge railing: height over the slab top, rail and post half sections, post step, metres. */
export const RAIL_RAILING = { height: 1.1, rail: 0.04, post: 0.04, postStep: 3.0, upstand: 0.3 } as const;
/** sRGB 0..1: concrete piers, steel girders (the NS grey-green), the railing, the viaduct's edge beam. */
export const RAIL_BRIDGE_COLOURS = {
  pier: [0.64, 0.62, 0.58] as RGB,
  girder: [0.36, 0.42, 0.42] as RGB,
  railing: [0.3, 0.31, 0.31] as RGB,
  edge: [0.42, 0.42, 0.41] as RGB,
};

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** The station at distance `s` along the run (linear between stations). */
function at(st: readonly RailDeckStation[], s: number): RailDeckStation {
  let i = 0;
  while (i + 2 < st.length && st[i + 1].s < s) i++;
  const a = st[i], b = st[Math.min(i + 1, st.length - 1)], f = b.s > a.s ? Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s))) : 0;
  const nx = lerp(a.n[0], b.n[0], f), ny = lerp(a.n[1], b.n[1], f), nl = Math.hypot(nx, ny) || 1;
  return { p: [lerp(a.p[0], b.p[0], f), lerp(a.p[1], b.p[1], f)], n: [nx / nl, ny / nl], k: lerp(a.k, b.k, f), s, top: lerp(a.top, b.top, f), soffit: lerp(a.soffit, b.soffit, f), left: lerp(a.left, b.left, f), right: lerp(a.right, b.right, f), sharedL: a.sharedL && b.sharedL, sharedR: a.sharedR && b.sharedR };
}

/**
 * Where piers may stand along a run: every `step` metres, the distance where the land under the pier's footprint
 * (both edges and the centre, ± its half length plus margin) is land and clear of the soffit by MIN_CLEAR_M.
 */
export function pierSites(input: RailBridgeInput, step = 1): { s: number; ground: number }[] {
  const st = input.stations, out: { s: number; ground: number }[] = [];
  if (st.length < 2) return out;
  const s0 = st[0].s, s1 = st[st.length - 1].s;
  for (let s = s0 + PIER.halfLen + PIER.margin; s <= s1 - PIER.halfLen - PIER.margin + 1e-9; s += step) {
    const c = at(st, s), j = st.findIndex((q, i) => i + 1 < st.length && st[i + 1].s >= s);
    const t: Vec2 = j >= 0 ? (() => { const a = st[j].p, b = st[j + 1].p, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as Vec2; })() : [-c.n[1], c.n[0]];
    let ok = true, low = Infinity;
    for (const along of [-(PIER.halfLen + PIER.margin), 0, PIER.halfLen + PIER.margin]) {
      for (const off of [c.left - 0.3, 0, -(c.right - 0.3)]) {
        const x = c.p[0] + c.n[0] * off * c.k + t[0] * along, y = c.p[1] + c.n[1] * off * c.k + t[1] * along;
        if (input.under(x, y) !== 'land') { ok = false; break; }
        low = Math.min(low, input.ground(x, y));
      }
      if (!ok) break;
    }
    if (ok && c.soffit - low >= MIN_CLEAR_M) out.push({ s, ground: low });
  }
  return out;
}

/** Greedy spacing: from the run's start, the farthest site within `span`; none within it, the nearest beyond. */
export function placePiers(sites: readonly { s: number }[], start: number, end: number, span: number): number[] {
  const out: number[] = [];
  let last = start;
  for (;;) {
    const within = sites.filter(q => q.s > last + 1 && q.s <= last + span);
    // The run's end is within the span: done (the abutment carries the deck).
    if (end - last <= span) break;
    const next = within.length ? within[within.length - 1].s : sites.find(q => q.s > last + span)?.s;
    if (next === undefined) break;
    out.push(next);
    last = next;
  }
  return out;
}

/** The structure under and beside one run of a rail deck. */
export function railBridgeMesh(input: RailBridgeInput): { mesh: MeshArrays; stats: RailBridgeStats } {
  const mesh = emptyMesh(true), stats: RailBridgeStats = { runs: 0, piers: 0, girderMetres: 0, viaductMetres: 0, railingMetres: 0, triangles: 0 };
  const st = input.stations;
  if (st.length < 2 || !input.own.some(Boolean)) return { mesh, stats };
  stats.runs = 1;
  const C = RAIL_BRIDGE_COLOURS;
  // Water under the run (centre, every station): a girder run.
  let waterM = 0;
  for (let i = 0; i + 1 < st.length; i++) { const m = at(st, (st[i].s + st[i + 1].s) / 2); if (input.under(m.p[0], m.p[1]) === 'water') waterM += st[i + 1].s - st[i].s; }
  const girder = waterM >= 4;
  const ownAt = (s: number) => { for (let i = 0; i + 1 < st.length; i++) if (s >= st[i].s && s <= st[i + 1].s) return input.own[i]; return false; };
  const edgePoint = (q: RailDeckStation, side: 1 | -1, inset = 0): Vec2 => { const o = side > 0 ? q.left - inset : -(q.right - inset); return [q.p[0] + q.n[0] * o * q.k, q.p[1] + q.n[1] * o * q.k]; };
  // Piers.
  const sites = pierSites(input);
  // A way's end is an abutment where the deck meets its land (no clearance under the soffit); elsewhere the deck runs on
  // as the next bridge way, whose own piers stand about half a span off (the greedy starts that far back).
  const span = girder ? RAIL_PIER_SPAN_M.girder : RAIL_PIER_SPAN_M.viaduct;
  const abut = (q: RailDeckStation) => q.soffit - input.ground(q.p[0], q.p[1]) < MIN_CLEAR_M;
  const first = st[0], last = st[st.length - 1];
  const piers = placePiers(sites, abut(first) ? first.s : first.s - span / 2, abut(last) ? last.s : last.s + span / 2, span);
  for (const s of piers) {
    if (!ownAt(s)) continue;
    const q = at(st, s), g = sites.find(x => x.s === s)!.ground - 0.3, u: Vec2 = [-q.n[1], q.n[0]];
    const width = (q.left + q.right) * q.k, mid = (q.left - q.right) / 2 * q.k, c: Vec2 = [q.p[0] + q.n[0] * mid, q.p[1] + q.n[1] * mid];
    stats.piers++;
    if (girder || input.far) {
      // A pier wall across the deck (girder spans on the banks; the far ring's columns).
      box(mesh, c, q.n, Math.max(0.5, width / 2 - 0.4), PIER.halfLen, g, q.soffit, C.pier, false);
    } else {
      // Columns under a crosshead (the Amstel viaduct): one per ~4 m of width.
      const n = Math.max(2, Math.round(width / PIER.columnStep) + 1), half = width / 2 - 0.7;
      box(mesh, c, q.n, width / 2 - 0.2, PIER.halfLen, q.soffit - PIER.crosshead, q.soffit, C.pier, false);
      for (let j = 0; j < n; j++) {
        const o = -half + (2 * half * j) / (n - 1), p: Vec2 = [c[0] + q.n[0] * o, c[1] + q.n[1] * o];
        box(mesh, p, u, PIER.column, PIER.column, g, q.soffit - PIER.crosshead, C.pier, false);
      }
    }
  }
  // Along the run: through girders (water) or the viaduct's edge beam and railing.
  for (let i = 0; i + 1 < st.length; i++) {
    if (!input.own[i]) continue;
    const a = st[i], b = st[i + 1], len = b.s - a.s;
    if (girder) stats.girderMetres += len; else stats.viaductMetres += len;
    for (const side of [1, -1] as const) {
      if (side > 0 ? a.sharedL || b.sharedL : a.sharedR || b.sharedR) continue;
      const out: V3 = [a.n[0] * side, a.n[1] * side, 0];
      if (girder) {
        // A through plate girder on the slab's edge: outer face, top, inner face, underside.
        const ao = edgePoint(a, side, -GIRDER.half), bo = edgePoint(b, side, -GIRDER.half), ai = edgePoint(a, side, GIRDER.half), bi = edgePoint(b, side, GIRDER.half);
        const at0 = a.top + GIRDER.rise, bt0 = b.top + GIRDER.rise, ab = a.soffit - GIRDER.drop, bb = b.soffit - GIRDER.drop;
        face(mesh, [[ao[0], ao[1], ab], [bo[0], bo[1], bb], [bo[0], bo[1], bt0], [ao[0], ao[1], at0]], C.girder, out);
        face(mesh, [[ai[0], ai[1], at0], [bi[0], bi[1], bt0], [bo[0], bo[1], bt0], [ao[0], ao[1], at0]], C.girder, [0, 0, 1]);
        if (!input.far) {
          face(mesh, [[ai[0], ai[1], a.top], [bi[0], bi[1], b.top], [bi[0], bi[1], bt0], [ai[0], ai[1], at0]], C.girder, [-out[0], -out[1], 0]);
          face(mesh, [[ai[0], ai[1], ab], [bi[0], bi[1], bb], [bo[0], bo[1], bb], [ao[0], ao[1], ab]], C.girder, [0, 0, -1]);
        }
      } else {
        // The viaduct: a dark edge beam over the slab's side, a low upstand and a steel railing on it.
        const ao = edgePoint(a, side, -0.02), bo = edgePoint(b, side, -0.02), ai = edgePoint(a, side, 0.25), bi = edgePoint(b, side, 0.25);
        const au = a.top + RAIL_RAILING.upstand, bu = b.top + RAIL_RAILING.upstand;
        face(mesh, [[ao[0], ao[1], a.soffit - 0.15], [bo[0], bo[1], b.soffit - 0.15], [bo[0], bo[1], bu], [ao[0], ao[1], au]], C.edge, out);
        face(mesh, [[ai[0], ai[1], au], [bi[0], bi[1], bu], [bo[0], bo[1], bu], [ao[0], ao[1], au]], C.edge, [0, 0, 1]);
        face(mesh, [[ai[0], ai[1], a.top], [bi[0], bi[1], b.top], [bi[0], bi[1], bu], [ai[0], ai[1], au]], C.edge, [-out[0], -out[1], 0]);
        stats.railingMetres += len;
        if (!input.far) {
          // The handrail: a thin bar along the edge, posts every postStep metres.
          const ar = edgePoint(a, side, 0.12), br = edgePoint(b, side, 0.12), ah = a.top + RAIL_RAILING.height, bh = b.top + RAIL_RAILING.height;
          face(mesh, [[ar[0], ar[1], ah - 0.08], [br[0], br[1], bh - 0.08], [br[0], br[1], bh], [ar[0], ar[1], ah]], C.railing, out);
          face(mesh, [[ar[0], ar[1], ah - 0.08], [br[0], br[1], bh - 0.08], [br[0], br[1], bh], [ar[0], ar[1], ah]], C.railing, [-out[0], -out[1], 0]);
          const first = Math.ceil(a.s / RAIL_RAILING.postStep) * RAIL_RAILING.postStep;
          for (let s = first; s < b.s; s += RAIL_RAILING.postStep) {
            const q = at(st, s), p = edgePoint(q, side, 0.12), u: Vec2 = [-q.n[1], q.n[0]];
            box(mesh, p, u, RAIL_RAILING.post, RAIL_RAILING.post, q.top + RAIL_RAILING.upstand, q.top + RAIL_RAILING.height - 0.04, C.railing, false);
          }
        }
      }
    }
  }
  stats.triangles = mesh.indices.length / 3;
  return { mesh, stats };
}

/** Half widths (metres) of a street way's footprint for the pier test, from its cross-section's bands. */
export function streetHalfWidth(bands: readonly { offset: number; width: number }[]): number {
  return bands.reduce((m, b) => Math.max(m, Math.abs(b.offset) + b.width / 2), 0);
}

/**
 * The `under` test for a cell: water (the water mask), a street (within its half width + 0.5 m of a way at grade),
 * another track at grade (within RAIL_UNDER_M), else land. Segments are bucketed on a 32 m grid.
 */
export const RAIL_UNDER_M = 2.6;
export function underTest(water: (x: number, y: number) => boolean, streets: readonly { points: readonly Vec2[]; half: number }[], tracks: readonly (readonly Vec2[])[]): (x: number, y: number) => UnderKind {
  const G = 32, grid = new Map<string, { a: Vec2; b: Vec2; r: number; kind: UnderKind }[]>();
  const put = (a: Vec2, b: Vec2, r: number, kind: UnderKind) => {
    const gx0 = Math.floor((Math.min(a[0], b[0]) - r) / G), gx1 = Math.floor((Math.max(a[0], b[0]) + r) / G), gy0 = Math.floor((Math.min(a[1], b[1]) - r) / G), gy1 = Math.floor((Math.max(a[1], b[1]) + r) / G);
    if ((gx1 - gx0 + 1) * (gy1 - gy0 + 1) > 400) return;
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) { const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ a, b, r, kind }); }
  };
  for (const s of streets) for (let i = 0; i + 1 < s.points.length; i++) put(s.points[i], s.points[i + 1], s.half + 0.5, 'road');
  for (const t of tracks) for (let i = 0; i + 1 < t.length; i++) put(t[i], t[i + 1], RAIL_UNDER_M, 'rail');
  return (x, y) => {
    if (water(x, y)) return 'water';
    for (const e of grid.get(`${Math.floor(x / G)}:${Math.floor(y / G)}`) ?? []) {
      const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - e.a[0]) * dx + (y - e.a[1]) * dy) / l2)) : 0;
      if (Math.hypot(e.a[0] + dx * t - x, e.a[1] + dy * t - y) <= e.r) return e.kind;
    }
    return 'land';
  };
}

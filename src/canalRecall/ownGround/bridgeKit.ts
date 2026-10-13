// The bridge kit (pure, DOM-free; built in the ground worker): one body per
// bridge type on a spine of stations along the crossing, lane bridge-kit
// 2026-10-13. User: Prinsengracht-class bridges drew as chunky brown slabs
// with no arch, no coping and no lamps; the Magere Brug's two bascule units
// read as one gantry; a footbridge's deck and railings read as two loose
// plates.
//
// The spine is the measured deck profile (decks.ts measuredDeckBody) or the
// crossing axis of an unmeasured footprint (flatDeckBody). Every station's
// top is the riding surface (GroundSurface.height); the kit only draws what
// is under, beside and on the edge of that top, so the measured hump and the
// rider's physics are untouched.
//
//   arch        the canal-belt standard: one arch under ~12 m of water, three
//               over (five past 60 m), segmental from the quay to under the
//               crown, brick spandrels, a stone arch ring with a keystone, a
//               stone coping band, a stone-post balustrade with iron rails,
//               lamp posts at the quarter points
//   girder      post-war and outer canals: an edge beam (steel or concrete),
//               a thin deck and soffit, piers in ~8 m bays over 12 m of water,
//               an upstand with posts and two rails
//   footbridge  narrow or foot/cycle-only: a thin deck whose posts are bolted
//               to its edge beam (railing and deck one piece), top and mid rail
//   bascule     movable: girder fixed parts, the leaf as its own plate in the
//               bridge's colour with dark joints, and (movableFrame) a portal
//               with sloping balance beams and a counterweight per leaf
//
// Each bridge is held to KIT_BUDGET triangles: the builder coarsens (station
// tolerance, arch segments, post step, lamps) until it fits.

import { emptyMesh, vertex, type MeshArrays } from './drape.js';
import { BRIDGE_CODES, FLAT_HINTS } from './bridgeHints.js';
import type { Vec2 } from './surface.js';

export type RGB = [number, number, number];
type V3 = [number, number, number];
export const hex = (h: string): RGB => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

export type BridgeKind = 'arch' | 'girder' | 'footbridge' | 'bascule';
export type BridgeMaterial = 'masonry' | 'steel' | 'concrete' | 'wood' | 'other';

/** Triangles per bridge body: near ring (LOD 0) and far ring (LOD 1). The deck top strip is counted apart (it is the riding surface). */
export const KIT_BUDGET = { near: 600, far: 60 } as const;

/** Bridge colours (sRGB). Brick and natural stone after the canal-belt bridges; Amsterdam railing green. */
export const KIT_COLOURS = {
  brick: hex('#8a4c3b'), brickShade: hex('#5c3a2f'), stone: hex('#b5ad9e'), keystone: hex('#d2cab8'),
  iron: hex('#26392e'), lampPole: hex('#1f2a25'), lantern: hex('#efe1b0'),
  steel: hex('#3f4d47'), concrete: hex('#a9a49b'), wood: hex('#6f5338'), woodRail: hex('#5c432d'),
  soffit: hex('#4d4843'), abutment: hex('#7b5a4a'), pier: hex('#8f877b'), joint: hex('#262624'),
  white: hex('#ecebe4'), green: hex('#2c4136'),
} as const;

// ------------------------------------------------------------------ register hints

/** What the municipal register says about a bridge (build-bridge-hints.ts). */
export interface RegisterHint { material: BridgeMaterial; classic: boolean; light: boolean; movable: boolean }
const MATERIALS: BridgeMaterial[] = ['masonry', 'steel', 'concrete', 'wood', 'other'];
export function encodeHint(h: RegisterHint): string {
  return String.fromCharCode(48 + MATERIALS.indexOf(h.material) * 8 + (h.classic ? 4 : 0) + (h.light ? 2 : 0) + (h.movable ? 1 : 0));
}
export function decodeHint(c: string): RegisterHint | null {
  const k = c.charCodeAt(0) - 48;
  if (!(k >= 0 && k < 40)) return null;
  return { material: MATERIALS[k >> 3], classic: !!(k & 4), light: !!(k & 2), movable: !!(k & 1) };
}
/** Register hint of a BRU id ('BRU0242'), or null. */
export function registerHint(id: string): RegisterHint | null {
  const m = /^BRU(\d+)$/.exec(id);
  return m ? decodeHint(BRIDGE_CODES[Number(m[1])] ?? '.') : null;
}
let flatIndex: Map<string, { id: string; x: number; y: number }[]> | null = null;
/** Hint of the unmeasured footprint whose centroid is within 2 m of (x, y), game frame (only footprints the register changes are indexed). */
export function flatHintAt(x: number, y: number): { id: string; hint: RegisterHint } | null {
  if (!flatIndex) {
    flatIndex = new Map();
    for (let i = 0; i + 2 < FLAT_HINTS.length; i += 3) {
      const e = { id: `BRU${String(FLAT_HINTS[i]).padStart(4, '0')}`, x: FLAT_HINTS[i + 1] / 10, y: FLAT_HINTS[i + 2] / 10 }, k = `${Math.floor(e.x / 50)}:${Math.floor(e.y / 50)}`;
      (flatIndex.get(k) ?? flatIndex.set(k, []).get(k)!).push(e);
    }
  }
  let best: { id: string; x: number; y: number } | null = null, bd = 2;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const e of flatIndex.get(`${Math.floor(x / 50) + i}:${Math.floor(y / 50) + j}`) ?? []) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  const hint = best && registerHint(best.id);
  return best && hint ? { id: best.id, hint } : null;
}

const FAMILY_MATERIAL: Record<string, BridgeMaterial> = { 'masonry-arch': 'masonry', 'steel-deck': 'steel', 'concrete-deck': 'concrete', 'wooden-deck': 'wood' };

/**
 * The kit for a measured deck. Arch: masonry, or a pre-1940 (canal-belt)
 * steel/concrete deck with a hump of at least ARCH_MIN_HUMP_M over at most
 * 60 m of water — the 19th-century iron decks of the belt sit behind brick
 * arch faces. Footbridge: foot/cycle-only and under 4.5 m, or any deck under
 * 3.5 m. Otherwise girder.
 */
export const ARCH_MIN_HUMP_M = 0.45;
export function measuredKind(family: string, width: number, hump: number, waterM: number, hint: RegisterHint | null): BridgeKind {
  if (hint?.light && width < 4.5) return 'footbridge';
  if (family === 'masonry-arch' || hint?.material === 'masonry') return width < 3 ? 'footbridge' : 'arch';
  if (hint?.classic && family !== 'wooden-deck' && hump >= ARCH_MIN_HUMP_M && waterM <= 60 && width >= 3) return 'arch';
  return width < 3.5 ? 'footbridge' : 'girder';
}
/** The kit for an unmeasured footprint (its across width from the crossing axis). */
export function flatKind(movable: boolean, across: number, hint: RegisterHint | null): BridgeKind {
  if (movable || hint?.movable) return 'bascule';
  if (hint?.material === 'masonry' && across >= 3) return 'arch';
  if (across < 3.5 || (hint?.light && across < 4.5)) return 'footbridge';
  return 'girder';
}
export const materialOf = (family: string | undefined, hint: RegisterHint | null): BridgeMaterial => (family && FAMILY_MATERIAL[family]) || hint?.material || 'concrete';

// ------------------------------------------------------------------ primitives

function quad(m: MeshArrays, a: number, b: number, c: number, d: number): void { m.indices.push(a, b, c, a, c, d); }

/** A planar quad (corners in order round it), wound so its normal points along `want`. Own vertices: flat shading. */
export function face(m: MeshArrays, p: readonly V3[], c: RGB, want: readonly number[]): void {
  const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const pts = n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0 ? [p[0], p[3], p[2], p[1]] : p;
  const i = pts.map(q => vertex(m, q[0], q[1], q[2], c));
  quad(m, i[0], i[1], i[2], i[3]);
}

/** An upright box on a centre, its long axis `u` (unit), no bottom face (10 triangles; `top` false: 8). */
export function box(m: MeshArrays, c: Vec2, u: Vec2, halfLen: number, halfWid: number, z0: number, z1: number, col: RGB, top = true): void {
  const v: Vec2 = [-u[1], u[0]];
  const at = (a: number, b: number, z: number): V3 => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, z];
  const L = halfLen, W = halfWid;
  face(m, [at(L, -W, z0), at(L, W, z0), at(L, W, z1), at(L, -W, z1)], col, [u[0], u[1], 0]);
  face(m, [at(-L, -W, z0), at(-L, W, z0), at(-L, W, z1), at(-L, -W, z1)], col, [-u[0], -u[1], 0]);
  face(m, [at(-L, W, z0), at(L, W, z0), at(L, W, z1), at(-L, W, z1)], col, [v[0], v[1], 0]);
  face(m, [at(-L, -W, z0), at(L, -W, z0), at(L, -W, z1), at(-L, -W, z1)], col, [-v[0], -v[1], 0]);
  if (top) face(m, [at(-L, -W, z1), at(L, -W, z1), at(L, W, z1), at(-L, W, z1)], col, [0, 0, 1]);
}

/** A box between two points (a beam, rod or rail), square section `half`. `open` drops the underside (rails: 6 triangles). */
export function beam(m: MeshArrays, a: V3, b: V3, half: number, col: RGB, open = false): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1, t = d.map(x => x / l);
  const up: V3 = Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  // e1 horizontal across the beam, e2 = e1 × t points up for a near-horizontal beam.
  const s1: V3 = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]], l1 = Math.hypot(...s1);
  const e1 = s1.map(x => x / l1 * half) as V3;
  const e2 = [e1[1] * t[2] - e1[2] * t[1], e1[2] * t[0] - e1[0] * t[2], e1[0] * t[1] - e1[1] * t[0]] as V3;
  const P = (p: V3, i: number, j: number): V3 => [p[0] + e1[0] * i + e2[0] * j, p[1] + e1[1] * i + e2[1] * j, p[2] + e1[2] * i + e2[2] * j];
  const sides: [number, number, number, number, number[]][] = [[1, -1, 1, 1, e1], [-1, -1, -1, 1, e1.map(x => -x)], [-1, 1, 1, 1, e2]];
  if (!open) sides.push([-1, -1, 1, -1, e2.map(x => -x)]);
  for (const [i0, j0, i1, j1, w] of sides) face(m, [P(a, i0, j0), P(a, i1, j1), P(b, i1, j1), P(b, i0, j0)], col, w);
}

// ------------------------------------------------------------------ spine

/** One station across the bridge: centre, left unit normal, edges, riding-surface z there, water under the centre/edges, relief at the edges. */
export interface KitRow { s: number; c: Vec2; n: Vec2; L: Vec2; R: Vec2; z: number; zL: number; zR: number; water: boolean; wL: boolean; wR: boolean; gL: number; gR: number }

export interface KitInput {
  id: string;
  kind: BridgeKind;
  material: BridgeMaterial;
  rows: KitRow[];
  /** Station range carrying the parapet/railings (the deck span). */
  parapet: [number, number];
  /** Water spans along the stations (the measured water, else the centre's runs). */
  spans: [number, number][];
  waterZ: number;
  lod: 0 | 1;
  /** Deck thickness under the top (girder, footbridge, bascule). */
  thickness?: number;
  /** Bascule leaves along the stations. */
  leaves?: [number, number][];
  /** Bascule colour (leaf fascia). */
  colour?: RGB;
  /** Edge chords may cut this far inside the edge (default LATERAL_TOL_M; an unmeasured footprint's ragged ring takes more). */
  lateralTol?: number;
  /** Triangle budget override (tests). */
  budget?: number;
}

export interface KitInfo { kind: BridgeKind; triangles: number; level: number; railingPosts: number; piers: number; arches: number; abutments: number; lamps: number }

const BURY = 0.4;
/** Stone coping band on an arch face, metres under the deck edge. */
export const COPE_M = 0.3;
/** Arch ring (voussoir band) depth, metres. */
export const RING_M = 0.38;
/** Pier length between arches / girder bays, metres. */
const PIER_LEN = 1.2;
const BAY_M = 8;
export const PIER_SPAN_M = 12;
/** Railing geometry, metres. */
export const RAILING = { height: 1.05, post: 0.07, rail: 0.05, plinthWidth: 0.28 };

function lerpRow(a: KitRow, b: KitRow, s: number): KitRow {
  const t = b.s > a.s ? Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s))) : 0, l = (x: number, y: number) => x + (y - x) * t;
  const l2 = (p: Vec2, q: Vec2): Vec2 => [l(p[0], q[0]), l(p[1], q[1])];
  const n = l2(a.n, b.n), nl = Math.hypot(n[0], n[1]) || 1, near = t < 0.5 ? a : b;
  return { s, c: l2(a.c, b.c), n: [n[0] / nl, n[1] / nl], L: l2(a.L, b.L), R: l2(a.R, b.R), z: l(a.z, b.z), zL: l(a.zL, b.zL), zR: l(a.zR, b.zR), water: near.water, wL: near.wL, wR: near.wR, gL: l(a.gL, b.gL), gR: l(a.gR, b.gR) };
}
function rowAt(rows: readonly KitRow[], s: number): KitRow {
  let k = 0;
  while (k < rows.length - 2 && rows[k + 1].s < s) k++;
  return lerpRow(rows[k], rows[Math.min(rows.length - 1, k + 1)], s);
}

/** Stations kept so every edge z stays within `tol` of the full profile (Douglas-Peucker), plus the water/land changes and `extra`. */
export function spineStations(rows: readonly KitRow[], tol: number, extra: readonly number[] = [], flips = true, lateralTol = LATERAL_TOL_M): number[] {
  const n = rows.length, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const dev = (i: number, a: number, b: number) => {
    const t = (rows[i].s - rows[a].s) / ((rows[b].s - rows[a].s) || 1), l = (x: number, y: number) => x + (y - x) * t;
    // Lateral: the measured half-width jitters by centimetres; an edge chord within LATERAL_TOL_M stays under the parapet.
    const lat = Math.max(Math.hypot(rows[i].L[0] - l(rows[a].L[0], rows[b].L[0]), rows[i].L[1] - l(rows[a].L[1], rows[b].L[1])),
      Math.hypot(rows[i].R[0] - l(rows[a].R[0], rows[b].R[0]), rows[i].R[1] - l(rows[a].R[1], rows[b].R[1])));
    return Math.max(Math.abs(rows[i].zL - l(rows[a].zL, rows[b].zL)), Math.abs(rows[i].zR - l(rows[a].zR, rows[b].zR)), lat > Math.max(lateralTol, tol) ? lat : 0);
  };
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) { const d = dev(i, a, b); if (d > worst) { worst = d; at = i; } }
    if (at >= 0 && worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  if (flips) for (let k = 0; k + 1 < n; k++) if (rows[k].water !== rows[k + 1].water || rows[k].wL !== rows[k + 1].wL || rows[k].wR !== rows[k + 1].wR) keep[k] = keep[k + 1] = 1;
  const out = rows.filter((_, k) => keep[k]).map(r => r.s);
  for (const s of extra) if (s > rows[0].s && s < rows[n - 1].s) out.push(s);
  out.sort((a, b) => a - b);
  return out.filter((s, k) => k === 0 || s - out[k - 1] > 0.04);
}

/** Edge chords may cut this far inside the measured edge (the parapet, ≥ 0.28 m wide, covers it). */
const LATERAL_TOL_M = 0.15;

/**
 * Water flags along the spine without the mask's speckle at a skewed quay:
 * water inside the spans, gaps under 3 m inside water, are water; water runs
 * under 1 m are land (each flip costs a station on both faces).
 */
export function cleanWater(rows: readonly KitRow[], spans: readonly [number, number][] = []): KitRow[] {
  // Inside a water span the kit draws its own piers: the mask's islands there (pier footings, BRU0236) are water.
  const out = rows.map(r => (spans.some(([a, b]) => r.s > a && r.s < b) ? { ...r, water: true, wL: true, wR: true } : { ...r }));
  for (const key of ['water', 'wL', 'wR'] as const) {
    const runs: [number, number][] = [];
    out.forEach((r, k) => { if (!r[key]) return; const last = runs[runs.length - 1]; if (last && last[1] === k - 1) last[1] = k; else runs.push([k, k]); });
    for (let j = 0; j + 1 < runs.length; j++) if (out[runs[j + 1][0]].s - out[runs[j][1]].s < 3) for (let k = runs[j][1] + 1; k < runs[j + 1][0]; k++) out[k][key] = true;
    const merged: [number, number][] = [];
    out.forEach((r, k) => { if (!r[key]) return; const last = merged[merged.length - 1]; if (last && last[1] === k - 1) last[1] = k; else merged.push([k, k]); });
    for (const [a, b] of merged) if (out[b].s - out[a].s < 1) for (let k = a; k <= b; k++) out[k][key] = false;
  }
  return out;
}

// ------------------------------------------------------------------ the builder

interface Level { tol: number; archSegs: number; postStep: number; lamps: number; midRail: boolean; ring: boolean; railings: boolean; inner: boolean; soffit: boolean; land: boolean }
const NEAR_LEVELS: Level[] = [
  { tol: 0.03, archSegs: 8, postStep: 1, lamps: 4, midRail: true, ring: true, railings: true, inner: true, soffit: true, land: true },
  { tol: 0.045, archSegs: 8, postStep: 1.5, lamps: 4, midRail: false, ring: true, railings: true, inner: true, soffit: true, land: true },
  { tol: 0.06, archSegs: 7, postStep: 2.5, lamps: 2, midRail: false, ring: true, railings: true, inner: true, soffit: true, land: true },
  { tol: 0.1, archSegs: 6, postStep: 5, lamps: 0, midRail: false, ring: true, railings: true, inner: true, soffit: true, land: true },
  { tol: 0.2, archSegs: 3, postStep: 1e9, lamps: 0, midRail: false, ring: false, railings: true, inner: true, soffit: true, land: false },
  // Last resort for a long or ragged footprint (a lock complex): the water faces, the parapet's outer face and one rail.
  { tol: 0.5, archSegs: 3, postStep: 1e9, lamps: 0, midRail: false, ring: false, railings: true, inner: false, soffit: false, land: false },
];
// The far ring (LOD 1, past ~350 m): the silhouette only. No railings, no walls over land (the relief hides most of them).
const FAR_LEVELS: Level[] = [
  { tol: 0.1, archSegs: 4, postStep: 1e9, lamps: 0, midRail: false, ring: false, railings: false, inner: false, soffit: true, land: true },
  { tol: 0.2, archSegs: 3, postStep: 1e9, lamps: 0, midRail: false, ring: false, railings: false, inner: false, soffit: true, land: false },
  { tol: 0.4, archSegs: 2, postStep: 1e9, lamps: 0, midRail: false, ring: false, railings: false, inner: false, soffit: false, land: false },
  { tol: 0.8, archSegs: 2, postStep: 1e9, lamps: 0, midRail: false, ring: false, railings: false, inner: false, soffit: false, land: false },
];

/** Base post spacing per kind, metres (scaled by the level). */
const POST_STEP: Record<BridgeKind, number> = { arch: 5, girder: 2.6, footbridge: 2.2, bascule: 3 };

/** Build one bridge's body, coarsening until it fits the budget. */
export function buildKit(raw: KitInput): { mesh: MeshArrays; info: KitInfo } {
  const input = { ...raw, rows: cleanWater(raw.rows, raw.spans) };
  const levels = input.lod === 0 ? NEAR_LEVELS : FAR_LEVELS, budget = input.budget ?? (input.lod === 0 ? KIT_BUDGET.near : KIT_BUDGET.far);
  let last: { mesh: MeshArrays; info: KitInfo } | null = null;
  for (let k = 0; k < levels.length; k++) {
    last = buildAt(input, levels[k], k);
    if (last.info.triangles <= budget) break;
  }
  return last!;
}

/** One level of the coarsening ladder (tests and the lane report). */
export function buildKitAtLevel(input: KitInput, level: number): { mesh: MeshArrays; info: KitInfo } {
  const levels = input.lod === 0 ? NEAR_LEVELS : FAR_LEVELS;
  return buildAt(input, levels[Math.min(level, levels.length - 1)], level);
}

interface Arch { s0: number; s1: number; spring: number; crown: number; R: number; mid: number }

/** Optional trace of each attempt (the census's --trace): stations and triangles per part. */
export const kitTrace: { fn: ((id: string, level: number, parts: Record<string, number>) => void) | null } = { fn: null };

function buildAt(input: KitInput, lv: Level, level: number): { mesh: MeshArrays; info: KitInfo } {
  const m = emptyMesh(true), { rows, kind, waterZ } = input;
  const info: KitInfo = { kind, triangles: 0, level, railingPosts: 0, piers: 0, arches: 0, abutments: 0, lamps: 0 };
  if (rows.length < 2) return { mesh: m, info };
  const C = KIT_COLOURS;
  const thickness = input.thickness ?? (kind === 'footbridge' ? 0.3 : input.material === 'steel' ? 0.5 : 0.55);
  const fascia: RGB = input.material === 'steel' ? C.steel : input.material === 'wood' ? C.wood : input.material === 'masonry' ? C.brick : C.concrete;

  // Arches (arch kind): one per span up to PIER_SPAN_M, three up to 60 m, five beyond; piers between.
  const arches: Arch[] = [], piers: number[] = [];
  const zAt = (s: number) => rowAt(rows, s).z;
  for (const [w0, w1] of input.spans) {
    const span = w1 - w0;
    if (span < 1.5) continue;
    if (kind === 'arch') {
      const nb = span <= PIER_SPAN_M ? 1 : span <= 60 ? 3 : 5;
      // The middle arch is the widest (the boat channel), the side arches smaller.
      const ratio = nb === 1 ? [1] : nb === 3 ? [1, 1.6, 1] : [0.8, 1, 1.3, 1, 0.8], total = ratio.reduce((a, b) => a + b, 0);
      const cut = ratio.map((_, j) => w0 + span * ratio.slice(0, j).reduce((a, b) => a + b, 0) / total).concat(w1);
      for (let j = 0; j < nb; j++) {
        const s0 = cut[j] + (j > 0 ? PIER_LEN / 2 : 0), s1 = cut[j + 1] - (j < nb - 1 ? PIER_LEN / 2 : 0);
        if (j > 0) piers.push(cut[j]);
        const half = (s1 - s0) / 2, mid = (s0 + s1) / 2;
        // Crown under the deck: the arch ring and the coping band fit between the intrados and the deck top.
        const crown = zAt(mid) - COPE_M - RING_M - 0.12;
        let spring = waterZ + 0.25, rise = crown - spring;
        if (rise < 0.4) continue; // too low for an arch: the face stays a wall over the water
        // Segmental arch; a rise over the half chord becomes a semicircle on raised springs.
        if (rise > half) { spring = crown - half; rise = half; }
        const R = (half * half + rise * rise) / (2 * rise);
        arches.push({ s0, s1, spring, crown, R, mid });
      }
    } else if (span > (kind === 'footbridge' ? 20 : PIER_SPAN_M)) { // a light footbridge spans a canal-belt canal in one
      const nb = Math.max(2, Math.min(7, Math.round(span / BAY_M)));
      for (let j = 1; j < nb; j++) piers.push(w0 + span * j / nb);
    }
  }
  info.arches = arches.length;
  const archOf = (s: number) => arches.find(a => s >= a.s0 - 1e-6 && s <= a.s1 + 1e-6) ?? null;
  // The vault never rises into the ring and coping under a deck that falls faster than the arch.
  const intrados = (a: Arch, s: number) => {
    const u = Math.max(-1, Math.min(1, (s - a.mid) / ((a.s1 - a.s0) / 2))) * (a.s1 - a.s0) / 2;
    return Math.max(a.spring, Math.min(a.crown - a.R + Math.sqrt(Math.max(0, a.R * a.R - u * u)), zAt(s) - COPE_M - RING_M - 0.05));
  };

  // Stations: the simplified spine, arch segments, pier and leaf edges, the parapet ends.
  // The parapet follows the spine alone; the faces also take the arch segments (fewer per arch on a multi-arch bridge).
  const extra: number[] = [input.parapet[0], input.parapet[1]];
  if (input.lod === 0) for (const [l0, l1] of input.leaves ?? []) extra.push(l0 - 0.05, l0 + 0.05, l1 - 0.05, l1 + 0.05);
  const spine = spineStations(rows, lv.tol, extra, input.lod === 0, input.lateralTol), segs = Math.max(2, Math.round(lv.archSegs * (arches.length > 1 ? 0.75 : 1)));
  const archSt: number[] = [];
  for (const a of arches) for (let j = 0; j <= segs; j++) archSt.push(a.s0 + (a.s1 - a.s0) * j / segs);
  // Inside an arch its own segments carry the face; a spine station there stays only where the deck edge leaves their chord by > 3 cm.
  const keepSpine = (s: number) => {
    const a = arches.find(x => s > x.s0 + 0.04 && s < x.s1 - 0.04);
    if (!a) return true;
    const j = Math.floor((s - a.s0) / ((a.s1 - a.s0) / segs)), s0 = a.s0 + (a.s1 - a.s0) * j / segs, s1 = a.s0 + (a.s1 - a.s0) * (j + 1) / segs, t = (s - s0) / (s1 - s0);
    const r = rowAt(rows, s), r0 = rowAt(rows, s0), r1 = rowAt(rows, s1);
    return Math.max(Math.abs(r.zL - (r0.zL + (r1.zL - r0.zL) * t)), Math.abs(r.zR - (r0.zR + (r1.zR - r0.zR) * t))) > 0.03;
  };
  const st = [...spine.filter(keepSpine), ...archSt].sort((a, b) => a - b).filter((s, k, all) => k === 0 || s - all[k - 1] > 0.04);
  const R = st.map(s => rowAt(rows, s));
  const inLeaf = (s: number) => (input.leaves ?? []).some(([l0, l1]) => s > l0 + 0.05 && s < l1 - 0.05);
  const inJoint = (s: number) => (input.leaves ?? []).some(([l0, l1]) => Math.abs(s - l0) < 0.051 || Math.abs(s - l1) < 0.051);

  // Side faces, left (+n) and right.
  for (let k = 0; k + 1 < R.length; k++) {
    const a = R[k], b = R[k + 1], mid = (a.s + b.s) / 2, arch = archOf(mid);
    for (const side of [1, -1] as const) {
      const pa = side > 0 ? a.L : a.R, pb = side > 0 ? b.L : b.R, za = side > 0 ? a.zL : a.zR, zb = side > 0 ? b.zL : b.zR;
      const wa = side > 0 ? a.wL : a.wR, wb = side > 0 ? b.wL : b.wR, ga = side > 0 ? a.gL : a.gR, gb = side > 0 ? b.gL : b.gR;
      const o = [(a.n[0] + b.n[0]) * side, (a.n[1] + b.n[1]) * side, 0];
      const wall = (z0a: number, z0b: number, z1a: number, z1b: number, col: RGB) => {
        if (z1a - z0a < 0.01 && z1b - z0b < 0.01) return;
        face(m, [[pa[0], pa[1], z1a], [pb[0], pb[1], z1b], [pb[0], pb[1], z0b], [pa[0], pa[1], z0a]], col, o);
      };
      const water = wa || wb;
      if (!water && !arch && !lv.land) continue;
      if (kind === 'arch') {
        // Brick to the extrados (in an arch), to the water (piers and abutments over water) or into the relief; a stone coping band on top.
        const bottom = (s: number, w: boolean, g: number, z: number) => arch ? Math.min(intrados(arch, s) + (lv.ring ? RING_M : 0), z - (lv.ring ? COPE_M : 0) - 0.05) : w ? waterZ - 0.3 : Math.min(g, z) - BURY;
        const ba = bottom(a.s, wa, ga, za), bb = bottom(b.s, wb, gb, zb);
        if (lv.ring) {
          // Under the parapet the stone coping (the parapet's proud outer face, parapet()) covers the top COPE_M.
          const cope = mid > input.parapet[0] && mid < input.parapet[1] ? COPE_M : 0;
          wall(ba, bb, za - cope, zb - cope, C.brick);
          if (arch) {
            const key = Math.abs(mid - arch.mid) < (arch.s1 - arch.s0) / (2 * segs) + 1e-6;
            wall(intrados(arch, a.s), intrados(arch, b.s), ba, bb, key ? C.keystone : C.stone);
          }
        } else wall(arch ? intrados(arch, a.s) : ba, arch ? intrados(arch, b.s) : bb, za, zb, C.brick);
      } else {
        const bottom = (w: boolean, g: number, z: number) => (w ? z - thickness : Math.min(g, z) - BURY);
        const col = inJoint(mid) ? C.joint : inLeaf(mid) ? input.colour ?? fascia : water ? fascia : C.brick;
        wall(bottom(wa, ga, za), bottom(wb, gb, zb), za, zb, col);
      }
    }
    // Underside over water: the vault in an arch, else the soffit (girder kinds).
    if (arch) {
      const ia = intrados(arch, a.s), ib = intrados(arch, b.s);
      if (lv.soffit) face(m, [[a.L[0], a.L[1], ia], [a.R[0], a.R[1], ia], [b.R[0], b.R[1], ib], [b.L[0], b.L[1], ib]], C.brickShade, [0, 0, -1]);
    } else if (kind !== 'arch' && lv.soffit && a.water && b.water) {
      const za = a.z - thickness, zb = b.z - thickness;
      face(m, [[a.L[0], a.L[1], za], [a.R[0], a.R[1], za], [b.R[0], b.R[1], zb], [b.L[0], b.L[1], zb]], inJoint(mid) ? C.joint : C.soffit, [0, 0, -1]);
    }
  }

  const tFaces = m.indices.length / 3;
  // Arch ends: the springing faces of the piers and abutments, across the width from the spring down past the water, facing the opening.
  for (const a of lv.ring ? arches : []) for (const [s, dir] of [[a.s0, 1], [a.s1, -1]] as const) {
    const r = rowAt(rows, s), u = [r.n[1] * dir, -r.n[0] * dir, 0];
    face(m, [[r.L[0], r.L[1], a.spring], [r.R[0], r.R[1], a.spring], [r.R[0], r.R[1], waterZ - 0.4], [r.L[0], r.L[1], waterZ - 0.4]], C.brick, u);
  }
  if (kind === 'arch') info.abutments = arches.length ? 2 : 0;
  if ((kind !== 'arch' || !arches.length) && lv.land) {
    // Abutments: at each land/water change along the axis (and a deck end still over water), a wall across the deck down past the water, facing it.
    const changes: { land: KitRow; toWater: 1 | -1 }[] = [];
    for (let k = 0; k + 1 < rows.length; k++) if (rows[k].water !== rows[k + 1].water) changes.push(rows[k].water ? { land: rows[k + 1], toWater: -1 } : { land: rows[k], toWater: 1 });
    if (rows[0].water) changes.push({ land: rows[0], toWater: 1 });
    if (rows[rows.length - 1].water) changes.push({ land: rows[rows.length - 1], toWater: -1 });
    for (const { land, toWater } of changes) {
      const u = [land.n[1] * toWater, -land.n[0] * toWater, 0], ext = 0.4, top = Math.min(land.zL, land.zR) - 0.05, bot = waterZ - 0.4;
      const A: Vec2 = [land.L[0] + land.n[0] * ext, land.L[1] + land.n[1] * ext], B: Vec2 = [land.R[0] - land.n[0] * ext, land.R[1] - land.n[1] * ext];
      face(m, [[A[0], A[1], top], [B[0], B[1], top], [B[0], B[1], bot], [A[0], A[1], bot]], C.brick, u);
      info.abutments++;
    }
  }
  // Girder piers between the bays (arch piers are the walls between the arches).
  for (const s of kind === 'arch' || !lv.land ? [] : piers) {
    const r = rowAt(rows, s), hw = Math.hypot(r.L[0] - r.c[0], r.L[1] - r.c[1]);
    box(m, r.c, [r.n[1], -r.n[0]], PIER_LEN / 2, hw + 0.2, waterZ - 0.5, r.z - thickness + 0.02, C.pier, false); // its top is under the soffit
  }
  info.piers = piers.length;

  const tEnds = m.indices.length / 3;
  // Parapet and railings over the deck span.
  if (lv.railings || lv.inner) parapet(m, input, lv, spine, info, fascia);
  info.triangles = m.indices.length / 3;
  kitTrace.fn?.(input.id, level, { stations: st.length, spine: spine.length, faces: tFaces, endsAndPiers: tEnds - tFaces, parapet: info.triangles - tEnds, posts: info.railingPosts });
  return { mesh: m, info };
}

/** Parapet (plinth, coping or edge upstand), posts, rails and lamps on both edges of the deck span. */
function parapet(m: MeshArrays, input: KitInput, lv: Level, st: readonly number[], info: KitInfo, fascia: RGB): void {
  const { rows, kind } = input, C = KIT_COLOURS;
  const [p0, p1] = [Math.max(rows[0].s, input.parapet[0]), Math.min(rows[rows.length - 1].s, input.parapet[1])];
  if (p1 - p0 < 1) return;
  // The parapet follows the deck edge's height alone (within the 3-4 cm its outer face reaches down over the face below); rails a little coarser.
  const ps = [p0, ...spineStations(rows, Math.min(lv.tol, 0.05), [], false, input.lateralTol).filter(s => s > p0 + 0.3 && s < p1 - 0.3), p1], P = ps.map(s => rowAt(rows, s));
  const railSpine = spineStations(rows, 0.06, [], false, input.lateralTol).filter(s => s > p0 + 0.3 && s < p1 - 0.3);
  const wood = input.material === 'wood';
  // A bascule's railing takes the bridge's colour (the Magere Brug's is white like its portals).
  const railColour = kind === 'bascule' && input.colour ? input.colour : wood ? C.woodRail : C.iron;
  const style = kind === 'arch'
    ? { plinth: 0.45, width: 0.34, plinthCol: C.stone, post: 0.15, postCol: C.stone, postTop: 1.12, railCol: C.iron, rail: RAILING.rail / 2 }
    : kind === 'footbridge'
      ? { plinth: 0, width: 0.1, plinthCol: C.steel, post: RAILING.post / 2, postCol: wood ? C.woodRail : C.iron, postTop: RAILING.height, railCol: wood ? C.woodRail : C.iron, rail: RAILING.rail / 2 }
      : { plinth: 0.14, width: RAILING.plinthWidth, plinthCol: fascia, post: RAILING.post / 2, postCol: railColour, postTop: RAILING.height, railCol: railColour, rail: RAILING.rail / 2 };
  for (const side of [1, -1] as const) {
    const edge = (r: KitRow) => (side > 0 ? r.L : r.R), zt = (r: KitRow) => (side > 0 ? r.zL : r.zR), out = (r: KitRow): Vec2 => [r.n[0] * side, r.n[1] * side];
    const inward = (r: KitRow, d: number): Vec2 => { const e = edge(r), o = out(r); return [e[0] - o[0] * d, e[1] - o[1] * d]; };
    // Plinth: outer face from the deck edge up, its top, its inner face toward the road (near ring); the far ring keeps the outer face.
    if (style.plinth > 0) for (let k = 0; k + 1 < P.length; k++) {
      const a = P[k], b = P[k + 1], o = [out(a)[0] + out(b)[0], out(a)[1] + out(b)[1], 0], h = style.plinth;
      // Arch bridges: the outer face is the stone coping, 3 cm proud of the brick face and COPE_M down it.
      const proud = kind === 'arch' ? 0.03 : 0, drop = (kind === 'arch' ? COPE_M : 0) + 0.06;
      const a0 = inward(a, -proud), b0 = inward(b, -proud), a1 = inward(a, style.width), b1 = inward(b, style.width), za = zt(a), zb = zt(b);
      face(m, [[a0[0], a0[1], za - drop], [b0[0], b0[1], zb - drop], [b0[0], b0[1], zb + h], [a0[0], a0[1], za + h]], style.plinthCol, o);
      if (!lv.inner) continue;
      face(m, [[a0[0], a0[1], za + h], [b0[0], b0[1], zb + h], [b1[0], b1[1], zb + h], [a1[0], a1[1], za + h]], style.plinthCol, [0, 0, 1]);
      face(m, [[a1[0], a1[1], za], [b1[0], b1[1], zb], [b1[0], b1[1], zb + h], [a1[0], a1[1], za + h]], style.plinthCol, [-o[0], -o[1], 0]);
    }
    if (!lv.railings) continue;
    // Posts at even spacing, rails straight from post to post.
    const len = p1 - p0, count = Math.max(1, Math.round(len / Math.min(len, POST_STEP[kind] * lv.postStep)));
    const posts: { c: Vec2; z: number; u: Vec2 }[] = [];
    for (let i = 0; i <= count; i++) {
      const r = rowAt(rows, p0 + len * i / count), o = out(r);
      const c = kind === 'footbridge' ? inward(r, -style.post) : inward(r, style.width / 2);
      posts.push({ c, z: zt(r), u: [o[1], -o[0]] });
      // Footbridge posts hang down the edge beam's face: deck and railing are one piece.
      const z0 = kind === 'footbridge' ? zt(r) - 0.25 : zt(r) + style.plinth - 0.02;
      if (kind === 'arch') box(m, c, [o[1], -o[0]], style.post, style.post, z0, zt(r) + style.postTop, style.postCol);
      else {
        // An iron or timber post is a flat bar facing the water and the road (4 triangles; its 7 cm edge and top are never seen).
        const u: Vec2 = [o[1], -o[0]], h = style.post, z1 = zt(r) + style.postTop;
        const a: Vec2 = [c[0] - u[0] * h, c[1] - u[1] * h], b: Vec2 = [c[0] + u[0] * h, c[1] + u[1] * h];
        face(m, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], style.postCol, [o[0], o[1], 0]);
        face(m, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], style.postCol, [-o[0], -o[1], 0]);
      }
      info.railingPosts++;
    }
    const levels = kind === 'arch' ? [RAILING.height - 0.08] : [RAILING.height, ...(lv.midRail || kind === 'footbridge' ? [0.55] : [])];
    // Rails follow the hump (knots where the edge leaves the chord by > 6 cm), passing the posts.
    const knots = [p0, ...railSpine, p1]
      .filter((s, k, all) => k === 0 || s - all[k - 1] > 0.3 || s === p1)
      .map(s => { const r = rowAt(rows, s); return { c: kind === 'footbridge' ? inward(r, -style.post) : inward(r, style.width / 2), z: zt(r) }; });
    for (let i = 0; i + 1 < knots.length; i++) for (const h of levels) {
      const a = knots[i], b = knots[i + 1];
      beam(m, [a.c[0], a.c[1], a.z + h], [b.c[0], b.c[1], b.z + h], h >= RAILING.height - 0.1 ? style.rail * 1.4 : style.rail, style.railCol, true);
    }
    // Lamp posts at the quarter points (arch kind): a pole on the plinth, a lantern and a cap.
    if (kind === 'arch' && lv.lamps && len >= 6) for (const f of lv.lamps >= 4 ? [0.25, 0.75] : [side > 0 ? 0.25 : 0.75]) {
      const r = rowAt(rows, p0 + len * f), o = out(r), c = inward(r, style.width / 2), z = zt(r) + style.plinth;
      box(m, c, [o[1], -o[0]], 0.07, 0.07, z, z + 3.3, C.lampPole, false);
      box(m, c, [o[1], -o[0]], 0.17, 0.17, z + 3.3, z + 3.75, C.lantern, false);
      const top: V3 = [c[0], c[1], z + 4.0], u: Vec2 = [o[1], -o[0]], v = o;
      const cn = (a: number, b: number): V3 => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, z + 3.75];
      const corners = [cn(0.22, 0.22), cn(-0.22, 0.22), cn(-0.22, -0.22), cn(0.22, -0.22)];
      for (let j = 0; j < 4; j++) {
        const p = corners[j], q = corners[(j + 1) % 4], n = [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1], 0.3];
        const i0 = vertex(m, p[0], p[1], p[2], C.lampPole), i1 = vertex(m, q[0], q[1], q[2], C.lampPole), i2 = vertex(m, top[0], top[1], top[2], C.lampPole);
        const e1 = [q[0] - p[0], q[1] - p[1], 0], e2 = [top[0] - p[0], top[1] - p[1], top[2] - p[2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) m.indices.push(i0, i1, i2); else m.indices.push(i0, i2, i1);
      }
      info.lamps++;
    }
  }
}

// ------------------------------------------------------------------ movable frames

/** Frame geometry of the movable-bridge unit, metres. */
export const FRAME = { postHeight: 6.2, post: 0.32, beamHeight: 0.38, maxLeaf: 9, doubleOver: 24, tipGap: 4 };

/** Leaves of a movable footprint along its axis (station range from `along[0]`): one, or two meeting over the middle past FRAME.doubleOver. */
export function basculeLeaves(along: readonly [number, number]): { leaves: [number, number][]; double: boolean; leaf: number; mid: number } {
  const length = along[1] - along[0], mid = (along[0] + along[1]) / 2, double = length > FRAME.doubleOver;
  const leaf = double ? Math.min(6, Math.max(3, length * 0.15)) : Math.min(FRAME.maxLeaf, Math.max(3, length * 0.45));
  return { double, leaf, mid, leaves: double ? [[mid - leaf, mid], [mid, mid + leaf]] : [[mid - leaf / 2, mid + leaf / 2]] };
}

/**
 * One portal unit of an Amsterdam ophaalbrug: two posts beside the deck at
 * the leaf's heel, a cross beam and knee braces, a balance beam (hamei) over
 * each post sloping down toward the leaf's tip, a counterweight box between
 * the raised back ends, pull rods from the beam tips to the leaf.
 * `P(a, b)` maps (along, across) to the scene; `dir` points over the leaf.
 */
export function basculeUnit(m: MeshArrays, P: (a: number, b: number) => Vec2, u: Vec2, at: number, dir: 1 | -1, reach: number, side: readonly [number, number], base: number, deckZ: (q: Vec2) => number, col: RGB, far = false): void {
  const H = FRAME.postHeight, Ph = FRAME.post / 2, Bh = FRAME.beamHeight / 2, dark = KIT_COLOURS.joint;
  const pivot = base + H + 0.1, slope = 0.1, back = 3.2;
  if (far) {
    // The far ring: posts and balance beams only (24 triangles a unit; a beam is its outer face and its top).
    for (const b of side) {
      const out = Math.sign(b - (side[0] + side[1]) / 2) * Bh, z0 = pivot + slope * back, z1 = pivot - slope * reach;
      const pb = P(at - dir * back, b + out), pt = P(at + dir * reach, b + out), ib = P(at - dir * back, b - out), it = P(at + dir * reach, b - out);
      box(m, P(at, b), u, Ph, Ph, base, base + H, col, false);
      const o = [pb[0] - ib[0], pb[1] - ib[1], 0];
      face(m, [[pb[0], pb[1], z0 - Bh], [pt[0], pt[1], z1 - Bh], [pt[0], pt[1], z1 + Bh], [pb[0], pb[1], z0 + Bh]], col, o);
      face(m, [[pb[0], pb[1], z0 + Bh], [pt[0], pt[1], z1 + Bh], [it[0], it[1], z1 + Bh], [ib[0], ib[1], z0 + Bh]], col, [0, 0, 1]);
    }
    return;
  }
  for (const b of side) {
    const q = P(at, b);
    box(m, q, u, Ph, Ph, base - 0.3, base + 0.6, dark);
    box(m, q, u, Ph * 0.85, Ph * 0.85, base + 0.6, base + H, col);
    const pb = P(at - dir * back, b), pt = P(at + dir * reach, b);
    beam(m, [pb[0], pb[1], pivot + slope * back], [pt[0], pt[1], pivot - slope * reach], Bh, col);
    const foot = deckZ(pt) + 0.15;
    beam(m, [pt[0], pt[1], pivot - slope * reach - Bh], [pt[0], pt[1], foot], 0.045, dark, true);
  }
  const pl = P(at, side[0]), pr = P(at, side[1]);
  beam(m, [pl[0], pl[1], base + H - 0.25], [pr[0], pr[1], base + H - 0.25], 0.18, col);
  // Knee braces under the cross beam.
  for (const [b, inward] of [[side[0], -1], [side[1], 1]] as const) {
    const lo = P(at, b), hi = P(at, b + inward * 1.1);
    beam(m, [lo[0], lo[1], base + H - 1.4], [hi[0], hi[1], base + H - 0.35], 0.07, col, true);
  }
  // The beams' front ends are joined (the head), the back ends carry the counterweight box (ballastkist).
  const tl = P(at + dir * reach, side[0]), tr = P(at + dir * reach, side[1]);
  beam(m, [tl[0], tl[1], pivot - slope * reach], [tr[0], tr[1], pivot - slope * reach], 0.1, col);
  const bc = P(at - dir * (back - 0.5), (side[0] + side[1]) / 2), across = Math.abs(side[0] - side[1]) / 2;
  box(m, bc, u, 0.5, across - 0.1, pivot + slope * back - 1.0, pivot + slope * back - Bh, col);
}

/** Bascule colour from the register: traditional timber ophaalbruggen (the Magere Brug) white, steel and concrete ones Amsterdam green. */
export const basculeColour = (hint: RegisterHint | null): RGB => (hint?.material === 'wood' ? KIT_COLOURS.white : KIT_COLOURS.green);

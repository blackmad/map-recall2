/**
 * Terrace kit (lane terraces-20261114): flat-shaded procedural furniture units, one mesh per model, drawn as one
 * instanced mesh each in the ride (engine/terraceLayer.ts). Non-indexed triangles with per-vertex linear colours, the
 * street-furniture convention (streetFurniture/models.ts): magenta SLOT faces take the instance colour (parasol canopy,
 * screen canvas).
 *
 * Local frame: metres, +x along the unit's long axis, +y across, +z up, origin on the ground at the unit centre.
 *
 * Units (priors from Amsterdam terraces, panorama-checked on the acceptance sheet; real kit sizes):
 *   set-brown       dark-stained square table 0.60 m with two bentwood chairs facing over it (brown café)
 *   set-bistro      round bistro table 0.60 m (teak top, black cast foot) with two rattan bistro chairs on cream
 *                   cushions (Leidseplein 2022-04 panorama TMX7316010203-002537_pano_0001_002579)
 *   set-restaurant  square table 0.80 m under a white cloth, four dark chairs
 *   set-modern      light-oak table 0.70 m with two black metal chairs (lunchroom, coffee, fast food)
 *   set-bar         high round table 1.08 m with two high stools
 *   set-wall        bench against the facade with a small table in front (strips under 1.3 m deep)
 *   parasol         market parasol, 2.7 m canopy, 2.45 m to the top; canopy is the SLOT colour
 *   planter         0.95 x 0.40 m box hedge, 0.85 m to the top of the green
 *   screen          1.5 m windbreak, 1.15 m high: canvas lower panel (SLOT), glass upper half drawn as its frame only
 * Each has a low-detail twin (`-lo`, a few boxes) for the far band of the draw radius.
 */
import { hexToRgb } from '../look/palette.js';

export const TERRACE_MODEL_IDS = ['set-brown', 'set-bistro', 'set-restaurant', 'set-modern', 'set-bar', 'set-wall', 'parasol', 'planter', 'screen'] as const;
export type TerraceModelId = typeof TERRACE_MODEL_IDS[number];
/** Per-model triangle cap (near detail); the low twins stay under TERRACE_LO_TRI_CAP. */
export const TERRACE_TRI_CAP = 160;
export const TERRACE_LO_TRI_CAP = 50;
export const SLOT = '#ff00ff';

/** Canopy / canvas colours by index (sRGB hex): cream, white, bottle green, burgundy, navy, sand, black, Heineken green. */
export const TERRACE_COLOURS = ['#efe8d8', '#f6f5f1', '#2f4d3a', '#76232a', '#22304a', '#cbb58c', '#222222', '#1f6b3a'] as const;

/** Palette (sRGB). Brown café tones match the retail-ground lane's brown bar (frame #3a2519, dark #2b1a12). */
export const TERRACE_TONES = {
  brownWood: '#3a2519', brownDark: '#2b1a12', brownSeat: '#5a3b26',
  bistroTop: '#9a6a3f', castIron: '#1d1d1d', rattan: '#b38b57', cushion: '#e4dbc6',
  cloth: '#f2efe8', clothShade: '#dcd8cf', restChair: '#3b3b3b',
  oak: '#c19a6b', metalChair: '#262626',
  barTop: '#2d2d2d', stool: '#6e4f33',
  bench: '#4b3424', pole: '#d9d4c8', poleDark: '#4a4a4a', base: '#3a3a3a',
  planterBox: '#3d3d3b', hedge: '#4c6b34', screenFrame: '#2a2a2a', glass: '#9fb2b8',
} as const;

const srgbToLinear = (c: number): number => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
export const linearOf = (hex: string): [number, number, number] => hexToRgb(hex).map(v => srgbToLinear(v / 255)) as [number, number, number];

export type TerraceMesh = { id: string; positions: Float32Array; colours: Float32Array; triangles: number; heightM: number; radiusM: number };
type V = [number, number, number];

class Builder {
  readonly p: number[] = []; readonly c: number[] = [];
  tri(a: V, b: V, d: V, hex: string): void { const col = linearOf(hex); for (const v of [a, b, d]) { this.p.push(...v); this.c.push(...col); } }
  quad(a: V, b: V, d: V, e: V, hex: string): void { this.tri(a, b, d, hex); this.tri(a, d, e, hex); }
  quad2(a: V, b: V, d: V, e: V, hex: string): void { this.quad(a, b, d, e, hex); this.quad(a, e, d, b, hex); }
  /** Axis-aligned box: sides always, top unless `top` false, bottom when `bottom`. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string, top = true, bottom = false, topHex = hex): void {
    const P = (x: number, y: number, z: number): V => [x, y, z];
    if (top) this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), topHex);
    if (bottom) this.quad(P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), hex);
    this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), hex);
    this.quad(P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), hex);
    this.quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), hex);
    this.quad(P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), hex);
  }
  /** n-sided frustum about a vertical axis; top cap (fan) optional, bottom cap optional. */
  prism(cx: number, cy: number, z0: number, z1: number, r0: number, r1: number, n: number, hex: string, top = true, bottom = false, topHex = hex): void {
    const ring = (r: number, z: number) => Array.from({ length: n }, (_, i): V => [cx + r * Math.cos((i + 0.5) * 2 * Math.PI / n), cy + r * Math.sin((i + 0.5) * 2 * Math.PI / n), z]);
    const a = ring(r0, z0), b = ring(r1, z1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (r1 > 1e-6) this.quad(a[i], a[j], b[j], b[i], hex); else this.tri(a[i], a[j], b[i], hex); }
    if (top && r1 > 1e-6) for (let i = 1; i < n - 1; i++) this.tri(b[0], b[i], b[i + 1], topHex);
    if (bottom) for (let i = 1; i < n - 1; i++) this.tri(a[0], a[i + 1], a[i], hex);
  }
  done(id: string): TerraceMesh {
    let h = 0, r = 0;
    for (let i = 0; i < this.p.length; i += 3) { h = Math.max(h, this.p[i + 2]); r = Math.max(r, Math.hypot(this.p[i], this.p[i + 1])); }
    return { id, positions: Float32Array.from(this.p), colours: Float32Array.from(this.c), triangles: this.p.length / 9, heightM: h, radiusM: r };
  }
}

/** Facing: the direction the sitter looks, one of the four axes. */
type Facing = '+x' | '-x' | '+y' | '-y';
interface ChairLook { seat: string; frame: string; seatH?: number; backH?: number; w?: number; legs?: 'plates' | 'post' }

/**
 * A chair centred at (cx, cy) whose sitter faces `facing`: seat slab, back panel behind the sitter, two side leg plates
 * (36 triangles), or one post for a stool (no back when backH is 0).
 */
function chair(b: Builder, cx: number, cy: number, facing: Facing, look: ChairLook): void {
  const w = look.w ?? 0.42, h = w / 2, sz = look.seatH ?? 0.45, bz = look.backH ?? 0.85, t = 0.04;
  // Work in the chair's frame (u forward, v left) then map to x/y.
  const map = (u: number, v: number): [number, number] => {
    switch (facing) { case '+x': return [cx + u, cy + v]; case '-x': return [cx - u, cy - v]; case '+y': return [cx - v, cy + u]; default: return [cx + v, cy - u]; }
  };
  const boxUV = (u0: number, v0: number, z0: number, u1: number, v1: number, z1: number, hex: string, top = true) => {
    const [xa, ya] = map(u0, v0), [xb, yb] = map(u1, v1);
    b.box(Math.min(xa, xb), Math.min(ya, yb), z0, Math.max(xa, xb), Math.max(ya, yb), z1, hex, top);
  };
  boxUV(-h, -h, sz - 0.04, h, h, sz, look.frame, true);
  // the seat top in the seat colour, a hair over the frame (skipped when they are one colour)
  if (look.seat !== look.frame) { const [xa, ya] = map(-h + 0.02, -h + 0.02), [xb, yb] = map(h - 0.02, h - 0.02); b.quad([Math.min(xa, xb), Math.min(ya, yb), sz + 0.005], [Math.max(xa, xb), Math.min(ya, yb), sz + 0.005], [Math.max(xa, xb), Math.max(ya, yb), sz + 0.005], [Math.min(xa, xb), Math.max(ya, yb), sz + 0.005], look.seat); }
  if (bz > sz) boxUV(-h, -h, sz, -h + t, h, bz, look.seat, true);
  if (look.legs === 'post') { const [px, py] = map(0, 0); b.prism(px, py, 0, sz - 0.04, 0.03, 0.03, 4, look.frame, false); b.prism(px, py, 0, 0.02, 0.18, 0.18, 6, look.frame, true); }
  else { boxUV(-h, -h, 0, h, -h + 0.03, sz - 0.04, look.frame, false); boxUV(-h, h - 0.03, 0, h, h, sz - 0.04, look.frame, false); }
}

function roundTable(b: Builder, top: string, foot: string, r = 0.3, z = 0.74, n = 8): void {
  b.prism(0, 0, z - 0.03, z, r, r, n, top, true);
  b.prism(0, 0, 0.02, z - 0.03, 0.03, 0.03, 4, foot, false);
  b.prism(0, 0, 0, 0.03, 0.22, 0.2, 4, foot, true);
}

export const TERRACE_MODELS: Readonly<Record<TerraceModelId, () => TerraceMesh>> = {
  'set-brown': () => {
    const b = new Builder(), T = TERRACE_TONES;
    b.box(-0.3, -0.3, 0.71, 0.3, 0.3, 0.75, T.brownWood);
    for (const [x, y] of [[-0.26, -0.26], [0.22, -0.26], [-0.26, 0.22], [0.22, 0.22]] as const) b.box(x, y, 0, x + 0.04, y + 0.04, 0.71, T.brownDark, false);
    chair(b, -0.55, 0, '+x', { seat: T.brownSeat, frame: T.brownDark });
    chair(b, 0.55, 0, '-x', { seat: T.brownSeat, frame: T.brownDark });
    return b.done('set-brown');
  },
  'set-bistro': () => {
    const b = new Builder(), T = TERRACE_TONES;
    roundTable(b, T.bistroTop, T.castIron);
    chair(b, -0.55, 0, '+x', { seat: T.cushion, frame: T.rattan, backH: 0.88 });
    chair(b, 0.55, 0, '-x', { seat: T.cushion, frame: T.rattan, backH: 0.88 });
    return b.done('set-bistro');
  },
  'set-restaurant': () => {
    const b = new Builder(), T = TERRACE_TONES;
    b.box(-0.4, -0.4, 0.5, 0.4, 0.4, 0.76, T.clothShade, true, false, T.cloth);
    chair(b, -0.62, 0, '+x', { seat: T.restChair, frame: T.restChair });
    chair(b, 0.62, 0, '-x', { seat: T.restChair, frame: T.restChair });
    chair(b, 0, -0.62, '+y', { seat: T.restChair, frame: T.restChair });
    chair(b, 0, 0.62, '-y', { seat: T.restChair, frame: T.restChair });
    return b.done('set-restaurant');
  },
  'set-modern': () => {
    const b = new Builder(), T = TERRACE_TONES;
    b.box(-0.35, -0.35, 0.71, 0.35, 0.35, 0.75, T.oak);
    for (const [x, y] of [[-0.32, -0.32], [0.29, -0.32], [-0.32, 0.29], [0.29, 0.29]] as const) b.box(x, y, 0, x + 0.03, y + 0.03, 0.71, T.metalChair, false);
    chair(b, -0.6, 0, '+x', { seat: T.metalChair, frame: T.metalChair, backH: 0.8 });
    chair(b, 0.6, 0, '-x', { seat: T.metalChair, frame: T.metalChair, backH: 0.8 });
    return b.done('set-modern');
  },
  'set-bar': () => {
    const b = new Builder(), T = TERRACE_TONES;
    roundTable(b, T.barTop, T.castIron, 0.32, 1.08);
    chair(b, -0.5, 0, '+x', { seat: T.stool, frame: T.castIron, seatH: 0.76, backH: 0, w: 0.36, legs: 'post' });
    chair(b, 0.5, 0, '-x', { seat: T.stool, frame: T.castIron, seatH: 0.76, backH: 0, w: 0.36, legs: 'post' });
    return b.done('set-bar');
  },
  'set-wall': () => {
    // Bench along the facade (at -y), its back against the wall; a small table in front.
    const b = new Builder(), T = TERRACE_TONES;
    b.box(-0.7, -0.3, 0.42, 0.7, 0.08, 0.46, T.bench);
    b.box(-0.7, -0.3, 0.46, 0.7, -0.26, 0.82, T.bench);
    b.box(-0.68, -0.26, 0, -0.64, 0.06, 0.42, T.brownDark, false); b.box(0.64, -0.26, 0, 0.68, 0.06, 0.42, T.brownDark, false);
    b.box(-0.25, 0.14, 0.7, 0.25, 0.44, 0.74, T.brownWood);
    b.box(-0.02, 0.27, 0, 0.02, 0.31, 0.7, T.castIron, false);
    return b.done('set-wall');
  },
  parasol: () => {
    const b = new Builder(), T = TERRACE_TONES, R = 1.35;
    b.box(-0.25, -0.25, 0, 0.25, 0.25, 0.08, T.base);
    b.prism(0, 0, 0.08, 2.2, 0.025, 0.025, 4, T.pole, false);
    // Canopy: an 8-sided cone from the rim (2.05 m) to the crown (2.45 m), both windings, and a short valance.
    b.prism(0, 0, 2.05, 2.45, R, 0, 8, SLOT, false);
    b.prism(0, 0, 2.45, 2.05, 0, R, 8, SLOT, false);
    b.prism(0, 0, 1.93, 2.05, R, R, 8, SLOT, false);
    return b.done('parasol');
  },
  planter: () => {
    const b = new Builder(), T = TERRACE_TONES;
    b.box(-0.475, -0.2, 0, 0.475, 0.2, 0.45, T.planterBox, true);
    b.box(-0.44, -0.17, 0.45, 0.44, 0.17, 0.85, T.hedge);
    return b.done('planter');
  },
  screen: () => {
    const b = new Builder(), T = TERRACE_TONES;
    b.box(-0.75, -0.03, 0, -0.71, 0.03, 1.15, T.screenFrame, true); b.box(0.71, -0.03, 0, 0.75, 0.03, 1.15, T.screenFrame, true);
    b.box(-0.71, -0.02, 0.05, 0.71, 0.02, 0.62, SLOT, true);
    b.box(-0.71, -0.02, 1.11, 0.71, 0.02, 1.15, T.screenFrame, true);
    b.quad2([-0.71, 0, 0.62], [0.71, 0, 0.62], [0.71, 0, 1.11], [-0.71, 0, 1.11], T.glass);
    b.box(-0.8, -0.18, 0, -0.66, 0.18, 0.04, T.screenFrame); b.box(0.66, -0.18, 0, 0.8, 0.18, 0.04, T.screenFrame);
    return b.done('screen');
  },
};

/** The far-band twins: the same footprint and colours in a few boxes. */
export const TERRACE_LO_MODELS: Readonly<Record<TerraceModelId, () => TerraceMesh>> = {
  'set-brown': () => loSet('set-brown', TERRACE_TONES.brownWood, TERRACE_TONES.brownSeat, 0.3, 0.75, 0.55, 2),
  'set-bistro': () => loSet('set-bistro', TERRACE_TONES.bistroTop, TERRACE_TONES.rattan, 0.3, 0.74, 0.55, 2),
  'set-restaurant': () => loSet('set-restaurant', TERRACE_TONES.cloth, TERRACE_TONES.restChair, 0.4, 0.76, 0.62, 4),
  'set-modern': () => loSet('set-modern', TERRACE_TONES.oak, TERRACE_TONES.metalChair, 0.35, 0.75, 0.6, 2),
  'set-bar': () => loSet('set-bar', TERRACE_TONES.barTop, TERRACE_TONES.stool, 0.3, 1.08, 0.5, 2),
  'set-wall': () => { const b = new Builder(); b.box(-0.7, -0.3, 0, 0.7, 0.08, 0.82, TERRACE_TONES.bench); b.box(-0.25, 0.14, 0, 0.25, 0.44, 0.74, TERRACE_TONES.brownWood); return b.done('set-wall-lo'); },
  parasol: () => { const b = new Builder(); b.prism(0, 0, 0, 2.05, 0.03, 0.03, 3, TERRACE_TONES.pole, false); b.prism(0, 0, 2.05, 2.45, 1.35, 0, 6, SLOT, false); b.prism(0, 0, 2.45, 2.05, 0, 1.35, 6, SLOT, false); return b.done('parasol-lo'); },
  planter: () => { const b = new Builder(); b.box(-0.475, -0.2, 0, 0.475, 0.2, 0.85, TERRACE_TONES.hedge); return b.done('planter-lo'); },
  screen: () => { const b = new Builder(); b.box(-0.75, -0.03, 0, 0.75, 0.03, 0.62, SLOT); b.box(-0.75, -0.03, 1.1, 0.75, 0.03, 1.15, TERRACE_TONES.screenFrame); return b.done('screen-lo'); },
};
function loSet(id: string, table: string, seat: string, r: number, z: number, off: number, n: 2 | 4): TerraceMesh {
  const b = new Builder();
  b.box(-r, -r, 0, r, r, z, table);
  const at: [number, number][] = n === 4 ? [[-off, 0], [off, 0], [0, -off], [0, off]] : [[-off, 0], [off, 0]];
  for (const [x, y] of at) b.box(x - 0.2, y - 0.2, 0, x + 0.2, y + 0.2, 0.6, seat);
  return b.done(`${id}-lo`);
}

const cache = new Map<string, TerraceMesh>();
export function terraceModel(id: TerraceModelId, lo = false): TerraceMesh {
  const key = lo ? `${id}-lo` : id;
  let m = cache.get(key);
  if (!m) cache.set(key, m = (lo ? TERRACE_LO_MODELS : TERRACE_MODELS)[id]());
  return m;
}

/** Placement sizes per set: half extents along/across the unit and the grid pitch (metres). */
export interface UnitSize { halfX: number; halfY: number; pitchX: number; pitchY: number }
export const UNIT_SIZE: Readonly<Record<'set-brown' | 'set-bistro' | 'set-restaurant' | 'set-modern' | 'set-bar' | 'set-wall', UnitSize>> = {
  'set-brown': { halfX: 0.76, halfY: 0.32, pitchX: 1.7, pitchY: 1.5 },
  'set-bistro': { halfX: 0.76, halfY: 0.32, pitchX: 1.7, pitchY: 1.4 },
  'set-restaurant': { halfX: 0.83, halfY: 0.83, pitchX: 2.1, pitchY: 2.1 },
  'set-modern': { halfX: 0.81, halfY: 0.36, pitchX: 1.8, pitchY: 1.5 },
  'set-bar': { halfX: 0.68, halfY: 0.32, pitchX: 1.6, pitchY: 1.4 },
  'set-wall': { halfX: 0.7, halfY: 0.3, pitchX: 1.8, pitchY: 1.0 },
};

/**
 * Street-furniture models (lane #170, 2026-11-01): flat-shaded procedural meshes, one per kind, measured from
 * Gemeente Amsterdam panoramas (scripts/street-furniture/measure.ts; crops in staging/street-furniture/measure-*.jpg).
 * Every model is non-indexed triangles with per-vertex colours from look/palette.ts STREET_FURNITURE_TONES, so every
 * kind shares one material (vertex colours) and the ride draws one instanced mesh per kind.
 *
 * Local frame: metres, +x along the kerb, +y the object's front (the container's insert, the abri's open side, the
 * lamp's arm), +z up, origin on the ground at the registered point. The magenta SLOT colour marks faces the ride paints
 * with the instance colour (the container's fraction lid, the column's poster): `isSlot` / the shader in
 * street-furniture-source.js.
 *
 * Measurements (panorama, distance; heights calibrated against the rig's implied camera height 2.0-2.5 m):
 *   container column 1.22 m high (1.25 rest 102570, 1.07->1.19 papier 121395), faces 0.66 x 0.76 m (seen 0.45-0.56
 *     at ~45 deg), floor plate 1.45 m square (diagonals 2.06 / 1.91 m), lift handle 0.30 m;
 *   canal lantern 4.09 m to the finial, lantern 0.70 x 0.45 m, its bottom at 3.16 m, shaft 0.11 m (332362);
 *   hooked pole 7.6 m to the curl (residential, Pijp 3976ec), arm reach 1.0 m, bowl 0.36 m;
 *   abri 2.47 m high, 4.11 m long (two bays), ad panel 1.27 x 1.78 m (1a551a; the JCDecaux mupi is 1.20 x 1.76);
 *   litter bin by that abri 1.11 x 0.57 m;
 *   reclamezuil 4.6-4.8 m to the finial, body 1.9-2.0 m across (6f6d95, 36dae2; cornice band 0.87 m with the roof).
 * Priors (no measurement): abri depth 1.4 m; bike hoop 0.75 x 0.70 m, five hoops 0.9 m apart per BGT rack point;
 * container column depth placement 0.15 m behind the plate centre.
 */
import { STREET_FURNITURE_TONES as T, hexToRgb } from '../look/palette.js';

export type FurnitureModelId = 'container' | 'lamp-lantern' | 'lamp-pole' | 'bin' | 'bike-rack' | 'abri' | 'ad-column';
export const FURNITURE_MODEL_IDS: readonly FurnitureModelId[] = ['container', 'lamp-lantern', 'lamp-pole', 'bin', 'bike-rack', 'abri', 'ad-column'];
/** Per-model triangle cap (the brief's budget). */
export const FURNITURE_TRI_CAP = 120;
/** Faces in this colour take the instance colour. */
export const SLOT = '#ff00ff';

export type FurnitureMesh = { id: FurnitureModelId; positions: Float32Array; colours: Float32Array; triangles: number; heightM: number };

export const DIMENSIONS = {
  container: { plate: 1.45, plateH: 0.04, colW: 0.66, colD: 0.76, colH: 1.22, chamferH: 0.32, chamferD: 0.28, handleH: 0.30, colBack: 0.15 },
  lantern: { height: 4.09, baseR: 0.13, baseH: 0.55, shaftR: 0.055, lanternBottom: 3.16, lanternH: 0.45, lanternBot: 0.30, lanternTop: 0.42, roofW: 0.50, roofH: 0.18, finialH: 0.10 },
  pole: { height: 7.6, baseR: 0.11, topR: 0.06, reach: 1.0, bowlR: 0.18, bowlH: 0.16 },
  abri: { length: 4.11, depth: 1.4, height: 2.47, post: 0.08, roofT: 0.10, panelW: 1.27, panelH: 1.78, panelT: 0.14, panelBase: 0.35 },
  bin: { height: 1.05, radius: 0.27 },
  hoop: { height: 0.75, width: 0.70, tube: 0.05 },
  column: { radius: 0.92, baseR: 0.98, baseH: 0.30, bodyH: 3.40, corniceR: 1.0, corniceH: 0.22, roofH: 0.72, finialH: 0.16 },
} as const;

/** Lamp-pole height by the road it lights (prior; the hooked pole measured 7.6 m on a residential Pijp street). */
export const LAMP_HEIGHT_BY_ROAD: Readonly<Record<string, number>> = {
  trunk: 10, primary: 10, primary_link: 9, secondary: 9, secondary_link: 8.5, tertiary: 8, tertiary_link: 8, busway: 8,
  unclassified: 7.6, residential: 7.6, living_street: 6, service: 6, pedestrian: 6, cycleway: 5, footway: 5, path: 5, track: 5,
};
export const lampHeight = (road: string | undefined): number => LAMP_HEIGHT_BY_ROAD[road ?? ''] ?? 7.6;

const srgbToLinear = (c: number): number => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
/** Linear RGB 0-1 of an sRGB hex (three.js vertex colours are linear). SLOT stays exactly (1, 0, 1). */
export const linearOf = (hex: string): [number, number, number] => hexToRgb(hex).map(v => srgbToLinear(v / 255)) as [number, number, number];
export const isSlot = (r: number, g: number, b: number): boolean => r > 0.98 && g < 0.02 && b > 0.98;

type V = [number, number, number];
class Builder {
  readonly p: number[] = []; readonly c: number[] = [];
  tri(a: V, b: V, d: V, hex: string): void { const col = linearOf(hex); for (const v of [a, b, d]) { this.p.push(...v); this.c.push(...col); } }
  quad(a: V, b: V, d: V, e: V, hex: string): void { this.tri(a, b, d, hex); this.tri(a, d, e, hex); }
  /** Both windings (thin panels seen from either side). */
  quad2(a: V, b: V, d: V, e: V, hex: string): void { this.quad(a, b, d, e, hex); this.quad(a, e, d, b, hex); }
  /** Axis-aligned box; `bottom` false drops the base (it stands on the ground). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: string, bottom = false, top = true): void {
    const P = (x: number, y: number, z: number): V => [x, y, z];
    if (top) this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), hex);
    if (bottom) this.quad(P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), hex);
    this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), hex);
    this.quad(P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), hex);
    this.quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), hex);
    this.quad(P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), hex);
  }
  /** n-sided frustum about a vertical axis at (cx, cy); caps optional. */
  prism(cx: number, cy: number, z0: number, z1: number, r0: number, r1: number, n: number, hex: string, top = true, bottom = false, topHex = hex): void {
    const ring = (r: number, z: number) => Array.from({ length: n }, (_, i): V => [cx + r * Math.cos((i + 0.5) * 2 * Math.PI / n), cy + r * Math.sin((i + 0.5) * 2 * Math.PI / n), z]);
    const a = ring(r0, z0), b = ring(r1, z1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (r1 > 1e-6) this.quad(a[i], a[j], b[j], b[i], hex); else this.tri(a[i], a[j], b[i], hex); }
    if (top && r1 > 1e-6) for (let i = 1; i < n - 1; i++) this.tri(b[0], b[i], b[i + 1], topHex);
    if (bottom) for (let i = 1; i < n - 1; i++) this.tri(a[0], a[i + 1], a[i], hex);
  }
  /** A square tube between two points (no end caps), side `w`. */
  tube(a: V, b: V, w: number, hex: string): void {
    const d: V = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d) || 1, t: V = [d[0] / len, d[1] / len, d[2] / len];
    const ref: V = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const cr = (u: V, v: V): V => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const n1 = cr(t, ref), l1 = Math.hypot(...n1), u: V = [n1[0] / l1 * w / 2, n1[1] / l1 * w / 2, n1[2] / l1 * w / 2], v = cr(t, u);
    const corner = (p: V, s: number, q: number): V => [p[0] + s * u[0] + q * v[0], p[1] + s * u[1] + q * v[1], p[2] + s * u[2] + q * v[2]];
    const sq: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let i = 0; i < 4; i++) { const [s0, q0] = sq[i], [s1, q1] = sq[(i + 1) % 4]; this.quad(corner(a, s0, q0), corner(a, s1, q1), corner(b, s1, q1), corner(b, s0, q0), hex); }
  }
  done(id: FurnitureModelId): FurnitureMesh {
    let h = 0; for (let i = 2; i < this.p.length; i += 3) h = Math.max(h, this.p[i]);
    return { id, positions: Float32Array.from(this.p), colours: Float32Array.from(this.c), triangles: this.p.length / 9, heightM: h };
  }
}

/** Underground container top: floor plate, NCS-grey column with a sloped front, the fraction lid (SLOT), drum, lift handle. */
export function containerModel(): FurnitureMesh {
  const D = DIMENSIONS.container, b = new Builder();
  const h = D.plate / 2, pz = D.plateH;
  b.box(-h, -h, 0, h, h, pz, T.containerPlate);
  const x0 = -D.colW / 2, x1 = D.colW / 2, yb = -D.colD / 2 - D.colBack, yf = D.colD / 2 - D.colBack, top = pz + D.colH, ch = top - D.chamferH, yc = yf - D.chamferD;
  // Side profile (y, z): back-bottom, front-bottom, front-chamfer start, top-front, top-back.
  const prof: [number, number][] = [[yb, pz], [yf, pz], [yf, ch], [yc, top], [yb, top]];
  for (const [x, flip] of [[x0, true], [x1, false]] as const) {
    const pts = prof.map(([y, z]): V => [x, y, z]);
    for (let i = 1; i < pts.length - 1; i++) flip ? b.tri(pts[0], pts[i], pts[i + 1], T.containerBody) : b.tri(pts[0], pts[i + 1], pts[i], T.containerBody);
  }
  // Faces round the profile: front, chamfer (the lid), top, back.
  b.quad([x1, yf, pz], [x0, yf, pz], [x0, yf, ch], [x1, yf, ch], T.containerBody);
  b.quad([x1, yf, ch], [x0, yf, ch], [x0, yc, top], [x1, yc, top], SLOT);
  b.quad([x1, yc, top], [x0, yc, top], [x0, yb, top], [x1, yb, top], T.containerBody);
  b.quad([x0, yb, pz], [x1, yb, pz], [x1, yb, top], [x0, yb, top], T.containerBody);
  // Insert: the stainless drum face on the front, a dark slot across it.
  const e = 0.006, dz0 = pz + 0.55, dz1 = ch - 0.04;
  b.quad([x1 - 0.08, yf + e, dz0], [x0 + 0.08, yf + e, dz0], [x0 + 0.08, yf + e, dz1], [x1 - 0.08, yf + e, dz1], T.containerDrum);
  b.quad([x1 - 0.12, yf + 2 * e, dz0 + 0.10], [x0 + 0.12, yf + 2 * e, dz0 + 0.10], [x0 + 0.12, yf + 2 * e, dz0 + 0.20], [x1 - 0.12, yf + 2 * e, dz0 + 0.20], T.containerSlot);
  // Lift handle ("mushroom") on the flat top.
  const hy = (yb + yc) / 2;
  b.prism(0, hy, top, top + D.handleH - 0.06, 0.035, 0.035, 4, T.containerDrum, false);
  b.prism(0, hy, top + D.handleH - 0.06, top + D.handleH, 0.09, 0.07, 6, T.containerDrum, true);
  return b.done('container');
}

/** The canal lantern: maroon cast-iron post on a fluted base, a four-sided lantern that widens upward, roof and finial. */
export function lanternModel(): FurnitureMesh {
  const D = DIMENSIONS.lantern, b = new Builder();
  b.prism(0, 0, 0, D.baseH, D.baseR, D.baseR * 0.7, 6, T.lanternPost, false);
  b.prism(0, 0, D.baseH, D.lanternBottom - 0.12, D.shaftR, D.shaftR * 0.85, 6, T.lanternPost, false);
  b.prism(0, 0, D.lanternBottom - 0.12, D.lanternBottom, D.shaftR, D.lanternBot * 0.45, 4, T.lanternPost, false);
  // Ladder rest: the cross-bar under the lantern.
  b.tube([-0.26, 0, D.lanternBottom - 0.24], [0.26, 0, D.lanternBottom - 0.24], 0.035, T.lanternPost);
  const z0 = D.lanternBottom, z1 = z0 + D.lanternH;
  b.prism(0, 0, z0, z1, D.lanternBot / Math.SQRT2, D.lanternTop / Math.SQRT2, 4, T.lanternGlass, false, true);
  b.prism(0, 0, z1, z1 + 0.03, D.roofW / Math.SQRT2, D.roofW / Math.SQRT2, 4, T.lanternRoof, false, true);
  b.prism(0, 0, z1 + 0.03, z1 + 0.03 + D.roofH, D.roofW / Math.SQRT2, 0.04, 4, T.lanternRoof, true);
  b.prism(0, 0, z1 + 0.03 + D.roofH, D.height, 0.04, 0, 4, T.lanternRoof, false);
  return b.done('lamp-lantern');
}

/** Light-grey pole with a hooked arm and a hanging bowl (scaled per instance by `lampHeight`). */
export function poleModel(): FurnitureMesh {
  const D = DIMENSIONS.pole, b = new Builder(), H = D.height;
  b.prism(0, 0, 0, 0.9, D.baseR * 1.35, D.baseR, 6, T.pole, false);
  b.prism(0, 0, 0.9, H - 0.55, D.baseR, D.topR, 6, T.pole, false);
  // The hook: up and over toward +y, then down to the bowl.
  const arc: V[] = [];
  for (let i = 0; i <= 5; i++) { const a = Math.PI * i / 5; arc.push([0, D.reach / 2 - Math.cos(a) * D.reach / 2, H - 0.55 + Math.sin(a) * 0.55]); }
  for (let i = 1; i < arc.length; i++) b.tube(arc[i - 1], arc[i], 0.07, T.pole);
  const by = D.reach, bz = H - 0.55;
  b.tube([0, by, bz], [0, by, bz - 0.25], 0.05, T.pole);
  b.prism(0, by, bz - 0.25 - D.bowlH, bz - 0.25, D.bowlR, 0.06, 6, T.luminaire, true, true);
  return b.done('lamp-pole');
}

/** The grey Amsterdam litter bin: an octagonal drum with a darker domed lid and a slot (no open register places it). */
export function binModel(): FurnitureMesh {
  const D = DIMENSIONS.bin, b = new Builder();
  b.prism(0, 0, 0, D.height - 0.18, D.radius, D.radius, 8, T.bin, false);
  b.prism(0, 0, D.height - 0.18, D.height - 0.06, D.radius * 1.03, D.radius * 0.9, 8, T.binLid, false);
  b.prism(0, 0, D.height - 0.06, D.height, D.radius * 0.9, D.radius * 0.45, 8, T.binLid, true);
  b.quad([0.12, D.radius + 0.01, D.height - 0.14], [-0.12, D.radius + 0.01, D.height - 0.14], [-0.12, D.radius + 0.01, D.height - 0.08], [0.12, D.radius + 0.01, D.height - 0.08], T.containerSlot);
  return b.done('bin');
}

/** One "nietje" hoop (a rack point draws a row of them along the kerb). */
export function hoopModel(): FurnitureMesh {
  const D = DIMENSIONS.hoop, b = new Builder(), w = D.width / 2, r = 0.12, h = D.height;
  const pts: V[] = [[0, -w, 0], [0, -w, h - r], [0, -w + r, h], [0, w - r, h], [0, w, h - r], [0, w, 0]];
  for (let i = 1; i < pts.length; i++) b.tube(pts[i - 1], pts[i], D.tube, T.hoop);
  return b.done('bike-rack');
}

/** Tram/bus shelter: four posts, a thin flat roof, glass framed by rails (left open), the lit ad panel at one end, a bench. */
export function abriModel(): FurnitureMesh {
  const D = DIMENSIONS.abri, b = new Builder(), L = D.length / 2, d = D.depth / 2, p = D.post / 2;
  for (const x of [-L + p, L - p]) for (const y of [-d + p, d - p * 6]) b.box(x - p, y - p, 0, x + p, y + p, D.height - D.roofT, T.abriFrame, false, false);
  b.box(-L - 0.05, -d - 0.05, D.height - D.roofT, L + 0.05, d + 0.15, D.height, T.abriFrame, true);
  // Back wall: glass between a low and a high rail (the rails read; the glass stays see-through).
  for (const z of [0.12, D.height - D.roofT - 0.12]) b.tube([-L + p, -d + p, z], [L - p, -d + p, z], 0.06, T.abriFrame);
  // Ad panel (mupi) closing the -x end, its two faces lit (the SLOT carries the poster tone on the open side).
  const x0 = -L + p, z0 = D.panelBase, z1 = z0 + D.panelH;
  b.box(x0 - D.panelT / 2, -d + 0.05, z0 - D.panelBase, x0 + D.panelT / 2, -d + 0.05 + D.panelW, z1 + 0.08, T.abriFrame);
  b.quad([x0 + D.panelT / 2 + 0.005, -d + 0.12, z0], [x0 + D.panelT / 2 + 0.005, -d + D.panelW - 0.02, z0], [x0 + D.panelT / 2 + 0.005, -d + D.panelW - 0.02, z1], [x0 + D.panelT / 2 + 0.005, -d + 0.12, z1], T.abriPanel);
  b.quad([x0 - D.panelT / 2 - 0.005, -d + D.panelW - 0.02, z0], [x0 - D.panelT / 2 - 0.005, -d + 0.12, z0], [x0 - D.panelT / 2 - 0.005, -d + 0.12, z1], [x0 - D.panelT / 2 - 0.005, -d + D.panelW - 0.02, z1], SLOT);
  // Bench along the back.
  b.box(-L + 0.6, -d + 0.1, 0.42, L - 0.3, -d + 0.45, 0.48, T.abriBench, true);
  return b.done('abri');
}

/** Reclamezuil: base ring, the poster drum (SLOT: a poster tone per column), cornice, conical roof, finial. */
export function columnModel(): FurnitureMesh {
  const D = DIMENSIONS.column, b = new Builder(), n = 10;
  b.prism(0, 0, 0, D.baseH, D.baseR, D.baseR, n, T.columnBase, true);
  b.prism(0, 0, D.baseH, D.baseH + D.bodyH, D.radius, D.radius, n, SLOT, false);
  const c0 = D.baseH + D.bodyH;
  b.prism(0, 0, c0, c0 + D.corniceH, D.corniceR, D.corniceR, n, T.columnCornice, false, true);
  b.prism(0, 0, c0 + D.corniceH, c0 + D.corniceH + D.roofH, D.corniceR * 0.97, 0, n, T.columnCornice, false);
  b.prism(0, 0, c0 + D.corniceH + D.roofH - 0.05, c0 + D.corniceH + D.roofH + D.finialH, 0.05, 0, 4, T.columnCornice, false);
  return b.done('ad-column');
}

export const FURNITURE_MODELS: Readonly<Record<FurnitureModelId, () => FurnitureMesh>> = {
  container: containerModel, 'lamp-lantern': lanternModel, 'lamp-pole': poleModel, bin: binModel, 'bike-rack': hoopModel, abri: abriModel, 'ad-column': columnModel,
};

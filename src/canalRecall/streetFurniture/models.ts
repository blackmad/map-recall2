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
 *   container column (#212 re-measure 2026-11-05, heights normalised to a 2.20 m camera from each crop's implied
 *     camera height; staging/street-furniture/container-measurements.md): body 1.19 m (1.22 rest 102570 pano
 *     recording_2025-06-18_08-56-14_01425 6.74 m; 1.17 papier 57671 recording_2025-07-31_07-49-05_00984 7.96 m; 1.16
 *     papier 121395 recording_2025-06-18_08-56-14_00581 6.46 m; 1.19 glas 191647 recording_2025-06-16_06-42-40_00170
 *     6.03 m), front 0.63 m (0.61 / 0.67 / back 0.66 215814 recording_2025-06-16_06-42-40_01252 6.16 m / back 0.55),
 *     depth 0.72 m (ground-plane footprint, 102570), plain front 0.55 m to the drum, drum 0.46 m (102570: 0.58-1.04 m),
 *     front chamfer from 0.83 m, lip 0.07 m, fraction band 0.15 m (57671 papier), back chamfer 0.16-0.21 m (191647,
 *     215814), lift mushroom 0.24-0.45 m (four reads; 0.35 m), floor plate 1.56 m edge (102570 ground plane);
 *   canal lantern 4.09 m to the finial, lantern 0.70 x 0.45 m, its bottom at 3.16 m, shaft 0.11 m (332362);
 *   hooked pole 7.6 m to the curl (residential, Pijp 3976ec), arm reach 1.0 m, bowl 0.36 m;
 *   abri 2.47 m high, 4.11 m long (two bays), ad panel 1.27 x 1.78 m (1a551a; the JCDecaux mupi is 1.20 x 1.76);
 *   litter bin by that abri 1.11 x 0.57 m;
 *   reclamezuil 4.6-4.8 m to the finial, body 1.9-2.0 m across (6f6d95, 36dae2; cornice band 0.87 m with the roof).
 * Priors (no measurement): abri depth 1.4 m; bike hoop 0.75 x 0.70 m, five hoops 0.9 m apart per BGT rack point;
 * container column 0.15 m behind the plate centre, cheeks 0.07 m, chamfer run 0.30 m (side-view slope ~50 deg).
 */
import { STREET_FURNITURE_TONES as T, hexToRgb } from '../look/palette.js';

export type FurnitureModelId = 'container' | 'container-glas' | 'container-papier' | 'lamp-lantern' | 'lamp-pole' | 'bin' | 'bike-rack' | 'abri' | 'ad-column';
export const FURNITURE_MODEL_IDS: readonly FurnitureModelId[] = ['container', 'container-glas', 'container-papier', 'lamp-lantern', 'lamp-pole', 'bin', 'bike-rack', 'abri', 'ad-column'];
/** Per-model triangle cap (the brief's budget). */
export const FURNITURE_TRI_CAP = 120;
/** Faces in this colour take the instance colour. */
export const SLOT = '#ff00ff';

export type FurnitureMesh = { id: FurnitureModelId; positions: Float32Array; colours: Float32Array; triangles: number; heightM: number };

export const DIMENSIONS = {
  container: {
    plate: 1.55, plateH: 0.04, colW: 0.63, colD: 0.72, colH: 1.19, colBack: 0.15,
    chamferZ: 0.83, chamferRun: 0.30, backChamferH: 0.18, backChamferRun: 0.12,
    cheek: 0.07, drumD: 0.46, drumBottom: 0.58, drumSet: 0.23, lipH: 0.07, lipProud: 0.03,
    panelSet: 0.08, holeD: 0.17, holeZ: 0.84, slotW: 0.38, slotH: 0.06, flapH: 0.14, labelW: 0.26, labelD: 0.16,
    handleH: 0.35, handleShaftR: 0.035, handleDiscR: 0.09,
  },
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

/**
 * Underground container top (#212 re-model): the Amsterdam inwerpzuil (the Kinshofer "Amsterdam Standaard" column on
 * 11,450 of the 12,892 active register containers). Side profile a long hexagon: vertical front carrying the pictogram,
 * a steep front chamfer, short flat top with the lift mushroom, a small back chamfer, vertical back. The stainless drum
 * (trommel) lies across the front between two cheeks, convex, its top in the chamfer; under it a light lip over the
 * dark mouth; above it the fraction band on the slope (SLOT, the instance colour). Grey galvanised floor plate with a
 * darker edge. Numbers: the module header and staging/street-furniture/container-measurements.md.
 */
export type ContainerInsert = 'drum' | 'hole' | 'slot';
/** The insert behind the fraction band: rest's drum, glass's round hole, paper's wide slot over a flap (193394, 57671). */
export const CONTAINER_INSERT: Readonly<Record<'container' | 'container-glas' | 'container-papier', ContainerInsert>> = { container: 'drum', 'container-glas': 'hole', 'container-papier': 'slot' };

export function containerModel(id: 'container' | 'container-glas' | 'container-papier' = 'container'): FurnitureMesh {
  const D = DIMENSIONS.container, b = new Builder(), insert = CONTAINER_INSERT[id];
  const h = D.plate / 2, pz = D.plateH;
  // Floor plate: lighter steel top, darker visible edge.
  b.quad([-h, -h, pz], [h, -h, pz], [h, h, pz], [-h, h, pz], T.containerPlate);
  b.box(-h, -h, 0, h, h, pz, T.containerPlateEdge, false, false);
  const x0 = -D.colW / 2, x1 = D.colW / 2, xi0 = x0 + D.cheek, xi1 = x1 - D.cheek;
  const yb = -D.colD / 2 - D.colBack, yf = D.colD / 2 - D.colBack;
  const top = pz + D.colH, zc = pz + D.chamferZ, yt = yf - D.chamferRun, zbk = top - D.backChamferH, ybt = yb + D.backChamferRun;
  const body = T.containerBody;
  // Side profile (y, z), counter-clockwise seen from +x: back-bottom, front-bottom, chamfer start, top-front, top-back, back chamfer.
  const prof: [number, number][] = [[yb, pz], [yf, pz], [yf, zc], [yt, top], [ybt, top], [yb, zbk]];
  for (const [x, flip] of [[x0, true], [x1, false]] as const) {
    const pts = prof.map(([y, z]): V => [x, y, z]);
    // Counter-clockwise in (y, z) faces +x: the -x side takes the reverse winding (front faces only in the ride).
    for (let i = 1; i < pts.length - 1; i++) flip ? b.tri(pts[0], pts[i + 1], pts[i], body) : b.tri(pts[0], pts[i], pts[i + 1], body);
  }
  // The recess between the cheeks: the drum (rest) or a flat insert panel set back from the front (glass, paper).
  const zm = pz + D.drumBottom, r = D.drumD / 2, za = zm + r, zTop = za + r;
  const ya = insert === 'drum' ? yf - D.drumSet : yf - D.panelSet;
  const slopeZ = (y: number) => zc + (yf - y) * (top - zc) / (yf - yt);
  // Front: full width up to the lip, then the two cheeks up to the chamfer and up the slope to the top edge.
  b.quad([x1, yf, pz], [x0, yf, pz], [x0, yf, zm], [x1, yf, zm], body);
  for (const [a, c] of [[x0, xi0], [xi1, x1]] as const) {
    b.quad([c, yf, zm], [a, yf, zm], [a, yf, zc], [c, yf, zc], body);
    b.quad([c, yf, zc], [a, yf, zc], [a, yt, top], [c, yt, top], body);
  }
  // Cheek inner faces bounding the recess (y from the recess back to the front).
  const ziA = slopeZ(ya);
  b.quad([xi0, ya, zm], [xi0, yf, zm], [xi0, yf, zc], [xi0, ya, ziA], body);
  b.quad([xi1, yf, zm], [xi1, ya, zm], [xi1, ya, ziA], [xi1, yf, zc], body);
  if (insert === 'drum') {
    // Lip: the light bar over the drum's mouth, proud of the front; the dark mouth floor behind it.
    const lz0 = zm - D.lipH, ly = yf + D.lipProud;
    b.quad([xi1, ly, lz0], [xi0, ly, lz0], [xi0, ly, zm], [xi1, ly, zm], T.containerLip);
    b.quad([xi1, ly, zm], [xi0, ly, zm], [xi0, yf, zm], [xi1, yf, zm], T.containerLip);
    b.quad([xi1, yf, lz0], [xi0, yf, lz0], [xi0, ly, lz0], [xi1, ly, lz0], T.containerLip);
    b.quad([xi1, yf, zm], [xi0, yf, zm], [xi0, ya, zm], [xi1, ya, zm], T.containerSlot);
  } else b.quad([xi1, yf, zm], [xi0, yf, zm], [xi0, ya, zm], [xi1, ya, zm], body); // the recess sill
  if (insert === 'drum') {
    // The drum: 6 facets from the bottom (-90 deg) over the front to the top (+90 deg).
    const n = 6, arc = Array.from({ length: n + 1 }, (_, i) => { const t = -Math.PI / 2 + Math.PI * i / n; return [ya + r * Math.cos(t), za + r * Math.sin(t)] as const; });
    for (let i = 0; i < n; i++) { const [y0, z0] = arc[i], [y1, z1] = arc[i + 1]; b.quad([xi0, y0, z0], [xi0, y1, z1], [xi1, y1, z1], [xi1, y0, z0], T.containerDrum); }
  } else {
    // Insert panel in the body colour, vertical, from the mouth to the band.
    b.quad([xi1, ya, zm], [xi0, ya, zm], [xi0, ya, zTop], [xi1, ya, zTop], body);
    const e = ya + 0.004;
    if (insert === 'hole') {
      // Glass: one round throw-in hole (octagon), dark.
      const cz = pz + D.holeZ, hr = D.holeD / 2, ring = Array.from({ length: 8 }, (_, i): V => [hr * Math.cos((i + 0.5) * Math.PI / 4), e, cz + hr * Math.sin((i + 0.5) * Math.PI / 4)]);
      for (let i = 1; i < 7; i++) b.tri(ring[0], ring[i + 1], ring[i], T.containerSlot);
    } else {
      // Paper: the wide letterbox slot under the band, the light flap below it.
      const sw = D.slotW / 2, s1 = zTop - 0.03, s0 = s1 - D.slotH, f0 = s0 - 0.02 - D.flapH;
      b.quad([sw, e, s0], [-sw, e, s0], [-sw, e, s1], [sw, e, s1], T.containerSlot);
      b.quad([sw, e, f0], [-sw, e, f0], [-sw, e, s0 - 0.02], [sw, e, s0 - 0.02], T.containerLip);
    }
  }
  // Fraction band on the slope: from the insert top to the top edge (SLOT, the instance colour).
  b.quad([xi0, ya, zTop], [xi0, yt, top], [xi1, yt, top], [xi1, ya, zTop], SLOT);
  // Flat top, back chamfer, back.
  b.quad([x0, yt, top], [x0, ybt, top], [x1, ybt, top], [x1, yt, top], T.containerTop);
  // The white instruction sticker on the flat top, toward the front (every panorama column carries one).
  b.quad([x0 + 0.06, yt - 0.03, top + 0.003], [x0 + 0.06, yt - 0.03 - D.labelD, top + 0.003], [x0 + 0.06 + D.labelW, yt - 0.03 - D.labelD, top + 0.003], [x0 + 0.06 + D.labelW, yt - 0.03, top + 0.003], T.containerLabel);
  b.quad([x0, ybt, top], [x0, yb, zbk], [x1, yb, zbk], [x1, ybt, top], body);
  b.quad([x0, yb, pz], [x1, yb, pz], [x1, yb, zbk], [x0, yb, zbk], body);
  // Lift mushroom: galvanised discs on a shaft in the fraction colour (yellow glass shafts 47128 / 215814, blue paper
  // 57671, dark rest 102570), so the shaft is SLOT too.
  const hy = (yt + ybt) / 2, H = D.handleH;
  b.prism(0, hy, top, top + H - 0.03, D.handleShaftR, D.handleShaftR, 6, SLOT, false);
  for (const z of [top + H * 0.55, top + H - 0.04]) b.prism(0, hy, z, z + 0.04, D.handleDiscR, D.handleDiscR, 6, T.containerHandle, true, true);
  return b.done(id);
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
  container: () => containerModel('container'), 'container-glas': () => containerModel('container-glas'), 'container-papier': () => containerModel('container-papier'), 'lamp-lantern': lanternModel, 'lamp-pole': poleModel, bin: binModel, 'bike-rack': hoopModel, abri: abriModel, 'ad-column': columnModel,
};

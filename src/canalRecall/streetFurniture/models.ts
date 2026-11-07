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
 *     2026-11-07 correction: those "front" reads are the flat panel between the angled corner strips (0.50 m); the
 *     whole width is 0.86 m and the depth 0.80 m (width/height 0.72-0.78, side view 0.69; staging/street-furniture/
 *     faceon-*: papier 72443, glas 262754, rest 131173, rest 78788 side-on; the user's two photos). Plain front 0.55 m
 *     to the drum, drum 0.44 m, front chamfer from 0.80 m, lip 0.07 m, fraction band 0.15 m (57671 papier), back chamfer 0.16-0.21 m (191647,
 *     215814), lift mushroom 0.24-0.45 m (four reads; 0.35 m), floor plate 1.56 m edge (102570 ground plane);
 *   canal lantern 4.09 m to the finial, lantern 0.70 x 0.45 m, its bottom at 3.16 m, shaft 0.11 m (332362);
 *   hooked pole 7.6 m to the curl (residential, Pijp 3976ec), arm reach 1.0 m, bowl 0.36 m;
 *   abri 2.47 m high, 4.11 m long (two bays), ad panel 1.27 x 1.78 m (1a551a; the JCDecaux mupi is 1.20 x 1.76);
 *   litter bin by that abri 1.11 x 0.57 m;
 *   reclamezuil 4.6-4.8 m to the finial, body 1.9-2.0 m across (6f6d95, 36dae2; cornice band 0.87 m with the roof).
 * Priors (no measurement): abri depth 1.4 m; bike hoop 0.75 x 0.70 m, five hoops 0.9 m apart per BGT rack point;
 * container column 0.15 m behind the plate centre, chamfer run 0.30 m (side-view slope ~50 deg).
 */
import { STREET_FURNITURE_TONES as T, hexToRgb } from '../look/palette.js';

export type FurnitureModelId = 'container' | 'container-rest' | 'container-glas' | 'container-papier' | 'lamp-lantern' | 'lamp-pole' | 'bin' | 'bike-rack' | 'abri' | 'ad-column';
export const FURNITURE_MODEL_IDS: readonly FurnitureModelId[] = ['container', 'container-rest', 'container-glas', 'container-papier', 'lamp-lantern', 'lamp-pole', 'bin', 'bike-rack', 'abri', 'ad-column'];
/** Per-model triangle cap (the brief's budget). */
export const FURNITURE_TRI_CAP = 160;
/** Faces in this colour take the instance colour. */
export const SLOT = '#ff00ff';

export type FurnitureMesh = { id: FurnitureModelId; positions: Float32Array; colours: Float32Array; triangles: number; heightM: number };

export const DIMENSIONS = {
  container: {
    plate: 1.55, plateH: 0.04, colW: 0.86, frontW: 0.50, cornerRun: 0.13, colD: 0.80, colH: 1.19, colBack: 0.15,
    chamferZ: 0.80, chamferRun: 0.30, backChamferH: 0.18, backChamferRun: 0.12,
    drumD: 0.58, drumBottom: 0.55, lipH: 0.07, lipProud: 0.03,
    panelSet: 0.07, bandRun: 0.13, lidDrop: 0.05, holeD: 0.20, slotW: 0.38, labelW: 0.13, labelD: 0.09,
    handleH: 0.36, handleShaftR: 0.03, handleDiscR: 0.09,
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
 * Underground container top (#212, re-shaped 2026-11-07 against the user's two photos and face-on panoramas): the
 * Amsterdam inwerpzuil. Plan: a flat front panel between two angled corner strips, then straight sides. Side profile a
 * long hexagon: vertical front, a steep slope, short flat top with the lift post, a small back chamfer. Between the
 * strips the slope is recessed: rest has the convex stainless drum over a light lip and a lid above it, glass a round
 * hole in the slope, paper a dark slot over a light flap. The fraction band (SLOT, the instance colour) runs the recess
 * width at the top of the slope. Rest comes in two tops the register cannot tell apart (2026-11-07, 30 random rest
 * panoramas: 6 drum, 14 flat-front, the rest unreadable; every type, 1338 / 1380 / 1340 >2022 / Sidcon press alike):
 * the drum (`container`) and the plain throw-in flap with a pull bar (`container-rest`; 85362, 15070, 107568, 217065).
 * Below: the darker pictogram panel (bag, sheet, bottle), side doors, the XXX on the
 * left strip. Grey galvanised floor plate with a darker edge.
 */
export type ContainerInsert = 'drum' | 'flap' | 'hole' | 'slot';
export type ContainerModelId = 'container' | 'container-rest' | 'container-glas' | 'container-papier';
/** The insert under the fraction band: rest's drum or flap, glass's round hole, paper's wide slot over a flap (193394, 57671). */
export const CONTAINER_INSERT: Readonly<Record<ContainerModelId, ContainerInsert>> = { container: 'drum', 'container-rest': 'flap', 'container-glas': 'hole', 'container-papier': 'slot' };

/** Pictogram outlines on the front panel, unit box (x -1..1, z 0..1), convex pieces fanned from their first point. */
const PICTOGRAM: Readonly<Record<ContainerInsert, readonly (readonly (readonly [number, number])[])[]>> = {
  drum: [[[-0.85, 0], [0.85, 0], [1, 0.3], [0.45, 0.72], [-0.45, 0.72], [-1, 0.3]], [[-0.3, 0.72], [0.3, 0.72], [0.55, 1], [-0.55, 1]]],
  flap: [[[-0.85, 0], [0.85, 0], [1, 0.3], [0.45, 0.72], [-0.45, 0.72], [-1, 0.3]], [[-0.3, 0.72], [0.3, 0.72], [0.55, 1], [-0.55, 1]]],
  hole: [[[-0.45, 0], [0.45, 0], [0.45, 0.55], [0.15, 0.72], [-0.15, 0.72], [-0.45, 0.55]], [[-0.15, 0.72], [0.15, 0.72], [0.15, 1], [-0.15, 1]]],
  slot: [[[-0.7, 0], [0.7, 0], [0.7, 0.72], [0.35, 1], [-0.7, 1]]],
};

export function containerModel(id: ContainerModelId = 'container'): FurnitureMesh {
  const D = DIMENSIONS.container, b = new Builder(), insert = CONTAINER_INSERT[id], body = T.containerBody;
  const h = D.plate / 2, pz = D.plateH;
  // Floor plate: lighter steel top, darker visible edge.
  b.quad([-h, -h, pz], [h, -h, pz], [h, h, pz], [-h, h, pz], T.containerPlate);
  b.box(-h, -h, 0, h, h, pz, T.containerPlateEdge, false, false);
  const W = D.colW / 2, Wf = D.frontW / 2;
  const yb = -D.colD / 2 - D.colBack, yf = D.colD / 2 - D.colBack, yc = yf - D.cornerRun;
  const top = pz + D.colH, zc = pz + D.chamferZ, yt = yf - D.chamferRun, zbk = top - D.backChamferH, ybt = yb + D.backChamferRun;
  const slopeZ = (y: number) => zc + (yf - y) * (top - zc) / (yf - yt);
  const zs = slopeZ(yc);
  // Sides, the door on each, the angled corner strips and the cheeks of the slope, mirrored. Winding flips with the side.
  for (const sx of [-1, 1] as const) {
    const q = (p: V, r: V, t: V, u: V, hex: string) => sx < 0 ? b.quad(p, r, t, u, hex) : b.quad(u, t, r, p, hex);
    const P = (x: number, y: number, z: number): V => [sx * x, y, z];
    const side: [number, number][] = [[yb, pz], [yc, pz], [yc, zs], [yt, top], [ybt, top], [yb, zbk]];
    const pts = side.map(([y, z]) => P(W, y, z));
    for (let i = 1; i < pts.length - 1; i++) sx > 0 ? b.tri(pts[0], pts[i], pts[i + 1], body) : b.tri(pts[0], pts[i + 1], pts[i], body);
    // The access door: a darker panel with its top-back corner cut parallel to the back chamfer (every side view,
    // 2026-11-07: 202523, 191178, 120284, 188634; the front corner is square under the slope).
    const dy0 = yb + 0.13, dy1 = yc - 0.07, dz0 = pz + 0.16, dz1 = Math.min(top - 0.19, slopeZ(dy1) - 0.06), cut = 0.2;
    const door = ([[dy0, dz0], [dy1, dz0], [dy1, dz1], [dy0 + cut * D.backChamferRun / D.backChamferH, dz1], [dy0, dz1 - cut]] as const).map(([y, z]) => P(W + 0.003, y, z));
    for (let i = 1; i < door.length - 1; i++) sx > 0 ? b.tri(door[0], door[i], door[i + 1], T.containerDoor) : b.tri(door[0], door[i + 1], door[i], T.containerDoor);
    q(P(Wf, yf, pz), P(W, yc, pz), P(W, yc, zs), P(Wf, yf, zc), body); // corner strip
    q(P(Wf, yf, zc), P(W, yc, zs), P(W, yt, top), P(Wf, yt, top), body); // cheek on the slope
  }
  // The recess between the cheeks and its floor at the bottom of the insert.
  // The drum shows only its upper part: it leaves the lip at -35 deg, so no dark mouth opens under it (the user's photo).
  const xi = Wf, drum = insert === 'drum', zm = drum ? pz + D.drumBottom : zc, r = D.drumD / 2, a0 = -35 * Math.PI / 180;
  const ya = drum ? yf - 0.02 - r * Math.cos(a0) : yf - D.panelSet, za = zm - r * Math.sin(a0), zTop = za + r;
  const yBand = drum ? yt : yt + D.bandRun, zBand = drum ? top : top - D.lidDrop;
  // Vertical front up to the recess, the darker pictogram panel on it.
  b.quad([xi, yf, pz], [-xi, yf, pz], [-xi, yf, zm], [xi, yf, zm], body);
  const m = 0.035, panelTop = zm - (drum ? D.lipH + 0.02 : 0.04), panelBottom = pz + 0.07, e = yf + 0.003;
  b.quad([xi - m, e, panelBottom], [-xi + m, e, panelBottom], [-xi + m, e, panelTop], [xi - m, e, panelTop], T.containerPanel);
  const ph = (panelTop - panelBottom) * 0.46, pw = ph * 0.42, pc = panelBottom + (panelTop - panelBottom) * 0.27, e2 = e + 0.002;
  for (const piece of PICTOGRAM[insert]) {
    const ring = piece.map(([x, z]): V => [-x * pw, e2, pc + z * ph]);
    for (let i = 1; i < ring.length - 1; i++) b.tri(ring[0], ring[i], ring[i + 1], T.containerLabel);
  }
  // The recess floor and cheek walls, from the slope back to the insert.
  const sill = drum ? (T.containerSlot) : T.containerLip;
  b.quad([xi, yf, zm], [-xi, yf, zm], [-xi, ya, zm], [xi, ya, zm], sill);
  b.quad([-xi, ya, zm], [-xi, yf, zm], [-xi, yf, zc], [-xi, ya, slopeZ(ya)], T.containerRecess);
  b.quad([xi, yf, zm], [xi, ya, zm], [xi, ya, slopeZ(ya)], [xi, yf, zc], T.containerRecess);
  if (drum) {
    // Lip: the light bar under the drum, proud of the front.
    const lz0 = zm - D.lipH, ly = yf + D.lipProud;
    b.quad([xi, ly, lz0], [-xi, ly, lz0], [-xi, ly, zm], [xi, ly, zm], T.containerLip);
    b.quad([xi, ly, zm], [-xi, ly, zm], [-xi, yf, zm], [xi, yf, zm], T.containerLip);
    b.quad([xi, yf, lz0], [-xi, yf, lz0], [-xi, ly, lz0], [xi, ly, lz0], T.containerLip);
    // The drum: 6 facets from the lip over the front to its crown.
    const n = 6, arc = Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (Math.PI / 2 - a0) * i / n; return [ya + r * Math.cos(t), za + r * Math.sin(t)] as const; });
    for (let i = 0; i < n; i++) { const [y0, z0] = arc[i], [y1, z1] = arc[i + 1]; b.quad([-xi, y0, z0], [-xi, y1, z1], [xi, y1, z1], [xi, y0, z0], T.containerDrum); }
    // Lid from the drum's crown back to the band, with the cheek walls down to it.
    b.quad([-xi, ya, zTop], [-xi, yBand, zBand], [xi, yBand, zBand], [xi, ya, zTop], T.containerTop);
  } else {
    // The insert slope: a plane set in from the cheeks, carrying the throw-in, up to the band.
    const yi = (t: number) => ya + (yBand - ya) * t, zi = (t: number) => zm + (zBand - zm) * t;
    b.quad([-xi, ya, zm], [-xi, yBand, zBand], [xi, yBand, zBand], [xi, ya, zm], T.containerInsert);
    const nrm = Math.hypot(ya - yBand, zBand - zm), ny = 0.004 * (zBand - zm) / nrm, nz = 0.004 * (ya - yBand) / nrm;
    const on = (x: number, t: number): V => [x, yi(t) + ny, zi(t) + nz];
    if (insert === 'hole') {
      // Glass: one round throw-in hole on the slope, dark.
      const tc = 0.5, len = Math.hypot(yBand - ya, zBand - zm), hr = D.holeD / 2;
      const ring = Array.from({ length: 10 }, (_, i) => { const a = (i + 0.5) * 2 * Math.PI / 10; return on(hr * Math.cos(a), tc + hr * Math.sin(a) / len); });
      for (let i = 1; i < 9; i++) b.tri(ring[0], ring[i + 1], ring[i], T.containerSlot);
    } else if (insert === 'flap') {
      // Rest without the drum: the whole slope is the hinged throw-in flap, a dark seam along its foot and a light
      // pull bar across its lower third.
      const fw = xi - 0.03, bw = D.slotW / 2;
      b.quad(on(-fw, 0.02), on(-fw, 0.06), on(fw, 0.06), on(fw, 0.02), T.containerSlot);
      b.quad(on(-bw, 0.2), on(-bw, 0.27), on(bw, 0.27), on(bw, 0.2), T.containerLip);
    } else {
      // Paper: the wide letterbox slot high on the slope, the light flap below it.
      const sw = D.slotW / 2;
      b.quad(on(-sw, 0.62), on(-sw, 0.84), on(sw, 0.84), on(sw, 0.62), T.containerSlot);
      b.quad(on(-sw, 0.14), on(-sw, 0.56), on(sw, 0.56), on(sw, 0.14), T.containerLip);
    }
  }
  // Cheek walls above the insert, then the fraction band up to the top edge (SLOT, the instance colour).
  const wallY = ya;
  b.tri([-xi, wallY, drum ? zTop : zm], [-xi, wallY, slopeZ(wallY)], [-xi, yBand, zBand], T.containerRecess);
  b.tri([-xi, wallY, slopeZ(wallY)], [-xi, yt, top], [-xi, yBand, zBand], T.containerRecess);
  b.tri([xi, wallY, drum ? zTop : zm], [xi, yBand, zBand], [xi, wallY, slopeZ(wallY)], T.containerRecess);
  b.tri([xi, wallY, slopeZ(wallY)], [xi, yBand, zBand], [xi, yt, top], T.containerRecess);
  // Rest's band lies on the flat top behind the lid; glass and paper's closes the slope.
  if (drum) b.quad([-xi, yt, top + 0.002], [-xi, yt - D.bandRun, top + 0.002], [xi, yt - D.bandRun, top + 0.002], [xi, yt, top + 0.002], SLOT);
  else b.quad([-xi, yBand, zBand], [-xi, yt, top], [xi, yt, top], [xi, yBand, zBand], SLOT);
  // Flat top, back chamfer, back.
  b.quad([-W, yt, top], [-W, ybt, top], [W, ybt, top], [W, yt, top], T.containerTop);
  // The small instruction sticker on the flat top, inside its front left corner.
  const lx = -W + 0.02, ly = yt - 0.05;
  b.quad([lx, ly, top + 0.003], [lx, ly - D.labelD, top + 0.003], [lx + D.labelW, ly - D.labelD, top + 0.003], [lx + D.labelW, ly, top + 0.003], T.containerLabel);
  b.quad([-W, ybt, top], [-W, yb, zbk], [W, yb, zbk], [W, ybt, top], body);
  b.quad([-W, yb, pz], [W, yb, pz], [W, yb, zbk], [-W, yb, zbk], body);
  // The three Amsterdam crosses, stacked on the left corner strip.
  const sy = (t: number) => yf + (yc - yf) * t, sxx = (t: number) => -(Wf + (W - Wf) * t), o = 0.004;
  const sn = Math.hypot(W - Wf, D.cornerRun), onx = -o * D.cornerRun / sn, ony = o * (W - Wf) / sn;
  for (let i = 0; i < 3; i++) {
    const zc0 = zc - 0.13 - i * 0.10, s = 0.035, w = 0.012, c = 0.5, dt = s / sn;
    const pt = (t: number, z: number): V => [sxx(t) + onx, sy(t) + ony, z];
    b.quad(pt(c - dt, zc0 - s + w), pt(c - dt, zc0 - s - w), pt(c + dt, zc0 + s - w), pt(c + dt, zc0 + s + w), T.containerCross);
    b.quad(pt(c + dt, zc0 - s + w), pt(c - dt, zc0 + s + w), pt(c - dt, zc0 + s - w), pt(c + dt, zc0 - s - w), T.containerCross);
  }
  // Lift post: galvanised discs on a shaft in the fraction colour (yellow glass shafts 47128 / 215814, blue paper
  // 57671, grey rest), so the shaft is SLOT too. Back third of the flat top (the user's photos).
  const hy = (yt + ybt) / 2 - 0.04, H = D.handleH;
  b.prism(0, hy, top, top + H - 0.02, D.handleShaftR, D.handleShaftR, 6, SLOT, false);
  for (const z of [top + H * 0.5, top + H - 0.03]) b.prism(0, hy, z, z + 0.03, D.handleDiscR, D.handleDiscR, 8, T.containerHandle, true, false);
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

/**
 * The ride's base lift over the bare relief (user 2026-11-07, "still sunk a bit?"): the pavement planes are drawn at
 * roadSurfaces SIDEWALK_TOP (LIFT.raisedBase 0.03 + kerb 0.11 = 0.14 m) and drape up to DRAPE_TOL float 0.03 m over
 * hollows, so furniture placed on the relief lost its plate and lowest 0.14-0.17 m under the paving. 0.15 m puts the
 * 0.04 m plate's top at 0.19 m, over the highest pavement plane. Pinned against SIDEWALK_TOP in streetFurniture.test.ts.
 */
export const RIDE_BASE_LIFT_M = 0.15;
/** Container plates in the ride carry a skirt this far below their base, so a plate on a lower carriageway-level spot (a parking strip at 0.03 m) shows a plinth edge, not a gap. */
export const RIDE_PLATE_SKIRT_M = 0.2;

/** The ride's mesh: the gallery model, plus the plate skirt on containers. */
export function rideModel(id: FurnitureModelId): FurnitureMesh {
  const m = FURNITURE_MODELS[id]();
  if (!id.startsWith('container')) return m;
  const D = DIMENSIONS.container, b = new Builder(), h = D.plate / 2;
  b.box(-h, -h, -RIDE_PLATE_SKIRT_M, h, h, 0, T.containerPlateEdge, false, false);
  const positions = new Float32Array(m.positions.length + b.p.length), colours = new Float32Array(m.colours.length + b.c.length);
  positions.set(m.positions); positions.set(b.p, m.positions.length); colours.set(m.colours); colours.set(b.c, m.colours.length);
  return { ...m, positions, colours, triangles: positions.length / 9 };
}

export const FURNITURE_MODELS: Readonly<Record<FurnitureModelId, () => FurnitureMesh>> = {
  container: () => containerModel('container'), 'container-rest': () => containerModel('container-rest'), 'container-glas': () => containerModel('container-glas'), 'container-papier': () => containerModel('container-papier'), 'lamp-lantern': lanternModel, 'lamp-pole': poleModel, bin: binModel, 'bike-rack': hoopModel, abri: abriModel, 'ad-column': columnModel,
};

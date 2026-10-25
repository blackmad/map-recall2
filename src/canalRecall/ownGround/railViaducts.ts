// Rail viaducts over streets: the passage floor in the ground-height build and the viaduct's mesh (pure, no DOM).
//
// AHN's DTM has no ground under a viaduct deck, and the 2 m field filled the hole from its whole rim: the track bed
// on the two abutment sides (+5.6 m NAP) and the streets at the two open sides (+0.5..1.5 m). West of Centraal the
// Droogbak - De Ruijterkade passage under the tracks drew as a 3 m saddle the road climbed over, with the bed's +5 m
// edge smeared into a slope and no wall or deck anywhere (issue #57). Two fixes, one record:
//
//   build   capViaductFloor: inside the passage, and in a strip `STRIP_M` into the bed behind each abutment, the field
//           is capped at the street level measured just outside the open sides. The bed's ramp down to the floor
//           then lies wholly behind the wall line, under the abutment's top (the 5 m land grid interpolates across
//           any quad with a vertex in the strip; a strip as deep as a quad's diagonal keeps the passage side flat).
//   mesh    viaductMesh: the deck slab over the passage at the bed level (ballast top, concrete soffit and
//           fascias; a water channel runs under it beside the road), each abutment as a block from the wall line `CAP_M`
//           back into the bed (its passage face the measured wall, its top the bed, over the ramp), piers and columns
//           from the floor to the soffit.
//
// Records come from the survey (BGT overbruggingsdeel deck and pijler polygons, BGT scheiding 'muur' lines for the
// abutments) and AHN; add one only with that evidence and say where it came from.

import { emptyMesh, vertex, type MeshArrays } from './drape.js';
import type { Grid } from './heightField.js';
import type { Vec2 } from './surface.js';

type LngLat = [number, number];
type RGB = [number, number, number];

export interface RailViaduct {
  id: string;
  label: string;
  /** Why the record looks the way it does, with the evidence. */
  evidence: string;
  /**
   * The passage under the deck, [lng, lat], four corners in order. Each edge ring[i] → ring[i + 1] is either an
   * abutment (the track bed ends at a wall there) or an open side (a street runs out under the deck's fascia).
   */
  ring: [LngLat, LngLat, LngLat, LngLat];
  /** Indices of the abutment edges of `ring`. */
  abutments: number[];
  /**
   * The deck slab, [lng, lat], four corners in the order of `ring`: along the abutment lines, reaching past the walls'
   * ends over the open sides where the survey's deck polygon does (over the water on columns).
   */
  deck: [LngLat, LngLat, LngLat, LngLat];
  /** Rectangular piers: centre, size along and across their axis (metres), the axis's angle from east (degrees, CCW). */
  piers: { at: LngLat; size: [number, number]; angleDeg: number }[];
  /** Round columns: centre and radius (metres). */
  columns: { at: LngLat; r: number }[];
  /** Deck depth from the track bed down to the soffit, metres. */
  deckDepthM: number;
}

/** Strip behind each abutment capped with the passage floor (metres): at least the land grid's quad diagonal (5 m × 1.38). */
export const STRIP_M = 10;
/** The abutment block reaches this far back into the bed (metres): the strip plus the far ring's 10 m quad diagonal, so the bed's ramp stays under its top. */
export const CAP_M = 25;
/** Street level for the floor: measured samples at most this far outside the deck's open sides (metres). */
export const MOUTH_BAND_M = 6;
/** The bed level for the deck: sampled this far behind each abutment (metres), past the block. */
export const BED_PROBE_M = CAP_M + 5;
/** The deck top and block tops sit this far above the bed (metres; the land under them is the bed at its back edge). */
export const TOP_LIFT_M = 0.04;

/** Colours (sRGB): the white glazed brick of the passage walls, concrete for the deck, its soffit and the piers; the deck top near the land's tone (groundLook land), so the track bed reads on over it. */
export const VIADUCT_COLOURS = { wall: [0.86, 0.85, 0.81] as RGB, fascia: [0.62, 0.61, 0.58] as RGB, soffit: [0.5, 0.5, 0.48] as RGB, pier: [0.66, 0.64, 0.6] as RGB, ballast: [0.69, 0.65, 0.58] as RGB, wing: [0.74, 0.72, 0.68] as RGB };

export const RAIL_VIADUCTS: readonly RailViaduct[] = [
  {
    id: 'centraal-west-droogbak',
    label: 'Centraal west: the rail viaduct over the Droogbak - De Ruijterkade passage',
    evidence: 'BGT overbruggingsdeel L0004.0b7103d3 (dek, hoogteligging 1) over the passage; BGT scheiding muur lines G0363.8c4423/3e8880/21ba15 (west abutment) and G0363.9da6a1/5c24f1/1629d1 (east abutment); 14 BGT pijler polygons under it. AHN dtm_05m: no data between the walls, track bed 5.55-5.73 m NAP behind both, streets 0.4-1.5 m NAP at the open sides. Panoramas b_20241121_1354_Track01_Sphere_00269 (white glazed-brick abutment walls, concrete deck about 4 m over the road) and recording_2025-06-16_03-46-32_00457 (the deck from De Ruijterkade).',
    ring: [[4.8954089, 52.3803325], [4.8962686, 52.3800242], [4.8968088, 52.3805765], [4.8959459, 52.3809099]],
    abutments: [1, 3],
    // The BGT deck reaches 3-6.5 m past the walls' south ends (over the water, on round columns) and 1-9 m past their north ends.
    deck: [[4.8953872, 52.380309], [4.8962265, 52.37998], [4.8968756, 52.3806487], [4.8959532, 52.3809181]],
    // BGT pijler rectangles, 2.7 m along the road and 3.5 m across it: one row down the middle of the span.
    piers: [
      [4.895888, 52.38023], [4.895933, 52.380276], [4.895978, 52.380322], [4.896023, 52.380369], [4.896068, 52.380415], [4.896105, 52.380454],
      [4.896174, 52.380524], [4.896211, 52.380563], [4.896256, 52.380609], [4.896302, 52.380655], [4.896341, 52.380696],
    ].map(([lng, lat]) => ({ at: [lng, lat] as LngLat, size: [2.7, 3.5] as [number, number], angleDeg: 59.5 }))
      .concat([{ at: [4.896368, 52.380724], size: [1.4, 3.44], angleDeg: 59.5 }]),
    columns: [
      { at: [4.89559, 52.380239], r: 0.5 }, { at: [4.895623, 52.380274], r: 0.5 }, { at: [4.895814, 52.380154], r: 0.5 },
      { at: [4.895851, 52.380192], r: 0.5 }, { at: [4.896038, 52.380068], r: 0.5 }, { at: [4.896078, 52.380109], r: 0.5 },
      { at: [4.896433, 52.380792], r: 2.3 },
    ],
    deckDepthM: 1.1,
  },
];

/** Even-odd point in polygon. */
export function insideRing(ring: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The passage ring (or the deck) in a planar frame, counter-clockwise. */
export function planarRing(v: RailViaduct, project: (p: LngLat) => Vec2, of: 'ring' | 'deck' = 'ring'): Vec2[] {
  const r = v[of].map(project);
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a >= 0 ? r : r.slice().reverse();
}

/** Edge `i` of the passage ring (or the deck) as planar endpoints with the unit normal pointing out of it. */
function edges(v: RailViaduct, project: (p: LngLat) => Vec2, of: 'ring' | 'deck' = 'ring'): { a: Vec2; b: Vec2; out: Vec2; abutment: boolean }[] {
  const raw = v[of].map(project), n = raw.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = raw[i], q = raw[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area >= 0;
  return raw.map((a, i) => {
    const b = raw[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    // CCW: the interior is on the left, outward is to the right (dy, −dx).
    const out: Vec2 = ccw ? [dy / l, -dx / l] : [-dy / l, dx / l];
    return { a, b, out, abutment: v.abutments.includes(i) };
  });
}

/** The floor zone: the passage and the deck, plus a strip `STRIP_M` deep behind each abutment (planar rings). */
export function floorZone(v: RailViaduct, project: (p: LngLat) => Vec2, stripM = STRIP_M): Vec2[][] {
  const zone: Vec2[][] = [planarRing(v, project), planarRing(v, project, 'deck')];
  for (const e of edges(v, project)) if (e.abutment) zone.push([e.a, e.b, [e.b[0] + e.out[0] * stripM, e.b[1] + e.out[1] * stripM], [e.a[0] + e.out[0] * stripM, e.a[1] + e.out[1] * stripM]]);
  return zone;
}

/**
 * Cap the floor zone of `v` in a filled grid (row 0 south, sample (i, j) centred at origin + (i + ½, j + ½)·step in
 * the frame `project` maps to) at the street level of its open sides: the median of the measured samples within
 * `MOUTH_BAND_M` outside each, interpolated between them by distance (the road climbs 0.8 m through the Droogbak
 * passage). Samples under the cap are kept. `measured` flags the samples AHN measured before the fill. Returns the
 * open sides' levels and the samples capped (no levels: no street measured at any open side, nothing capped).
 */
export function capViaductFloor(grid: Grid, origin: Vec2, stepM: number, v: RailViaduct, project: (p: LngLat) => Vec2, measured: Uint8Array): { levels: number[]; capped: number; mouthSamples: number } {
  const zone = floorZone(v, project), mouths = edges(v, project, 'deck').filter(e => !e.abutment);
  const xs = zone.flat().map(p => p[0]), ys = zone.flat().map(p => p[1]), pad = MOUTH_BAND_M + stepM;
  const i0 = Math.max(0, Math.floor((Math.min(...xs) - pad - origin[0]) / stepM)), i1 = Math.min(grid.width - 1, Math.ceil((Math.max(...xs) + pad - origin[0]) / stepM));
  const j0 = Math.max(0, Math.floor((Math.min(...ys) - pad - origin[1]) / stepM)), j1 = Math.min(grid.height - 1, Math.ceil((Math.max(...ys) + pad - origin[1]) / stepM));
  const inZone = (x: number, y: number) => zone.some(r => insideRing(r, x, y));
  const street: number[][] = mouths.map(() => []), members: number[] = [];
  const dist = (e: (typeof mouths)[number], x: number, y: number) => (x - e.a[0]) * e.out[0] + (y - e.a[1]) * e.out[1];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = origin[0] + (i + 0.5) * stepM, y = origin[1] + (j + 0.5) * stepM, k = j * grid.width + i;
    if (inZone(x, y)) { members.push(k); continue; }
    if (!measured[k]) continue;
    mouths.forEach((e, m) => {
      const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], t = ((x - e.a[0]) * dx + (y - e.a[1]) * dy) / (dx * dx + dy * dy), d = dist(e, x, y);
      if (t >= 0 && t <= 1 && d >= 0 && d <= MOUTH_BAND_M) street[m].push(grid.data[k]);
    });
  }
  const sides = mouths.map((e, m) => ({ e, level: median(street[m]) })).filter(s => s.level === s.level);
  const mouthSamples = street.reduce((n, s) => n + s.length, 0);
  if (!sides.length) return { levels: [], capped: 0, mouthSamples };
  let capped = 0;
  for (const k of members) {
    const i = k % grid.width, j = (k - i) / grid.width, x = origin[0] + (i + 0.5) * stepM, y = origin[1] + (j + 0.5) * stepM;
    // Inverse distance to each open side's line: linear between two parallel sides.
    let w = 0, z = 0;
    for (const s of sides) { const d = Math.max(0.5, -dist(s.e, x, y)), q = 1 / d; w += q; z += q * s.level; }
    const cap = z / w;
    if (grid.data[k] > cap) { grid.data[k] = cap; capped++; }
  }
  return { levels: sides.map(s => +s.level.toFixed(2)), capped, mouthSamples };
}

export interface ViaductBuild {
  id: string;
  /** Deck top (the bed level behind the abutments), soffit and the passage floor at its centre, scene metres. */
  deckZ: number;
  soffitZ: number;
  floorZ: number;
  /** Lowest clear height of the abutment faces (floor at the wall foot up to the soffit), metres. */
  wallFaceM: number;
  piers: number;
  columns: number;
}

/** A planar quad as two triangles facing `toward` (a direction its front side faces). */
function quad(m: MeshArrays, p: [number, number, number][], toward: [number, number, number], colour?: RGB): void {
  const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], flip = n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0;
  const k = p.map(q => vertex(m, q[0], q[1], q[2], colour));
  if (flip) m.indices.push(k[0], k[2], k[1], k[0], k[3], k[2]); else m.indices.push(k[0], k[1], k[2], k[0], k[2], k[3]);
}

/** A convex planar polygon (CCW from above) at height z, facing up (+1) or down (−1). */
function flatPolygon(m: MeshArrays, ring: readonly Vec2[], z: number, up: 1 | -1, colour?: RGB): void {
  const k = ring.map(p => vertex(m, p[0], p[1], z, colour));
  for (let i = 1; i + 1 < k.length; i++) { if (up > 0) m.indices.push(k[0], k[i], k[i + 1]); else m.indices.push(k[0], k[i + 1], k[i]); }
}

/** A sheet over the parallelogram a, b, a + (c − a) … facing up, `step` metres a cell, at z = h(x, y). */
function sheet(m: MeshArrays, a: Vec2, b: Vec2, c: Vec2, h: (x: number, y: number) => number, step: number): void {
  const nu = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)), nv = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / step));
  const at = (i: number, j: number): Vec2 => [a[0] + (b[0] - a[0]) * i / nu + (c[0] - a[0]) * j / nv, a[1] + (b[1] - a[1]) * i / nu + (c[1] - a[1]) * j / nv];
  const base = m.positions.length / 3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const [x, y] = at(i, j); vertex(m, x, y, h(x, y)); }
  // Up-facing: (b − a) × (c − a) has z > 0 when c lies left of a → b.
  const left = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = base + j * (nu + 1) + i, r = k + 1, u = k + nu + 1, ur = u + 1;
    if (left) m.indices.push(k, r, ur, k, ur, u); else m.indices.push(k, ur, r, k, u, ur);
  }
}

/** A vertical wall along a → b from `bottom(x, y)` up to `top`, facing `out`, in `steps` panels (the floor under it may slope). */
function wall(m: MeshArrays, a: Vec2, b: Vec2, bottom: (x: number, y: number) => number, top: number, out: Vec2, colour: RGB, steps: number): number {
  let lowest = Infinity;
  for (let s = 0; s < steps; s++) {
    const p: Vec2 = [a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps], q: Vec2 = [a[0] + (b[0] - a[0]) * (s + 1) / steps, a[1] + (b[1] - a[1]) * (s + 1) / steps];
    const zp = bottom(p[0], p[1]), zq = bottom(q[0], q[1]);
    lowest = Math.min(lowest, top - Math.max(zp, zq));
    quad(m, [[p[0], p[1], zp], [q[0], q[1], zq], [q[0], q[1], top], [p[0], p[1], top]], [out[0], out[1], 0], colour);
  }
  return lowest;
}

/** A vertical prism (pier, column) on `ring` (CCW from above) from z0 to z1, sides only. */
function prism(m: MeshArrays, ring: readonly Vec2[], z0: number, z1: number, colour: RGB): void {
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1];
    quad(m, [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]], [dy, -dx, 0], colour);
  }
}

function median(v: number[]): number { const s = v.filter(x => x === x).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; }

/**
 * The viaduct in the local frame: `body` (vertex-coloured: soffit, fascias, abutment faces and ends, piers, columns),
 * `deckTop` (the deck's top, vertex-coloured in the bed's tone) and `top` (the abutment blocks' tops over the bed's ramp,
 * land-textured: UVs are world metres like the land grid's, so the bed's texture runs on over them).
 * `ground` is the relief (scene z). LOD 1 leaves out piers and columns.
 */
export function viaductMesh(v: RailViaduct, project: (p: LngLat) => Vec2, ground: (x: number, y: number) => number, lod: 0 | 1): { body: MeshArrays; top: MeshArrays; deckTop: MeshArrays; info: ViaductBuild } {
  const body = emptyMesh(true), top = emptyMesh(), deckTop = emptyMesh(true), es = edges(v, project), ring = planarRing(v, project), deck = planarRing(v, project, 'deck'), C = VIADUCT_COLOURS;
  // The bed level: behind each abutment, past its block.
  const bed: number[] = [];
  for (const e of es) if (e.abutment) for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) bed.push(ground(e.a[0] + (e.b[0] - e.a[0]) * t + e.out[0] * BED_PROBE_M, e.a[1] + (e.b[1] - e.a[1]) * t + e.out[1] * BED_PROBE_M));
  const deckZ = median(bed), soffitZ = deckZ - v.deckDepthM, topZ = deckZ + TOP_LIFT_M;
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  // Deck: a bed-coloured top (its own layer: the land's shader drops fragments over the water mask, and the
  // channel runs under this deck), concrete soffit, a fascia round it (inside the abutment blocks where it meets them).
  flatPolygon(deckTop, deck, topZ, 1, C.ballast);
  flatPolygon(body, deck, soffitZ, -1, C.soffit);
  for (const e of edges(v, project, 'deck')) quad(body, [[e.a[0], e.a[1], soffitZ], [e.b[0], e.b[1], soffitZ], [e.b[0], e.b[1], topZ], [e.a[0], e.a[1], topZ]], [e.out[0], e.out[1], 0], C.fascia);
  // Abutments: the wall face from the floor to the soffit, a block back into the bed (top over the ramp), its two ends.
  let wallFaceM = Infinity;
  const inward = (e: { out: Vec2 }): Vec2 => [-e.out[0], -e.out[1]];
  for (const e of es) {
    if (!e.abutment) continue;
    const back = (p: Vec2): Vec2 => [p[0] + e.out[0] * CAP_M, p[1] + e.out[1] * CAP_M];
    const steps = Math.max(1, Math.ceil(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) / 4));
    // The foot sits on the floor half a metre into the passage, a little under it so no seam shows.
    const foot = (x: number, y: number) => ground(x - e.out[0] * 0.5, y - e.out[1] * 0.5) - 0.15;
    wallFaceM = Math.min(wallFaceM, wall(body, e.a, e.b, foot, soffitZ, inward(e), C.wall, steps));
    const ba = back(e.a), bb = back(e.b);
    // Block top: over the bed's ramp at the deck level, on the bed where it stands higher (its 0.2 m swell between the tracks).
    sheet(top, e.a, e.b, ba, (x, y) => Math.max(topZ, ground(x, y) + TOP_LIFT_M), 2.5);
    // Ends: from the ground just outside each end up to the bed (wing walls where the street runs out under the fascia).
    for (const [p, q] of [[e.a, ba], [e.b, bb]] as [Vec2, Vec2][]) {
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1];
      let n: Vec2 = [dy, -dx];
      // Face away from the block's middle.
      const bx = (e.a[0] + e.b[0] + ba[0] + bb[0]) / 4, by = (e.a[1] + e.b[1] + ba[1] + bb[1]) / 4;
      if ((mx - bx) * n[0] + (my - by) * n[1] < 0) n = [-n[0], -n[1]];
      const l = Math.hypot(n[0], n[1]) || 1, nu: Vec2 = [n[0] / l, n[1] / l];
      wall(body, p, q, (x, y) => Math.min(topZ, ground(x + nu[0] * 0.5, y + nu[1] * 0.5)) - 0.15, topZ, nu, C.wing, Math.max(1, Math.ceil(CAP_M / 4)));
    }
  }
  // Piers and columns: from under the floor to the soffit.
  let piers = 0, columns = 0;
  if (lod === 0) {
    for (const p of v.piers) {
      const [x, y] = project(p.at), a = (p.angleDeg * Math.PI) / 180, u: Vec2 = [Math.cos(a), Math.sin(a)], w: Vec2 = [-u[1], u[0]];
      if (!insideRing(deck, x, y)) continue;
      const hu = p.size[0] / 2, hw = p.size[1] / 2;
      const r: Vec2[] = [[x - u[0] * hu - w[0] * hw, y - u[1] * hu - w[1] * hw], [x + u[0] * hu - w[0] * hw, y + u[1] * hu - w[1] * hw], [x + u[0] * hu + w[0] * hw, y + u[1] * hu + w[1] * hw], [x - u[0] * hu + w[0] * hw, y - u[1] * hu + w[1] * hw]];
      prism(body, r, Math.min(...r.map(q => ground(q[0], q[1]))) - 0.3, soffitZ, C.pier);
      piers++;
    }
    for (const c of v.columns) {
      const [x, y] = project(c.at);
      if (!insideRing(deck, x, y)) continue;
      const sides = c.r > 1 ? 16 : 10, r: Vec2[] = [];
      for (let s = 0; s < sides; s++) { const t = (2 * Math.PI * s) / sides; r.push([x + Math.cos(t) * c.r, y + Math.sin(t) * c.r]); }
      prism(body, r, ground(x, y) - 0.3, soffitZ, C.pier);
      columns++;
    }
  }
  return { body, top, deckTop, info: { id: v.id, deckZ: +deckZ.toFixed(2), soffitZ: +soffitZ.toFixed(2), floorZ: +ground(cx, cy).toFixed(2), wallFaceM: +wallFaceM.toFixed(2), piers, columns } };
}

/**
 * The post-1965 housing kit's wall components (`?postwarKit=1`, kit.ts). Never dice (p 0): a pand's kit read forces
 * them through `registerForce` (threeBuildingFeatures.ts), on street walls only. In the registry only with the flag on
 * (facadeExtras.ts), so the component list, and every wall, is byte-identical without it.
 *
 *   - postwar-balcony-band: a slab and a balustrade the length of the wall on every upper storey (Zeeburgerdijk 275-375,
 *     Th. K. van Lohuizenlaan, Amstelboulevard, Geuzenkade): 14 triangles a storey.
 *   - postwar-round-balconies: stacked rounded balconies, two stepped boxes in plan, on one or two axes (Pentagon,
 *     Sint Antoniesbreestraat 39-67, Marcantilaan, Eerste Weteringplantsoen): 20 triangles a balcony.
 *   - postwar-projecting-balconies: slab-and-rail balconies on alternate window axes (Molukkenstraat, Mary van der
 *     Sluisstraat): 14 triangles each, at most two a storey.
 *   - postwar-arcade: the ground storey drawn as a dark recess behind piers under a beam (Pentagon, Haarlemmer
 *     Houttuinen, Sint Antoniesbreestraat, Amstelboulevard).
 *   - postwar-dark-erkers: full-height dark-glass bays with dark storey frames (Marnixstraat 125-127, Weteringschans 81-89).
 * Round 2 (lane postwar-kit-r2-20261121; feature-reads.json):
 *   - postwar-white-erkers: projecting bays in white frames and white spandrel panels over the upper storeys, box or
 *     canted in plan (Wagenaarstraat 485-501): the 1965-90 aluminium-and-panel erker.
 *   - postwar-brick-erkers: the same bay in the wall's brick with a dark window band per storey.
 *   - postwar-stair-glazing: a glazed stairwell over each entrance (Spitsbergenstraat 82-102): a flush strip of glass in a
 *     frame from the first floor to under the roof ('glazed-strip'), or a proud glass volume ('glazed-tower').
 *   - the balcony band and arcade run on through the joints of a curved run (postwarKit.joinStart/joinEnd), and on its
 *     short facets (threeBuildingMesh.ts), so a curved front's band follows the footprint without gaps.
 */
import type { ExtraContext, ExtraSink, WallComponent } from '../facadeExtraCore.js';
import { doorSpan, shadeHex, storeyZ, windowSpans } from '../facadeOrnaments.js';
import { ERKER_FRAME_HEX, ERKER_GLASS_HEX } from './kit.js';

const STYLES = ['postwar', 'modern', 'tower'] as const;
export const BAND = { depth: 1.3, slab: 0.18, rail: 1.0, inset: 0.3, maxStoreys: 8 } as const;
export const ROUND = { steps: [[1.55, 0.75], [0.95, 1.25]] as const, slab: 0.16, rail: 1.0, maxStoreys: 6 } as const;
export const PROJECT = { halfW: 1.2, depth: 1.1, slab: 0.16, rail: 1.0, perStorey: 2, maxStoreys: 6 } as const;
export const ARCADE = { beam: 0.45, pier: 0.45, pitch: 3.6, recess: '#2b2a28', maxPiers: 14 } as const;
export const ERKER = { halfW: 1.2, depth: 0.6, frame: 0.12, maxStoreys: 6, maxPerWall: 4 } as const;
/** Round 2 bays: white-framed panel erkers and brick erkers; canted sides take `cant` of the depth back along the wall. */
export const BAY = { halfW: 1.3, depth: 0.7, cant: 0.55, sill: 0.85, head: 0.35, frame: 0.08, white: '#e9e7e1', panel: '#dcdad3', glass: '#55646c', dark: '#2b2f33' } as const;
/** Round 2 glazed stairs: a strip over the entrance, its frame and storey transoms; a tower stands proud. */
export const STAIR = { halfW: 0.85, frame: 0.1, out: 0.06, towerOut: 1.1, glass: '#5e7079', frameHex: '#d9d7d0', darkFrame: '#2a2d30', maxPerWall: 3 } as const;

/** Round 2b: whether this wall faces the side a feature read was made on (postwarKit.faceBearing), within FACE_TOL_DEG. */
export const FACE_TOL_DEG = 50;
export function onReadFace(c: ExtraContext): boolean {
  const want = c.postwarKit?.faceBearing;
  if (want === undefined) return true;
  const bearing = (Math.atan2(c.f.nx, c.f.ny) * 180 / Math.PI + 360) % 360, d = Math.abs(((bearing - want) % 360 + 540) % 360 - 180);
  return d <= FACE_TOL_DEG;
}
const upperStoreys = (c: ExtraContext, cap: number) => Math.max(0, Math.min(cap, c.layout.storeys));
/** Window axes of the first upper storey, nearest the wall's centre first. */
const axes = (c: ExtraContext) => windowSpans(c, 0).map(w => w.x).sort((a, b) => Math.abs(a - c.f.len / 2) - Math.abs(b - c.f.len / 2) || a - b);

export function balconyBand(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  const hex = c.postwarKit?.balconyHex;
  if (!hex || (c.f.len < 3 && !c.postwarKit?.curved)) return;
  const a0 = c.postwarKit?.joinStart ? 0 : BAND.inset, a1 = c.f.len - (c.postwarKit?.joinEnd ? 0 : BAND.inset);
  for (let k = 0; k < upperStoreys(c, BAND.maxStoreys); k++) {
    const z = storeyZ(c, k);
    if (z + BAND.rail > c.top - 0.2) break;
    s.box(c.f, a0, a1, 0, BAND.depth, z - BAND.slab, z, '#d8d5ce', true);
    s.strip(c.f, a0, a1, BAND.depth, z, z + BAND.rail, hex, 0.06);
  }
}

export function roundBalconies(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  const hex = c.postwarKit?.balconyHex;
  if (!hex || c.f.len < 4) return;
  const xs = axes(c).filter(x => x - ROUND.steps[0][0] > 0.1 && x + ROUND.steps[0][0] < c.f.len - 0.1);
  if (!xs.length) return;
  // One stack on a short wall, two on a long one, spread apart.
  const picks = c.f.len < 14 ? [xs[0]] : [xs.reduce((a, b) => b < a ? b : a), xs.reduce((a, b) => b > a ? b : a)];
  for (let k = 0; k < upperStoreys(c, ROUND.maxStoreys); k++) {
    const z = storeyZ(c, k);
    if (z + ROUND.rail > c.top - 0.2) break;
    for (const x of picks) for (const [hw, d] of ROUND.steps) s.box(c.f, x - hw, x + hw, 0, d, z - ROUND.slab, z + ROUND.rail, hex, true);
  }
}

export function projectingBalconies(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  const hex = c.postwarKit?.balconyHex;
  if (!hex) return;
  const xs = axes(c).filter(x => x - PROJECT.halfW > 0.05 && x + PROJECT.halfW < c.f.len - 0.05).sort((a, b) => a - b);
  const every = xs.filter((_, i) => i % 2 === 0).slice(0, PROJECT.perStorey);
  for (let k = 0; k < upperStoreys(c, PROJECT.maxStoreys); k++) {
    const z = storeyZ(c, k);
    if (z + PROJECT.rail > c.top - 0.2) break;
    for (const x of every) {
      s.box(c.f, x - PROJECT.halfW, x + PROJECT.halfW, 0, PROJECT.depth, z - PROJECT.slab, z, '#d8d5ce', true);
      s.strip(c.f, x - PROJECT.halfW, x + PROJECT.halfW, PROJECT.depth, z, z + PROJECT.rail, hex, 0.06);
    }
  }
}

export function arcade(c: ExtraContext, s: ExtraSink): void {
  const pier = c.postwarKit?.pierHex;
  if (!pier || !c.groundLevel) return;
  if (c.postwarKit?.curved && c.f.len < 5) {
    // A short facet of a curved arcade: the recess and the beam only, so the arcade turns the curve unbroken.
    const z0 = c.base, z1 = c.base + c.layout.groundM, zb = z1 - ARCADE.beam;
    s.strip(c.f, 0, c.f.len, 0.03, z0, zb, ARCADE.recess);
    s.box(c.f, 0, c.f.len, 0, 0.14, zb, z1, pier, true);
    return;
  }
  if (c.f.len < 5) return;
  const z0 = c.base, z1 = c.base + c.layout.groundM, zb = z1 - ARCADE.beam;
  // The recess: a dark plate over the ground cell, the piers and the beam proud of it.
  s.strip(c.f, 0.05, c.f.len - 0.05, 0.03, z0, zb, ARCADE.recess);
  const n = Math.min(ARCADE.maxPiers, Math.max(2, Math.round(c.f.len / ARCADE.pitch) + 1));
  for (let i = 0; i < n; i++) {
    const x = ARCADE.pier / 2 + (c.f.len - ARCADE.pier) * i / (n - 1);
    s.box(c.f, x - ARCADE.pier / 2, x + ARCADE.pier / 2, 0, 0.12, z0, zb, pier);
  }
  s.box(c.f, 0, c.f.len, 0, 0.14, zb, z1, pier, true);
}

/** Erker axes: round 1's (one on a short wall, the outermost two on a long one), or (round 2) the read's count spread
 *  evenly over the window axes, never two on neighbouring axes closer than the bay is wide. */
export function erkerAxes(c: ExtraContext, halfW: number): number[] {
  const xs = axes(c).filter(x => x - halfW > 0.3 && x + halfW < c.f.len - 0.3);
  if (!xs.length) return [];
  const n = c.postwarKit?.erkerCount;
  if (!n) return c.f.len < 16 ? [xs[0]] : [xs.reduce((a, b) => b < a ? b : a), xs.reduce((a, b) => b > a ? b : a)];
  const sorted = [...xs].sort((a, b) => a - b), out: number[] = [];
  const want = Math.min(n, ERKER.maxPerWall, Math.max(1, Math.floor(c.f.len / (2 * halfW + 1.2))));
  if (want === 1) return [xs[0]];
  for (let i = 0; i < want; i++) {
    const x = sorted[Math.round(i * (sorted.length - 1) / (want - 1))];
    if (out.every(o => Math.abs(o - x) >= 2 * halfW + 0.6)) out.push(x);
  }
  return out;
}

export function darkErkers(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  const picks = erkerAxes(c, ERKER.halfW);
  if (!picks.length || c.layout.storeys < 2) return;
  const n = upperStoreys(c, ERKER.maxStoreys), z0 = storeyZ(c, 0) - 0.1, z1 = Math.min(c.top - 0.3, storeyZ(c, n));
  if (z1 - z0 < 2) return;
  for (const x of picks) {
    s.box(c.f, x - ERKER.halfW, x + ERKER.halfW, 0, ERKER.depth, z0, z1, ERKER_GLASS_HEX, true);
    for (let k = 0; k <= n; k++) {
      const z = Math.min(z1 - ERKER.frame, storeyZ(c, k) - 0.1);
      s.strip(c.f, x - ERKER.halfW, x + ERKER.halfW, ERKER.depth + 0.01, z, z + ERKER.frame, ERKER_FRAME_HEX);
    }
  }
}

type V3 = [number, number, number];
/** A bay's faces in the wall frame (x along, o out) from left to right: box sides straight out, canted sides diagonal. */
function bayFaces(x: number, halfW: number, depth: number, plan: 'box' | 'canted' | 'round'): Array<[[number, number], [number, number]]> {
  const xa = x - halfW, xb = x + halfW, inset = plan === 'box' ? 0 : depth * BAY.cant / 0.7;
  return [[[xa, 0], [xa + inset, depth]], [[xa + inset, depth], [xb - inset, depth]], [[xb - inset, depth], [xb, 0]]];
}
function bayQuad(c: ExtraContext, s: ExtraSink, q: [[number, number], [number, number]], u0: number, u1: number, out: number, z0: number, z1: number, hex: string): void {
  const f = c.f, [a, b] = q, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, no = dx / l;
  const P = (u: number, z: number): V3 => { const X = a[0] + dx * u + nx * out, O = a[1] + dy * u + no * out; return [f.x0 + f.ux * X + f.nx * O, f.y0 + f.uy * X + f.ny * O, z]; };
  s.quad(P(u0, z0), P(u1, z0), P(u1, z1), P(u0, z1), [f.ux * nx + f.nx * no, f.uy * nx + f.ny * no, 0], hex);
}
/** One projecting bay over the upper storeys: a body in `body`, per storey a window band of glass framed in `frame`. */
function bayStack(c: ExtraContext, s: ExtraSink, x: number, body: string, frame: string, glass: string): void {
  const n = upperStoreys(c, ERKER.maxStoreys), z0 = storeyZ(c, 0) - 0.1, z1 = Math.min(c.top - 0.3, storeyZ(c, n));
  if (z1 - z0 < 2) return;
  const plan = c.postwarKit?.erkerPlan ?? 'box', faces = bayFaces(x, BAY.halfW, BAY.depth, plan);
  s.begin();
  for (const q of faces) bayQuad(c, s, q, 0, 1, 0, z0, z1, body);
  s.box(c.f, x - BAY.halfW, x + BAY.halfW, 0, BAY.depth, z0 - 0.12, z0, frame, true);
  s.box(c.f, x - BAY.halfW, x + BAY.halfW, 0, BAY.depth, z1, z1 + 0.12, frame);
  for (let k = 0; k < n; k++) {
    const zf = storeyZ(c, k), za = zf + BAY.sill, zh = Math.min(zf + c.layout.storeyM - BAY.head, z1 - 0.1);
    if (zh - za < 0.6) continue;
    for (const q of faces) {
      const l = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
      if (l < 0.25) continue;
      const fu = BAY.frame / l;
      bayQuad(c, s, q, 0, 1, 0.01, za - BAY.frame, zh + BAY.frame, frame);
      bayQuad(c, s, q, fu, 1 - fu, 0.02, za, zh, glass);
    }
  }
  s.commit();
}
export function whiteErkers(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  if (c.layout.storeys < 2) return;
  for (const x of erkerAxes(c, BAY.halfW)) bayStack(c, s, x, BAY.panel, BAY.white, BAY.glass);
}
export function brickErkers(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  if (c.layout.storeys < 2) return;
  for (const x of erkerAxes(c, BAY.halfW)) bayStack(c, s, x, shadeHex(c.wallHex, 0.94), BAY.dark, BAY.glass);
}

/** Entrance axes on this wall (its door bays); a street wall without a laid-out door takes its centre. */
export function stairAxes(c: ExtraContext): number[] {
  const bw = c.layout.bayWidthM, d = doorSpan(c);
  const xs = d ? c.layout.doorBays.map(i => (i + (d.x / bw - c.layout.doorBays[0]))  * bw) : c.streetSide ? [c.f.len / 2] : [];
  // A door near a corner keeps its stair over it, moved in just far enough to stay on the wall.
  const lo = STAIR.halfW + 0.2, hi = c.f.len - STAIR.halfW - 0.2;
  if (hi < lo) return [];
  const out: number[] = [];
  for (const x of xs.map(x => Math.max(lo, Math.min(hi, x)))) if (out.every(o => Math.abs(o - x) >= 2 * STAIR.halfW + 0.5)) out.push(x);
  return out.slice(0, Math.min(STAIR.maxPerWall, c.postwarKit?.stairCount ?? 1));
}
export function stairGlazing(c: ExtraContext, s: ExtraSink): void {
  if (!onReadFace(c)) return;
  const kind = c.postwarKit?.stair;
  if (!kind || c.layout.storeys < 2) return;
  const z0 = storeyZ(c, 0) - 0.3, z1 = Math.min(c.top - 0.4, storeyZ(c, upperStoreys(c, 8)));
  if (z1 - z0 < 2.5) return;
  const out = kind === 'glazed-tower' ? STAIR.towerOut : STAIR.out, frame = kind === 'glazed-tower' ? STAIR.darkFrame : STAIR.frameHex;
  for (const x of stairAxes(c)) {
    s.begin();
    if (kind === 'glazed-tower') {
      // The volume: glass on its three faces, a frame round its front, a cap.
      s.box(c.f, x - STAIR.halfW, x + STAIR.halfW, 0, out, z0, z1, STAIR.glass, true);
      s.box(c.f, x - STAIR.halfW - 0.05, x + STAIR.halfW + 0.05, 0, out + 0.05, z1, z1 + 0.25, frame);
    } else s.strip(c.f, x - STAIR.halfW, x + STAIR.halfW, out, z0, z1, STAIR.glass);
    // The frame: jambs, and a transom at each landing.
    for (const xe of [x - STAIR.halfW, x + STAIR.halfW - STAIR.frame]) s.strip(c.f, xe, xe + STAIR.frame, out + 0.02, z0, z1, frame);
    for (let k = 0; k <= upperStoreys(c, 8); k++) {
      const z = Math.min(z1 - STAIR.frame, storeyZ(c, k) - 0.3);
      if (z < z0) continue;
      s.strip(c.f, x - STAIR.halfW, x + STAIR.halfW, out + 0.02, z, z + STAIR.frame, frame);
    }
    s.strip(c.f, x - 0.03, x + 0.03, out + 0.02, z0, z1, frame);
    s.commit();
  }
}

export const POSTWAR_COMPONENTS: readonly WallComponent[] = [
  { id: 'postwar-balcony-band', styles: STYLES, p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => balconyBand(c, s) },
  { id: 'postwar-round-balconies', styles: STYLES, p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => roundBalconies(c, s) },
  { id: 'postwar-projecting-balconies', styles: STYLES, p: 0, wide: true, street: true, group: 'balcony', build: (c, s) => projectingBalconies(c, s) },
  { id: 'postwar-arcade', styles: STYLES, p: 0, wide: true, street: true, group: 'postwar-ground', build: (c, s) => arcade(c, s) },
  { id: 'postwar-dark-erkers', styles: STYLES, p: 0, wide: true, street: true, group: 'oriel', build: (c, s) => darkErkers(c, s) },
  { id: 'postwar-white-erkers', styles: STYLES, p: 0, wide: true, street: true, group: 'oriel', build: (c, s) => whiteErkers(c, s) },
  { id: 'postwar-brick-erkers', styles: STYLES, p: 0, wide: true, street: true, group: 'oriel', build: (c, s) => brickErkers(c, s) },
  { id: 'postwar-stair-glazing', styles: STYLES, p: 0, wide: true, street: true, group: 'postwar-stair', build: (c, s) => stairGlazing(c, s) },
];
export const POSTWAR_COMPONENT_IDS: ReadonlySet<string> = new Set(POSTWAR_COMPONENTS.map(c => c.id));

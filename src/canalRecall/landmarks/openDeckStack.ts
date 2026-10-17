/**
 * Open deck stack: a multi-storey car park's facade read as continuous horizontal bands, white parapet bands
 * alternating with deep dark open slots, swept round any plan outline (a ramp drum's circle, a deck block's rectangle).
 *
 * Why (2026-10-17): the Marnixstraat car park (Europarking, 1972) was a large-tier recipe whose ribbon windows were
 * holes 18 cm deep cut into a 3DBAG wall. The building's look is the opposite: thick white parapets with rounded
 * noses standing proud of slots about 1-2 m deep, wrapping the two helical ramp drums over the Singelgracht, on an
 * open pillared undercroft. Neither the block kit nor the large tier can draw a band whose section is not a wall
 * with a hole in it, so this module sweeps a measured section (bands, slot depth, nose radius, rounded underside,
 * parapet thickness, roof deck, open wells) along the plan.
 *
 * Frame: plan points are [x, z] (the landmark GLB frame: x east, z south), y up, metres. Output is triangle soup per
 * role (positions, three floats per vertex, wound counter-clockwise seen from outside the solid); the caller maps
 * roles to colours. Without `clip` and with every edge exposed the result is a closed 2-manifold (tested).
 */
import {ShapeUtils, Vector2} from 'three';

export type PlanPoint = [number, number];
export interface DeckBand { bottom: number; top: number }
export type DeckRole = 'parapet' | 'slot' | 'slotCeiling' | 'slotFloor' | 'parapetInner' | 'deck' | 'soffit' | 'well' | 'rail';
export const DECK_ROLES: readonly DeckRole[] = ['parapet', 'slot', 'slotCeiling', 'slotFloor', 'parapetInner', 'deck', 'soffit', 'well', 'rail'];
export type DeckStackGeometry = Record<DeckRole, number[]>;

export interface DeckStackOptions {
  /** Plan outline, either winding, no repeated closing point. */
  ring: PlanPoint[];
  /** White parapet bands, ascending and disjoint; the slots are the gaps between consecutive bands. */
  bands: DeckBand[];
  /** Depth of each slot's back wall behind the band faces (m). */
  slotDepth: number;
  /** Bullnose radius on every band edge (0 = square). */
  nose?: number;
  noseSegments?: number;
  /** Radius of the rounded underside of the lowest band, which curves in to the soffit (0 = square). */
  underside?: number;
  undersideSegments?: number;
  /** Thickness of the top band (the roof parapet); the roof deck lies inside it. Default `slotDepth`. */
  parapet?: number;
  /** Roof deck height (default 1.1 m below the top band's top). */
  deckY?: number;
  /** Open wells through the whole stack (a ramp drum's core): walls from soffit to deck, holes in both caps. */
  holes?: PlanPoint[][];
  /** Per ring edge i (point i to i + 1): false = no faces swept along it (an edge buried in a neighbouring mass). */
  exposed?: boolean[];
  /** A rail on top of every band but the roof parapet, standing in the slot: [inset from the nose, width, height]. */
  rail?: [number, number, number];
  /** Full deck plates across the plan at every slot's floor and ceiling (inset by the slot depth), for a mass whose
   * sides are partly buried in neighbours (`exposed` false) so its slots would otherwise look into an empty hull. */
  slabs?: boolean;
  /** Clamp the miter at vertices sharper than ~50 degrees instead of refusing the ring (a mass whose sharp corners
   * lie on unexposed edges; the inset there is shortened). */
  clampMiters?: boolean;
  /** Keep only the half-planes (p - point) . normal <= 0 (two drums meeting at their radical line). */
  clip?: {point: PlanPoint; normal: PlanPoint}[];
}

export interface ProfilePoint { o: number; y: number; role: DeckRole }

const emptyGeometry = (): DeckStackGeometry => Object.fromEntries(DECK_ROLES.map(r => [r, [] as number[]])) as unknown as DeckStackGeometry;

function signedArea(ring: PlanPoint[]) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
/** The ring with positive signed area (ccw = true) or negative (ccw = false). */
const wound = (ring: PlanPoint[], ccw: boolean) => (signedArea(ring) > 0) === ccw ? ring.slice() : ring.slice().reverse();

/** Unit normal of edge p -> q pointing away from the area of a positively wound ring. */
function edgeNormal(p: PlanPoint, q: PlanPoint): PlanPoint {
  const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
}
/** Miter vectors: vertex + m * o is the point `o` metres out from both adjacent edges (o < 0 = inward). */
function miters(ring: PlanPoint[], clamp = false): PlanPoint[] {
  const n = ring.length;
  return ring.map((_, i) => {
    const a = edgeNormal(ring[(i - 1 + n) % n], ring[i]), b = edgeNormal(ring[i], ring[(i + 1) % n]);
    let k = 1 + a[0] * b[0] + a[1] * b[1];
    if (k < 0.2 && clamp) k = 0.2;
    if (k < 0.2) throw new Error(`openDeckStack: vertex ${i} turns too sharply for a miter`);
    return [(a[0] + b[0]) / k, (a[1] + b[1]) / k];
  });
}
const at = (ring: PlanPoint[], m: PlanPoint[], i: number, o: number): PlanPoint => [ring[i][0] + m[i][0] * o, ring[i][1] + m[i][1] * o];

function pushTri(out: number[], a: number[], b: number[], c: number[], expect: number[]) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (Math.hypot(nx, ny, nz) < 1e-9) return;
  if (nx * expect[0] + ny * expect[1] + nz * expect[2] < 0) out.push(...a, ...c, ...b);
  else out.push(...a, ...b, ...c);
}

/** Sweep a section (o outward, y up) along the exposed edges of a ring with positive signed area (a hole ring: negative). */
export function sweepProfile(ring: PlanPoint[], profile: ProfilePoint[], out: DeckStackGeometry, exposed?: boolean[], clamp = false) {
  const m = miters(ring, clamp), n = ring.length;
  for (let i = 0; i < n; i++) {
    if (exposed && exposed[i] === false) continue;
    const j = (i + 1) % n, e = edgeNormal(ring[i], ring[j]);
    for (let k = 1; k < profile.length; k++) {
      const a = profile[k - 1], b = profile[k];
      const dy = b.y - a.y, dO = b.o - a.o;
      const expect = [e[0] * dy, -dO, e[1] * dy];
      const Ai = at(ring, m, i, a.o), Aj = at(ring, m, j, a.o), Bi = at(ring, m, i, b.o), Bj = at(ring, m, j, b.o);
      const P = (p: PlanPoint, y: number) => [p[0], y, p[1]];
      pushTri(out[b.role], P(Ai, a.y), P(Aj, a.y), P(Bj, b.y), expect);
      pushTri(out[b.role], P(Ai, a.y), P(Bj, b.y), P(Bi, b.y), expect);
    }
  }
}

/** The stack's section, bottom to top, for the given options (o = 0 at the band faces). */
export function deckProfile(o: DeckStackOptions): ProfilePoint[] {
  const bands = o.bands, N = o.nose ?? 0, ns = o.noseSegments ?? 2, U = o.underside ?? 0, us = o.undersideSegments ?? 3;
  const D = o.slotDepth, T = o.parapet ?? D, last = bands[bands.length - 1], deckY = o.deckY ?? last.top - 1.1;
  if (!bands.length) throw new Error('openDeckStack: no bands');
  for (let i = 0; i < bands.length; i++) {
    if (bands[i].top - bands[i].bottom < 2 * N + (i === 0 ? U : 0) - 1e-9) throw new Error(`openDeckStack: band ${i} thinner than its noses`);
    if (i && bands[i].bottom <= bands[i - 1].top) throw new Error(`openDeckStack: band ${i} overlaps band ${i - 1}`);
  }
  if (D <= N || T < N || T <= 0) throw new Error('openDeckStack: slot depth and parapet must exceed the nose');
  if (!(deckY < last.top && deckY > (bands.length > 1 ? bands[bands.length - 2].top : bands[0].bottom))) throw new Error('openDeckStack: deck must lie within the top band');
  const P: ProfilePoint[] = [];
  const arc = (co: number, cy: number, r: number, a0: number, a1: number, seg: number, role: DeckRole) => {
    for (let s = 1; s <= seg; s++) { const a = (a0 + (a1 - a0) * s / seg) * Math.PI / 180; P.push({o: co + r * Math.cos(a), y: cy + r * Math.sin(a), role}); }
  };
  const b0 = bands[0];
  if (U > 0) { P.push({o: -U, y: b0.bottom, role: 'soffit'}); arc(-U, b0.bottom + U, U, -90, 0, us, 'parapet'); }
  else P.push({o: 0, y: b0.bottom, role: 'soffit'});
  bands.forEach((b, i) => {
    if (i > 0 && N > 0) arc(-N, b.bottom + N, N, -90, 0, ns, 'parapet');
    P.push({o: 0, y: b.top - N, role: 'parapet'});
    if (N > 0) arc(-N, b.top - N, N, 0, 90, ns, 'parapet');
    if (i < bands.length - 1) {
      const next = bands[i + 1];
      P.push({o: -D, y: b.top, role: 'slotFloor'});
      P.push({o: -D, y: next.bottom, role: 'slot'});
      P.push({o: -N, y: next.bottom, role: 'slotCeiling'});
    } else {
      P.push({o: -T, y: b.top, role: 'parapet'});
      P.push({o: -T, y: deckY, role: 'parapetInner'});
    }
  });
  // Drop zero-length steps (square noses repeat their corner).
  return P.filter((p, i) => i === 0 || Math.abs(p.o - P[i - 1].o) > 1e-9 || Math.abs(p.y - P[i - 1].y) > 1e-9);
}

function cap(outer: PlanPoint[], holes: PlanPoint[][], y: number, up: boolean, out: number[]) {
  const tris = ShapeUtils.triangulateShape(outer.map(p => new Vector2(p[0], p[1])), holes.map(h => h.map(p => new Vector2(p[0], p[1]))));
  const all = [...outer, ...holes.flat()];
  for (const t of tris) pushTri(out, [all[t[0]][0], y, all[t[0]][1]], [all[t[1]][0], y, all[t[1]][1]], [all[t[2]][0], y, all[t[2]][1]], [0, up ? 1 : -1, 0]);
}

/** Clip a triangle soup to the half-plane (p - point) . normal <= 0 (Sutherland-Hodgman per triangle, fan re-triangulated). */
export function clipSoup(pos: number[], point: PlanPoint, normal: PlanPoint): number[] {
  const out: number[] = [], d = (v: number[]) => (v[0] - point[0]) * normal[0] + (v[2] - point[1]) * normal[1];
  for (let t = 0; t < pos.length; t += 9) {
    const tri = [pos.slice(t, t + 3), pos.slice(t + 3, t + 6), pos.slice(t + 6, t + 9)], poly: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3], da = d(a), db = d(b);
      if (da <= 0) poly.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const s = da / (da - db); poly.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]); }
    }
    for (let k = 1; k + 1 < poly.length; k++) {
      const a = poly[0], b = poly[k], c = poly[k + 1];
      const area = Math.hypot((b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (area > 1e-8) out.push(...a, ...b, ...c);
    }
  }
  return out;
}

/** Build the stack. Roles: parapet (white band faces, noses, roof parapet cap), slot (back walls), slotCeiling,
 * slotFloor, parapetInner (inside of the roof parapet), deck (roof deck), soffit (underside), well (open core walls), rail. */
export function openDeckStack(o: DeckStackOptions): DeckStackGeometry {
  const out = emptyGeometry();
  const sign = signedArea(o.ring) > 0;
  const ring = wound(o.ring, true);
  // `exposed` is indexed on the caller's ring; follow it through the reversal.
  const exposed = o.exposed && (sign ? o.exposed : o.ring.map((_, i) => o.exposed![(o.ring.length - 2 - i + o.ring.length) % o.ring.length]));
  const profile = deckProfile(o);
  sweepProfile(ring, profile, out, exposed, o.clampMiters);
  const holes = (o.holes ?? []).map(h => wound(h, false));
  const last = o.bands[o.bands.length - 1], deckY = o.deckY ?? last.top - 1.1, bottom = o.bands[0].bottom;
  const m = miters(ring, o.clampMiters), T = o.parapet ?? o.slotDepth, U = o.underside ?? 0;
  for (const h of holes) sweepProfile(h, [{o: 0, y: bottom, role: 'well'}, {o: 0, y: deckY, role: 'well'}], out);
  // Caps use the same miter points as the sweep, so their rims share its vertices exactly.
  cap(ring.map((_, i) => at(ring, m, i, -T)), holes, deckY, true, out.deck);
  cap(ring.map((_, i) => at(ring, m, i, -U)), holes, bottom, false, out.soffit);
  if (o.slabs) {
    const inner = ring.map((_, i) => at(ring, m, i, -o.slotDepth));
    for (let i = 0; i + 1 < o.bands.length; i++) { cap(inner, holes, o.bands[i].top, true, out.slotFloor); cap(inner, holes, o.bands[i + 1].bottom, false, out.slotCeiling); }
  }
  if (o.rail) {
    const [inset, w, h] = o.rail, N = o.nose ?? 0;
    for (const b of o.bands.slice(0, -1)) {
      const o0 = -(N + inset), o1 = o0 - w;
      sweepProfile(ring, [{o: o0, y: b.top, role: 'rail'}, {o: o0, y: b.top + h, role: 'rail'}, {o: o1, y: b.top + h, role: 'rail'}, {o: o1, y: b.top, role: 'rail'}], out, exposed, o.clampMiters);
    }
  }
  if (o.clip) for (const c of o.clip) for (const r of DECK_ROLES) out[r] = clipSoup(out[r], c.point, c.normal);
  return out;
}

/** Points of a circle (centre, radius) as a plan ring, `segments` vertices starting at angle `phase` (radians, from +x). */
export function circleRing(centre: PlanPoint, r: number, segments: number, phase = 0): PlanPoint[] {
  return Array.from({length: segments}, (_, i) => { const a = phase + i * 2 * Math.PI / segments; return [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)] as PlanPoint; });
}

export const triangleCount = (g: DeckStackGeometry) => DECK_ROLES.reduce((s, r) => s + g[r].length / 9, 0);

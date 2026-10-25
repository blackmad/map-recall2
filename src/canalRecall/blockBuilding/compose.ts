/**
 * Block-kit compositor: 3DBAG LoD2.2 shell (exact walls + roofs, part 0) with
 * facade systems laid out on every exposed wall panel. Every decoration is its
 * own part, built flush on the wall plane (offsets 0 to ~0.9 m), so attachment
 * is by construction and checked by gates.ts.
 */
import * as T from 'three';
import type { SurfaceSet } from './types.ts';
import { MeshBuilder, type V3, cross, sub, add, scale, norm, dot } from './mesh.ts';
import { buildHost, fitsPanel, rectPoly, pt, insidePoly, newell, triangulate3, type Panel } from './panels.ts';
import type { BlockSpec, System, Row, WinParams, BalconyParams, Band, Slot, Sign, PanesParams } from './spec.ts';
import { drawArchedOpening, drawArchedProud } from './arch.ts';

export interface TextShaper { (text: string, font?: string): { shapes: T.Shape[]; width: number; ascent: number } }
export interface ComposeOptions {
  shaper?: TextShaper;
  /**
   * Large tier (opt-in): cut every opening that fits one 3DBAG wall surface into the host wall and recess it this deep (m)
   * with reveals, the frame and glass at the back. Host walls are then triangulated after the facade systems. Openings that
   * straddle two surfaces stay proud (flush, within 2 cm of the wall). Unset = the original block-kit path, unchanged.
   */
  recessM?: number;
  /** keep tiny 3DBAG wall slivers as wall triangles (closes 0.1-0.4 m shell gaps); default off so installed block-kit output is byte-identical */
  sealSlivers?: boolean;
  /** large tier (opt-in): wall-mounted boxes (sills, heads, surrounds) get a back face, so a box on a 3DBAG wall that sits a few cm off the panel's reference plane has no open edge. Default off: installed block-kit output is byte-identical. */
  closedBoxes?: boolean;
  /** large tier (opt-in): bands (string courses, cornices, fascias) are closed solids (back face, and end caps at mitred joints), so they leave no open edge where 3DBAG faces stand a few cm off the panel plane or the next panel's band stops short. Default off: earlier large recipes stay byte-identical. */
  closedBands?: boolean;
  /** recess mode (opt-in): glazing bars and doors stand this far in front of the glass (default 0.015). The 1.5 cm default is
   *  inside the audit's 2 cm coplanar band (bars z-fight with the glass at range); 0.05 clears it as closed boxes, 0 puts the
   *  bars on the glass plane (pair with glassBackM). Unset: output byte-identical. */
  barOffsetM?: number;
  /** Glass of recessed openings sits this far (m) behind the frame ring and bars; default 0. With barOffsetM 0 the bars never overlap the glass within the audit's 2 cm. */
  glassBackM?: number;
  /**
   * Layered kit (recess mode, opt-in): glazing bars, door leaves and arched-head bars are closed boxes standing on the
   * 4.5 cm sheet layer off the glass, a flush arch band is a closed ring 4.5 cm off the wall, and balconies are one slab,
   * rail and pair of cheeks per storey run instead of per bay. Unset: output byte-identical.
   */
  layered?: boolean;
  /** Walls (indices into `set.walls`) with different keys never merge into one panel (large-tier wall groups). */
  mergeKey?: (wall: number) => number;
  /** Host wall slot per panel (recess mode only, where walls are emitted after the facade systems). */
  wallSlotFor?: (p: Panel) => Slot;
  /** System per panel; replaces `spec.rules`/`spec.default` (large-tier recipes assign systems by 3DBAG wall surface). */
  systemFor?: (p: Panel) => string | null;
  /**
   * Row split (opt-in): spans of the panel drawn with their own system instead of the panel's (each system's `lines`,
   * `bays` layout and bands; cells numbered from `bayOffset`, `bays` in the whole row). The panel's own system still
   * sets the levels the panel hook sees. Absent or null for a panel: unchanged.
   */
  segmentsFor?: (p: Panel) => { system: string; u0: number; u1: number; top: number; bayOffset: number; bays: number }[] | null;
  /** Leave this cell empty so a component (entrance, garage door) can take it. */
  skipCell?: (p: Panel, floor: number, bay: number, bays: number) => boolean;
  /** Leave this panel's bands (string courses) out: a wall no one sees, a court face (opt-in). */
  skipBands?: (p: Panel) => boolean;
  /** Components drawn on a panel after its facade system, with the panel's storey lines and the cells it laid out. */
  panelHook?: (c: Ctx, info: { system: string | null; levels: number[]; cells: Cell[] }) => void;
}
export interface ComposeResult { mesh: MeshBuilder; panels: Panel[]; stats: Record<string, number>; assignment: { panel: number; system: string | null; width: number; centre: [number, number] }[] }

const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
const rand = (a: number, b: number, c: number) => { let h = 2166136261 ^ (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** A cut opening: its bounding rectangle, plus the (u, v) outline when it is not that rectangle (arched openings). */
export type HoleRect = [u0: number, u1: number, v0: number, v1: number, outline?: [number, number][]];
/**
 * Sheets drawn on an unholed wall (frame 0.02, glass 0.035, mullions 0.05, louvres 0.06-0.075 in the component code) are lifted onto four
 * layers SHEET_PITCH (4.5 cm) apart: raw depth <= 0.025 -> 4.5 cm (frame, surround), <= 0.04 -> 9 cm (glass, inset panes, cladding), <= 0.065 -> 13.5 cm (mullions, transoms, louvres), above -> 18 cm (items stacked on a 0.06 sheet in the block specs). A sheet 2 cm over the wall, or 1.5 cm under the next one, bleeds through at 900-1800 m
 * (zfight-validate calibration; the zfight-tight band is < 3 cm). Fixed classes, not per-part ranks: ranks put the first sheet of every part on the
 * same 4.5 cm plane, and neighbouring parts then tie. Depths of 0.08 and more (solids, trim) and negative (recessed) depths are untouched.
 */
export const SHEET_PITCH = 0.045;
/** An opening that cannot be cut may lose this much (m) of its head or sill to fit its wall (`drawRecessed`). */
export const OPENING_TRIM_M = 0.1;
function liftSheet(d: number): number {
  if (!(d > 0 && d < 0.08)) return d;
  return SHEET_PITCH * (d <= 0.025 ? 1 : d <= 0.04 ? 2 : d <= 0.065 ? 3 : 4);
}
/** A wall's plan profile: its offset `d` (m, along the panel normal) at increasing `u` columns, linear between them. */
export interface WallProfile { u: number[]; d: number[] }
export function profileAt(w: WallProfile, u: number): number {
  const n = w.u.length;
  if (u <= w.u[0]) return w.d[0];
  if (u >= w.u[n - 1]) return w.d[n - 1];
  let i = 1; while (w.u[i] < u) i++;
  const t = (u - w.u[i - 1]) / (w.u[i] - w.u[i - 1]);
  return w.d[i - 1] + (w.d[i] - w.d[i - 1]) * t;
}
/** A part spanning a bend may cut its chord this far (m) inside or outside the wall before it is split there. */
const BEND_TOL = 0.01;
/**
 * Columns strictly inside (u0, u1) where a part must break to follow the wall's bends: Douglas-Peucker over the profile
 * columns, so every straight piece stays within BEND_TOL of the wall (a 2 mm wiggle in the 3DBAG ring splits nothing).
 */
export function kinksIn(w: WallProfile, u0: number, u1: number): number[] {
  u0 = Math.max(u0, w.u[0]); u1 = Math.min(u1, w.u[w.u.length - 1]);
  const inner = w.u.filter(u => u > u0 + 1e-3 && u < u1 - 1e-3);
  if (!inner.length) return [];
  const out: number[] = [];
  const split = (a: number, b: number) => {
    const da = profileAt(w, a), db = profileAt(w, b);
    let worst = -1, dev = BEND_TOL;
    for (const u of inner) if (u > a && u < b) { const e = Math.abs(profileAt(w, u) - (da + (db - da) * (u - a) / (b - a))); if (e > dev) { dev = e; worst = u; } }
    if (worst < 0) return;
    split(a, worst); out.push(worst); split(worst, b);
  };
  split(u0, u1);
  return out;
}

/**
 * Layered kit: where the panel's 3DBAG member walls actually stand, when that is not its reference plane. A wall merged
 * into a panel can lean off it (Berlage Lyceum: 0 to 9.5 cm over 8.6 m; Montessori Van Ostade 5.3 cm over 7.2 m) or
 * bend (Stadsloket West: a 65 m front kinked 26 cm out 8 m from one end), so a pier, string course, sill or curtain-wall
 * mullion laid off the reference plane met the real brick or glass somewhere along its length (the stone/brick and
 * glass/grid residue after the layered re-installs). Walls are vertical, so their offset depends on `u` alone: every
 * member vertex gives a (u, d) sample, and when the samples at each column agree within 5 mm the panel's parts are laid
 * off that piecewise-linear profile. Null when a column disagrees (a warped or overlapping member) or the wall stays
 * within PROFILE_MIN of the reference plane (output unchanged there).
 */
/**
 * A wall closer than this to the panel's reference plane is left alone: layered parts stand at least 4.5 cm off it
 * (string courses 5 cm), so 1.5 cm keeps them 3 cm clear of the brick, outside the audit's tight band.
 */
const PROFILE_MIN = 0.015;
export function wallProfileOf(p: Panel): WallProfile | null {
  if (!p.members?.length) return null;
  const pts: [number, number][] = [];
  for (const m of p.members) for (const r of m.rings) for (const q of r) { const e = sub(q, p.o); pts.push([dot(p.r, e), dot(p.n, [e[0], 0, e[2]])]); }
  pts.sort((a, b) => a[0] - b[0]);
  const u: number[] = [], d: number[] = [];
  let off = 0;
  for (const [pu, pd] of pts) {
    off = Math.max(off, Math.abs(pd));
    const k = u.length - 1;
    if (k >= 0 && pu - u[k] < 0.01) { if (Math.abs(pd - d[k]) > 0.005) return null; continue; }
    u.push(pu); d.push(pd);
  }
  return off < PROFILE_MIN || u.length < 2 ? null : { u, d };
}
class Ctx {
  /** recess depth (large tier); 0 = openings drawn proud as in the original block kit */
  recess = 0;
  wallSlot = 'wall';
  /** holes cut per member wall (index into `p.members`) */
  holes = new Map<number, HoleRect[]>();
  stats = { recessed: 0, proud: 0, trimmed: 0 };
  /** `ComposeOptions.closedBoxes` */
  closedBoxes = false;
  /** `ComposeOptions.closedBands` (recess mode only) */
  closedBands = false;
  /** `ComposeOptions.barOffsetM` */
  barOut = 0.015;
  glassBack = 0;
  /** `ComposeOptions.layered` (recess mode only) */
  layered = false;
  /** layered balconies laid out on this panel (drawn per storey run after the rows) */
  balconies: { b: BalconyParams; cell: Cell; a0: number; a1: number }[] = [];
  /** Depth of glazing bars (closed boxes from the glass) for a window without its own `barD`. */
  barDepth(w?: { barD?: number }) { return w?.barD ?? (this.layered ? SHEET_PITCH : this.barOut); }
  constructor(public mesh: MeshBuilder, public p: Panel, public panels: Panel[]) {}
  /**
   * Cut a rectangular opening into one member wall when it lies inside it with 3 cm to spare and clear of other holes.
   * Returns the corners on that wall's own plane (bottom-left, bottom-right, top-right, top-left), or null.
   */
  cut(u0: number, u1: number, v0: number, v1: number): V3[] | null {
    const k = this.claim(u0, u1, v0, v1);
    if (k < 0) return null;
    const onWall = this.onMember(k);
    return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => onWall(u, v));
  }
  /**
   * Cut a non-rectangular opening (convex `outline` inside the rectangle u0..u1 x v0..v1) into one member wall, on the
   * same terms as `cut`. Returns a mapper from (u, v) onto that wall's own plane, or null.
   */
  cutOutline(u0: number, u1: number, v0: number, v1: number, outline: [number, number][]): ((u: number, v: number) => V3) | null {
    const k = this.claim(u0, u1, v0, v1, outline);
    return k < 0 ? null : this.onMember(k);
  }
  /**
   * A point `d` in front of the wall face actually emitted at (u, v): the member wall containing (u, v), projected along
   * the panel normal (3DBAG faces merged into one panel can sit a few cm off its reference plane). Falls back to the
   * panel plane outside every member and in the original (non-recess) path.
   */
  onWallAt(u: number, v: number, d = 0): V3 {
    const m = this.p.members, k = m ? m.findIndex(x => insidePoly([u, v], x.poly)) : -1;
    return k < 0 ? this.P(u, v, d) : add(this.onMember(k)(u, v), scale(this.p.n, d));
  }
  /** (u, v) onto member wall k's own plane, along the panel normal. */
  private onMember(k: number): (u: number, v: number) => V3 {
    // layered kit, a member bent across facets: onto the wall's plan profile, where emitWalls lays its faces (`emitFacets`)
    const w = this.profile;
    if (w && this.bent && bentMember(this.p.members![k].rings)) return (u, v) => pt(this.p, u, v, profileAt(w, u));
    const ring = this.p.members![k].rings[0], nm = norm(newell(ring)), q0 = ring[0], n = this.p.n, den = dot(nm, n);
    return (u, v) => { const P = pt(this.p, u, v, 0), t = Math.abs(den) > 1e-6 ? dot(nm, sub(q0, P)) / den : 0; return add(P, scale(n, t)); };
  }
  /** Member wall that takes the rectangle as a hole (recorded), or -1. */
  private claim(u0: number, u1: number, v0: number, v1: number, outline?: [number, number][]): number {
    const members = this.p.members;
    if (!this.recess || !members) return -1;
    const m = 0.03, a0 = u0 - m, a1 = u1 + m, b0 = v0 - m, b1 = v1 + m;
    const inRect = (q: [number, number]) => q[0] > a0 && q[0] < a1 && q[1] > b0 && q[1] < b1;
    const probe: [number, number][] = [[a0, b0], [a1, b0], [a1, b1], [a0, b1], [(a0 + a1) / 2, b0], [(a0 + a1) / 2, b1], [a0, (b0 + b1) / 2], [a1, (b0 + b1) / 2]];
    const rectEdges: [number, number][][] = [[[a0, b0], [a1, b0]], [[a1, b0], [a1, b1]], [[a1, b1], [a0, b1]], [[a0, b1], [a0, b0]]];
    const crosses = (p: [number, number], q: [number, number], r: [number, number], s: [number, number]) => {
      const d = (x: [number, number], y: [number, number], z: [number, number]) => (y[0] - x[0]) * (z[1] - x[1]) - (y[1] - x[1]) * (z[0] - x[0]);
      return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0;
    };
    for (let k = 0; k < members.length; k++) {
      const poly = members[k].poly;
      if (!probe.every(q => insidePoly(q, poly))) continue;
      const rings = [poly.outer, ...poly.holes];
      if (rings.some(ring => ring.some(inRect) || ring.some((q, i) => rectEdges.some(([e0, e1]) => crosses(q, ring[(i + 1) % ring.length], e0, e1))))) continue;
      const list = this.holes.get(k) ?? [];
      if (list.some(h => h[0] < a1 && h[1] > a0 && h[2] < b1 && h[3] > b0)) continue;
      list.push(outline ? [u0, u1, v0, v1, outline] : [u0, u1, v0, v1]); this.holes.set(k, list);
      return k;
    }
    return -1;
  }
  /** Layered kit: the plan profile of the 3DBAG wall parts are laid off (`wallProfileOf`); null = the panel's reference plane. */
  profile: WallProfile | null = null;
  /** the profile bends by more than BEND_TOL somewhere (bent members are cut and emitted on it: `emitFacets`) */
  bent = false;
  P(u: number, v: number, d = 0) { return pt(this.p, u, v, this.profile ? d + profileAt(this.profile, u) : d); }
  part() { return this.mesh.newPart(); }
  /** A flat sheet at an exact depth (a rail hanging off a slab): not lifted onto the wall layers. */
  quadRaw(slot: Slot, u0: number, v0: number, u1: number, v1: number, d: number, part: number) {
    this.mesh.quad(slot, this.P(u0, v0, d), this.P(u1, v0, d), this.P(u1, v1, d), this.P(u0, v1, d), part, this.p.n);
  }
  quad(slot: Slot, u0: number, v0: number, u1: number, v1: number, d: number, part: number) {
    d = liftSheet(d);
    this.mesh.quad(slot, this.P(u0, v0, d), this.P(u1, v0, d), this.P(u1, v1, d), this.P(u0, v1, d), part, this.p.n);
  }
  poly(slot: Slot, pts: [number, number][], d: number, part: number) {
    d = liftSheet(d);
    const faces = T.ShapeUtils.triangulateShape(pts.map(q => new T.Vector2(q[0], q[1])), []);
    for (const f of faces) this.mesh.tri(slot, this.P(...pts[f[0]], d), this.P(...pts[f[1]], d), this.P(...pts[f[2]], d), part, this.p.n);
  }
  /** Box on the wall: faces front, top, bottom, left, right (back omitted: it sits on the wall). */
  box(slot: Slot, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, part: number, shift?: V3) {
    const { mesh, p } = this, P = shift ? (u: number, v: number, d: number) => add(this.P(u, v, d), shift) : (u: number, v: number, d: number) => this.P(u, v, d);
    const bends = this.profile ? kinksIn(this.profile, u0, u1) : [];
    // layered kit: a box laid on the followed wall profile, or shifted onto the cut wall (a hoist door's threshold), needs
    // no back face: its back edges lie on the wall (within BEND_TOL)
    const onWall = this.layered && d0 === 0 && (!!shift || (!!this.profile && !shift));
    if (bends.length) {
      // across a bend in the wall: front, top, bottom (and back) per facet, end caps at u0 and u1 only
      const us = [u0, ...bends, u1];
      for (let i = 0; i + 1 < us.length; i++) {
        const a = us[i], b = us[i + 1];
        mesh.quad(slot, P(a, v0, d1), P(b, v0, d1), P(b, v1, d1), P(a, v1, d1), part, p.n);
        mesh.quad(slot, P(a, v1, d0), P(b, v1, d0), P(b, v1, d1), P(a, v1, d1), part, UP);
        mesh.quad(slot, P(a, v0, d0), P(b, v0, d0), P(b, v0, d1), P(a, v0, d1), part, DOWN);
        if (this.closedBoxes && !onWall) mesh.quad(slot, P(a, v0, d0), P(b, v0, d0), P(b, v1, d0), P(a, v1, d0), part, scale(p.n, -1));
      }
      mesh.quad(slot, P(u0, v0, d0), P(u0, v1, d0), P(u0, v1, d1), P(u0, v0, d1), part, scale(p.r, -1));
      mesh.quad(slot, P(u1, v0, d0), P(u1, v1, d0), P(u1, v1, d1), P(u1, v0, d1), part, p.r);
      return;
    }
    mesh.quad(slot, P(u0, v0, d1), P(u1, v0, d1), P(u1, v1, d1), P(u0, v1, d1), part, p.n);
    mesh.quad(slot, P(u0, v1, d0), P(u1, v1, d0), P(u1, v1, d1), P(u0, v1, d1), part, UP);
    mesh.quad(slot, P(u0, v0, d0), P(u1, v0, d0), P(u1, v0, d1), P(u0, v0, d1), part, DOWN);
    mesh.quad(slot, P(u0, v0, d0), P(u0, v1, d0), P(u0, v1, d1), P(u0, v0, d1), part, scale(p.r, -1));
    mesh.quad(slot, P(u1, v0, d0), P(u1, v1, d0), P(u1, v1, d1), P(u1, v0, d1), part, p.r);
    if (this.closedBoxes && !onWall) mesh.quad(slot, P(u0, v0, d0), P(u1, v0, d0), P(u1, v1, d0), P(u0, v1, d0), part, scale(p.n, -1));
  }
}

export interface Cell { u0: number; u1: number; v0: number; v1: number; bay: number; floor: number; bays: number }
/**
 * A glazing bar, door leaf or stile in front of the glass. Within the default 1.5 cm standoff it is one quad (its edges lie
 * within the 2 cm the open-edge gate treats as touching the glass). Deeper (`ComposeOptions.barOffsetM`, or a window's
 * `barD` from the large tier's `deepBars`) it is a box standing on the glass plane `d0` out to `d1`: far enough to clear
 * the coplanar z-fight band, and still closed (no open edges). One helper for the three lanes that needed it (2026-10-13).
 */
export function barQuad(c: Ctx, slot: Slot, Q: (u: number, v: number, d: number) => V3, a: number, b: number, lo: number, hi: number, d0: number, d1: number, part: number) {
  const { mesh, p } = c;
  mesh.quad(slot, Q(a, lo, d1), Q(b, lo, d1), Q(b, hi, d1), Q(a, hi, d1), part, p.n);
  if (d1 - d0 <= 0.015) return; // within the default standoff: one quad, as every legacy export has it
  mesh.quad(slot, Q(a, hi, d0), Q(b, hi, d0), Q(b, hi, d1), Q(a, hi, d1), part, UP);
  mesh.quad(slot, Q(a, lo, d0), Q(b, lo, d0), Q(b, lo, d1), Q(a, lo, d1), part, DOWN);
  mesh.quad(slot, Q(a, lo, d0), Q(a, hi, d0), Q(a, hi, d1), Q(a, lo, d1), part, scale(p.r, -1));
  mesh.quad(slot, Q(b, lo, d0), Q(b, hi, d0), Q(b, hi, d1), Q(b, lo, d1), part, p.r);
}
/**
 * A closed hexahedron: `Q(i, j, k)` is the corner on u side i, v side j and depth side k (0 = at the wall, 1 = out).
 * Six quads, each facing away from the centre, so a solid with a tilted or tapered face still has no open edge.
 */
export function solid(c: Ctx, slot: Slot, Q: (i: number, j: number, k: number) => V3, part: number) {
  const all: V3[] = []; for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) all.push(Q(i, j, k));
  const ctr = scale(all.reduce((s, q) => add(s, q), [0, 0, 0] as V3), 1 / 8);
  const face = (f: (a: number, b: number) => V3) => {
    const q = [f(0, 0), f(1, 0), f(1, 1), f(0, 1)], fc = scale(q.reduce((s, x) => add(s, x), [0, 0, 0] as V3), 0.25);
    c.mesh.quad(slot, q[0], q[1], q[2], q[3], part, sub(fc, ctr));
  };
  for (const k of [0, 1]) face((a, b) => Q(a, b, k));
  for (const j of [0, 1]) face((a, b) => Q(a, j, b));
  for (const i of [0, 1]) face((a, b) => Q(i, a, b));
}

/** Tilted bay (box) window frame (`WinParams.tilt`): sill, head and two cheeks as closed solids whose front leans from `outBottom` to `outTop`. */
function drawTilt(c: Ctx, u0: number, u1: number, v0: number, v1: number, tilt: NonNullable<WinParams['tilt']>) {
  const t = tilt.t, vb = v0 - t, vt = v1 + t;
  if (!fitsPanel(c.p, rectPoly(u0 - t, u1 + t, vb, vt))) return;
  const D = (v: number) => tilt.outBottom + (tilt.outTop - tilt.outBottom) * (v - vb) / (vt - vb), part = c.part();
  for (const [a, b, lo, hi] of [[u0 - t, u1 + t, vb, v0], [u0 - t, u1 + t, v1, vt], [u0 - t, u0, v0, v1], [u1, u1 + t, v0, v1]]) {
    const us = [a, b], vs = [lo, hi];
    solid(c, tilt.slot, (i, j, k) => c.P(us[i], vs[j], k ? D(vs[j]) : 0), part);
  }
}
export { Ctx as PanelCtx, drawOpening, stripBox, intervals };
const frac = (x: number | undefined, total: number, dflt: number) => { const v = x ?? dflt; return v <= 1 ? v * total : v; };

/**
 * Pane-split glazing (`WinParams.paneSplit`): the panes stand one sheet layer in front of the frame sheet, clear of the audit's
 * 3 cm coplanar bands even on a skewed 3DBAG cut (audit:glb joins such assemblies at 10 cm: LAYERED_SHEET_IDS).
 */
export const PANE_OUT_M = SHEET_PITCH;
/**
 * The pane rectangles of an opening: inset `fw` from its edges, split at the glazing-bar fractions `mulls` (of the width) and
 * `rows` (of the height) by gaps `bw` wide. Bars that would leave a pane under 4 cm are dropped.
 */
export function paneRects(u0: number, u1: number, v0: number, v1: number, fw: number, bw: number, mulls: number[], rows: number[]): [number, number, number, number][] {
  const cuts = (a: number, b: number, at: number[], len: number): [number, number][] => {
    const out: [number, number][] = [];
    let lo = a;
    for (const f of [...at].sort((p, q) => p - q)) {
      const m = a - fw + len * f;
      if (m - bw / 2 - lo < 0.04 || b - (m + bw / 2) < 0.04) continue;
      out.push([lo, m - bw / 2]); lo = m + bw / 2;
    }
    if (b - lo > 0.01) out.push([lo, b]);
    return out;
  };
  const us = cuts(u0 + fw, u1 - fw, mulls, u1 - u0), vs = cuts(v0 + fw, v1 - fw, rows, v1 - v0), out: [number, number, number, number][] = [];
  for (const [lo, hi] of vs) for (const [a, b] of us) out.push([a, b, lo, hi]);
  return out;
}

/** Returns the depth of the glass plane (m in front of the wall; negative when recessed), or null when nothing was drawn. */
function drawOpening(c: Ctx, u0: number, u1: number, v0: number, v1: number, w: WinParams, seed: number): number | null {
  const frameSlot = w.frame ?? 'frame', glassSlot = w.glass ?? 'glass', fw = w.frameW ?? 0.07;
  if (u1 - u0 < 0.3 || v1 - v0 < 0.3) return null;
  if (!fitsPanel(c.p, rectPoly(u0 - (w.surround?.t ?? 0), u1 + (w.surround?.t ?? 0), v0 - (w.sillSlot ? (w.sillH ?? 0.05) : 0), v1 + (w.surround?.t ?? 0)))) return null;
  if (w.arch) return drawArched(c, u0, u1, v0, v1, w);
  if (c.recess > 0) return drawRecessed(c, u0, u1, v0, v1, w);
  if (w.surround) {
    const t = w.surround.t, out = w.surround.out ?? 0.06, part = c.part();
    c.box(w.surround.slot, u0 - t, u0, v0 - t, v1 + t, 0, out, part);
    c.box(w.surround.slot, u1, u1 + t, v0 - t, v1 + t, 0, out, part);
    c.box(w.surround.slot, u0, u1, v1, v1 + t, 0, out, part);
    c.box(w.surround.slot, u0, u1, v0 - t, v0, 0, out, part);
  }
  let part = c.part();
  c.quad(frameSlot, u0, v0, u1, v1, 0.02, part);
  part = c.part();
  c.quad(glassSlot, u0 + fw, v0 + fw, u1 - fw, v1 - fw, 0.035, part);
  const n = w.mull ?? 0;
  if (w.mullAt?.length) {
    part = c.part();
    for (const f of w.mullAt) { const u = u0 + (u1 - u0) * f; c.quad(frameSlot, u - fw / 2, v0 + fw, u + fw / 2, v1 - fw, 0.05, part); }
  } else if (n > 0) {
    part = c.part();
    for (let k = 1; k <= n; k++) { const u = u0 + (u1 - u0) * k / (n + 1); c.quad(frameSlot, u - fw / 2, v0 + fw, u + fw / 2, v1 - fw, 0.05, part); }
  }
  if (w.transom) {
    part = c.part();
    const v = v0 + (v1 - v0) * w.transom;
    c.quad(frameSlot, u0 + fw, v - fw / 2, u1 - fw, v + fw / 2, 0.05, part);
  }
  const rn = w.rows ?? 0;
  if (w.rowsAt?.length) {
    part = c.part();
    for (const f of w.rowsAt) { const v = v0 + (v1 - v0) * f; c.quad(frameSlot, u0 + fw, v - fw / 2, u1 - fw, v + fw / 2, 0.05, part); }
  } else if (rn > 0) {
    part = c.part();
    for (let k = 1; k <= rn; k++) { const v = v0 + (v1 - v0) * k / (rn + 1); c.quad(frameSlot, u0 + fw, v - fw / 2, u1 - fw, v + fw / 2, 0.05, part); }
  }
  if (w.louvre) {
    const lw = w.louvre.w, a = w.louvre.side === 'right' ? u1 - fw - lw : u0 + fw, slot = w.louvre.slot ?? 'louvre';
    part = c.part();
    c.quad(slot, a, v0 + fw, a + lw, v1 - fw, 0.06, part);
    for (let v = v0 + 0.25; v < v1 - 0.2; v += 0.14) c.quad(frameSlot, a, v, a + lw, v + 0.025, 0.075, part);
  }
  if (w.sillSlot) { part = c.part(); const sh = w.sillH ?? 0.07; c.box(w.sillSlot, u0 - 0.08, u1 + 0.08, v0 - sh, v0, 0, w.sillOut ?? 0.12, part); }
  if (w.headSlot) { part = c.part(); c.box(w.headSlot, u0 - 0.06, u1 + 0.06, v1, v1 + 0.12, 0, 0.08, part); }
  void seed;
  return 0.035;
}

/**
 * Large-tier opening: a hole in the host wall with four reveals `c.recess` deep, closed at the back by the glass and a
 * frame ring of width `frameW` in one plane (abutting, so nothing z-fights); glazing bars sit 1.5 cm in front of the
 * glass; sill/head/surround project from the wall face as usual. Where the opening cannot be cut (straddles two 3DBAG
 * surfaces, or pokes past a step in the wall outline by more than OPENING_TRIM_M) the same glass + frame ring is laid
 * 1.5 cm in front of the wall instead, so its edges stay within the open-edge gate's 2 cm. Returns the glass depth
 * (negative = behind the wall face).
 */
function drawRecessed(c: Ctx, u0: number, u1: number, v0: number, v1: number, w: WinParams): number {
  const frameSlot = w.frame ?? 'frame', glassSlot = w.glass ?? 'glass', n = c.p.n;
  let corners = c.cut(u0, u1, v0, v1);
  // A head or sill a few cm into a step of the wall outline (Singel 457: the 3DBAG face steps back over the window at
  // 13.28 m and the head stood 3 mm into the gap): lower the head, or raise the sill, by up to OPENING_TRIM_M and cut the
  // opening there instead of laying it proud, where it z-fought the brick.
  for (let t = 0.01; !corners && t <= OPENING_TRIM_M + 1e-9; t += 0.01) {
    const h = +t.toFixed(2);
    if ((corners = c.cut(u0, u1, v0, v1 - h))) { v1 -= h; c.stats.trimmed++; break; }
    if ((corners = c.cut(u0, u1, v0 + h, v1))) { v0 += h; c.stats.trimmed++; break; }
  }
  const fw = Math.min(w.frameW ?? 0.07, (u1 - u0) / 4, (v1 - v0) / 4);
  let back: number, Q: (u: number, v: number, d: number) => V3;
  const part = c.part();
  if (corners) {
    c.stats.recessed++;
    const R = w.loggia?.depth ?? c.recess, inner = corners.map(q => add(q, scale(n, -R))), [bl, br, tr, tl] = corners, [ibl, ibr, itr, itl] = inner;
    c.mesh.quad(c.wallSlot, bl, br, ibr, ibl, part, UP);
    c.mesh.quad(c.wallSlot, tl, tr, itr, itl, part, DOWN);
    c.mesh.quad(c.wallSlot, bl, tl, itl, ibl, part, c.p.r);
    c.mesh.quad(c.wallSlot, br, tr, itr, ibr, part, scale(c.p.r, -1));
    // Bilinear over the back corners: ring and glass vertices weld exactly with the reveals.
    const lerp = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    Q = (u, v, d) => {
      const s = (u - u0) / (u1 - u0), t = (v - v0) / (v1 - v0);
      return add(lerp(lerp(ibl, ibr, s), lerp(itl, itr, s), t), scale(n, d));
    };
    back = -R;
  } else {
    c.stats.proud++;
    Q = (u, v, d) => c.P(u, v, d + 0.015);
    back = 0.015;
  }
  const g = (a: number, b: number, lo: number, hi: number, slot: string, d: number, pt = part) => c.mesh.quad(slot, Q(a, lo, d), Q(b, lo, d), Q(b, hi, d), Q(a, hi, d), pt, n);
  if (w.paneSplit) {
    // one frame sheet at the back, the panes in front of it: ring and bars are the sheet between the panes
    g(u0, u1, v0, v1, frameSlot, 0);
    const mulls = w.mullAt?.length ? w.mullAt : Array.from({ length: w.mull ?? 0 }, (_, k) => (k + 1) / ((w.mull ?? 0) + 1));
    const rows = w.rowsAt?.length ? w.rowsAt : Array.from({ length: w.rows ?? 0 }, (_, k) => (k + 1) / ((w.rows ?? 0) + 1));
    for (const [a, b, lo, hi] of paneRects(u0, u1, v0, v1, fw, fw > 0 ? fw : 0.06, mulls, [...rows, ...(w.transom ? [w.transom] : [])])) g(a, b, lo, hi, glassSlot, PANE_OUT_M);
  } else if (w.loggia?.back) {
    // a loggia whose back is a wall with rows of windows: abutting quads on the back plane (wall strips between the
    // rows, piers between the windows), no frame ring, no overlap
    const rows = [...w.loggia.back.rows].sort((p, q) => p.lo - q.lo), wp = c.part();
    let vAt = v0;
    for (const r of rows) {
      const lo = Math.max(vAt, v0 + (v1 - v0) * r.lo), hi = Math.min(v1, v0 + (v1 - v0) * r.hi);
      if (hi - lo < 0.2) continue;
      if (lo > vAt) g(u0, u1, vAt, lo, c.wallSlot, 0, wp);
      const n = Math.max(1, Math.round((u1 - u0) / r.pitch)), step = (u1 - u0) / n, ww = Math.min(r.winW, step - 0.1);
      let at = u0;
      for (let k = 0; k < n; k++) { const a = u0 + step * (k + 0.5) - ww / 2; g(at, a, lo, hi, c.wallSlot, 0, wp); g(a, a + ww, lo, hi, glassSlot, 0, wp); at = a + ww; }
      g(at, u1, lo, hi, c.wallSlot, 0, wp);
      vAt = hi;
    }
    if (vAt < v1) g(u0, u1, vAt, v1, c.wallSlot, 0, wp);
  } else {
    g(u0, u1, v0, v0 + fw, frameSlot, 0); g(u0, u1, v1 - fw, v1, frameSlot, 0);
    g(u0, u0 + fw, v0 + fw, v1 - fw, frameSlot, 0); g(u1 - fw, u1, v0 + fw, v1 - fw, frameSlot, 0);
    g(u0 + fw, u1 - fw, v0 + fw, v1 - fw, glassSlot, -c.glassBack);
    const mulls = w.mullAt?.length ? w.mullAt : Array.from({ length: w.mull ?? 0 }, (_, k) => (k + 1) / ((w.mull ?? 0) + 1));
    const rows = w.rowsAt?.length ? w.rowsAt : Array.from({ length: w.rows ?? 0 }, (_, k) => (k + 1) / ((w.rows ?? 0) + 1));
    if (mulls.length || rows.length || w.transom) {
      // frameW 0 (no frame ring: the glass fills the opening) still takes 6 cm glazing bars
      const bars = c.part(), bw = fw > 0 ? fw : 0.06;
      const bd = c.barDepth(w);
      for (const f of mulls) { const u = u0 + (u1 - u0) * f; barQuad(c, frameSlot, Q, u - bw / 2, u + bw / 2, v0 + fw, v1 - fw, 0, bd, bars); }
      for (const f of [...rows, ...(w.transom ? [w.transom] : [])]) { const v = v0 + (v1 - v0) * f; barQuad(c, frameSlot, Q, u0 + fw, u1 - fw, v - bw / 2, v + bw / 2, 0, bd, bars); }
    }
    if (w.sash) drawSash(c, Q, u0, u1, v0, v1, fw, w);
  }
  if (w.surround) {
    const t = w.surround.t, out = w.surround.out ?? 0.06, sp = c.part();
    c.box(w.surround.slot, u0 - t, u0, v0 - t, v1 + t, 0, out, sp);
    c.box(w.surround.slot, u1, u1 + t, v0 - t, v1 + t, 0, out, sp);
    c.box(w.surround.slot, u0, u1, v1, v1 + t, 0, out, sp);
    c.box(w.surround.slot, u0, u1, v0 - t, v0, 0, out, sp);
  }
  if (w.sillSlot) {
    const sp = c.part(), sh = w.sillH ?? 0.07;
    const shift = w.sillOnWall && corners ? scale(corners.reduce((s, q, i) => add(s, sub(q, c.P(i === 0 || i === 3 ? u0 : u1, i < 2 ? v0 : v1, 0))), [0, 0, 0] as V3), 0.25) : undefined;
    c.box(w.sillSlot, u0 - 0.08, u1 + 0.08, v0 - sh, v0, 0, w.sillOut ?? 0.12, sp, shift);
  }
  if (w.headSlot) { const sp = c.part(); c.box(w.headSlot, u0 - 0.06, u1 + 0.06, v1, v1 + 0.12, 0, 0.08, sp); }
  if (w.tilt) drawTilt(c, u0, u1, v0, v1, w.tilt);
  if (w.loggia?.rail && corners) drawLoggiaRail(c, Q, u0, u1, v0, v1, -back, w.loggia.rail, w.frame ?? 'frame');
  return back;
}

/** Side-light ring width (m) when `WinParams.sash.t` is not given, and its clearance (m) from the bars round it. */
export const SASH_RING = { t: 0.05, gap: 0.01 };

/**
 * A side light (`WinParams.sash`) in a recessed opening: the mullion at `w` of the width from `side` and the bars at
 * `low` / `high` in the window's frame slot, then the light's own ring in `sash.slot`, all closed bars standing on the
 * glass (`Q` maps onto the back plane) as deep as the glazing bars. The ring keeps `SASH_RING.gap` clear of the frame and
 * bars, so no two solids share a face.
 */
function drawSash(c: Ctx, Q: (u: number, v: number, d: number) => V3, u0: number, u1: number, v0: number, v1: number, fw: number, w: WinParams) {
  const sa = w.sash!, frameSlot = w.frame ?? 'frame', bw = fw > 0 ? fw : 0.06, bd = c.barDepth(w), part = c.part(), gap = SASH_RING.gap;
  const W = u1 - u0, H = v1 - v0, t = Math.min(sa.t ?? SASH_RING.t, W / 6, H / 6);
  let a = u0 + fw, b = u1 - fw, lo = v0 + fw, hi = v1 - fw;
  if (sa.w < 1) {
    const um = sa.side === 'left' ? u0 + W * sa.w : u1 - W * sa.w;
    barQuad(c, frameSlot, Q, um - bw / 2, um + bw / 2, v0 + fw, v1 - fw, 0, bd, part);
    if (sa.side === 'left') b = um - bw / 2; else a = um + bw / 2;
  }
  if (sa.low > 0) { const v = v0 + H * sa.low; barQuad(c, frameSlot, Q, u0 + fw, u1 - fw, v - bw / 2, v + bw / 2, 0, bd, part); lo = v + bw / 2; }
  if (sa.high < 1) { const v = v0 + H * sa.high; barQuad(c, frameSlot, Q, u0 + fw, u1 - fw, v - bw / 2, v + bw / 2, 0, bd, part); hi = v - bw / 2; }
  a += gap; b -= gap; lo += gap; hi -= gap;
  if (b - a < 3 * t || hi - lo < 3 * t) return;
  barQuad(c, sa.slot, Q, a, b, lo, lo + t, 0, bd, part); barQuad(c, sa.slot, Q, a, b, hi - t, hi, 0, bd, part);
  barQuad(c, sa.slot, Q, a, a + t, lo + t, hi - t, 0, bd, part); barQuad(c, sa.slot, Q, b - t, b, lo + t, hi - t, 0, bd, part);
}

/** Loggia balustrade: bar pitch (m) for `bars` rails, bar width, sheet thickness and the top rail height (m). */
export const LOGGIA_RAIL = { barPitchM: 1.0, barW: 0.04, sheetT: 0.02, topH: 0.05 };

/**
 * A loggia's balustrade (`WinParams.loggia.rail`) across the opening, `inset` behind the wall face of a recess `depth`
 * deep (`Q` maps onto the back plane, `d` m out): a glass or solid sheet under a top rail, or a top rail on bars, all
 * closed solids standing on the loggia floor between the side returns (no open edge).
 */
function drawLoggiaRail(c: Ctx, Q: (u: number, v: number, d: number) => V3, u0: number, u1: number, v0: number, v1: number,
  depth: number, rail: NonNullable<NonNullable<WinParams['loggia']>['rail']>, frameSlot: string) {
  const d = Math.max(0.08, depth - (rail.inset ?? 0.12)), top = Math.min(v1 - 0.1, v0 + rail.h), part = c.part(), L = LOGGIA_RAIL;
  if (top - v0 < 0.3) return;
  const box = (slot: string, a: number, b: number, lo: number, hi: number, d0: number, d1: number) =>
    solid(c, slot, (i, j, k) => Q(i ? b : a, j ? hi : lo, k ? d1 : d0), part);
  if (rail.kind === 'bars') {
    const n = Math.max(2, Math.round((u1 - u0) / L.barPitchM));
    for (let k = 1; k < n; k++) { const u = u0 + (u1 - u0) * k / n; box(rail.slot, u - L.barW / 2, u + L.barW / 2, v0, top - L.topH, d - L.barW, d); }
  } else box(rail.slot, u0, u1, v0, top - L.topH, d - L.sheetT, d);
  box(rail.kind === 'bars' ? rail.slot : frameSlot, u0, u1, top - L.topH, top, d - 0.05, d + 0.01);
}

/** Arched opening (`WinParams.arch`): arch.ts cuts it (recess mode) or lays it proud; sill as for a rectangular one. */
function drawArched(c: Ctx, u0: number, u1: number, v0: number, v1: number, w: WinParams): number {
  const a = { frame: w.frame ?? 'frame', glass: w.glass ?? 'glass', frameW: w.frameW ?? 0.07, arch: w.arch!, barD: c.barDepth(w), ...(w.paneSplit ? { paneSplit: true } : {}),
    mullAt: w.mullAt?.length ? w.mullAt : Array.from({ length: w.mull ?? 0 }, (_, k) => (k + 1) / ((w.mull ?? 0) + 1)),
    rowsAt: [...(w.rowsAt?.length ? w.rowsAt : Array.from({ length: w.rows ?? 0 }, (_, k) => (k + 1) / ((w.rows ?? 0) + 1))), ...(w.transom ? [w.transom] : [])] };
  let back = 0.035, shift: V3 | null = null;
  if (c.recess > 0) ({ back, shift } = drawArchedOpening(c, u0, u1, v0, v1, a)); else drawArchedProud(c, u0, u1, v0, v1, a);
  // the sill stands on the cut wall (arched openings always; the panel plane otherwise)
  if (w.sillSlot) { const sp = c.part(), sh = w.sillH ?? 0.07; c.box(w.sillSlot, u0 - 0.08, u1 + 0.08, v0 - sh, v0, 0, w.sillOut ?? 0.12, sp, shift ?? undefined); }
  return back;
}

/** One opening, or with `w.group` its `count` windows side by side across [u0, u1] with `gap` of wall between them. */
function drawGrouped(c: Ctx, u0: number, u1: number, v0: number, v1: number, w: WinParams, seed: number): number | null {
  if (!w.group || w.group.count < 2) return drawOpening(c, u0, u1, v0, v1, w, seed);
  const { count, gap } = w.group, lw = (u1 - u0 - gap * (count - 1)) / count, { group: _g, ...one } = w;
  let back: number | null = null;
  for (let k = 0; k < count; k++) { const a = u0 + k * (lw + gap), r = drawOpening(c, a, a + lw, v0, v1, one, seed); back = back ?? r; }
  return back;
}

function winRect(cell: Cell, w: WinParams): [number, number, number, number] {
  const cw = cell.u1 - cell.u0, ch = cell.v1 - cell.v0, uc = (cell.u0 + cell.u1) / 2;
  const ww = Math.min(cw - 0.1, frac(w.w, cw, 0.5)), wh = Math.min(ch - 0.2, frac(w.h, ch, 0.6)), v0 = cell.v0 + (w.sill ?? 0.9);
  return [uc - ww / 2, uc + ww / 2, v0, Math.min(v0 + wh, cell.v1 - 0.1)];
}

function drawRow(c: Ctx, row: Row, cell: Cell, seed: number) {
  c.mesh.label = `panel${c.p.index}:f${cell.floor}:b${cell.bay}:${row.kind}`;
  if (row.cycle?.length) { row = row.cycle[((cell.bay + (row.shift ?? 0) * cell.floor) % row.cycle.length + row.cycle.length) % row.cycle.length]; }
  const { u0, u1, v0, v1 } = cell;
  switch (row.kind) {
    case 'wall': return;
    case 'stack': { for (const it of row.stack ?? []) drawRow(c, it.row, { ...cell, v0: cell.v0 + it.v0, v1: Math.min(cell.v1, cell.v0 + it.v1) }, seed); return; }
    case 'punched': { const w = row.win ?? {}; const [a, b, lo, hi] = winRect(cell, w); drawGrouped(c, a, b, lo, hi, w, seed); return; }
    case 'glazed': {
      const w = { w: 0.92, h: 0.86, sill: 0.12, ...(row.win ?? {}) };
      const [a, b, lo, hi] = winRect(cell, w);
      const door = row.door && (row.door.bays ?? []).includes(cell.bay) ? row.door : null;
      if (door?.portal) {
        const t = door.portal.t, out = door.portal.out ?? 0.1, pt0 = c.part();
        if (fitsPanel(c.p, rectPoly(a - t, b + t, lo, hi + t))) {
          c.box(door.portal.slot, a - t, a, lo, hi + t, 0, out, pt0); c.box(door.portal.slot, b, b + t, lo, hi + t, 0, out, pt0); c.box(door.portal.slot, a, b, hi, hi + t, 0, out, pt0);
        }
      }
      const back = drawOpening(c, a, b, lo, hi, w, seed);
      if (door) {
        const dw = door.w ?? 1.1, dh = door.h ?? 2.3, uc = (a + b) / 2, part = c.part();
        if (!fitsPanel(c.p, rectPoly(uc - dw / 2, uc + dw / 2, lo, lo + dh))) return;
        // layered: the leaf is a closed box on the glass (its own sheet layer), not a quad 1.5 cm in front of it
        if (c.layered && back !== null) c.box(door.slot ?? 'door', uc - dw / 2, uc + dw / 2, lo, lo + dh, back, back + c.barDepth(w), part);
        else c.quad(door.slot ?? 'door', uc - dw / 2, lo, uc + dw / 2, lo + dh, c.recess > 0 && back !== null ? back + c.barOut : 0.02, part);
      }
      return;
    }
    case 'ribbon': {
      const w = { h: 0.62, sill: 0.8, mull: 1, ...(row.win ?? {}) }, pier = row.pier ?? 0.5;
      const cu0 = u0 + pier / 2, cu1 = u1 - pier / 2, ch = v1 - v0, wh = Math.min(ch - 0.25, frac(w.h, ch, 0.62));
      drawOpening(c, cu0, cu1, v0 + (w.sill ?? 0.8), v0 + (w.sill ?? 0.8) + wh, w, seed);
      return;
    }
    case 'balcony': return drawBalcony(c, row.balcony ?? {}, cell, seed);
    case 'curtain': {
      const cu = row.curtain!; const fwid = cu.frame ?? 0.09, inset = cu.inset ?? 0.035;
      const variants = cu.variants, vi = Math.floor(rand(cell.bay, cell.floor, seed) * variants.length), rowsF = variants[vi];
      const ch = v1 - v0, cw = u1 - u0;
      let vv = v1;
      rowsF.forEach((cols, ri) => {
        const rh = ch / rowsF.length, top = vv, bot = vv - rh; vv = bot; let uu = u0;
        cols.forEach((cf, ci) => {
          const x0 = uu, x1 = uu + cw * cf; uu = x1;
          const g = cu.glass2 && rand(cell.bay * 7 + ci, cell.floor * 5 + ri, seed + 3) < (cu.glass2Ratio ?? 0.15) ? cu.glass2 : (cu.glass ?? 'glass');
          if (!fitsPanel(c.p, rectPoly(x0 + fwid / 2, x1 - fwid / 2, bot + fwid / 2, top - fwid / 2))) return;
          const part = c.part();
          c.quad(g, x0 + fwid / 2, bot + fwid / 2, x1 - fwid / 2, top - fwid / 2, inset, part);
        });
      });
      return;
    }
    case 'panes': return drawPanes(c, row.panes!, cell);
    case 'items': {
      const lists = row.items ?? [], list = lists[Math.min(cell.floor, lists.length - 1)] ?? [];
      for (const it of list) {
        const a = u0 + it.u[0], b = u0 + it.u[1], lo = v0 + it.v[0], hi = v0 + it.v[1];
        if (!fitsPanel(c.p, rectPoly(a, b, lo, hi))) { if (process.env.KIT_DEBUG) console.warn(`items skip panel${c.p.index} f${cell.floor} ${it.kind} ${it.slot} u${a.toFixed(2)}-${b.toFixed(2)} v${lo.toFixed(2)}-${hi.toFixed(2)}`); continue; }
        const part = c.part();
        if (it.kind === 'quad') c.quad(it.slot ?? 'glass', a, lo, b, hi, it.d ?? 0.02, part);
        else if (it.kind === 'box') c.box(it.slot ?? 'slab', a, b, lo, hi, 0, it.d ?? 0.1, part);
        else drawOpening(c, a, b, lo, hi, it.win ?? {}, seed);
      }
      return;
    }
    case 'shopfront': return drawShopfront(c, row.shopfront!, cell);
    case 'pointed': return drawPointed(c, row.pointed!, cell);
    case 'gable': {
      const g = row.gable ?? {}, cw = u1 - u0, uc = (u0 + u1) / 2, m = g.margin ?? 0.35, ww = cw - 2 * m, ch = v1 - v0;
      const base = v0 + (g.sill ?? 0.6), shoulder = base + (g.shoulder ?? ch * 0.55), apex = shoulder + (g.apex ?? ww * 0.45);
      const outline: [number, number][] = [[uc - ww / 2, base], [uc + ww / 2, base], [uc + ww / 2, shoulder], [uc, apex], [uc - ww / 2, shoulder]];
      if (!fitsPanel(c.p, outline)) return;
      const fw = g.frameW ?? 0.09, inner: [number, number][] = [[uc - ww / 2 + fw, base + fw], [uc + ww / 2 - fw, base + fw], [uc + ww / 2 - fw, shoulder], [uc, apex - fw * 1.5], [uc - ww / 2 + fw, shoulder]];
      let part = c.part();
      c.poly(g.frame ?? 'frame', outline, 0.02, part);
      part = c.part();
      c.poly(g.glass ?? 'glass', inner, 0.035, part);
      const n = g.mull ?? 2; part = c.part();
      for (let k = 1; k <= n; k++) { const u = uc - ww / 2 + ww * k / (n + 1); c.quad(g.frame ?? 'frame', u - 0.025, base + fw, u + 0.025, shoulder + (apex - shoulder) * (1 - Math.abs(u - uc) / (ww / 2)) - fw * 1.5, 0.05, part); }
      c.quad(g.frame ?? 'frame', uc - ww / 2 + fw, shoulder - 0.03, uc + ww / 2 - fw, shoulder + 0.03, 0.05, part);
      return;
    }
  }
}

function drawPanes(c: Ctx, pa: PanesParams, cell: Cell) {
  const table = pa.table, rowT = table[Math.min(cell.floor, table.length - 1)], code = rowT[Math.min(cell.bay, rowT.length - 1)];
  const cols = pa.layouts[code]; if (!cols) throw new Error(`panes: unknown layout "${code}"`);
  const he = pa.heavyEvery ?? 2, sh = pa.heavyShift ?? 0, left = he > 0 && (cell.bay + sh) % he === 0 ? pa.heavy : pa.light, right = he > 0 && (cell.bay + sh) % he === he - 1 ? pa.heavy : pa.light;
  const x0 = cell.u0 + left / 2, x1 = cell.u1 - right / 2, y0 = cell.v0 + (pa.beam ?? pa.light) / 2, y1 = cell.v1 - (pa.beam ?? pa.light) / 2, inset = pa.inset ?? 0.04;
  if (x1 - x0 < 0.4 || y1 - y0 < 0.4 || !fitsPanel(c.p, rectPoly(x0, x1, y0, y1))) return;
  const total = cols.reduce<number>((t, k) => t + Math.abs(Array.isArray(k) ? k[0] : k), 0);
  const frame = pa.frame ?? 'frame', out = pa.frameOut ?? 0;
  let u = x0;
  cols.forEach((k, i) => {
    const frac = Array.isArray(k) ? k[0] : k, n = Array.isArray(k) ? k[1] : 1, w = (x1 - x0) * Math.abs(frac) / total, a = u, b = u + w; u = b;
    const m = pa.mull / 2, ga = i === 0 ? a : a + m, gb = i === cols.length - 1 ? b : b - m;
    for (let r = 0; r < n; r++) {
      const lo = y0 + (y1 - y0) * r / n + (r === 0 ? 0 : m), hi = y0 + (y1 - y0) * (r + 1) / n - (r === n - 1 ? 0 : m);
      const part = c.part();
      c.quad(frac < 0 ? (pa.solid ?? 'door') : (pa.glass2 && (i + r) % 5 === 4 ? pa.glass2 : pa.glass), ga, lo, gb, hi, inset, part);
    }
    if (i > 0 && out > 0) { const part = c.part(); c.box(frame, a - m, a + m, y0, y1, 0, out * 0.6, part); }
  });
  if (out > 0) {
    const part = c.part(), l = cell.u0, r = cell.u1;
    c.box(frame, l, x0, cell.v0, cell.v1, 0, out, part); c.box(frame, x1, r, cell.v0, cell.v1, 0, out, part);
    c.box(frame, x0, x1, cell.v0, y0, 0, out, part); c.box(frame, x0, x1, y1, cell.v1, 0, out, part);
  }
}

function glazedPanel(c: Ctx, u0: number, u1: number, v0: number, v1: number, cols: number, rows: number, frame: Slot, glass: Slot, splitV?: number) {
  const fw = 0.06;
  let part = c.part();
  c.quad(frame, u0, v0, u1, v1, 0.02, part);
  part = c.part();
  c.quad(glass, u0 + fw, v0 + fw, u1 - fw, v1 - fw, 0.035, part);
  part = c.part();
  for (let k = 1; k < cols; k++) { const u = u0 + (u1 - u0) * k / cols; c.quad(frame, u - 0.03, v0 + fw, u + 0.03, v1 - fw, 0.05, part); }
  for (let k = 1; k < rows; k++) { const v = splitV !== undefined && rows === 2 ? splitV : v0 + (v1 - v0) * k / rows; c.quad(frame, u0 + fw, v - 0.03, u1 - fw, v + 0.03, 0.05, part); }
}

function drawShopfront(c: Ctx, s: import('./spec.ts').ShopfrontParams, cell: Cell) {
  const uc = (cell.u0 + cell.u1) / 2, t = s.surround.t, out = s.surround.out ?? 0.1, W = s.w, v0 = cell.v0;
  const a = uc - W / 2 + t, b = uc + W / 2 - t, vt = v0 + s.top - t, frame = s.frame ?? 'frame', glass = s.glass ?? 'glass';
  if (!fitsPanel(c.p, rectPoly(a - t, b + t, v0, vt + t))) return;
  let part = c.part();
  c.box(s.surround.slot, a - t, a, v0, vt + t, 0, out, part); c.box(s.surround.slot, b, b + t, v0, vt + t, 0, out, part); c.box(s.surround.slot, a, b, vt, vt + t, 0, out, part);
  const up = s.upper, sp = s.spandrel, lo = s.lower;
  glazedPanel(c, a, b, v0 + up.v0, v0 + up.v1, up.cols, up.rows, frame, glass, up.splitV !== undefined ? v0 + up.splitV : undefined);
  part = c.part();
  c.quad(sp.slot ?? frame, a, v0 + sp.v0, b, v0 + sp.v1, 0.03, part);
  glazedPanel(c, a, b, v0 + 0.08, v0 + lo.v1, lo.cols, 1, frame, glass);
  const dw = s.door.w, dh = s.door.h, du = uc + s.door.offsets[cell.bay % s.door.offsets.length];
  part = c.part();
  c.quad(frame, du - dw / 2 - 0.05, v0 + 0.08, du + dw / 2 + 0.05, v0 + dh + 0.05, 0.02, part);
  c.quad(s.door.slot ?? 'door', du - dw / 2, v0 + 0.08, du + dw / 2, v0 + dh, 0.035, part);
}

function drawPointed(c: Ctx, g: import('./spec.ts').PointedParams, cell: Cell) {
  const uc = (cell.u0 + cell.u1) / 2, hw = g.w / 2, v0 = cell.v0, bot = v0 + g.bottom, sh = v0 + g.shoulder, ap = v0 + g.apex, frame = g.frame ?? 'frame', glass = g.glass ?? 'glass';
  const l0 = v0 + g.ledge.v0, l1 = v0 + g.ledge.v1, lo = g.ledge.out ?? 0.2, t = g.surround?.t ?? 0;
  const outline: [number, number][] = [[uc - hw - t, bot - t], [uc + hw + t, bot - t], [uc + hw + t, sh], [uc, ap + t * 1.5], [uc - hw - t, sh]];
  if (!fitsPanel(c.p, outline)) return;
  let part = c.part();
  if (g.surround) c.poly(g.surround.slot, outline, 0.015, part);
  glazedPanel(c, uc - hw, uc + hw, bot, l0, g.lowerCols, g.lowerRows, frame, glass);
  const up: [number, number][] = [[uc - hw, l1], [uc + hw, l1], [uc + hw, sh], [uc, ap], [uc - hw, sh]];
  part = c.part(); c.poly(frame, up, 0.02, part);
  const fw = 0.06, inner: [number, number][] = [[uc - hw + fw, l1 + fw], [uc + hw - fw, l1 + fw], [uc + hw - fw, sh], [uc, ap - fw * 1.5], [uc - hw + fw, sh]];
  part = c.part(); c.poly(glass, inner, 0.035, part);
  part = c.part();
  for (let k = 1; k < g.upperCols; k++) {
    const u = uc - hw + g.w * k / g.upperCols, top = sh + (ap - sh) * (1 - Math.abs(u - uc) / hw) - fw * 1.5;
    c.quad(frame, u - 0.03, l1 + fw, u + 0.03, top, 0.05, part);
  }
  for (let k = 1; k < g.upperRows; k++) { const v = l1 + (sh - l1) * k / g.upperRows; c.quad(frame, uc - hw + fw, v - 0.03, uc + hw - fw, v + 0.03, 0.05, part); }
  part = c.part();
  c.box(g.ledge.slot ?? 'stone', uc - hw - t, uc + hw + t, l0, l1, 0, lo, part);
}

function drawBalcony(c: Ctx, b: BalconyParams, cell: Cell, seed: number) {
  const { u0, u1, v0, v1 } = cell, depth = b.depth ?? 1.4, sh = b.slab?.h ?? 0.2, slab = b.slab?.slot ?? 'slab';
  const rail = b.rail ?? {}, rh = rail.h ?? 1.05;
  const inner = b.piers ? b.piers.w : 0;
  const ucb = (u0 + u1) / 2, a0 = b.w ? ucb - b.w / 2 : u0 + inner, a1 = b.w ? ucb + b.w / 2 : u1 - inner;
  if (!fitsPanel(c.p, rectPoly(a0, a1, v0 - 0.01, Math.min(v1, v0 + sh + rh)))) return;
  if (c.layered) { c.balconies.push({ b, cell, a0, a1 }); drawBalconyBack(c, b, cell, a0, a1, seed); return; }
  let part = c.part();
  c.box(slab, a0, a1, v0 - 0.02, v0 - 0.02 + sh, 0, depth, part);
  part = c.part();
  const rv0 = v0 - 0.02 + sh;
  const rslot = rail.slot ?? (rail.kind === 'glass' ? 'glassRail' : rail.kind === 'solid' ? 'slab' : 'rail');
  if (rail.kind === 'bars') {
    c.quadRaw(rail.slot ?? 'rail', a0 + 0.05, rv0, a1 - 0.05, rv0 + rh, depth - 0.03, part);
  } else if (rail.kind === 'rods') {
    const rs = rail.slot ?? 'rail', n = Math.max(2, Math.round((a1 - a0) / 0.13));
    for (let k = 0; k <= n; k++) { const u = a0 + 0.04 + (a1 - a0 - 0.08) * k / n; c.quadRaw(rs, u - 0.012, rv0, u + 0.012, rv0 + rh, depth - 0.03, part); }
    c.quadRaw(rs, a0, rv0 + 0.05, a1, rv0 + 0.1, depth - 0.03, part);
  } else c.quadRaw(rslot, a0, rv0, a1, rv0 + rh, depth - 0.03, part);
  // side cheeks join the slab to the wall so the rail is supported on both ends
  part = c.part();
  const cheek = rail.kind === 'solid' ? slab : (rail.slot ?? 'rail');
  c.box(cheek, a0, a0 + 0.06, rv0, rv0 + rh, 0, depth, part);
  c.box(cheek, a1 - 0.06, a1, rv0, rv0 + rh, 0, depth, part);
  if (rail.top !== null) { part = c.part(); c.box(rail.top ?? slab, a0, a1, rv0 + rh, rv0 + rh + 0.05, depth - 0.07, depth, part); }
  drawBalconyBack(c, b, cell, a0, a1, seed);
}

/** The balcony's back window (French window behind the slab) and, with `piers`, the piers either side of the bay. */
function drawBalconyBack(c: Ctx, b: BalconyParams, cell: Cell, a0: number, a1: number, seed: number) {
  const { u0, u1, v0, v1 } = cell, sh = b.slab?.h ?? 0.2;
  if (b.back !== null) {
    const w = { w: 0.8, h: 0.72, sill: sh + 0.08, ...(b.back ?? {}) };
    const [a, bb, lo, hi] = winRect({ ...cell, u0: a0, u1: a1 }, w);
    drawGrouped(c, a, bb, lo, hi, w, seed);
  }
  if (b.piers) {
    const part = c.part();
    const slot = b.piers.slot ?? 'wall', out = b.piers.out ?? 0.12;
    c.box(slot, u0, a0, v0, v1, 0, out, part); c.box(slot, a1, u1, v0, v1, 0, out, part);
  }
}

/** Rods per balcony rail run at most (layered kit): a 40 m run of 13 cm rods cost 600 triangles a storey. */
export const MAX_RAIL_RODS = 48;

/**
 * Layered balconies: one slab, one rail, one top rail and a cheek at each end per storey run (bays whose balconies
 * abut), instead of a slab, rail and two cheeks per bay. Each storey's slab front stands on its own sheet layer
 * (`SHEET_PITCH` further out on every other storey), so the slab and cheek faces of stacked storeys never share a plane.
 */
function drawBalconyRuns(c: Ctx) {
  const byFloor = new Map<number, typeof c.balconies>();
  for (const x of c.balconies) { const l = byFloor.get(x.cell.floor) ?? []; l.push(x); byFloor.set(x.cell.floor, l); }
  for (const [floor, list] of [...byFloor].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.a0 - b.a0);
    const runs: (typeof list)[] = [];
    for (const x of list) {
      const run = runs[runs.length - 1], last = run?.[run.length - 1];
      if (last && last.b === x.b && Math.abs(last.a1 - x.a0) < 1e-6 && Math.abs(last.cell.v0 - x.cell.v0) < 1e-6) run.push(x); else runs.push([x]);
    }
    for (const run of runs) {
      const { b, cell } = run[0], a0 = run[0].a0, a1 = run[run.length - 1].a1, v0 = cell.v0;
      const depth = (b.depth ?? 1.4) + (floor % 2) * SHEET_PITCH, sh = b.slab?.h ?? 0.2, slab = b.slab?.slot ?? 'slab', rail = b.rail ?? {}, rh = rail.h ?? 1.05;
      if (!fitsPanel(c.p, rectPoly(a0, a1, v0 - 0.01, Math.min(cell.v1, v0 + sh + rh)))) continue;
      const part = c.part(), rv0 = v0 - 0.02 + sh, rs = rail.slot ?? (rail.kind === 'glass' ? 'glassRail' : rail.kind === 'solid' ? 'slab' : 'rail');
      // Faces as needed: closed at the back (3DBAG faces merged into the panel stand a few cm off its plane, so a back edge
      // need not lie on the wall); a cheek's bottom stands on the slab and is left out.
      const F = (slot: Slot, u0: number, u1: number, lo: number, hi: number, d0: number, d1: number, faces: string) => {
        const P = (u: number, v: number, d: number) => c.P(u, v, d), n = c.p.n, r = c.p.r, m = c.mesh;
        if (faces.includes('f')) m.quad(slot, P(u0, lo, d1), P(u1, lo, d1), P(u1, hi, d1), P(u0, hi, d1), part, n);
        if (faces.includes('k')) m.quad(slot, P(u0, lo, d0), P(u1, lo, d0), P(u1, hi, d0), P(u0, hi, d0), part, scale(n, -1));
        if (faces.includes('t')) m.quad(slot, P(u0, hi, d0), P(u1, hi, d0), P(u1, hi, d1), P(u0, hi, d1), part, UP);
        if (faces.includes('b')) m.quad(slot, P(u0, lo, d0), P(u1, lo, d0), P(u1, lo, d1), P(u0, lo, d1), part, DOWN);
        if (faces.includes('l')) m.quad(slot, P(u0, lo, d0), P(u0, hi, d0), P(u0, hi, d1), P(u0, lo, d1), part, scale(r, -1));
        if (faces.includes('r')) m.quad(slot, P(u1, lo, d0), P(u1, hi, d0), P(u1, hi, d1), P(u1, lo, d1), part, r);
      };
      F(slab, a0, a1, v0 - 0.02, rv0, 0, depth, 'fktblr');
      // Cheeks (side rails) stand one sheet layer in from the slab ends: a pier or the next panel's wall ends exactly at a
      // bay joint, and a cheek face there would share its plane. The top rail and the rail between them span the cheeks.
      const cheek = rail.kind === 'solid' ? slab : (rail.slot ?? 'rail'), e0 = a0 + SHEET_PITCH, e1 = a1 - SHEET_PITCH, cw = 0.06, i0 = e0 + cw, i1 = e1 - cw;
      F(cheek, e0, i0, rv0, rv0 + rh, 0, depth, 'fktlr');
      F(cheek, i1, e1, rv0, rv0 + rh, 0, depth, 'fktlr');
      if (rail.top !== null) F(rail.top ?? slab, i0, i1, rv0 + rh - 0.05, rv0 + rh, depth - 0.07, depth, 'fktb');
      const railTop = rail.top !== null ? rv0 + rh - 0.05 : rv0 + rh;
      if (rail.kind === 'rods') {
        const n = Math.min(MAX_RAIL_RODS, Math.max(2, Math.round((i1 - i0) / 0.13)));
        for (let k = 1; k < n; k++) { const u = i0 + (i1 - i0) * k / n; c.quadRaw(rs, u - 0.012, rv0, u + 0.012, railTop, depth - 0.03, part); }
        c.quadRaw(rs, i0, rv0 + 0.05, i1, rv0 + 0.1, depth - 0.03, part);
      } else c.quadRaw(rs, i0, rv0, i1, railTop, depth - 0.03, part);
    }
  }
}

function intervals(p: Panel, v0: number, v1: number, step = 0.5): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  const W = p.uMax - p.uMin, n = Math.max(1, Math.ceil(W / step));
  for (let i = 0; i < n; i++) {
    const a = p.uMin + (W * i) / n, b = p.uMin + (W * (i + 1)) / n, ok = fitsPanel(p, rectPoly(a + 0.01, b - 0.01, v0, v1), 0.0);
    if (ok && start === null) start = a;
    if (!ok && start !== null) { out.push([start, a]); start = null; }
  }
  if (start !== null) out.push([start, p.uMax]);
  return out;
}

function stripBox(c: Ctx, slot: Slot, a: number, b: number, v0: number, v1: number, out: number) {
  const bends = c.profile ? kinksIn(c.profile, a, b) : [];
  if (bends.length) { const us = [a, ...bends, b]; for (let i = 0; i + 1 < us.length; i++) stripBox(c, slot, us[i], us[i + 1], v0, v1, out); return; }
  const p = c.p, mesh = c.mesh, part = c.part();
  const mitre = (other: Panel | undefined): V3 => {
    if (!other) return scale(p.n, out);
    const s = scale(add(p.n, other.n), 1 / Math.min(3, Math.max(0.35, 1 + p.n[0] * other.n[0] + p.n[2] * other.n[2])));
    return scale(s, out);
  };
  const joinA = a <= p.uMin + 1e-3 && p.prev >= 0 ? c.panels[p.prev] : undefined, joinB = b >= p.uMax - 1e-3 && p.next >= 0 ? c.panels[p.next] : undefined;
  const mA = mitre(joinA), mB = mitre(joinB);
  const A0 = c.P(a, v0, 0), B0 = c.P(b, v0, 0), A1 = c.P(a, v1, 0), B1 = c.P(b, v1, 0);
  const oA0 = add(A0, mA), oB0 = add(B0, mB), oA1 = add(A1, mA), oB1 = add(B1, mB);
  mesh.quad(slot, oA0, oB0, oB1, oA1, part, p.n);
  if (c.closedBands) mesh.quad(slot, A0, B0, B1, A1, part, scale(p.n, -1));
  mesh.quad(slot, A1, B1, oB1, oA1, part, UP);
  mesh.quad(slot, A0, B0, oB0, oA0, part, DOWN);
  // closed bands cap mitred ends too: the neighbouring panel's band may stop short of the joint (an opening, another group)
  if (!joinA || c.closedBands) mesh.quad(slot, A0, oA0, oA1, A1, part, scale(p.r, -1));
  if (!joinB || c.closedBands) mesh.quad(slot, B0, oB0, oB1, B1, part, p.r);
}

function drawBands(c: Ctx, bands: Band[], levels: number[], sys: System, top = Infinity, clip?: [number, number]) {
  void sys;
  for (const band of bands) {
    levels.forEach((L, f) => {
      if (f === 0 || (band.skipGround && f === 1) || (band.fromFloor && f < band.fromFloor)) return;
      const next = levels[f + 1] ?? top;
      if (band.liftFrac !== undefined && !Number.isFinite(next)) return;
      const v0 = L + (band.lift ?? 0) + (band.liftFrac !== undefined ? band.liftFrac * (next - L) : 0) - band.h / 2, v1 = v0 + band.h;
      for (const [a0, b0] of intervals(c.p, v0, v1)) {
        const a = clip ? Math.max(a0, clip[0]) : a0, b = clip ? Math.min(b0, clip[1]) : b0;
        if (b - a > (band.minRun ?? 0.2)) stripBox(c, band.slot, a, b, v0, v1, band.out);
      }
    });
  }
}

/** Squared-free bearing (deg clockwise from north) of a panel's outward normal. */
export const bearingOf = (n: V3) => (Math.atan2(n[0], -n[2]) * 180 / Math.PI + 360) % 360;

function pickSystem(spec: BlockSpec, p: Panel): string | null {
  const mid: [number, number] = [p.o[0] + p.r[0] * (p.uMin + p.uMax) / 2, p.o[2] + p.r[2] * (p.uMin + p.uMax) / 2];
  const w = p.uMax - p.uMin, br = bearingOf(p.n);
  for (const rule of spec.rules ?? []) {
    if (rule.at && Math.hypot(mid[0] - rule.at[0], mid[1] - rule.at[1]) > (rule.r ?? 5)) continue;
    if (rule.bearing) { const [a, b] = rule.bearing; const inR = a <= b ? br >= a && br <= b : br >= a || br <= b; if (!inR) continue; }
    if (rule.maxWidth !== undefined && w > rule.maxWidth) continue;
    if (rule.minWidth !== undefined && w < rule.minWidth) continue;
    return rule.system === 'none' ? null : rule.system;
  }
  return spec.default === 'none' ? null : spec.default;
}

export function compose(set: SurfaceSet, spec: BlockSpec, opts: ComposeOptions = {}): ComposeResult {
  const mesh = new MeshBuilder();
  const roofSlot = spec.roofSlot ?? 'roof', wallSlot = spec.wallSlot ?? 'wall';
  const recess = opts.recessM ?? 0;
  const { panels, stats: hostStats } = buildHost(set, mesh, roofSlot, wallSlot, { deferWalls: recess > 0, dissolve: recess > 0, mergeKey: opts.mergeKey, sealSlivers: opts.sealSlivers });
  const openingStats = { recessed: 0, proud: 0 }; let trimmed = 0;
  const hostTris = mesh.triangles;
  const assignment: ComposeResult['assignment'] = [];
  const g = spec.levels.groundM, s = spec.levels.storeyM;
  for (const p of panels) {
    const W = p.uMax - p.uMin, centre: [number, number] = [p.o[0] + p.r[0] * (p.uMin + p.uMax) / 2, p.o[2] + p.r[2] * (p.uMin + p.uMax) / 2];
    const sysName = opts.systemFor ? opts.systemFor(p) : pickSystem(spec, p);
    assignment.push({ panel: p.index, system: sysName, width: W, centre });
    const c = new Ctx(mesh, p, panels);
    c.closedBoxes = !!opts.closedBoxes;
    if (opts.barOffsetM !== undefined) c.barOut = opts.barOffsetM;
    c.closedBands = recess > 0 && !!opts.closedBands;
    c.glassBack = opts.glassBackM ?? 0;
    c.layered = recess > 0 && !!opts.layered;
    c.profile = c.layered ? wallProfileOf(p) : null;
    c.bent = !!c.profile && kinksIn(c.profile, p.uMin, p.uMax).length > 0;
    c.recess = recess; c.wallSlot = recess > 0 ? opts.wallSlotFor?.(p) ?? wallSlot : wallSlot;
    const cells: Cell[] = [];
    const finish = (levels: number[]) => {
      opts.panelHook?.(c, { system: sysName, levels, cells });
      if (recess > 0) emitWalls(mesh, p, c.holes, c.wallSlot, c.bent ? c.profile : null);
      openingStats.recessed += c.stats.recessed; openingStats.proud += c.stats.proud; trimmed += c.stats.trimmed;
    };
    if (!sysName) { finish([]); continue; }
    const sys: System | undefined = spec.systems[sysName]; if (!sys) throw new Error(`unknown system ${sysName}`);
    if (W < (sys.minWidth ?? sys.pitch * 0.6) || p.vMax - p.vMin < 2.5) { finish([]); continue; }
    // storey boundaries
    const lineSet = sys.lines ?? spec.levels.lines;
    const levels: number[] = lineSet ? lineSet.slice(0, -1).filter((L, i) => i === 0 || L < p.vMax - 0.8) : [0, g];
    if (!lineSet) for (let L = g + s; L < p.vMax - 1.0; L += s) levels.push(L);
    levels.push(Math.max(p.vMax, levels[levels.length - 1] + 0.01));
    const floors = levels.length - 1, nb = Math.max(1, Math.round(W / sys.pitch)), nbays = sys.bays ? sys.bays.centres?.length ?? sys.bays.count : nb;
    const segs = opts.segmentsFor?.(p);
    if (segs) {
      // row split: every house span with its own system's storey lines (under its own top), bays and bands
      for (const seg of segs) {
        const hs: System | undefined = spec.systems[seg.system]; if (!hs?.lines || !hs.bays) throw new Error(`segment system ${seg.system} needs lines and a bay layout`);
        const lv = hs.lines.slice(0, -1).filter((L, i) => i === 0 || L < seg.top - 0.8);
        lv.push(Math.max(seg.top, lv[lv.length - 1] + 0.01));
        const fl = lv.length - 1, lay = hs.bays;
        for (let f = 0; f < fl; f++) {
          const v0 = lv[f], v1 = lv[f + 1];
          if (v1 <= p.vMin + 0.5 || v0 < p.partyH - 0.3) continue;
          if (f === fl - 1 && v1 - v0 < 1.8) continue;
          const topRow = hs.top && f >= fl - (hs.topCount ?? 1) && f > 0;
          const row = hs.rowOverrides?.[String(f)] ?? (f === 0 ? hs.ground : topRow ? hs.top! : hs.typical);
          for (let b = 0; b < lay.count; b++) {
            const cell: Cell = { u0: p.uMin + lay.first + lay.pitch * (b - 0.5), u1: p.uMin + lay.first + lay.pitch * (b + 0.5), v0: Math.max(v0, p.vMin), v1, bay: seg.bayOffset + b, floor: f, bays: seg.bays };
            cells.push(cell);
            if (opts.skipCell?.(p, f, cell.bay, seg.bays)) continue;
            drawRow(c, row, cell, p.index * 31 + 7);
          }
        }
        if (hs.bands && !opts.skipBands?.(p)) drawBands(c, hs.bands, lv.slice(0, fl), hs, lv[fl], [seg.u0, seg.u1]);
      }
      if (c.layered) drawBalconyRuns(c);
      finish(levels);
      continue;
    }
    // recessed loggia bands: the cells they cover draw nothing (only bands this panel has the bays and floors for)
    const bands = (sys.recessBands ?? []).filter(rb => rb.floors[1] < floors && rb.bays[1] < nbays);
    const inBand = (f: number, b: number) => bands.some(rb => f >= rb.floors[0] && f <= rb.floors[1] && b >= rb.bays[0] && b <= rb.bays[1]);
    for (let f = 0; f < floors; f++) {
      const v0 = levels[f], v1 = levels[f + 1];
      if (v1 <= p.vMin + 0.5 || v0 < p.partyH - 0.3) continue;
      if (f === floors - 1 && v1 - v0 < 1.8) continue;
      const topRow = sys.top && f >= floors - (sys.topCount ?? 1) && f > 0;
      const row = sys.rowOverrides?.[String(f)] ?? (f === 0 ? sys.ground : topRow ? sys.top! : sys.typical);
      for (let b = 0; b < nbays; b++) {
        const lay = sys.bays;
        const cell: Cell = lay?.centres
          ? { u0: p.uMin + lay.centres[b] - lay.pitch / 2, u1: p.uMin + lay.centres[b] + lay.pitch / 2, v0: Math.max(v0, p.vMin), v1, bay: b, floor: f, bays: nbays }
          : lay
          ? { u0: p.uMin + lay.first + lay.pitch * (b - 0.5) - (b === 0 ? lay.reach?.[0] ?? 0 : 0), u1: p.uMin + lay.first + lay.pitch * (b + 0.5) + (b === nbays - 1 ? lay.reach?.[1] ?? 0 : 0), v0: Math.max(v0, p.vMin), v1, bay: b, floor: f, bays: nbays }
          : { u0: p.uMin + W * b / nb, u1: p.uMin + W * (b + 1) / nb, v0: Math.max(v0, p.vMin), v1, bay: b, floor: f, bays: nb };
        cells.push(cell);
        if (opts.skipCell?.(p, f, b, nbays)) continue;
        if (bands.length && inBand(f, b)) continue;
        drawRow(c, row, cell, p.index * 31 + 7);
      }
    }
    for (const rb of bands) {
      const first = cells.find(q => q.floor === rb.floors[0] && q.bay === rb.bays[0]), last = cells.find(q => q.floor === rb.floors[0] && q.bay === rb.bays[1]);
      if (!first || !last) continue;
      c.mesh.label = `panel${p.index}:f${rb.floors[0]}-${rb.floors[1]}:b${rb.bays[0]}-${rb.bays[1]}:recessBand`;
      const lo = levels[rb.floors[0]] + rb.sill, hi = Math.min(levels[rb.floors[1]] + rb.head, levels[rb.floors[1] + 1] - 0.1);
      // an end bay the panel outline does not fill at the band's height (a 3DBAG step beside a lower piece): pull that
      // end of the band in, at most its own bay, until the band fits the panel
      let a = first.u0 + rb.inset, b = last.u1 - rb.inset;
      const fits = (x: number, y: number) => fitsPanel(p, rectPoly(x, y, lo, hi));
      for (let k = 1; !fits(a, b) && k <= 40; k++) {
        const a1 = first.u0 + rb.inset + (first.u1 - first.u0) * k / 40, b1 = last.u1 - rb.inset - (last.u1 - last.u0) * k / 40;
        if (fits(a1, b)) a = a1; else if (fits(a, b1)) b = b1; else if (fits(a1, b1)) { a = a1; b = b1; }
      }
      // a pulled-in end keeps the cut's 3 cm probe margin (Ctx.claim) clear of the step's edge
      if (a > first.u0 + rb.inset) a += 0.05;
      if (b < last.u1 - rb.inset) b -= 0.05;
      drawOpening(c, a, b, lo, hi, rb.win, p.index * 31 + 7);
    }
    if (c.layered) drawBalconyRuns(c);
    if (sys.cladding) for (const [a0, b0] of intervals(p, sys.cladding.from, p.vMax - 0.35)) for (const [a, b] of [[Math.max(a0, p.uMin + W * (sys.cladding.u?.[0] ?? 0)), Math.min(b0, p.uMin + W * (sys.cladding.u?.[1] ?? 1))]]) if (b - a > 0.3) { const part = c.part(); c.quad(sys.cladding.slot, a, sys.cladding.from, b, p.vMax - 0.35, 0.012, part); }
    if (sys.bands && !opts.skipBands?.(p)) drawBands(c, sys.bands, levels.slice(0, floors), sys, levels[floors]);
    if (sys.piers) {
      for (let b = 0; b <= nb; b++) {
        const u = p.uMin + W * b / nb, w = sys.piers.w, a = Math.max(p.uMin, u - w / 2), bb = Math.min(p.uMax, u + w / 2);
        if (fitsPanel(p, rectPoly(a, bb, g, Math.max(g + 0.5, p.vMax - 0.3)))) {
          const nseg = Math.max(1, sys.piers.segments ?? 1), top = p.vMax - 0.3;
          for (let k = 0; k < nseg; k++) { const part = c.part(); c.box(sys.piers.slot, a, bb, g + (top - g) * k / nseg, g + (top - g) * (k + 1) / nseg, 0, sys.piers.out, part); }
        }
      }
    }
    if (sys.groundPiers) {
      const gp = sys.groundPiers, g0 = levels[0], top = Math.min(g0 + gp.top, p.vMax - 0.3);
      // the strip as closed boxes of at most 8 m (no open boundary loop over the GLB audit's 30 m)
      if (gp.plinth) for (const [a, b] of intervals(p, g0, g0 + gp.plinth.h)) if (b - a > 0.3) {
        const n = Math.ceil((b - a) / 8);
        for (let k = 0; k < n; k++) { const part = c.part(); c.box(gp.plinth.slot, a + (b - a) * k / n, a + (b - a) * (k + 1) / n, g0, g0 + gp.plinth.h, 0, 0.02, part); }
      }
      for (let b = gp.first; b <= nb; b += Math.max(1, gp.every)) {
        const u = p.uMin + W * b / nb, a = Math.max(p.uMin, u - gp.w / 2), bb = Math.min(p.uMax, u + gp.w / 2);
        if (bb - a > 0.05 && top > g0 + 0.5 && fitsPanel(p, rectPoly(a, bb, g0, top))) { const part = c.part(); c.box(gp.slot, a, bb, g0, top, 0, gp.out, part); }
      }
    }
    finish(levels);
  }
  // signs
  if (opts.shaper) for (const sign of spec.signs ?? []) drawSign(mesh, panels, sign, opts.shaper);
  return { mesh, panels, assignment, stats: { ...hostStats, panels: panels.length, hostTris, triangles: mesh.triangles, parts: mesh.partCount, ...(recess > 0 ? openingStats : {}), ...(trimmed ? { trimmed } : {}) } };
}

/** A member wall whose vertices leave its own (Newell) plane by more than 5 mm: 3DBAG facets dissolved across a bend. */
function bentMember(rings: V3[][]): boolean {
  const nm = norm(newell(rings[0])), q0 = rings[0][0];
  return rings.some(r => r.some(q => Math.abs(dot(nm, sub(q, q0))) > 0.005));
}

/**
 * Layered kit: a bent member wall (Stadsloket West's 65 m front kinks 26 cm out 8 m from one end; Plantage Middenlaan
 * 52's 50 m front by 56 cm) triangulated by earcut gets triangles spanning the bend, whose faces lean off both facets
 * and off the profile the parts follow. Emitted instead per facet: the rings are clipped to the slabs between the
 * profile's bends (`kinksIn`, so each slab is within BEND_TOL of flat) and each slab is earcut with the holes and cut
 * openings inside it. A slab an opening straddles is cut into trapezoids between consecutive vertex columns (every ring
 * edge crosses a column whole, so pairing edges by height gives quads on the 3D edges). False = use plain earcut.
 */
function emitFacets(mesh: MeshBuilder, p: Panel, profile: WallProfile, rings: V3[][], slot: Slot): boolean {
  const uOf = (q: V3) => (q[0] - p.o[0]) * p.r[0] + (q[2] - p.o[2]) * p.r[2];
  const us = rings.flat().map(uOf), lo = Math.min(...us), hi = Math.max(...us), bends = kinksIn(profile, lo, hi);
  if (!bends.length) return false;
  // a ring that visits a vertex twice (a degenerate 3DBAG face: Funenpark's blank west wall) keeps plain earcut
  const seen = new Set<string>();
  for (const r of rings) for (const q of r) { const k = q.map(x => Math.round(x * 1000)).join(','); if (seen.has(k)) return false; seen.add(k); }
  const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** Sutherland-Hodgman against u >= a and u <= b; the cut points lie on the 3D edges. */
  const clip = (ring: V3[], a: number, b: number): V3[] => {
    let out = ring;
    for (const [lim, keep] of [[a, (u: number) => u >= a], [b, (u: number) => u <= b]] as [number, (u: number) => boolean][]) {
      if (!Number.isFinite(lim)) continue;
      const src = out; out = [];
      src.forEach((q, i) => {
        const r = src[(i + 1) % src.length], uq = uOf(q), ur = uOf(r);
        if (keep(uq)) out.push(q);
        if (keep(uq) !== keep(ur)) out.push(lerp(q, r, (lim - uq) / (ur - uq)));
      });
    }
    // drop repeated points (a vertex on the slab line comes out twice); earcut fails on them
    return out.filter((q, i) => { const nx = out[(i + 1) % out.length]; return Math.hypot(q[0] - nx[0], q[1] - nx[1], q[2] - nx[2]) > 1e-4; });
  };
  const spans = rings.slice(1).map(h => { const hu = h.map(uOf); return [Math.min(...hu), Math.max(...hu)]; });
  // A bend under an opening moves to the pier beside it (a gently curved front: Entrepotdok), as long as every slab
  // stays within BEND_TOL of flat; otherwise slabs keep the true bends and a slab an opening straddles is trapezoided.
  const free = (u: number) => {
    for (let k = 0; k < 12; k++) {
      const h = spans.find(([h0, h1]) => u > h0 - 0.01 && u < h1 + 0.01);
      if (!h) return u;
      u = u - h[0] < h[1] - u ? h[0] - 0.02 : h[1] + 0.02;
    }
    return NaN;
  };
  const flatSlabs = (cuts: number[]) => cuts.every((c, k) => k + 1 >= cuts.length || !kinksIn(profile, Math.max(c, lo), Math.min(cuts[k + 1], hi)).length);
  const moved = [...new Set(bends.map(free))].filter(u => u > lo + 0.05 && u < hi - 0.05).sort((a, b) => a - b);
  const cuts = bends.every(u => Number.isFinite(free(u))) && moved.length && flatSlabs([lo, ...moved, hi]) ? moved : bends;
  const bounds = [-Infinity, ...cuts, Infinity], tris: V3[][] = [], quads: V3[][] = [];
  const to2 = (q: V3) => new T.Vector2(uOf(q), q[1]);
  for (let s = 0; s + 1 < bounds.length; s++) {
    const a = bounds[s], b = bounds[s + 1], outer = clip(rings[0], a, b);
    if (outer.length < 3) continue;
    const holes: V3[][] = [];
    let straddled = false;
    rings.slice(1).forEach((h, k) => {
      const [h0, h1] = spans[k];
      if (h1 <= a + 1e-4 || h0 >= b - 1e-4) return;
      if (h0 < a - 1e-4 || h1 > b + 1e-4) { straddled = true; const c = clip(h, a, b); if (c.length >= 3) holes.push(c); return; }
      holes.push(h);
    });
    const faces = straddled ? [] : T.ShapeUtils.triangulateShape(outer.map(to2), holes.map(h => h.map(to2)));
    if (!faces.length) { const q = trapezoids(p, [outer, ...holes]); if (!q) return false; quads.push(...q); continue; }
    const all = [...outer, ...holes.flat()];
    for (const f of faces) tris.push([all[f[0]], all[f[1]], all[f[2]]]);
  }
  if (!tris.length && !quads.length) return false;
  for (const t of tris) mesh.tri(slot, t[0], t[1], t[2], 0, p.n);
  for (const q of quads) mesh.quad(slot, q[0], q[1], q[2], q[3], 0, p.n);
  return true;
}

/** Quads between consecutive vertex columns of `rings` (outer and holes, even-odd by height), or null when a column pairs oddly. */
function trapezoids(p: Panel, rings: V3[][]): V3[][] | null {
  const uOf = (q: V3) => (q[0] - p.o[0]) * p.r[0] + (q[2] - p.o[2]) * p.r[2];
  const edges: [V3, V3][] = [];
  for (const r of rings) r.forEach((q, i) => { const b = r[(i + 1) % r.length]; if (Math.abs(uOf(q) - uOf(b)) > 1e-6) edges.push(uOf(q) < uOf(b) ? [q, b] : [b, q]); });
  const cols = [...new Set(rings.flat().map(q => Math.round(uOf(q) * 1e4) / 1e4))].sort((a, b) => a - b);
  const at = ([a, b]: [V3, V3], u: number): V3 => { const t = Math.min(1, Math.max(0, (u - uOf(a)) / (uOf(b) - uOf(a)))); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const quads: V3[][] = [];
  for (let i = 0; i + 1 < cols.length; i++) {
    const ua = cols[i], ub = cols[i + 1], um = (ua + ub) / 2;
    if (ub - ua < 1e-4) continue;
    const span = edges.filter(([a, b]) => uOf(a) < um && uOf(b) > um).sort((e, f) => at(e, um)[1] - at(f, um)[1]);
    if (span.length % 2) return null;
    for (let j = 0; j < span.length; j += 2) quads.push([at(span[j], ua), at(span[j], ub), at(span[j + 1], ub), at(span[j + 1], ua)]);
  }
  return quads;
}

/** Deferred host walls: members with holes are triangulated in the panel's (u, v) frame, keeping their exact 3D ring vertices. */
function emitWalls(mesh: MeshBuilder, p: Panel, holes: Map<number, HoleRect[]>, wallSlot: Slot, profile: WallProfile | null = null) {
  (p.members ?? []).forEach((m, k) => {
    const rects = holes.get(k);
    if (profile && bentMember(m.rings)) {
      const on = (u: number, v: number): V3 => pt(p, u, v, profileAt(profile, u));
      const rectRings = (rects ?? []).map(([u0, u1, v0, v1, outline]) => outline ? outline.map(([u, v]) => on(u, v)) : [on(u0, v0), on(u1, v0), on(u1, v1), on(u0, v1)]);
      if (emitFacets(mesh, p, profile, [...m.rings, ...rectRings], wallSlot)) return;
    }
    if (!rects?.length) { triangulate3(mesh, wallSlot, m.rings, p.n, 0); return; }
    const clean = (r: V3[]) => r.filter((q, i) => { const nx = r[(i + 1) % r.length]; return Math.hypot(q[0] - nx[0], q[1] - nx[1], q[2] - nx[2]) > 1e-4; });
    const rings3 = m.rings.map(clean), to2 = (q: V3) => new T.Vector2((q[0] - p.o[0]) * p.r[0] + (q[2] - p.o[2]) * p.r[2], q[1]);
    const nm = norm(newell(rings3[0])), q0 = rings3[0][0], den = dot(nm, p.n);
    const onWall = (u: number, v: number): V3 => { const P = pt(p, u, v, 0), t = Math.abs(den) > 1e-6 ? dot(nm, sub(q0, P)) / den : 0; return add(P, scale(p.n, t)); };
    const rectRings = rects.map(([u0, u1, v0, v1, outline]) => outline ? outline.map(([u, v]) => onWall(u, v)) : [onWall(u0, v0), onWall(u1, v0), onWall(u1, v1), onWall(u0, v1)]);
    const all = [...rings3.flat(), ...rectRings.flat()];
    const faces = T.ShapeUtils.triangulateShape(rings3[0].map(to2), [...rings3.slice(1), ...rectRings].map(r => r.map(to2)));
    for (const f of faces) mesh.tri(wallSlot, all[f[0]], all[f[1]], all[f[2]], 0, p.n);
  });
}

function drawSign(mesh: MeshBuilder, panels: Panel[], sign: Sign, shaper: TextShaper) {
  let best: Panel | null = null, bd = Infinity;
  for (const p of panels) {
    const u = (sign.at[0] - p.o[0]) * p.r[0] + (sign.at[1] - p.o[2]) * p.r[2];
    const d = Math.abs((sign.at[0] - p.o[0]) * p.n[0] + (sign.at[1] - p.o[2]) * p.n[2]);
    if (u < p.uMin - 0.5 || u > p.uMax + 0.5) continue;
    if (d < bd && p.uMax - p.uMin > 1) { bd = d; best = p; }
  }
  if (!best) throw new Error(`sign "${sign.text}" found no wall near ${sign.at}`);
  const p = best, c = new Ctx(mesh, p, panels);
  const uAt = (sign.at[0] - p.o[0]) * p.r[0] + (sign.at[1] - p.o[2]) * p.r[2];
  // glyph run: each character shaped alone so tracking can be spread to a target span
  const chars = [...sign.text], glyphs = chars.map(ch => (ch === ' ' ? null : shaper(ch, sign.font)));
  const full = shaper(chars.filter(ch => ch !== ' ').join(''), sign.font), sc = sign.height / full.ascent, scx = sc * (sign.stretch ?? 1);
  const wsum = glyphs.reduce((t, g) => t + (g ? g.width * scx : 0), 0);
  let gap = (sign.letterSpacing ?? 0.12) * sign.height, wordGap = 3 * gap;
  const gapsN = chars.reduce((n, ch, i) => n + (i > 0 && ch !== ' ' && chars[i - 1] !== ' ' ? 1 : 0), 0), wordsN = chars.filter(ch => ch === ' ').length;
  if (sign.span) { const unit = (sign.span - wsum) / Math.max(1, gapsN + 3 * wordsN); gap = unit; wordGap = 3 * unit; }
  const total = wsum + gap * gapsN + wordGap * wordsN;
  let u = uAt - total / 2 + (sign.offset ?? 0);
  const part = c.part();
  chars.forEach((ch, i) => {
    if (ch === ' ') { u += wordGap; return; }
    const g = glyphs[i]!, w = g.width * scx;
    for (const shape of g.shapes) {
      const geo = new T.ShapeGeometry(shape, 3), pos = geo.getAttribute('position'), idx = geo.index!;
      for (let k = 0; k < idx.count; k += 3) {
        const q = [0, 1, 2].map(m => { const j = idx.getX(k + m); return c.P(u + pos.getX(j) * scx, sign.v + pos.getY(j) * sc, 0.035); });
        mesh.tri(sign.slot, q[0], q[1], q[2], part, p.n);
      }
      geo.dispose();
    }
    u += w + (i + 1 < chars.length && chars[i + 1] !== ' ' ? gap : 0);
  });
  if (!fitsPanel(p, rectPoly(uAt - total / 2 + (sign.offset ?? 0), uAt + total / 2 + (sign.offset ?? 0), sign.v, sign.v + sign.height), 0)) throw new Error(`sign "${sign.text}" does not fit its wall`);
}
export { cross, sub, norm };

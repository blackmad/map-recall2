/**
 * Large-tier components drawn on one wall panel (compose `panelHook`): recessed entrances and entrance halls,
 * canopies, sectional garage doors, cornices and fascias, stroke-font lettering, and the police signature parts
 * (blue-and-white striped POLITIE band, blue lamp), plus roof plant boxes on the roof. Every part is built on or
 * cut into the exact wall plane, so attachment holds by construction (block-kit gates check it).
 */
import { type PanelCtx, type Cell, stripBox, intervals, barQuad, solid, SHEET_PITCH } from './compose.ts';
import { fitsPanel, rectPoly } from './panels.ts';
import { MeshBuilder, type V3, add, scale, sub } from './mesh.ts';
import { letteringGeometry } from '../buildingRecipe/signage.ts';
import type { Slot } from './spec.ts';

const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];

/** Span of the given cells (same bay, consecutive floors). */
export function cellSpan(cells: Cell[]): { u0: number; u1: number; v0: number; v1: number } {
  return { u0: Math.min(...cells.map(c => c.u0)), u1: Math.max(...cells.map(c => c.u1)), v0: Math.min(...cells.map(c => c.v0)), v1: Math.max(...cells.map(c => c.v1)) };
}

/**
 * A rectangular hole cut into the wall with four reveals `depth` deep and a back plane. Returns the back-plane depth
 * and a mapper onto the cut wall's own plane, or null when the rectangle cannot be cut (straddles two 3DBAG surfaces).
 */
export function recess(c: PanelCtx, u0: number, u1: number, v0: number, v1: number, depth: number, backSlot: Slot): { back: number; Q: (u: number, v: number, d: number) => V3 } | null {
  const corners = c.cut(u0, u1, v0, v1);
  if (!corners) return null;
  const n = c.p.n, uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const shift = scale(corners.reduce((s, q, i) => add(s, sub(q, c.P(uv[i][0], uv[i][1], 0))), [0, 0, 0] as V3), 0.25);
  const inner = corners.map(q => add(q, scale(n, -depth))), [bl, br, tr, tl] = corners, [ibl, ibr, itr, itl] = inner, part = c.part();
  c.mesh.quad(c.wallSlot, bl, br, ibr, ibl, part, UP);
  c.mesh.quad(c.wallSlot, tl, tr, itr, itl, part, DOWN);
  c.mesh.quad(c.wallSlot, bl, tl, itl, ibl, part, c.p.r);
  c.mesh.quad(c.wallSlot, br, tr, itr, ibr, part, scale(c.p.r, -1));
  c.mesh.quad(backSlot, ibl, ibr, itr, itl, part, n);
  return { back: -depth, Q: (u, v, d) => add(c.P(u, v, d), shift) };
}

export interface EntranceSlots { frame: Slot; glass: Slot; door: Slot; stone: Slot }
export interface EntranceResult { u0: number; u1: number; v0: number; doorTop: number; top: number; glassDepth: number }

/**
 * Recessed entrance in a cell span: a glazed door pair with side lights and a transom light, 0.6 m deep. A span of
 * several storeys (`hall`) becomes one tall glazed entrance hall with a transom bar at every storey line.
 */
export function drawEntrance(c: PanelCtx, span: { u0: number; u1: number; v0: number; v1: number }, levels: number[], slots: EntranceSlots, hall: boolean, barD?: number): EntranceResult | null {
  const cw = span.u1 - span.u0, w = hall ? cw - 0.3 : Math.min(cw - (cw < 2 ? 0.3 : 0.5), 3.0), uc = (span.u0 + span.u1) / 2;
  const v0 = Math.max(span.v0, c.p.vMin) + 0.05, top = hall ? span.v1 - 0.3 : Math.min(v0 + 3.0, span.v1 - 0.45);
  if (w < 0.9 || top - v0 < 2.2) return null;
  const u0 = uc - w / 2, u1 = uc + w / 2, doorTop = v0 + Math.min(2.4, top - v0 - 0.25);
  // The recess is closed by the glass itself; frame, door stiles and push bars sit 1.5 cm in front of it.
  const r = recess(c, u0, u1, v0, top, 0.6, slots.glass);
  if (!r) return null;
  const g = r.back, bar = r.back + (barD ?? (c.layered ? SHEET_PITCH : c.barOut)), fw = 0.08;
  // Under 1.6 m: one door filling the opening; wider: a door pair in the middle with side lights either side.
  const single = w < 1.6, dw = single ? w : Math.min(2.0, w * 0.5), d0 = uc - dw / 2, d1 = uc + dw / 2, bars = c.part();
  const qb = (a: number, b: number, lo: number, hi: number, slot: Slot = slots.frame) => barQuad(c, slot, r.Q, a, b, lo, hi, g, bar, bars);
  // outer frame ring and the transom bar over the door(s)
  qb(u0, u1, v0, v0 + fw); qb(u0, u1, top - fw, top); qb(u0, u0 + fw, v0 + fw, top - fw); qb(u1 - fw, u1, v0 + fw, top - fw);
  if (single) {
    qb(u0 + fw, u1 - fw, doorTop - fw / 2, doorTop + fw / 2);
    qb(u0 + fw + 0.1, u1 - fw - 0.1, v0 + 1.0, v0 + 1.06, slots.door);
  } else {
    // A hall's upper glazing is one undivided pane per storey (lettering goes there); a single entrance keeps full-height stiles.
    const stileTop = hall ? doorTop - fw / 2 : top - fw;
    qb(d0 - fw / 2, d0 + fw / 2, v0 + fw, stileTop); qb(d1 - fw / 2, d1 + fw / 2, v0 + fw, stileTop); qb(uc - fw / 2, uc + fw / 2, v0 + fw, doorTop - fw / 2);
    qb(u0 + fw, d0 - fw / 2, doorTop - fw / 2, doorTop + fw / 2); qb(d0 + fw / 2, d1 - fw / 2, doorTop - fw / 2, doorTop + fw / 2); qb(d1 + fw / 2, u1 - fw, doorTop - fw / 2, doorTop + fw / 2);
    // door push bars at handle height, in the bar plane between the stiles
    for (const [a, b] of [[d0 + fw / 2 + 0.1, uc - fw / 2 - 0.1], [uc + fw / 2 + 0.1, d1 - fw / 2 - 0.1]]) qb(a, b, v0 + 1.0, v0 + 1.06, slots.door);
  }
  if (hall) for (const L of levels) if (L > doorTop + 0.3 && L < top - 0.3) qb(u0 + fw, u1 - fw, L - fw / 2, L + fw / 2);
  // threshold step
  const step = c.part();
  if (fitsPanel(c.p, rectPoly(u0, u1, Math.max(c.p.vMin, span.v0), v0 + 0.01), 0)) c.box(slots.stone, u0, u1, Math.max(c.p.vMin, span.v0), v0, 0, 0.35, step);
  return { u0, u1, v0, doorTop, top, glassDepth: g };
}

/** Cantilevered canopy over an entrance: slab `projection` deep, its front edge `edge` tall. Returns the front face depth and v range. */
export function drawCanopy(c: PanelCtx, u0: number, u1: number, at: number, slot: Slot, edge = 0.3, projection = 1.6): { d: number; v0: number; v1: number } | null {
  const a = u0 - 0.6, b = u1 + 0.6;
  if (!fitsPanel(c.p, rectPoly(a, b, at, at + edge))) return null;
  c.box(slot, a, b, at, at + edge, 0, projection, c.part());
  return { d: projection, v0: at, v1: at + edge };
}

/** Garage door frame ring width (m), layered kit. */
export const GARAGE_FRAME_W = 0.08;

/**
 * Sectional garage door: recessed 0.25 m, panel with horizontal ribs. Layered kit (`c.layered`): the door leaf closes
 * the recess at the back, the ribs are closed boxes on the first sheet layer (4.5 cm) and a frame ring of closed boxes
 * stands on the second (9 cm) inside the reveals, so leaf, ribs, frame and reveals never share a plane.
 */
export function drawGarageDoor(c: PanelCtx, cell: Cell, slots: { door: Slot; frame: Slot }): boolean {
  const cw = cell.u1 - cell.u0, w = Math.min(cw - 0.6, 3.6), uc = (cell.u0 + cell.u1) / 2, v0 = Math.max(cell.v0, c.p.vMin) + 0.05;
  const h = Math.min(3.2, cell.v1 - v0 - 0.4);
  if (w < 2.2 || h < 2.2) return false;
  const r = recess(c, uc - w / 2, uc + w / 2, v0, v0 + h, 0.25, slots.door);
  if (!r) return false;
  const part = c.part();
  if (!c.layered) {
    const d = r.back + c.barOut;
    for (let v = v0 + 0.5; v < v0 + h - 0.2; v += 0.5) barQuad(c, slots.frame, r.Q, uc - w / 2 + 0.05, uc + w / 2 - 0.05, v - 0.025, v + 0.025, r.back, d, part);
    return true;
  }
  const a = uc - w / 2, b = uc + w / 2, f = GARAGE_FRAME_W, top = v0 + h, rib = r.back + SHEET_PITCH, ring = r.back + 2 * SHEET_PITCH;
  const box = (slot: Slot, u0: number, u1: number, lo: number, hi: number, d1: number) => barQuad(c, slot, r.Q, u0, u1, lo, hi, r.back, d1, part);
  box(slots.frame, a, a + f, v0, top, ring); box(slots.frame, b - f, b, v0, top, ring);
  box(slots.frame, a + f, b - f, top - f, top, ring);
  for (let v = v0 + 0.5; v < top - f - 0.15; v += 0.5) box(slots.frame, a + f, b - f, v - 0.025, v + 0.025, rib);
  return true;
}

/** Stroke-font lettering centred at (uc, vc) on the plane `d` in front of the wall; returns triangles added. */
export function drawLettering(c: PanelCtx, text: string, uc: number, vc: number, d: number, heightM: number, maxWidthM: number, slot: Slot, Q?: (u: number, v: number, d: number) => V3): number {
  const L = letteringGeometry({ text, heightM, maxWidthM });
  const P = Q ?? ((u: number, v: number, dd: number) => c.P(u, v, dd)), part = c.part(), pos = L.positions;
  for (let i = 0; i < pos.length; i += 9) c.mesh.tri(slot, P(uc + pos[i], vc + pos[i + 1], d), P(uc + pos[i + 3], vc + pos[i + 4], d), P(uc + pos[i + 6], vc + pos[i + 7], d), part, c.p.n);
  return L.triangles;
}

/** Projecting band along the wall wherever the wall is present between v0 and v1 (cornice, fascia), minus `skip` spans. */
export function drawBand(c: PanelCtx, slot: Slot, v0: number, v1: number, out: number, skip: [number, number][] = []): number {
  let n = 0;
  skip = [...skip, ...holeSpans(c, v0, v1)];
  for (const [a0, b0] of intervals(c.p, v0, v1, 0.25)) {
    let pieces: [number, number][] = [[a0, b0]];
    for (const [s0, s1] of skip) pieces = pieces.flatMap(([a, b]) => (s1 <= a || s0 >= b ? [[a, b]] : [[a, s0], [s1, b]].filter(([x, y]) => y - x > 0.2)) as [number, number][]);
    for (const [a, b] of pieces) if (b - a > 0.2) { stripBox(c, slot, a, b, v0, v1, out); n++; }
  }
  return n;
}

/**
 * Police band: a white fascia band over the ground floor with diagonal blue stripes, and a white plate lettered
 * POLITIE in blue centred on `plateAt` (the entrance), as on Dutch police stations' signage.
 */
export function drawPoliceStripe(c: PanelCtx, v0: number, height: number, plateAt: number, slots: { white: Slot; blue: Slot }, skip: [number, number][] = []) {
  const out = 0.07, v1 = v0 + height, plate = [plateAt - 2.4, plateAt + 2.4] as [number, number];
  drawBand(c, slots.white, v0, v1, out, skip);
  const stripes = c.part(), sw = height * 0.45, pitch = height * 1.1;
  for (const [a0, b0] of intervals(c.p, v0, v1, 0.25)) {
    for (let u = a0 + 0.15; u + sw + height * 0.6 < b0 - 0.15; u += pitch) {
      const lo = u, hi = u + sw + height * 0.6;
      if ((hi > plate[0] && lo < plate[1]) || [...skip, ...holeSpans(c, v0, v1)].some(([s0, s1]) => hi > s0 && lo < s1)) continue;
      const d = out + 0.012, y0 = v0 + 0.06, y1 = v1 - 0.06, slant = (y1 - y0) * 0.6;
      c.mesh.quad(slots.blue, c.P(u, y0, d), c.P(u + sw, y0, d), c.P(u + sw + slant, y1, d), c.P(u + slant, y1, d), stripes, c.p.n);
    }
  }
  if (fitsPanel(c.p, rectPoly(plate[0], plate[1], v0, v1), 0)) drawLettering(c, 'POLITIE', plateAt, (v0 + v1) / 2, out + 0.012, height * 0.62, plate[1] - plate[0] - 0.4, slots.blue);
}

/** u-intervals (with a 5 cm margin) of the openings already cut into this panel that overlap the height range v0..v1. */
export function holeSpans(c: PanelCtx, v0: number, v1: number): [number, number][] {
  const out: [number, number][] = [];
  for (const list of c.holes.values()) for (const [a, b, h0, h1] of list) if (h1 > v0 && h0 < v1) out.push([a - 0.05, b + 0.05]);
  return out;
}

/** Lowest bottom edge of a cut opening starting above `v` (Infinity when none): bands are placed under it. */
export function lowestHoleAbove(c: PanelCtx, v: number): number {
  let lo = Infinity;
  for (const list of c.holes.values()) for (const h of list) if (h[2] >= v && h[2] < lo) lo = h[2];
  return lo;
}

/** A box off the wall face, closed on all six sides. */
function closedBox(c: PanelCtx, slot: Slot, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) {
  const part = c.part();
  c.box(slot, u0, u1, v0, v1, d0, d1, part);
  c.mesh.quad(slot, c.P(u1, v0, d0), c.P(u0, v0, d0), c.P(u0, v1, d0), c.P(u1, v1, d0), part, scale(c.p.n, -1));
}

/**
 * St Andrew's cross (one of the three of Amsterdam's coat of arms): two diagonal bars of closed prisms standing on the wall,
 * `sizeM` square. The second bar is 8 cm prouder than the first, so the faces of the crossing never share a plane, and
 * every solid is closed (no open edges for the large-tier gate). Returns the triangle count.
 */
export function drawStAndrewsCross(c: PanelCtx, uc: number, vc: number, sizeM: number, slot: Slot): number {
  const w = sizeM * 0.2, h = sizeM / 2 - w * 0.35, depths: [number, number][] = [[0.01, 0.09], [0.01, 0.17]];
  let n = 0;
  [1, -1].forEach((dir, k) => {
    const [d0, d1] = depths[k], part = c.part(), t = [Math.SQRT1_2, dir * Math.SQRT1_2], q = [-t[1], t[0]];
    const at = (a: number, b: number, d: number): V3 => c.P(uc + t[0] * a + q[0] * b, vc + t[1] * a + q[1] * b, d);
    const dirOf = (du: number, dv: number): V3 => { const o = c.P(uc, vc, 0), e = c.P(uc + du, vc + dv, 0); return [e[0] - o[0], e[1] - o[1], e[2] - o[2]]; };
    const L = h * Math.SQRT2, W = w / 2, ring: [number, number][] = [[-L, -W], [L, -W], [L, W], [-L, W]];
    const front = ring.map(([a, b]) => at(a, b, d1)), back = ring.map(([a, b]) => at(a, b, d0));
    c.mesh.quad(slot, front[0], front[1], front[2], front[3], part, c.p.n);
    c.mesh.quad(slot, back[3], back[2], back[1], back[0], part, scale(c.p.n, -1));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, mid = [(ring[i][0] + ring[j][0]) / 2, (ring[i][1] + ring[j][1]) / 2];
      c.mesh.quad(slot, back[i], back[j], front[j], front[i], part, dirOf(t[0] * mid[0] + q[0] * mid[1], t[1] * mid[0] + q[1] * mid[1]));
    }
    n += 12;
  });
  return n;
}

/** Blue police lamp on a bracket beside the entrance (wall-mounted lantern). */
export function drawBlueLamp(c: PanelCtx, u: number, v: number, slots: { bracket: Slot; lamp: Slot; cap: Slot }): boolean {
  if (!fitsPanel(c.p, rectPoly(u - 0.1, u + 0.1, v - 0.1, v + 0.1))) return false;
  c.box(slots.bracket, u - 0.04, u + 0.04, v - 0.04, v + 0.04, 0, 0.5, c.part());
  closedBox(c, slots.bracket, u - 0.06, u + 0.06, v - 0.12, v - 0.04, 0.42, 0.56);
  closedBox(c, slots.lamp, u - 0.17, u + 0.17, v - 0.62, v - 0.12, 0.32, 0.66);
  closedBox(c, slots.cap, u - 0.2, u + 0.2, v - 0.12, v - 0.04, 0.29, 0.69);
  return true;
}

export interface RoofBox { centre: [number, number]; baseY: number; size: [number, number, number]; angleRad: number }
/** Roof plant: closed boxes standing on the roof (closed underneath too: the base edges otherwise read as open edges). */
export function drawRoofBoxes(mesh: MeshBuilder, boxes: RoofBox[], slot: Slot) {
  for (const b of boxes) {
    const [cx, cz] = b.centre, [w, d, h] = b.size, ca = Math.cos(b.angleRad), sa = Math.sin(b.angleRad), part = mesh.newPart();
    const at = (x: number, z: number, y: number): V3 => [cx + x * ca - z * sa, b.baseY + y, cz + x * sa + z * ca];
    const c = [at(-w / 2, -d / 2, 0), at(w / 2, -d / 2, 0), at(w / 2, d / 2, 0), at(-w / 2, d / 2, 0)], t = c.map(p => [p[0], p[1] + h, p[2]] as V3);
    mesh.quad(slot, t[0], t[1], t[2], t[3], part, UP);
    mesh.quad(slot, c[3], c[2], c[1], c[0], part, DOWN);
    for (let k = 0; k < 4; k++) {
      const a = c[k], bb = c[(k + 1) % 4], mid: V3 = [(a[0] + bb[0]) / 2 - cx, 0, (a[2] + bb[2]) / 2 - cz];
      mesh.quad(slot, a, bb, t[(k + 1) % 4], t[k], part, mid);
    }
  }
}

/** Carved portal round an entrance: jambs, entablature, pediment (tympanum block) and the crest in it (m). */
export const PORTAL = { jamb: 0.32, out: 2 * SHEET_PITCH, entH: 0.42, maxTympanumH: 1.4 };
export interface PortalResult { u0: number; u1: number; frieze: { v0: number; v1: number; d: number }; tympanum: boolean; crest: boolean }

/**
 * A carved stone portal round a cut entrance (`e`: its opening): two jambs and an entablature as closed boxes 9 cm
 * off the wall (the frieze 4.5 cm further), a triangular pediment block over it whose front face is the tympanum, and a
 * lozenge crest standing 9 cm proud of the tympanum. The pediment shrinks (or is dropped) to stay under the openings
 * above. Every part is a closed solid, so nothing adds an open edge or shares a plane with the wall.
 */
export function drawPortal(c: PanelCtx, e: { u0: number; u1: number; v0: number; top: number }, slot: Slot, crestSlot: Slot = slot): PortalResult | null {
  const { jamb: t, out, entH } = PORTAL, a = e.u0 - t, b = e.u1 + t, room = lowestHoleAbove(c, e.top) - 0.1 - e.top;
  const eh = Math.min(entH, Math.max(0, room)), ea = a - 0.08, eb = b + 0.08;
  if (eh < 0.25 || !fitsPanel(c.p, rectPoly(ea, eb, e.v0, e.top + eh))) return null;
  const part = c.part();
  c.box(slot, a, e.u0, e.v0, e.top, 0, out, part);
  c.box(slot, e.u1, b, e.v0, e.top, 0, out, part);
  const frieze = { v0: e.top, v1: e.top + eh, d: out + SHEET_PITCH };
  c.box(slot, ea, eb, frieze.v0, frieze.v1, 0, frieze.d, part);
  // pediment: a triangular prism on the entablature (front = tympanum), apex centred
  const base = frieze.v1, H = Math.min(PORTAL.maxTympanumH, 0.3 * (eb - ea), room - eh - 0.05), uc = (ea + eb) / 2;
  if (H < 0.3 || !fitsPanel(c.p, [[ea, base], [eb, base], [uc, base + H]])) return { u0: ea, u1: eb, frieze, tympanum: false, crest: false };
  solid(c, slot, (i, j, k) => c.P(j ? uc : i ? eb : ea, base + j * H, k ? out : 0), part);
  // crest: a lozenge prism in the tympanum, through the pediment to 9 cm in front of it
  const cs = Math.min(0.7, H * 0.55), cv = base + H * 0.38;
  const corner = (i: number, j: number): [number, number] => (i === 0 && j === 0 ? [uc, cv - cs / 2] : i === 1 && j === 0 ? [uc + cs * 0.4, cv] : i === 1 ? [uc, cv + cs / 2] : [uc - cs * 0.4, cv]);
  solid(c, crestSlot, (i, j, k) => { const [u, v] = corner(i, j); return c.P(u, v, k ? out + 2 * SHEET_PITCH : 0); }, c.part());
  return { u0: ea, u1: eb, frieze, tympanum: true, crest: true };
}

/** Lettering stands this far in front of the board it is on: within the open-edge gate's 2 cm, as every lettered plate in the kit. */
export const LETTER_STANDOFF = 0.012;

/**
 * Facing boards and cladding stand on the 9 cm sheet layer, not 4.5 cm: 3DBAG faces merged into one panel sit up to a
 * few cm in front of its plane, and a 4.5 cm facing then came within 2.5 cm of the brick (Beursplein 5, 13 m2 tight
 * z-fight in the first cut).
 */
export const FACING_OUT = 2 * SHEET_PITCH;

/**
 * Name band at the cornice: lettered on the cornice's own front face when the wall has one (`cornice`: its v range
 * and projection; Binnengasthuis, UNIVERSITEIT VAN AMSTERDAM on the entablature), else a stone frieze board on the
 * facing layer between the top row of openings and `top`. Lettering 1.2 cm proud, centred on the panel; returns
 * triangles of lettering (0 = no room).
 */
export function drawNameBand(c: PanelCtx, text: string, top: number, slot: Slot, textSlot: Slot, cornice?: { v0: number; v1: number; out: number }): number {
  const p = c.p, W = p.uMax - p.uMin;
  if (cornice) {
    const h = (cornice.v1 - cornice.v0) * 0.62, uc = (p.uMin + p.uMax) / 2, L = letteringGeometry({ text, heightM: h, maxWidthM: W * 0.8 });
    if (!fitsPanel(p, rectPoly(uc - L.widthM / 2, uc + L.widthM / 2, cornice.v0, cornice.v1))) return 0;
    return drawLettering(c, text, uc, (cornice.v0 + cornice.v1) / 2, cornice.out + LETTER_STANDOFF, h, W * 0.8, textSlot);
  }
  const holes = [...c.holes.values()].flat().filter(h => h[3] < top);
  const lo = Math.max(p.vMin, ...holes.map(h => h[3])) + 0.12, hi = top - 0.06, h = Math.min(0.9, hi - lo);
  if (h < 0.35) return 0;
  const v0 = (lo + hi) / 2 - h / 2, v1 = v0 + h, uc = (p.uMin + p.uMax) / 2;
  const L = letteringGeometry({ text, heightM: h * 0.6, maxWidthM: W * 0.8 }), bw = Math.min(W * 0.92, L.widthM + 1.0);
  if (!fitsPanel(p, rectPoly(uc - bw / 2, uc + bw / 2, v0, v1))) return 0;
  c.box(slot, uc - bw / 2, uc + bw / 2, v0, v1, 0, FACING_OUT, c.part());
  return drawLettering(c, text, uc, (v0 + v1) / 2, FACING_OUT + LETTER_STANDOFF, h * 0.6, W * 0.8, textSlot);
}

/**
 * Stone-faced storeys (a granite base, an ashlar attic) over a brick group: the storey's wall clad on the facing layer
 * (9 cm) in the group's stone, as bands below the openings, above them, and piers between them (closed with `closedBands`).
 */
export function drawStoneStorey(c: PanelCtx, v0: number, v1: number, slot: Slot): number {
  const p = c.p, holes = [...c.holes.values()].flat().filter(h => h[3] > v0 + 0.05 && h[2] < v1 - 0.05);
  let n = 0;
  if (!holes.length) return drawBand(c, slot, v0, v1, FACING_OUT);
  // the lower band stops 10 cm under the openings, clear of the sill boxes' top faces (they would share that plane)
  const hb = Math.max(v0, Math.min(...holes.map(h => h[2])) - 0.1), ht = Math.min(v1, Math.max(...holes.map(h => h[3])));
  if (hb - v0 > 0.15) n += drawBand(c, slot, v0, hb, FACING_OUT);
  if (v1 - ht > 0.15) n += drawBand(c, slot, ht, v1, FACING_OUT);
  if (ht - hb > 0.15) n += drawBand(c, slot, hb, ht, FACING_OUT);
  void p;
  return n;
}

/**
 * Banded stone pilasters at both ends of a panel (bank and office fronts): a pilaster 13.5 cm off the wall (4.5 cm
 * over any stone facing), and every other 0.36 m course a darker band 4.5 cm prouder again, inset 4.5 cm from the
 * pilaster's sides so no face shares a plane. Narrowed to clear the openings; returns the pilasters drawn.
 */
export function drawPilasters(c: PanelCtx, v0: number, v1: number, slot: Slot, bandSlot: Slot, width = 0.9): number {
  const p = c.p, W = p.uMax - p.uMin, spans = holeSpans(c, v0, v1);
  let n = 0;
  for (const side of [0, 1]) {
    let w = Math.min(width, W * 0.12);
    for (const [s0, s1] of spans) { if (side === 0 && s1 > p.uMin) w = Math.min(w, s0 - p.uMin - 0.05); if (side === 1 && s0 < p.uMax) w = Math.min(w, p.uMax - s1 - 0.05); }
    if (w < 0.3) continue;
    const a = side === 0 ? p.uMin : p.uMax - w, b = a + w, part = c.part();
    if (!fitsPanel(p, rectPoly(a, b, v0, v1), 0.01)) continue;
    c.box(slot, a, b, v0, v1, 0, FACING_OUT + SHEET_PITCH, part);
    const course = 0.36, bp = c.part();
    for (let v = v0 + course; v + course < v1; v += 2 * course) c.box(bandSlot, a + SHEET_PITCH, b - SHEET_PITCH, v, v + course, 0, FACING_OUT + 2 * SHEET_PITCH, bp);
    n++;
  }
  return n;
}

export interface Lantern { centre: [number, number]; baseY: number; topY: number; size: number; angleRad: number }
/**
 * Roof lantern (a glazed cupola on a mansard ridge): a glass core, four frame corner posts proud of it, a base and a
 * cap slab, all closed boxes on the local roof axes. `baseY` sits at the lowest roof point under it so it reads seated.
 */
export function drawLantern(mesh: MeshBuilder, l: Lantern, slots: { glass: Slot; frame: Slot; stone: Slot }) {
  // one part: the stacked boxes touch face to face, but their corners (the gate's probe points) are up to 20 cm apart
  const ca = Math.cos(l.angleRad), sa = Math.sin(l.angleRad), [cx, cz] = l.centre, s = l.size, part = mesh.newPart();
  const box = (slot: Slot, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => {
    const at = (x: number, z: number, y: number): V3 => [cx + x * ca - z * sa, y, cz + x * sa + z * ca];
    const b = [at(x0, z0, y0), at(x1, z0, y0), at(x1, z1, y0), at(x0, z1, y0)], t = b.map(q => [q[0], y1, q[2]] as V3), mid = at((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    mesh.quad(slot, t[0], t[1], t[2], t[3], part, [0, 1, 0]);
    mesh.quad(slot, b[3], b[2], b[1], b[0], part, [0, -1, 0]);
    for (let k = 0; k < 4; k++) mesh.quad(slot, b[k], b[(k + 1) % 4], t[(k + 1) % 4], t[k], part, sub(scale(add(b[k], b[(k + 1) % 4]), 0.5), mid));
  };
  const h = l.topY - l.baseY, plinth = Math.min(0.6, h * 0.2), cap = 0.3, core = s / 2 - 0.1, post = 0.14;
  box(slots.stone, -s / 2 - 0.05, s / 2 + 0.05, -s / 2 - 0.05, s / 2 + 0.05, l.baseY, l.baseY + plinth);
  box(slots.glass, -core, core, -core, core, l.baseY + plinth, l.topY - cap);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(slots.frame, x * s / 2 - (x > 0 ? post : 0), x * s / 2 + (x < 0 ? post : 0), z * s / 2 - (z > 0 ? post : 0), z * s / 2 + (z < 0 ? post : 0), l.baseY + plinth, l.topY - cap);
  box(slots.stone, -s / 2 - 0.15, s / 2 + 0.15, -s / 2 - 0.15, s / 2 + 0.15, l.topY - cap, l.topY);
}

/** Perforated-brick screen lattice: rails on the 9 cm sheet layer, posts on the 13.5 cm one, so the crossings never share a plane. */
export const SCREEN = { postW: 0.14, postOut: 3 * SHEET_PITCH, railH: 0.12, railOut: 2 * SHEET_PITCH, maxSegM: 9 };

/**
 * Perforated-brick screen (car parks, 1970s-80s): a concrete lattice in front of the brick infill, posts at every bay
 * joint and rails at every storey line and the top, as closed boxes (one lattice cell per bay per storey), over the
 * storeys the facade system laid out (not down a party wall). Posts stand on the 13.5 cm sheet layer and rails on the
 * 9 cm one, so where they cross the front faces are 4.5 cm apart (never coplanar) and the boxes simply interpenetrate;
 * rails skip the openings already cut. Returns the number of boxes drawn.
 */
export function drawScreen(c: PanelCtx, cells: Cell[], levels: number[], slot: Slot, top: number): number {
  return drawLattice(c, cells, levels, slot, top, SCREEN, false);
}

/** Curtain-wall grid (layered kit): mullions on the 13.5 cm sheet layer, transoms on the 9 cm one, 10 cm wide, on a glass skin. */
export const CURTAIN_GRID = { postW: 0.1, postOut: 3 * SHEET_PITCH, railH: 0.1, railOut: 2 * SHEET_PITCH, maxSegM: 9 };

/**
 * Curtain wall (layered kit): the group's 3DBAG wall is the glass skin and this draws its mullion/transom grid as closed
 * boxes standing off the glass (mullions at every bay joint, transoms at every storey line and under the top), skipping
 * the openings cut into it (an entrance). Nothing lies on the glass plane, so the grid never z-fights the skin.
 */
export function drawCurtainGrid(c: PanelCtx, cells: Cell[], levels: number[], slot: Slot, top: number): number {
  return drawLattice(c, cells, levels, slot, top, CURTAIN_GRID, true);
}

function drawLattice(c: PanelCtx, cells: Cell[], levels: number[], slot: Slot, top: number, dims: typeof SCREEN, postsSkipHoles: boolean): number {
  const p = c.p, part = c.part(), bot = Math.max(p.vMin, 0, Math.min(...cells.map(x => x.v0))) + 0.02;
  let n = 0;
  const joints = [...new Set(cells.flatMap(x => [x.u0, x.u1]).map(u => Math.round(u * 1000) / 1000))].sort((a, b) => a - b);
  for (const u of joints) {
    const a = Math.max(p.uMin, u - dims.postW / 2), b = Math.min(p.uMax, u + dims.postW / 2);
    if (b - a < dims.postW * 0.6) continue;
    // vertical runs where the wall is present, in 0.5 m steps, split at maxSegM (no box taller than the audit's loop limit)
    let start: number | null = null;
    const flush = (end: number) => {
      if (start === null) return;
      const k = Math.max(1, Math.ceil((end - start) / dims.maxSegM));
      for (let i = 0; i < k; i++) { c.box(slot, a, b, start + (end - start) * i / k, start + (end - start) * (i + 1) / k, 0, dims.postOut, part); n++; }
      start = null;
    };
    for (let v = bot; v < top - 0.01; v += 0.5) {
      const hi = Math.min(top, v + 0.5), ok = fitsPanel(p, rectPoly(a, b, v, hi), 0.0) && !(postsSkipHoles && holeSpans(c, v, hi).some(([s0, s1]) => s0 < b && s1 > a));
      if (ok && start === null) start = v;
      if (!ok) flush(v);
    }
    flush(top);
  }
  const rails = new Set<number>();
  levels.forEach((L, f) => { if (f > 0 && L > bot + 0.3 && L < top - 0.3) rails.add(L); });
  rails.add(top - dims.railH / 2);
  for (const v of [...rails].sort((x, y) => x - y)) {
    const v0 = v - dims.railH / 2, v1 = v + dims.railH / 2, skip = holeSpans(c, v0, v1);
    for (const [a0, b0] of intervals(p, v0, v1, 0.25)) {
      let pieces: [number, number][] = [[a0, b0]];
      for (const [s0, s1] of skip) pieces = pieces.flatMap(([a, b]) => (s1 <= a || s0 >= b ? [[a, b]] : [[a, s0], [s1, b]].filter(([x, y]) => y - x > 0.2)) as [number, number][]);
      for (const [a, b] of pieces) if (b - a > 0.2) { c.box(slot, a, b, v0, v1, 0, dims.railOut, part); n++; }
    }
  }
  return n;
}

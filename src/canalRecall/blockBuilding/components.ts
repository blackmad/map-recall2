/**
 * Large-tier components drawn on one wall panel (compose `panelHook`): recessed entrances and entrance halls,
 * canopies, sectional garage doors, cornices and fascias, stroke-font lettering, and the police signature parts
 * (blue-and-white striped POLITIE band, blue lamp), plus roof plant boxes on the roof. Every part is built on or
 * cut into the exact wall plane, so attachment holds by construction (block-kit gates check it).
 */
import { type PanelCtx, type Cell, stripBox, intervals, barQuad } from './compose.ts';
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
  const g = r.back, bar = r.back + (barD ?? c.barOut), fw = 0.08;
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

/** Sectional garage door: recessed 0.25 m, panel with horizontal ribs. */
export function drawGarageDoor(c: PanelCtx, cell: Cell, slots: { door: Slot; frame: Slot }): boolean {
  const cw = cell.u1 - cell.u0, w = Math.min(cw - 0.6, 3.6), uc = (cell.u0 + cell.u1) / 2, v0 = Math.max(cell.v0, c.p.vMin) + 0.05;
  const h = Math.min(3.2, cell.v1 - v0 - 0.4);
  if (w < 2.2 || h < 2.2) return false;
  const r = recess(c, uc - w / 2, uc + w / 2, v0, v0 + h, 0.25, slots.door);
  if (!r) return false;
  const part = c.part(), d = r.back + c.barOut;
  for (let v = v0 + 0.5; v < v0 + h - 0.2; v += 0.5) barQuad(c, slots.frame, r.Q, uc - w / 2 + 0.05, uc + w / 2 - 0.05, v - 0.025, v + 0.025, r.back, d, part);
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

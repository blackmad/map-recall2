/**
 * Block-kit compositor: 3DBAG LoD2.2 shell (exact walls + roofs, part 0) with
 * facade systems laid out on every exposed wall panel. Every decoration is its
 * own part, built flush on the wall plane (offsets 0 to ~0.9 m), so attachment
 * is by construction and checked by gates.ts.
 */
import * as T from 'three';
import type { SurfaceSet } from './types.ts';
import { MeshBuilder, type V3, cross, sub, add, scale, norm } from './mesh.ts';
import { buildHost, fitsPanel, rectPoly, pt, type Panel } from './panels.ts';
import type { BlockSpec, System, Row, WinParams, BalconyParams, Band, Slot, Sign } from './spec.ts';

export interface TextShaper { (text: string, font?: string): { shapes: T.Shape[]; width: number; ascent: number } }
export interface ComposeOptions { shaper?: TextShaper }
export interface ComposeResult { mesh: MeshBuilder; panels: Panel[]; stats: Record<string, number>; assignment: { panel: number; system: string | null; width: number; centre: [number, number] }[] }

const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
const rand = (a: number, b: number, c: number) => { let h = 2166136261 ^ (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Ctx {
  constructor(public mesh: MeshBuilder, public p: Panel, public panels: Panel[]) {}
  P(u: number, v: number, d = 0) { return pt(this.p, u, v, d); }
  part() { return this.mesh.newPart(); }
  quad(slot: Slot, u0: number, v0: number, u1: number, v1: number, d: number, part: number) {
    this.mesh.quad(slot, this.P(u0, v0, d), this.P(u1, v0, d), this.P(u1, v1, d), this.P(u0, v1, d), part, this.p.n);
  }
  poly(slot: Slot, pts: [number, number][], d: number, part: number) {
    const faces = T.ShapeUtils.triangulateShape(pts.map(q => new T.Vector2(q[0], q[1])), []);
    for (const f of faces) this.mesh.tri(slot, this.P(...pts[f[0]], d), this.P(...pts[f[1]], d), this.P(...pts[f[2]], d), part, this.p.n);
  }
  /** Box on the wall: faces front, top, bottom, left, right (back omitted: it sits on the wall). */
  box(slot: Slot, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, part: number) {
    const { mesh, p } = this, P = (u: number, v: number, d: number) => this.P(u, v, d);
    mesh.quad(slot, P(u0, v0, d1), P(u1, v0, d1), P(u1, v1, d1), P(u0, v1, d1), part, p.n);
    mesh.quad(slot, P(u0, v1, d0), P(u1, v1, d0), P(u1, v1, d1), P(u0, v1, d1), part, UP);
    mesh.quad(slot, P(u0, v0, d0), P(u1, v0, d0), P(u1, v0, d1), P(u0, v0, d1), part, DOWN);
    mesh.quad(slot, P(u0, v0, d0), P(u0, v1, d0), P(u0, v1, d1), P(u0, v0, d1), part, scale(p.r, -1));
    mesh.quad(slot, P(u1, v0, d0), P(u1, v1, d0), P(u1, v1, d1), P(u1, v0, d1), part, p.r);
  }
}

interface Cell { u0: number; u1: number; v0: number; v1: number; bay: number; floor: number; bays: number }
const frac = (x: number | undefined, total: number, dflt: number) => { const v = x ?? dflt; return v <= 1 ? v * total : v; };

function drawOpening(c: Ctx, u0: number, u1: number, v0: number, v1: number, w: WinParams, seed: number) {
  const frameSlot = w.frame ?? 'frame', glassSlot = w.glass ?? 'glass', fw = w.frameW ?? 0.07;
  if (u1 - u0 < 0.3 || v1 - v0 < 0.3) return;
  if (!fitsPanel(c.p, rectPoly(u0 - (w.surround?.t ?? 0), u1 + (w.surround?.t ?? 0), v0 - (w.sillSlot ? (w.sillH ?? 0.05) : 0), v1 + (w.surround?.t ?? 0)))) return;
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
  if (n > 0) {
    part = c.part();
    for (let k = 1; k <= n; k++) { const u = u0 + (u1 - u0) * k / (n + 1); c.quad(frameSlot, u - fw / 2, v0 + fw, u + fw / 2, v1 - fw, 0.05, part); }
  }
  if (w.transom) {
    part = c.part();
    const v = v0 + (v1 - v0) * w.transom;
    c.quad(frameSlot, u0 + fw, v - fw / 2, u1 - fw, v + fw / 2, 0.05, part);
  }
  const rn = w.rows ?? 0;
  if (rn > 0) {
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
    case 'punched': { const w = row.win ?? {}; const [a, b, lo, hi] = winRect(cell, w); drawOpening(c, a, b, lo, hi, w, seed); return; }
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
      drawOpening(c, a, b, lo, hi, w, seed);
      if (door) {
        const dw = door.w ?? 1.1, dh = door.h ?? 2.3, uc = (a + b) / 2, part = c.part();
        if (fitsPanel(c.p, rectPoly(uc - dw / 2, uc + dw / 2, lo, lo + dh))) c.quad(door.slot ?? 'door', uc - dw / 2, lo, uc + dw / 2, lo + dh, 0.045, part);
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
  c.quad(frame, du - dw / 2 - 0.05, v0 + 0.08, du + dw / 2 + 0.05, v0 + dh + 0.05, 0.055, part);
  c.quad(s.door.slot ?? 'door', du - dw / 2, v0 + 0.08, du + dw / 2, v0 + dh, 0.065, part);
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
  let part = c.part();
  c.box(slab, a0, a1, v0 - 0.02, v0 - 0.02 + sh, 0, depth, part);
  part = c.part();
  const rv0 = v0 - 0.02 + sh;
  const rslot = rail.slot ?? (rail.kind === 'glass' ? 'glassRail' : rail.kind === 'solid' ? 'slab' : 'rail');
  if (rail.kind === 'bars') {
    c.quad(rail.slot ?? 'rail', a0 + 0.05, rv0, a1 - 0.05, rv0 + rh, depth - 0.03, part);
  } else if (rail.kind === 'rods') {
    const rs = rail.slot ?? 'rail', n = Math.max(2, Math.round((a1 - a0) / 0.13));
    for (let k = 0; k <= n; k++) { const u = a0 + 0.04 + (a1 - a0 - 0.08) * k / n; c.quad(rs, u - 0.012, rv0, u + 0.012, rv0 + rh, depth - 0.03, part); }
    c.quad(rs, a0, rv0 + 0.05, a1, rv0 + 0.1, depth - 0.03, part);
  } else c.quad(rslot, a0, rv0, a1, rv0 + rh, depth - 0.03, part);
  // side cheeks join the slab to the wall so the rail is supported on both ends
  part = c.part();
  const cheek = rail.kind === 'solid' ? slab : (rail.slot ?? 'rail');
  c.box(cheek, a0, a0 + 0.06, rv0, rv0 + rh, 0, depth, part);
  c.box(cheek, a1 - 0.06, a1, rv0, rv0 + rh, 0, depth, part);
  if (rail.top !== null) { part = c.part(); c.box(rail.top ?? slab, a0, a1, rv0 + rh, rv0 + rh + 0.05, depth - 0.07, depth, part); }
  if (b.back !== null) {
    const w = { w: 0.8, h: 0.72, sill: sh + 0.08, ...(b.back ?? {}) };
    const [a, bb, lo, hi] = winRect({ ...cell, u0: a0, u1: a1 }, w);
    drawOpening(c, a, bb, lo, hi, w, seed);
  }
  if (b.piers) {
    part = c.part();
    const slot = b.piers.slot ?? 'wall', out = b.piers.out ?? 0.12;
    c.box(slot, u0, a0, v0, v1, 0, out, part); c.box(slot, a1, u1, v0, v1, 0, out, part);
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
  mesh.quad(slot, A1, B1, oB1, oA1, part, UP);
  mesh.quad(slot, A0, B0, oB0, oA0, part, DOWN);
  if (!joinA) mesh.quad(slot, A0, oA0, oA1, A1, part, scale(p.r, -1));
  if (!joinB) mesh.quad(slot, B0, oB0, oB1, B1, part, p.r);
}

function drawBands(c: Ctx, bands: Band[], levels: number[], sys: System) {
  void sys;
  for (const band of bands) {
    levels.forEach((L, f) => {
      if (f === 0 || (band.skipGround && f === 1) || (band.fromFloor && f < band.fromFloor)) return;
      const v0 = L + (band.lift ?? 0) - band.h / 2, v1 = v0 + band.h;
      for (const [a, b] of intervals(c.p, v0, v1)) if (b - a > 0.2) stripBox(c, band.slot, a, b, v0, v1, band.out);
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
  const { panels, stats: hostStats } = buildHost(set, mesh, roofSlot, wallSlot);
  const hostTris = mesh.triangles;
  const assignment: ComposeResult['assignment'] = [];
  const g = spec.levels.groundM, s = spec.levels.storeyM;
  for (const p of panels) {
    const W = p.uMax - p.uMin, centre: [number, number] = [p.o[0] + p.r[0] * (p.uMin + p.uMax) / 2, p.o[2] + p.r[2] * (p.uMin + p.uMax) / 2];
    const sysName = pickSystem(spec, p);
    assignment.push({ panel: p.index, system: sysName, width: W, centre });
    if (!sysName) continue;
    const sys: System | undefined = spec.systems[sysName]; if (!sys) throw new Error(`unknown system ${sysName}`);
    if (W < (sys.minWidth ?? sys.pitch * 0.6) || p.vMax - p.vMin < 2.5) continue;
    const c = new Ctx(mesh, p, panels);
    // storey boundaries
    const levels: number[] = [0, g]; for (let L = g + s; L < p.vMax - 1.0; L += s) levels.push(L); levels.push(Math.max(p.vMax, levels[levels.length - 1] + 0.01));
    const floors = levels.length - 1, nb = Math.max(1, Math.round(W / sys.pitch)), nbays = sys.bays ? sys.bays.count : nb;
    for (let f = 0; f < floors; f++) {
      const v0 = levels[f], v1 = levels[f + 1];
      if (v1 <= p.vMin + 0.5 || v0 < p.partyH - 0.3) continue;
      if (f === floors - 1 && v1 - v0 < 1.8) continue;
      const topRow = sys.top && f >= floors - (sys.topCount ?? 1) && f > 0;
      const row = sys.rowOverrides?.[String(f)] ?? (f === 0 ? sys.ground : topRow ? sys.top! : sys.typical);
      for (let b = 0; b < nbays; b++) {
        const lay = sys.bays;
        const cell: Cell = lay
          ? { u0: p.uMin + lay.first + lay.pitch * (b - 0.5), u1: p.uMin + lay.first + lay.pitch * (b + 0.5), v0: Math.max(v0, p.vMin), v1, bay: b, floor: f, bays: nbays }
          : { u0: p.uMin + W * b / nb, u1: p.uMin + W * (b + 1) / nb, v0: Math.max(v0, p.vMin), v1, bay: b, floor: f, bays: nb };
        drawRow(c, row, cell, p.index * 31 + 7);
      }
    }
    if (sys.cladding) for (const [a0, b0] of intervals(p, sys.cladding.from, p.vMax - 0.35)) for (const [a, b] of [[Math.max(a0, p.uMin + W * (sys.cladding.u?.[0] ?? 0)), Math.min(b0, p.uMin + W * (sys.cladding.u?.[1] ?? 1))]]) if (b - a > 0.3) { const part = c.part(); c.quad(sys.cladding.slot, a, sys.cladding.from, b, p.vMax - 0.35, 0.012, part); }
    if (sys.bands) drawBands(c, sys.bands, levels.slice(0, floors), sys);
    if (sys.piers) {
      for (let b = 0; b <= nb; b++) {
        const u = p.uMin + W * b / nb, w = sys.piers.w, a = Math.max(p.uMin, u - w / 2), bb = Math.min(p.uMax, u + w / 2);
        if (fitsPanel(p, rectPoly(a, bb, g, Math.max(g + 0.5, p.vMax - 0.3)))) { const part = c.part(); c.box(sys.piers.slot, a, bb, g, p.vMax - 0.3, 0, sys.piers.out, part); }
      }
    }
  }
  // signs
  if (opts.shaper) for (const sign of spec.signs ?? []) drawSign(mesh, panels, sign, opts.shaper);
  return { mesh, panels, assignment, stats: { ...hostStats, panels: panels.length, hostTris, triangles: mesh.triangles, parts: mesh.partCount } };
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

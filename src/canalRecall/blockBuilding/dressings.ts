/**
 * Stone dressings on a brick wall (opt-in `dressings` on a large-tier wall group): the white accents of late-19th and
 * early-20th-century fronts that the plain brick grid cannot say. Damrak 77 (1893/rebuilt), its oriel stacks and
 * speklagen; the dark-brick schools and warehouses with stone lintels, keystones and quoins.
 *
 * - `bands`: stone bands at the storey line (`floor`), under the storey's sills (`sill`) or over its heads (`head`), single
 *   or `double` (two thin bands);
 * - `stripes`: speklagen, `count` stone courses alternating with brick across the plain wall of each listed storey;
 * - `heads`: a stone `lintel`, a `keystone`, or both, over every square-headed window of the listed storeys;
 * - `surrounds`: stone jambs and head round every square-headed window (`eared`: the head runs past the jambs with ears);
 * - `quoins`: long and short blocks up both ends of the widest panel, and/or a chain of small blocks up its listed bay joints;
 * - `oriels`: a projecting stone bay over the listed bays from storey `from` to `to`, square or canted, its windows on the
 *   front face, on a corbel, under a cap;
 * - `voussoirs`: alternating stone and brick voussoirs round every arched opening of the listed storeys (a banded arch),
 *   optionally continued down the jambs;
 * - `piers`: brick pilasters at the bay joints from storey `from` up.
 *
 * Every part is a closed solid at least 4 cm proud (the z-fight band), parts that meet overlap by 2 cm instead of
 * sharing a face, and nothing is drawn across an opening. Geometry is in the panel's (u, v, d) frame.
 */
import { solid, SHEET_PITCH, type Cell, type PanelCtx } from './compose.ts';
import { drawBand } from './components.ts';
import { fitsPanel, rectPoly } from './panels.ts';
import type { V3 } from './mesh.ts';

export const DRESSING_BAND_AT = ['floor', 'sill', 'head'] as const;
export const DRESSING_HEADS = ['lintel', 'keystone', 'lintel-keystone'] as const;

/** The intent field (validated in buildingRecipe/stoneDressingsIntent.ts); the fit passes it through unchanged. */
export interface StoneDressings {
  /** dressing colour (#rrggbb) when it differs from the group's stone (fitLarge gives it the slot `dress@g<i>`) */
  colour?: string;
  bands?: { at: (typeof DRESSING_BAND_AT[number])[]; storeys?: number[]; double?: boolean };
  stripes?: { storeys: number[]; count?: number };
  heads?: { kind: typeof DRESSING_HEADS[number]; storeys?: number[] };
  surrounds?: { storeys?: number[]; eared?: boolean };
  quoins?: { ends?: boolean; joints?: number[] };
  oriels?: { bays: number[]; from: number; to: number; deep?: number; canted?: boolean };
  voussoirs?: { storeys?: number[]; jambs?: boolean };
  piers?: { w?: number; from?: number };
}

/** Sizes in metres (proportions where noted); measured on Damrak 77 (w01-128, 2020-04-21) and the Nassaukade benchmark. */
export const DRESS = {
  band: { h: 0.16, thin: 0.09, gap: 0.07, out: 0.06 },
  stripe: { out: 0.045, minCount: 1, maxCount: 8 },
  lintel: { h: 0.22, over: 0.1, out: 0.06 },
  keystone: { w: 0.24, h: 0.34, out: 0.1 },
  surround: { t: 0.13, out: 0.05, ear: 0.12, earH: 0.14, earOut: 0.07 },
  quoin: { course: 0.32, joint: 0.04, long: 0.62, short: 0.36, out: 0.05 },
  chain: { w: 0.24, h: 0.15, pitch: 0.36, out: 0.05 },
  /** oriel: `deep` x the oriel's width out (default), window margin, corbel and cap heights, window frame width */
  oriel: { deep: 0.22, cant: 0.6, minOut: 0.35, maxOut: 1.1, margin: 0.22, corbel: 0.45, cap: 0.3, frame: 0.06, side: 0.1 },
  voussoir: { t: 0.42, block: 0.34, out: 0.05, jamb: 0.3 },
  /** pier width as a fraction of the bay (default) and projection */
  pier: { w: 0.18, out: 0.22 },
} as const;

export interface DressingSlots { stone: string; wall: string; frame: string; glass: string }
type Hole = [number, number, number, number, [number, number][]?];

/** The storey (index into `levels`) an opening starting at `v0` belongs to, or -1. */
function storeyOf(levels: number[], v0: number): number {
  for (let s = 0; s + 1 < levels.length; s++) if (v0 >= levels[s] - 0.05 && v0 < levels[s + 1] - 0.05) return s;
  return -1;
}
const overlaps = (h: Hole, u0: number, u1: number, v0: number, v1: number, m = 0.05) => h[0] - m < u1 && h[1] + m > u0 && h[2] - m < v1 && h[3] + m > v0;

/**
 * Draw the group's dressings on one panel. `main`: this is the group's widest panel (oriels, joint chains and piers are
 * laid out on its bays); `top`: the wall top under the cornice. Returns the number of parts drawn.
 */
export function drawDressings(c: PanelCtx, info: { levels: number[]; cells: Cell[] }, d: StoneDressings, slots: DressingSlots, main: boolean, top: number): number {
  const p = c.p, levels = info.levels, holes = [...c.holes.values()].flat() as Hole[], base = Math.max(0, p.vMin);
  let n = 0;
  // Oriels first: what they cover gets no band, head or quoin.
  const oriels = main && d.oriels ? drawOriels(c, info, holes, d.oriels, slots, top) : [];
  n += oriels.length;
  const covered = (h: Hole) => oriels.some(o => h[0] >= o[0] - 0.01 && h[1] <= o[1] + 0.01 && h[2] >= o[2] - 0.01 && h[3] <= o[3] + 0.01);
  const free = holes.filter(h => !covered(h));
  const orielSkip = (v0: number, v1: number): [number, number][] => oriels.filter(o => o[2] < v1 && o[3] > v0).map(o => [o[0] - 0.02, o[1] + 0.02]);
  const storeys = Math.max(0, levels.length - 1);
  const pierOut = main && d.piers ? DRESS.pier.out : 0;
  if (main && d.piers) n += drawPiers(c, info, free, d.piers, slots.wall, top);

  if (d.bands) {
    const B = DRESS.band, list = d.bands.storeys ?? Array.from({ length: Math.max(0, storeys - 1) }, (_, k) => k + 1);
    for (const st of list) {
      if (st < 0 || st >= storeys) continue;
      const own = free.filter(h => !h[4] && storeyOf(levels, h[2]) === st);
      for (const at of d.bands.at) {
        let mid: number;
        if (at === 'floor') { if (st === 0) continue; mid = levels[st]; }
        else if (!own.length) continue;
        else if (at === 'sill') mid = Math.min(...own.map(h => h[2])) - 0.02 - B.h / 2;
        else mid = Math.max(...own.map(h => h[3])) + 0.04 + B.h / 2;
        const spans: [number, number][] = d.bands.double ? [[mid - B.gap / 2 - B.thin, mid - B.gap / 2], [mid + B.gap / 2, mid + B.gap / 2 + B.thin]] : [[mid - B.h / 2, mid + B.h / 2]];
        for (const [v0, v1] of spans) if (v0 > base + 0.1 && v1 < top - 0.05) n += drawBand(c, slots.stone, v0, v1, B.out, orielSkip(v0, v1));
      }
    }
  }

  if (d.stripes) {
    const count = Math.max(DRESS.stripe.minCount, Math.min(DRESS.stripe.maxCount, d.stripes.count ?? 4));
    for (const st of d.stripes.storeys) {
      if (st < 0 || st >= storeys) continue;
      const v0 = Math.max(base, levels[st]) + (st === 0 ? 0.3 : 0.1), v1 = Math.min(top, levels[st + 1]) - 0.1, pitch = (v1 - v0) / (2 * count + 1);
      if (pitch < 0.08) continue;
      // brick, stone, brick, ... brick: `count` stone courses with brick above and below
      for (let k = 0; k < count; k++) { const a = v0 + (2 * k + 1) * pitch, b = a + pitch; n += drawBand(c, slots.stone, a, b, DRESS.stripe.out, orielSkip(a, b)); }
    }
  }

  const square = (list: number[] | undefined) => free.filter(h => !h[4] && (list ? list.includes(storeyOf(levels, h[2])) : storeyOf(levels, h[2]) >= 1));
  if (d.surrounds) {
    const S = DRESS.surround;
    for (const h of square(d.surrounds.storeys)) {
      const [u0, u1, v0, v1] = h, ear = d.surrounds.eared ? S.ear : 0;
      if (!fitsPanel(p, rectPoly(u0 - S.t - ear, u1 + S.t + ear, v0, v1 + S.t)) || free.some(o => o !== h && overlaps(o, u0 - S.t - ear, u1 + S.t + ear, v0, v1 + S.t, 0.02))) continue;
      const part = c.part();
      c.box(slots.stone, u0 - S.t, u0 + 0.0, v0, v1 + 0.02, 0, S.out, part);
      c.box(slots.stone, u1 - 0.0, u1 + S.t, v0, v1 + 0.02, 0, S.out, part);
      c.box(slots.stone, u0 - S.t - ear, u1 + S.t + ear, v1, v1 + S.t, 0, S.out + 0.01, part);
      if (ear) { c.box(slots.stone, u0 - S.t - ear, u0 - S.t + 0.02, v1 - S.earH, v1 + 0.02, 0, S.earOut, part); c.box(slots.stone, u1 + S.t - 0.02, u1 + S.t + ear, v1 - S.earH, v1 + 0.02, 0, S.earOut, part); }
      n++;
    }
  }
  if (d.heads) {
    const L = DRESS.lintel, K = DRESS.keystone, lintel = d.heads.kind !== 'keystone', key = d.heads.kind !== 'lintel';
    for (const h of square(d.heads.storeys)) {
      const [u0, u1, , v1] = h, uc = (u0 + u1) / 2, above = d.surrounds ? DRESS.surround.t : 0;
      const room = Math.min(top, ...free.filter(o => o !== h && o[2] > v1 && o[0] < u1 + L.over && o[1] > u0 - L.over).map(o => o[2] - 0.05)) - v1;
      if (room < K.h + 0.05) continue;
      const part = c.part();
      if (lintel && !d.surrounds && fitsPanel(p, rectPoly(u0 - L.over, u1 + L.over, v1, v1 + L.h))) { c.box(slots.stone, u0 - L.over, u1 + L.over, v1, v1 + L.h, 0, L.out, part); n++; }
      // with a lintel or a surround head the keystone stands on its face 3 cm up; alone it springs from the head
      const k0 = lintel || above ? v1 + 0.03 : v1 - 0.02, k1 = Math.max(k0 + 0.2, v1 + above + K.h);
      if (key && fitsPanel(p, rectPoly(uc - K.w / 2, uc + K.w / 2, k0, k1))) { c.box(slots.stone, uc - K.w / 2, uc + K.w / 2, k0, k1, 0, K.out, part); n++; }
    }
  }

  if (main && d.quoins?.ends) n += drawQuoins(c, free, base, top, slots.stone);
  if (main && d.quoins?.joints?.length) n += drawChains(c, info, free, d.quoins.joints, base, top, slots.stone, pierOut);
  if (d.voussoirs) n += drawVoussoirs(c, levels, free, d.voussoirs, slots.stone);
  return n;
}

/** Brick pilasters at every bay joint of the panel from storey `from` (default 1) to `top`, narrowed to clear the openings. */
function drawPiers(c: PanelCtx, info: { levels: number[]; cells: Cell[] }, holes: Hole[], pr: NonNullable<StoneDressings['piers']>, slot: string, top: number): number {
  const p = c.p, from = pr.from ?? 1, v0 = Math.max(p.vMin, info.levels[from] ?? p.vMax), joints = jointUs(info.cells);
  let n = 0;
  if (top - v0 < 1) return 0;
  for (const u of joints) {
    const pitch = Math.min(...info.cells.map(x => x.u1 - x.u0));
    let w = (pr.w ?? DRESS.pier.w) * pitch;
    for (const h of holes) if (h[3] > v0 && h[2] < top) { if (h[1] <= u) w = Math.min(w, 2 * (u - h[1] - 0.04)); else if (h[0] >= u) w = Math.min(w, 2 * (h[0] - u - 0.04)); else w = 0; }
    if (w < 0.2 || !fitsPanel(p, rectPoly(u - w / 2, u + w / 2, v0, top))) continue;
    c.box(slot, u - w / 2, u + w / 2, v0, top, 0, DRESS.pier.out, c.part()); n++;
  }
  return n;
}

/** u of the joints between neighbouring bays of the panel's cell grid (not its ends). */
function jointUs(cells: Cell[]): number[] {
  const byBay = new Map<number, number>();
  for (const x of cells) byBay.set(x.bay, Math.min(byBay.get(x.bay) ?? Infinity, x.u0));
  return [...byBay].filter(([b]) => b > 0).map(([, u]) => u).sort((a, b) => a - b);
}

/** Quoins up both ends of the panel (the group's widest): blocks alternately long and short, a 4 cm joint between courses, clear of openings. */
function drawQuoins(c: PanelCtx, holes: Hole[], base: number, top: number, slot: string): number {
  const p = c.p, Q = DRESS.quoin;
  let n = 0;
  for (const side of [0, 1]) {
    const part = c.part();
    let k = 0, drawn = 0;
    for (let v = base + 0.02; v + Q.course <= top; v += Q.course, k++) {
      const w = Math.min(k % 2 ? Q.short : Q.long, (p.uMax - p.uMin) * 0.2), a = side === 0 ? p.uMin : p.uMax - w, b = a + w, v1 = v + Q.course - Q.joint;
      if (!fitsPanel(p, rectPoly(a, b, v, v1), 0.01) || holes.some(h => overlaps(h, a, b, v, v1))) continue;
      c.box(slot, a, b, v, v1, 0, Q.out, part); drawn++;
    }
    if (drawn) n++;
  }
  return n;
}

/** A chain of small stone blocks up the joint left of each listed bay (the bay count = the joint at the right end). */
function drawChains(c: PanelCtx, info: { cells: Cell[] }, holes: Hole[], joints: number[], base: number, top: number, slot: string, d0: number): number {
  const p = c.p, C = DRESS.chain, left = new Map<number, number>(), right = new Map<number, number>();
  for (const x of info.cells) { left.set(x.bay, Math.min(left.get(x.bay) ?? Infinity, x.u0)); right.set(x.bay, Math.max(right.get(x.bay) ?? -Infinity, x.u1)); }
  let n = 0;
  for (const j of joints) {
    const u = left.get(j) ?? right.get(j - 1);
    if (u === undefined) continue;
    const part = c.part();
    let drawn = 0;
    for (let v = base + 0.3; v + C.h <= top - 0.1; v += C.pitch) {
      const a = u - C.w / 2, b = u + C.w / 2;
      if (!fitsPanel(p, rectPoly(a, b, v, v + C.h), 0.01) || holes.some(h => overlaps(h, a, b, v, v + C.h, 0.03))) continue;
      c.box(slot, a, b, v, v + C.h, 0, d0 + C.out, part); drawn++;
    }
    if (drawn) n++;
  }
  return n;
}

/**
 * Banded arches: round every arched opening on the listed storeys (default the ground), the head divided into an odd
 * number of voussoirs about 0.34 m wide, alternately stone and wall (the wall ones are the brick itself), stone at both
 * springers and the crown; `jambs`: alternating stone blocks down both jambs to the sill.
 */
function drawVoussoirs(c: PanelCtx, levels: number[], holes: Hole[], vs: NonNullable<StoneDressings['voussoirs']>, slot: string): number {
  const V = DRESS.voussoir, list = vs.storeys ?? [0];
  let n = 0;
  for (const h of holes) {
    const outline = h[4];
    if (!outline || outline.length < 5 || !list.includes(storeyOf(levels, h[2]))) continue;
    const head = outline.slice(2), uc = (h[0] + h[1]) / 2, spring = head[0][1];
    // arc length parametrisation of the head polyline (right springer -> left springer)
    const seg = head.slice(1).map((q, i) => Math.hypot(q[0] - head[i][0], q[1] - head[i][1])), L = seg.reduce((s, x) => s + x, 0);
    let count = Math.max(5, Math.round(L / V.block));
    if (count % 4 !== 1) count += (5 - (count % 4)) % 4; // 4m+1: stone at both springers and at the crown
    const at = (t: number): [number, number] => {
      let s = t * L;
      for (let i = 0; i < seg.length; i++) { if (s <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, s / seg[i]) : 0; return [head[i][0] + (head[i + 1][0] - head[i][0]) * f, head[i][1] + (head[i + 1][1] - head[i][1]) * f]; } s -= seg[i]; }
      return head[head.length - 1];
    };
    const radial = (q: [number, number]): [number, number] => { const du = q[0] - uc, dv = Math.max(0, q[1] - spring) + 1e-6, l = Math.hypot(du, dv); return [du / l, dv / l]; };
    const part = c.part();
    for (let k = 0; k < count; k += 2) {
      const a = at(k / count), b = at((k + 1) / count), ra = radial(a), rb = radial(b);
      const ring = (q: [number, number], r: [number, number], j: number): [number, number] => [q[0] + r[0] * V.t * j, q[1] + r[1] * V.t * j];
      const pts = [[ring(a, ra, 0), ring(a, ra, 1)], [ring(b, rb, 0), ring(b, rb, 1)]];
      if (!pts.flat().every(q => fitsPanel(c.p, rectPoly(q[0] - 0.01, q[0] + 0.01, q[1] - 0.01, q[1] + 0.01), 0))) continue;
      solid(c, slot, (i, j, kk) => { const q = pts[i][j]; return c.P(q[0], q[1], kk ? V.out : 0) as V3; }, part);
      n++;
    }
    if (vs.jambs) {
      for (const side of [0, 1]) {
        let k = 0;
        for (let v1 = spring; v1 - V.jamb >= h[2] - 0.01; v1 -= V.jamb, k++) {
          if (k % 2) continue;
          const w = k % 4 ? V.t * 0.7 : V.t, a = side === 0 ? h[0] - w : h[1], b = a + w, v0 = v1 - V.jamb + 0.03;
          if (!fitsPanel(c.p, rectPoly(a, b, v0, v1), 0.01)) continue;
          c.box(slot, a, b, v0, v1, 0, V.out, part); n++;
        }
      }
    }
  }
  return n;
}

/** Oriel rectangles drawn: [u0, u1, v0, v1] of the body on the wall. */
type OrielRect = [number, number, number, number];

/**
 * Oriels: per listed bay of the main panel, a stone bay from under the sills of storey `from` to over the heads of
 * storey `to`, `deep` x its width out (0.35..1.1 m), square or canted (the cants run back 0.6 x the projection), on a corbel and under a cap. The
 * openings of those storeys (cut in the wall behind) are repeated on its front face: a frame ring, a mullion when wider
 * than 0.9 m, a transom at three quarters, and glass, all closed solids standing on the face.
 */
function drawOriels(c: PanelCtx, info: { levels: number[]; cells: Cell[] }, holes: Hole[], o: NonNullable<StoneDressings['oriels']>, slots: DressingSlots, top: number): OrielRect[] {
  const p = c.p, O = DRESS.oriel, out: OrielRect[] = [];
  for (const bay of o.bays) {
    const cells = info.cells.filter(x => x.bay === bay && x.floor >= o.from && x.floor <= o.to);
    if (!cells.length) continue;
    const cu0 = Math.min(...cells.map(x => x.u0)), cu1 = Math.max(...cells.map(x => x.u1)), cv0 = Math.min(...cells.map(x => x.v0)), cv1 = Math.max(...cells.map(x => x.v1));
    const own = holes.filter(h => !h[4] && (h[0] + h[1]) / 2 > cu0 && (h[0] + h[1]) / 2 < cu1 && (h[2] + h[3]) / 2 > cv0 && (h[2] + h[3]) / 2 < cv1);
    if (!own.length) continue;
    const u0 = Math.max(cu0 + 0.05, Math.min(...own.map(h => h[0])) - O.margin), u1 = Math.min(cu1 - 0.05, Math.max(...own.map(h => h[1])) + O.margin);
    const v0 = Math.min(...own.map(h => h[2])) - O.margin, v1 = Math.min(top - 0.05, Math.max(...own.map(h => h[3])) + O.cap), W = u1 - u0;
    const D = Math.max(O.minOut, Math.min(O.maxOut, (o.deep ?? O.deep) * W)), inset = o.canted ? Math.min(D * O.cant, W * 0.15) : 0;
    if (W < 0.8 || !fitsPanel(p, rectPoly(u0, u1, v0 - O.corbel, v1))) continue;
    const part = c.part();
    // body: a prism on the plan (u, d) trapezoid, back on the wall
    const plan: [number, number][] = [[u0, 0], [u1, 0], [u1 - inset, D], [u0 + inset, D]];
    prism(c, slots.stone, plan, v0, v1, part);
    // corbel and cap, each overlapping the body by 2 cm (no shared face)
    c.box(slots.stone, u0 + W * 0.15, u1 - W * 0.15, v0 - O.corbel, v0 + 0.02, 0, D * 0.7, part);
    if (top - v1 > 0.2) c.box(slots.stone, u0 - 0.06, u1 + 0.06, v1 - 0.02, v1 + 0.14, 0, D + 0.06, part);
    // the windows on the front face, mapped from the wall openings into the narrower face
    const fu0 = u0 + inset, fu1 = u1 - inset, map = (u: number) => fu0 + O.side + ((u - (u0 + O.margin)) / Math.max(0.1, W - 2 * O.margin)) * (fu1 - fu0 - 2 * O.side);
    for (const h of own) {
      const a = map(h[0]), b = map(h[1]), lo = h[2], hi = h[3], F = O.frame;
      if (b - a < 0.3) continue;
      const at = (u: number, v: number, dd: number): V3 => c.P(u, v, D + dd) as V3;
      const box = (slot: string, x0: number, x1: number, y0: number, y1: number, d0: number, d1: number) => solid(c, slot, (i, j, k) => at(i ? x1 : x0, j ? y1 : y0, k ? d1 : d0), part);
      box(slots.glass, a, b, lo, hi, -0.02, 0.02);
      box(slots.frame, a, b, lo, lo + F, -0.02, 0.05); box(slots.frame, a, b, hi - F, hi, -0.02, 0.05);
      box(slots.frame, a, a + F, lo + F - 0.01, hi - F + 0.01, -0.02, 0.05); box(slots.frame, b - F, b, lo + F - 0.01, hi - F + 0.01, -0.02, 0.05);
      const tv = lo + (hi - lo) * 0.75;
      box(slots.frame, a + F - 0.01, b - F + 0.01, tv - F / 2, tv + F / 2, -0.02, 0.045);
      if (b - a > 0.9) box(slots.frame, (a + b) / 2 - F / 2, (a + b) / 2 + F / 2, lo + F - 0.01, tv - F / 2 + 0.01, -0.02, 0.04);
    }
    out.push([u0, u1, v0, v1]);
  }
  return out;
}

/** A closed prism over a convex plan polygon in (u, d), from v0 to v1: one quad per plan edge and the two caps. */
function prism(c: PanelCtx, slot: string, plan: [number, number][], v0: number, v1: number, part: number) {
  const at = (q: [number, number], v: number): V3 => c.P(q[0], v, q[1]) as V3;
  const cu = plan.reduce((s, q) => s + q[0], 0) / plan.length, cd = plan.reduce((s, q) => s + q[1], 0) / plan.length, ctr = at([cu, cd], (v0 + v1) / 2);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i], b = plan[(i + 1) % plan.length], A0 = at(a, v0), B0 = at(b, v0), B1 = at(b, v1), A1 = at(a, v1);
    const fc = [(A0[0] + B1[0]) / 2 - ctr[0], (A0[1] + B1[1]) / 2 - ctr[1], (A0[2] + B1[2]) / 2 - ctr[2]] as V3;
    c.mesh.quad(slot, A0, B0, B1, A1, part, fc);
  }
  const cap = (v: number, up: number) => { const q = plan.map(x => at(x, v)); c.mesh.quad(slot, q[0], q[1], q[2], q[3], part, [0, up, 0]); };
  cap(v1, 1); cap(v0, -1);
}

/** Exported for tests: the layer the dressings stand on, so a caller can check they clear the z-fight band. */
export const DRESSING_MIN_OUT = Math.min(DRESS.band.out, DRESS.stripe.out, DRESS.lintel.out, DRESS.surround.out, DRESS.quoin.out, DRESS.chain.out, DRESS.voussoir.out);
void SHEET_PITCH;

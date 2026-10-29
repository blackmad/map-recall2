/**
 * Stacked offset blocks (Blend, Haarlemmerweg 518A-776, MVRDV 2023): rooms that step a whole bay (or a run of bays)
 * out of the core wall on one storey and back on the next, so the tower reads as a staggered chequer of blocks with
 * the balconies in the gaps. The photographed pattern repeats nowhere, so the intent writes it storey by storey as
 * one character per bay, viewer's left to right:
 *
 *   `B`  a block: a closed box `deep` (of the storey height) out of the core over the bay's storey, in the wall colour, its own framed
 *        window(s) on the front (`window`, fractions of the bay pitch and the storey height);
 *   `R`  a recessed balcony: a floor slab out to the block line (left out where the bay's storey below is a block,
 *        whose roof is the floor) with a glass balustrade on its front and on any side not closed by a block;
 *   `.`  the plain core wall (the group's own window grid).
 *
 * Intent (per wall group, `stackedBlocks`): {rows: {"<storey>": "BB.R..", ...}, deep?, window?: {w, h, sill}, panes?}
 *   storey 0..storeys-1, each row exactly `baysPerStorey` characters; deep 0.15..0.8 of the panel's typical storey
 *   height (default 0.47: 1.5 m on Blend's 3.23 m storeys, the soffit returns in the 2023 photo), capped 0.6..2.5 m; window.w 0.3..0.95 of the bay, h 0.3..0.85 and sill 0.02..0.5 of the storey (default
 *   0.62 / 0.62 / 0.22); panes 1, 2 (one mullion) or 4 (mullion and transom, default).
 * Runs of `B` side by side on one storey are one box, and boxes of the same span on consecutive storeys merge, so no
 * two blocks meet face to face. Drawn on the group's main panel after the openings; the block's back sits 5 cm
 * behind the wall face, so it never shares the wall's plane. Absent: nothing is drawn and the mesh is byte-identical.
 * `drawStackedBlocks` returns the blocks' plan rectangles (local x, z), which the footprint gate adds to the core
 * (`footprint: "core"`, buildingRecipe/coreFootprint.ts) before it compares the plan with the BAG outline.
 */
import {solid, type PanelCtx} from './compose.ts';
import {fitsPanel, rectPoly} from './panels.ts';
import type {V3} from './mesh.ts';

export interface StackedBlocksIntent {rows: Record<string, string>; deep?: number; window?: {w: number; h: number; sill: number}; panes?: 1 | 2 | 4}
export interface StackedBlocksFit {
  rows: Record<number, string>; deep: number; window: {w: number; h: number; sill: number}; panes: 1 | 2 | 4;
  slots: {wall: string; frame: string; glass: string; rail: string};
}

export const STACKED_BLOCKS = {
  deep: 0.47, minDeepM: 0.6, maxDeepM: 2.5, window: {w: 0.62, h: 0.62, sill: 0.22}, panes: 4 as const,
  /** the block's back face behind the wall face (m) */
  backM: 0.05,
  /** frame border and bar width (m); the frame stands this far off the block front, the glass half as far */
  frameM: 0.08, frameOutM: 0.12, glassOutM: 0.05,
  /** balcony slab and balustrade */
  slabM: 0.24, railM: 1.0, railT: 0.04,
} as const;
const FIELDS = ['rows', 'deep', 'window', 'panes'];
const CELL = /^[BR.]+$/;

export function stackedBlocksProblems(b: unknown, at: string, baysPerStorey: number | undefined, storeys: number | undefined): string[] {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return [`${at}: object {${FIELDS.join(', ')}}`];
  const a = b as Record<string, unknown>, out: string[] = [];
  for (const k of Object.keys(a)) if (!FIELDS.includes(k)) out.push(`${at}.${k}: unknown field (${FIELDS.join(', ')})`);
  const rows = a.rows;
  if (!rows || typeof rows !== 'object' || Array.isArray(rows) || !Object.keys(rows).length) out.push(`${at}.rows: {"<storey>": "B.R..."} with at least one storey`);
  else for (const [k, v] of Object.entries(rows as Record<string, unknown>)) {
    const s = Number(k);
    if (!Number.isInteger(s) || s < 0 || (storeys !== undefined && s > storeys - 1)) out.push(`${at}.rows.${k}: a storey 0..${storeys !== undefined ? storeys - 1 : 'storeys-1'}`);
    if (typeof v !== 'string' || !CELL.test(v)) out.push(`${at}.rows.${k}: one of B (block), R (recessed balcony) or . (core) per bay`);
    else if (baysPerStorey !== undefined && v.length !== baysPerStorey) out.push(`${at}.rows.${k}: ${v.length} cells for ${baysPerStorey} bays`);
  }
  if (a.deep !== undefined && (typeof a.deep !== 'number' || !(a.deep >= 0.15 && a.deep <= 0.8))) out.push(`${at}.deep: a fraction 0.15..0.8 of the storey height`);
  if (a.window !== undefined) {
    const w = a.window as Record<string, unknown>;
    if (!w || typeof w !== 'object' || Array.isArray(w)) out.push(`${at}.window: {w, h, sill}`);
    else {
      for (const k of Object.keys(w)) if (!['w', 'h', 'sill'].includes(k)) out.push(`${at}.window.${k}: unknown field (w, h, sill)`);
      const frac = (k: string, lo: number, hi: number) => { const v = w[k]; if (typeof v !== 'number' || !(v >= lo && v <= hi)) out.push(`${at}.window.${k}: a fraction ${lo}..${hi}`); };
      frac('w', 0.3, 0.95); frac('h', 0.3, 0.85); frac('sill', 0.02, 0.5);
      if (typeof w.h === 'number' && typeof w.sill === 'number' && w.h + w.sill > 0.92) out.push(`${at}.window: h + sill <= 0.92 of the storey`);
    }
  }
  if (a.panes !== undefined && ![1, 2, 4].includes(a.panes as number)) out.push(`${at}.panes: 1, 2 or 4`);
  return out;
}

export function fitStackedBlocks(b: StackedBlocksIntent, slots: StackedBlocksFit['slots']): StackedBlocksFit {
  const rows: Record<number, string> = {};
  for (const k of Object.keys(b.rows).map(Number).sort((x, y) => x - y)) rows[k] = b.rows[String(k)];
  return {rows, deep: b.deep ?? STACKED_BLOCKS.deep, window: b.window ?? {...STACKED_BLOCKS.window}, panes: b.panes ?? STACKED_BLOCKS.panes, slots};
}

const cellAt = (f: StackedBlocksFit, storey: number, bay: number) => f.rows[storey]?.[bay] ?? '.';

/** Runs of one cell kind on one storey: [first bay, last bay + 1]. */
export function cellRuns(row: string, kind: 'B' | 'R'): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < row.length; i++) if (row[i] === kind) { let j = i; while (j < row.length && row[j] === kind) j++; out.push([i, j]); i = j - 1; }
  return out;
}

/** The blocks as boxes: bay span [b0, b1) over storeys [s0, s1), merged across storeys where the span repeats. */
export function blockBoxes(f: StackedBlocksFit): {b0: number; b1: number; s0: number; s1: number}[] {
  const open: {b0: number; b1: number; s0: number; s1: number}[] = [], done: typeof open = [];
  const storeys = Object.keys(f.rows).map(Number).sort((x, y) => x - y);
  for (const s of storeys) {
    const runs = cellRuns(f.rows[s], 'B');
    for (const box of open.splice(0)) {
      const k = runs.findIndex(r => r[0] === box.b0 && r[1] === box.b1 && box.s1 === s);
      if (k >= 0) { box.s1 = s + 1; runs.splice(k, 1); open.push(box); } else done.push(box);
    }
    for (const [b0, b1] of runs) open.push({b0, b1, s0: s, s1: s + 1});
  }
  return [...done, ...open].sort((x, y) => x.s0 - y.s0 || x.b0 - y.b0);
}

/** Storey band [lo, hi] of storey s from the panel's storey lines (the top storey runs to `topM`), or null. */
function band(levels: number[], s: number, topM: number): [number, number] | null {
  const lo = levels[s], hi = Math.min(topM, levels[s + 1] ?? topM);
  return lo === undefined || !(hi - lo > 1.5) ? null : [lo, hi];
}

/** The blocks' projection (m): `deep` of the median storey height of the panel's storey lines, within 0.6..2.5 m. */
export function blockDepthM(levels: number[], deep: number): number {
  const h = levels.slice(1).map((v, i) => v - levels[i]).filter(x => x > 1.5).sort((a, b) => a - b);
  const H = h.length ? h[Math.floor(h.length / 2)] : 3;
  return Math.min(STACKED_BLOCKS.maxDeepM, Math.max(STACKED_BLOCKS.minDeepM, deep * H));
}

/** Draw the blocks and recessed balconies of one group on its main panel; returns the counts drawn. */
export function drawStackedBlocks(c: PanelCtx, levels: number[], f: StackedBlocksFit, bays: number, topM: number): {blocks: number; balconies: number; windows: number; plans: [number, number][][]} {
  const p = c.p, W = (p.uMax - p.uMin) / bays, K = STACKED_BLOCKS, D = blockDepthM(levels, f.deep);
  const U = (b: number) => p.uMin + b * W;
  const out = {blocks: 0, balconies: 0, windows: 0, plans: [] as [number, number][][]};
  const box = (slot: string, part: number, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) =>
    solid(c, slot, (i, j, k) => c.P(i ? u1 : u0, j ? v1 : v0, k ? d1 : d0) as V3, part);
  const plan = (u0: number, u1: number): [number, number][] => [[u0, 0], [u1, 0], [u1, D], [u0, D]].map(([u, d]) => { const q = c.P(u, 0, d); return [q[0], q[2]] as [number, number]; });
  for (const b of blockBoxes(f)) {
    const lo = band(levels, b.s0, topM), hi = band(levels, b.s1 - 1, topM);
    if (!lo || !hi) continue;
    const u0 = U(b.b0), u1 = U(b.b1), v0 = lo[0], v1 = hi[1];
    if (!fitsPanel(p, rectPoly(u0, u1, v0, v1))) continue;
    const part = c.part();
    box(f.slots.wall, part, u0, u1, v0, v1, -K.backM, D);
    out.blocks++;
    out.plans.push(plan(u0, u1));
    // the windows on the block's front, one per bay and storey
    for (let s = b.s0; s < b.s1; s++) {
      const st = band(levels, s, topM);
      if (!st) continue;
      const H = st[1] - st[0];
      for (let bay = b.b0; bay < b.b1; bay++) {
        const uc = U(bay) + W / 2, hw = f.window.w * W / 2, w0 = uc - hw, w1 = uc + hw, y0 = st[0] + f.window.sill * H, y1 = y0 + f.window.h * H, t = K.frameM;
        if (!(w1 - w0 > 2 * t + 0.2) || !(y1 - y0 > 2 * t + 0.2)) continue;
        const wp = c.part();
        box(f.slots.glass, wp, w0 + t, w1 - t, y0 + t, y1 - t, D - 0.02, D + K.glassOutM);
        const bars: [number, number, number, number][] = [[w0, w1, y0, y0 + t], [w0, w1, y1 - t, y1], [w0, w0 + t, y0 + t, y1 - t], [w1 - t, w1, y0 + t, y1 - t]];
        const um = (w0 + w1) / 2, vm = y0 + (y1 - y0) * 0.62;
        if (f.panes >= 2) bars.push([um - t / 2, um + t / 2, y0 + t, y1 - t]);
        if (f.panes === 4) bars.push([w0 + t, um - t / 2, vm - t / 2, vm + t / 2], [um + t / 2, w1 - t, vm - t / 2, vm + t / 2]);
        for (const [a0, a1, b0, b1] of bars) box(f.slots.frame, wp, a0, a1, b0, b1, D - 0.02, D + K.frameOutM);
        out.windows++;
      }
    }
  }
  // recessed balconies: a slab where the storey below is not a block, the balustrade on the block line and open sides
  for (const s of Object.keys(f.rows).map(Number).sort((x, y) => x - y)) {
    const st = band(levels, s, topM);
    if (!st) continue;
    for (const [b0, b1] of cellRuns(f.rows[s], 'R')) {
      const u0 = U(b0), u1 = U(b1), floor = st[0], top = floor + K.railM;
      if (top > st[1] || !fitsPanel(p, rectPoly(u0, u1, Math.max(p.vMin, floor - K.slabM), top))) continue;
      const part = c.part();
      // slab pieces under the bays whose storey below is not a block (the block's roof is the floor there)
      for (const [a0, a1] of cellRunsWhere(b0, b1, bay => s > 0 && cellAt(f, s - 1, bay) !== 'B')) box(f.slots.wall, part, U(a0), U(a1), floor - K.slabM, floor, -K.backM, D);
      box(f.slots.rail, part, u0, u1, floor, top, D - K.railT, D);
      if (cellAt(f, s, b0 - 1) !== 'B' && b0 > 0) box(f.slots.rail, part, u0, u0 + K.railT, floor, top, -K.backM, D - K.railT);
      if (cellAt(f, s, b1) !== 'B' && b1 < bays) box(f.slots.rail, part, u1 - K.railT, u1, floor, top, -K.backM, D - K.railT);
      out.balconies++;
    }
  }
  return out;
}

function cellRunsWhere(b0: number, b1: number, ok: (bay: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let i = b0; i < b1; i++) if (ok(i)) { let j = i; while (j < b1 && ok(j)) j++; out.push([i, j]); i = j - 1; }
  return out;
}

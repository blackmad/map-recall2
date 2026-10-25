/**
 * Facade cladding for `kind: large` wall groups (intent `walls[].cladding`, GitHub #49): the walls that are not brick
 * with punched windows. Factory halls in ribbed or horizontal profiled metal (pand-083151, pand-083604), office fronts
 * in flat cassette panels round ribbon windows (pand-083151 walls[4,5,7], pand-138900), louvre screens, dark metal
 * fascias over a brick ground (OBA Molenwijk) and brick painted over.
 *
 * Two steps, both no-ops for a group without cladding:
 * - `applyCladdingSlots` (after compose): the group's wall triangles (its own wall slot) between `fromM` and `toM`
 *   move to the cladding slot, clipped at both heights, so the sheet colour change is a straight horizontal line
 *   (a concrete or brick plinth under a metal hall stays the wall colour). `paint` stops here: the brick texture keeps
 *   its joints in the paint colour.
 * - `drawCladdingLines` (panel hook, after the openings are cut): the profile as geometry on the sheet, in the line
 *   slot, broken round every opening and kept inside the panel outline:
 *   `ribs` vertical trapezoidal ribs, `boards` horizontal profile lines, `louvres` deep horizontal slats in the sheet
 *   colour over a dark ground (the line colour), `panels` the joints of a cassette grid.
 * Each line is a closed box standing on the wall, at least 3.5 cm proud so its face clears the coplanar audit's
 * under-3 cm band.
 */
import { type PanelCtx, intervals } from './compose.ts';
import { fitsPanel, rectPoly, type Panel } from './panels.ts';
import type { MeshBuilder } from './mesh.ts';

export const CLADDING_KINDS = ['ribs', 'boards', 'louvres', 'panels', 'paint'] as const;
export type CladdingKind = typeof CLADDING_KINDS[number];

/**
 * Per kind: default line pitch (m), allowed pitch range (m), line width (m) and projection (m). Ribs are drawn at the
 * visual pitch of a trapezoidal sheet seen from the street (real profiles run 0.2-0.33 m; one box per 0.5 m keeps a
 * 100 m hall inside the 12k budget); boards and louvres as measured on pand-083151's crops; panel joints at the
 * cassette width.
 */
export const CLADDING: Readonly<Record<Exclude<CladdingKind, 'paint'>, { pitch: number; min: number; max: number; w: number; out: number }>> = {
  ribs: { pitch: 0.5, min: 0.25, max: 2, w: 0.09, out: 0.04 },
  boards: { pitch: 0.4, min: 0.15, max: 1.5, w: 0.05, out: 0.035 },
  louvres: { pitch: 0.35, min: 0.2, max: 1, w: 0.12, out: 0.12 },
  panels: { pitch: 1.2, min: 0.6, max: 6, w: 0.05, out: 0.035 },
};
/** Default height of a cassette panel row (m): horizontal joints every `rowPitch`. */
export const PANEL_ROW_M = 1.0;

export interface CladdingFit {
  kind: CladdingKind;
  /** heights above ground (m) the cladding covers on every panel of the group */
  fromM: number; toM: number;
  pitchM: number; rowPitchM: number;
  /** sheet slot (the moved wall triangles) and line slot */
  slot: string; lineSlot: string;
  /**
   * With a two-colour wall (intent `wallSplit`): which side is clad. `left`: the group's own wall (lines on the split
   * panel only left of `uM`); `right`: the split wall (its slot `source`; lines on the split panel right of `uM` only).
   */
  side?: { panel: number; uM: number; right: boolean; source?: string };
}

/** Vertical runs [v0, v1] of a line `a`..`b` wide between `lo` and `hi`: inside the panel and clear of every cut opening. */
function verticalRuns(c: PanelCtx, a: number, b: number, lo: number, hi: number, step = 0.5): [number, number][] {
  let runs: [number, number][] = [[lo, hi]];
  for (const h of [...c.holes.values()].flat()) {
    if (!(h[0] - 0.03 < b && h[1] + 0.03 > a)) continue;
    const s0 = h[2] - 0.03, s1 = h[3] + 0.03;
    runs = runs.flatMap(([x, y]) => (s1 <= x || s0 >= y ? [[x, y]] : [[x, s0], [s1, y]]) as [number, number][]);
  }
  // inside the panel outline (a gable, a stepped top): walk each run in steps, keep the stretches that fit
  const out: [number, number][] = [];
  for (const [x, y] of runs) {
    let start: number | null = null;
    for (let v = x; v < y - 1e-3; v += step) {
      const top = Math.min(y, v + step), ok = fitsPanel(c.p, rectPoly(a, b, v, top), 0.0);
      if (ok && start === null) start = v;
      if (!ok && start !== null) { out.push([start, v]); start = null; }
    }
    if (start !== null) out.push([start, y]);
  }
  return out.filter(([x, y]) => y - x > 0.2);
}

/** Horizontal runs [u0, u1] of a line between heights v0 and v1: inside the panel and clear of every cut opening. */
function horizontalRuns(c: PanelCtx, v0: number, v1: number): [number, number][] {
  const holes = [...c.holes.values()].flat().filter(h => h[3] + 0.03 > v0 && h[2] - 0.03 < v1).map(h => [h[0] - 0.03, h[1] + 0.03] as [number, number]);
  let runs = intervals(c.p, v0, v1, 0.25);
  for (const [s0, s1] of holes) runs = runs.flatMap(([a, b]) => (s1 <= a || s0 >= b ? [[a, b]] : [[a, s0], [s1, b]]) as [number, number][]);
  return runs.filter(([a, b]) => b - a > 0.2);
}

/** The cladding profile on one panel of the group; returns the number of line boxes drawn. */
export function drawCladdingLines(c: PanelCtx, f: CladdingFit): number {
  if (f.kind === 'paint') return 0;
  const p = c.p, D = CLADDING[f.kind], lo = Math.max(f.fromM, p.vMin, 0), hi = Math.min(f.toM, p.vMax);
  if (hi - lo < 0.4) return 0;
  // a clad side of a split wall: only its own stretch of the split panel (the right side has no other panel)
  const s = f.side, onSplit = s?.panel === p.index;
  if (s?.right && !onSplit) return 0;
  const uA = onSplit && s!.right ? s!.uM : p.uMin, uB = onSplit && !s!.right ? s!.uM : p.uMax;
  const part = c.part();
  let n = 0;
  const box = (a: number, b: number, v0: number, v1: number) => { c.box(f.lineSlot, a, b, v0, v1, 0, D.out, part); n++; };
  const verticals = (pitch: number) => {
    const W = uB - uA, k = Math.max(1, Math.round(W / pitch));
    for (let i = 1; i < k; i++) { const u = uA + (W * i) / k; for (const [v0, v1] of verticalRuns(c, u - D.w / 2, u + D.w / 2, lo, hi)) box(u - D.w / 2, u + D.w / 2, v0, v1); }
  };
  const horizontals = (pitch: number, first: number) => {
    for (let v = first; v < hi - D.w / 2 - 0.02; v += pitch) for (const [a0, b0] of horizontalRuns(c, v - D.w / 2, v + D.w / 2)) { const a = Math.max(a0, uA), b = Math.min(b0, uB); if (b - a > 0.2) box(a, b, v - D.w / 2, v + D.w / 2); }
  };
  switch (f.kind) {
    case 'ribs': verticals(f.pitchM); break;
    case 'boards': horizontals(f.pitchM, lo + f.pitchM); break;
    case 'louvres': horizontals(f.pitchM, lo + f.pitchM / 2); break;
    case 'panels': verticals(f.pitchM); horizontals(f.rowPitchM, lo + f.rowPitchM); break;
  }
  return n;
}

/**
 * Move each cladding group's wall triangles between its heights into the sheet slot (louvres: the line slot, the dark
 * ground behind the slats), clipping triangles that cross `fromM` or `toM`. Returns the triangles moved or clipped.
 */
export function applyCladdingSlots(mesh: MeshBuilder, groups: readonly { slots: { wall: string }; cladding?: CladdingFit }[]): number {
  let moved = 0;
  for (const g of groups) {
    const f = g.cladding, from = f?.side?.right && f.side.source ? f.side.source : g.slots.wall, src = f && mesh.slots.get(from);
    if (!f || !src) continue;
    const dstSlot = f.kind === 'louvres' ? f.lineSlot : f.slot;
    const keep = { positions: [] as number[], parts: [] as number[] }, out = mesh.slots.get(dstSlot) ?? { positions: [], parts: [] };
    const emit = (dst: typeof keep, poly: number[][], part: number) => { for (let i = 1; i + 1 < poly.length; i++) { dst.positions.push(...poly[0], ...poly[i], ...poly[i + 1]); dst.parts.push(part); } };
    /** split a polygon at height y into [below, above] */
    const cut = (poly: number[][], y: number): [number[][], number[][]] => {
      const below: number[][] = [], above: number[][] = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        (a[1] <= y ? below : above).push(a);
        if ((a[1] - y) * (b[1] - y) < 0) { const k = (y - a[1]) / (b[1] - a[1]), x = [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * k); below.push(x); above.push(x); }
      }
      return [below, above];
    };
    for (let t = 0; t < src.parts.length; t++) {
      const v = [0, 1, 2].map(i => src.positions.slice(t * 9 + i * 3, t * 9 + i * 3 + 3)), part = src.parts[t], ys = v.map(q => q[1]);
      if (Math.max(...ys) <= f.fromM + 1e-4 || Math.min(...ys) >= f.toM - 1e-4) { emit(keep, v, part); continue; }
      moved++;
      const [under, rest] = Math.min(...ys) < f.fromM - 1e-4 ? cut(v, f.fromM) : [[], v];
      const [mid, over] = Math.max(...rest.map(q => q[1])) > f.toM + 1e-4 ? cut(rest, f.toM) : [rest, []];
      if (under.length >= 3) emit(keep, under, part);
      if (over.length >= 3) emit(keep, over, part);
      if (mid.length >= 3) emit(out, mid, part);
    }
    mesh.slots.set(from, keep);
    if (out.parts.length) mesh.slots.set(dstSlot, out);
  }
  return moved;
}

/** `toM` of a cladding that runs to the top of every panel (gables and towers above the eaves included). */
export const CLADDING_TOP_M = 9999;
/** Heights a cladding covers on a group whose eaves are `eavesM`: fractions `from`..`to` of the eaves. */
export function claddingHeights(eavesM: number, from = 0, to = 1): { fromM: number; toM: number } {
  return { fromM: +(from * eavesM).toFixed(3), toM: to >= 1 ? CLADDING_TOP_M : +(to * eavesM).toFixed(3) };
}

export type { Panel };

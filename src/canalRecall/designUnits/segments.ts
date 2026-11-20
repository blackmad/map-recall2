/**
 * Design-unit segments (phase 1, Ring layer; docs/handoffs/design-units-plan-20261119.md, phase 0 report "option A").
 *
 * unit → segments → members. A segment is the thing with ONE elevation, ONE eaves line and ONE roof. In the Ring layer a
 * unit is one segment by default; it splits only at a real break, measured on the AHN front-edge line (beltLook/ahnFront.ts
 * p90 over the member's street front), never on 3DBAG per-pand eaves (they split identical houses all week: Van
 * Ostadestraat 153176/158962 read 18.2/15.4 m in 3DBAG and 16.8/17.4 m on AHN).
 *
 *   - A real break: adjacent members whose AHN lines differ by SPLIT_STEP_M or more (about a storey), with the step
 *     holding on both sides (each side's members agree with each other within AGREE_M), and not a lone member.
 *   - A lone member stepping out of its segment (a roof extension, common in De Pijp) is an exception on that member,
 *     clamped to the segment line as blockFace/rowCoherence.ts does; it never makes a segment of its own.
 *   - A member a storey or more off the line (|AHN − line| >= SPLIT_STEP_M: a low shop wing, a rear annex with a street
 *     edge, a corner tower) is not clamped: it leaves the segment as a one-pand segment and draws as today
 *     (2026-11-19 ring run: about 230 of 13,894 members, up to 16 m below the line).
 *   - The segment's line is the median AHN p90 of its members (exceptions excluded); with fewer than two AHN reads, the
 *     median 3DBAG eaves (source `3dbag`).
 *   - Seeds: a one-pand segment keeps its pand id (byte-identical to today); otherwise `<unit id>#<k>`.
 *
 * The browser reads the compact extract (`SegmentsExtract`) only under `?designUnits=1`. Pure: no fs, no DOM.
 */
import type { DesignUnit } from './types.ts';

/** A step between adjacent members' AHN lines this large (m) is a candidate break (about a storey). */
export const SPLIT_STEP_M = 2.5;
/** Members on one side of a break agree within this (m); a lone member outside it is an exception. */
export const AGREE_M = 0.8;
/** A member more than this (m) off its segment line is an exception, clamped to the line (rowCoherence thresholdM). */
export const EXCEPTION_M = 0.8;

/** The split rule's thresholds (m). The Ring defaults are the constants above; a layer dry run may pass its own. */
export interface SplitRule { stepM: number; agreeM: number; leaveM: number }
export const RING_RULE: SplitRule = { stepM: SPLIT_STEP_M, agreeM: AGREE_M, leaveM: SPLIT_STEP_M };
/**
 * Gordel (1920-40) dry-run rule (option A, 2026-11-19): composed blocks step by part of a storey at their accents, so a
 * break is 1.5 m and a member 1.5 m off its run leaves it (a corner accent draws as its own segment, never clamped).
 */
export const GORDEL_RULE: SplitRule = { stepM: 1.5, agreeM: AGREE_M, leaveM: 1.5 };

export interface MemberHeights {
  /** AHN front band p90 over the member's front (m above ground); null unread. */
  ahnM: number | null;
  /** 3DBAG eaves (m). */
  bagEavesM: number | null;
}

export interface SegmentSlice { pandId: string; street: string; fromM: number; toM: number }

export interface Segment {
  id: string;
  seed: string;
  unit: string;
  /** Members in street order along the unit's main face (then any member on other faces, then unfronted, by id). */
  members: string[];
  eavesM: number | null;
  eavesSource: 'ahn' | '3dbag' | 'none';
  /** Metres along each face, measured from the segment's own left end on that face. */
  slices: SegmentSlice[];
  /** Members drawn at the segment line although they read otherwise. */
  exceptions: Array<{ pandId: string; readM: number; why: string }>;
  /** Median BAG construction year of the members (the style year the renderer draws them all with); set by build-segments. */
  year?: number | null;
  /** Members' footprint centroid [lng, lat] (one measured-wall pool draw per segment); set by build-segments. */
  at?: [number, number];
  /** AHN roof mass behind the front over the eaves line (m, median member); null unread. Set by build-segments. */
  roofRiseM?: number | null;
  /** Round 2 (#399, 2026-11-20): each member's own AHN front p90 (m). The renderer draws the plot's cornice there, clamped
   *  to PLOT_EAVES_M of the segment line. Set by build-segments. */
  plotEavesM?: Record<string, number>;
  /** Members photo evidence says are one facade (a face intent `identical`/`sameAs`, a same-building "one" read): each
   *  group draws one continuous front, with no party-wall break inside it. Every other member is its own house. */
  plotGroups?: string[][];
  /** A roof storey seen in photos where AHN cannot see it (2026-11-20: the Ring's front mansards and hoist dormers stand
   *  inside the DSM's flat top, so AHN reads them as no rise). `storey`: the top storey is a slate roof storey inside the
   *  measured top, one dormer per plot. Source: a photo-row review (staging/roof-evidence.json) or the members' D1 reads. */
  roofEvidence?: { storey: boolean; dormer?: 'pediment' | 'gabled' | 'plain'; hoist?: boolean; source: string };
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Street order of a unit's members: main face slices first, other faces after, unfronted last. */
export function memberOrder(u: DesignUnit): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const f of u.faces) for (const s of f.slices) if (!seen.has(s.pandId)) { seen.add(s.pandId); out.push(s.pandId); }
  for (const m of [...u.unfronted, ...u.members].sort()) if (!seen.has(m)) { seen.add(m); out.push(m); }
  return out;
}

/** Break the main-face order into runs at real AHN steps. Returns runs of member ids. */
export function splitRuns(order: readonly string[], h: ReadonlyMap<string, MemberHeights>, rule: SplitRule = RING_RULE): string[][] {
  const ahn = (p: string) => h.get(p)?.ahnM ?? null;
  const cuts: number[] = [];
  for (let i = 1; i < order.length; i++) {
    const a = ahn(order[i - 1]), b = ahn(order[i]);
    if (a === null || b === null || Math.abs(a - b) < rule.stepM) continue;
    // The step must hold on both sides: the next member on each side (when there is one) agrees with its neighbour.
    const left = order[i - 2] !== undefined ? ahn(order[i - 2]) : null, right = order[i + 1] !== undefined ? ahn(order[i + 1]) : null;
    const leftHolds = left === null ? i - 1 === 0 : Math.abs(left - a) < rule.agreeM;
    const rightHolds = right === null ? i === order.length - 1 : Math.abs(right - b) < rule.agreeM;
    // A lone member (one side of the step is a single member between two steps, or at an end) is an exception, not a run.
    const loneLeft = i - 1 === 0 || (left !== null && Math.abs(left - a) >= rule.stepM);
    const loneRight = i === order.length - 1 || (right !== null && Math.abs(right - b) >= rule.stepM);
    if (leftHolds && rightHolds && !loneLeft && !loneRight) cuts.push(i);
  }
  const runs: string[][] = [];
  let k0 = 0;
  for (const c of [...cuts, order.length]) { runs.push(order.slice(k0, c)); k0 = c; }
  return runs.filter(r => r.length);
}

/** The segments of one unit. */
export function segmentsOf(u: DesignUnit, h: ReadonlyMap<string, MemberHeights>, rule: SplitRule = RING_RULE): Segment[] {
  const order = memberOrder(u);
  const split = u.members.length > 1 ? splitRuns(order, h, rule) : [order];
  // Members a storey or more off their run's AHN median leave it (drawn alone, as today).
  const runs: string[][] = [];
  for (const run of split) {
    const v = run.map(p => h.get(p)?.ahnM).filter((x): x is number => typeof x === 'number');
    const m = run.length > 2 && v.length >= 2 ? median(v)! : null;
    const off = m === null ? [] : run.filter(p => { const a = h.get(p)?.ahnM; return typeof a === 'number' && Math.abs(a - m) >= rule.leaveM; });
    const keep = run.filter(p => !off.includes(p));
    if (keep.length) runs.push(keep);
    for (const p of off) runs.push([p]);
  }
  return runs.map((members, k) => {
    const ahn = members.map(p => h.get(p)?.ahnM).filter((v): v is number => typeof v === 'number');
    let eavesM: number | null = null, eavesSource: Segment['eavesSource'] = 'none';
    const exceptions: Segment['exceptions'] = [];
    if (ahn.length >= 2 || (ahn.length === 1 && members.length === 1)) {
      // Median, then drop members off it by more than EXCEPTION_M and take the median again.
      const m0 = median(ahn)!;
      const core = ahn.filter(v => Math.abs(v - m0) <= EXCEPTION_M);
      eavesM = r2(median(core.length ? core : ahn)!); eavesSource = 'ahn';
      for (const p of members) {
        const v = h.get(p)?.ahnM;
        if (typeof v === 'number' && Math.abs(v - eavesM) > EXCEPTION_M) exceptions.push({ pandId: p, readM: v, why: `AHN front ${v} m against the segment line ${eavesM} m: one member out of line, clamped (rowCoherence)` });
      }
    } else {
      const bag = members.map(p => h.get(p)?.bagEavesM).filter((v): v is number => typeof v === 'number');
      const m = median(bag);
      if (m !== null) { eavesM = r2(m); eavesSource = '3dbag'; }
    }
    const set = new Set(members);
    const slices: SegmentSlice[] = [];
    for (const f of u.faces) {
      const mine = f.slices.filter(s => set.has(s.pandId));
      if (!mine.length) continue;
      const o = Math.min(...mine.map(s => s.fromM));
      for (const s of mine) slices.push({ pandId: s.pandId, street: f.street, fromM: r2(s.fromM - o), toM: r2(s.toM - o) });
    }
    const single = members.length === 1;
    const id = runs.length === 1 && !single ? u.id : single ? members[0] : `${u.id}#${k}`;
    return { id, seed: single ? members[0] : id, unit: u.id, members, eavesM, eavesSource, slices, exceptions };
  });
}

// --- the browser extract -----------------------------------------------------------------------------------------

export const SEGMENTS_SCHEMA = 'design-units-segments-v1' as const;
/** What the renderer reads under `?designUnits=1`: Ring-layer multi-pand segments only (singles draw as today). */
export interface SegmentsExtract {
  schema: typeof SEGMENTS_SCHEMA;
  layers: string[];
  generatedAt: string;
  source: string;
  segments: Segment[];
}

/** Pand id (16 digits) → its segment and slice, for the renderer's decoration pass. */
export function segmentLookup(x: SegmentsExtract): Map<string, { segment: Segment; slices: SegmentSlice[]; exception?: Segment['exceptions'][number] }> {
  const out = new Map<string, { segment: Segment; slices: SegmentSlice[]; exception?: Segment['exceptions'][number] }>();
  for (const s of x.segments) for (const p of s.members) {
    const exception = s.exceptions.find(e => e.pandId === p);
    out.set(p, { segment: s, slices: s.slices.filter(sl => sl.pandId === p), ...(exception ? { exception } : {}) });
  }
  return out;
}

/**
 * Compare two roof-facts sidecar trees (published vs staged): rows, roofs gaining or losing a stored fact by
 * confidence, slot changes, colour/confidence/furniture/dormer drift on shared rows, and, given the pand inputs
 * of both builds, why a roof gained or lost a fact (pand added/removed, outline or roof type changed, or nothing
 * in the input changed: classifier or imagery drift). Pure; `compare-roof-facts.mts` is the CLI.
 */
import type { RoofFact } from '../../src/canalRecall/roofs/roofSlots.ts';

/** What a build saw of one pand: its z14 tile, roof type and an outline signature. */
export type PandInput = { tile: string; roof: number; outline: string };
export type Hist = Record<string, number>;
export type DriftCause = 'pand-added' | 'pand-removed' | 'outline-changed' | 'roof-type-changed' | 'tile-moved' | 'input-unchanged' | 'unknown';

export type RoofFactsCompare = {
  publishedRows: number;
  stagedRows: number;
  sharedRows: number;
  roofsGainingFact: number;
  roofsLosingFact: number;
  gainedByConfidence: Hist;
  lostByConfidence: Hist;
  gainedBySlot: Hist;
  lostBySlot: Hist;
  /** Gained/lost at or above `driftFloor`: the threshold change alone cannot explain these. */
  gainedAboveFloor: number;
  lostAboveFloor: number;
  gainedAboveFloorCause: Partial<Record<DriftCause, number>>;
  lostAboveFloorCause: Partial<Record<DriftCause, number>>;
  slotChanged: number;
  topSlotChanges: Array<[string, number]>;
  meanAbsRgbDelta5bit: number;
  confidenceChanged: number;
  furnitureChanged: number;
  dormerFlagChanged: number;
  publishedSlots: Hist;
  stagedSlots: Hist;
  publishedDormers: number;
  stagedDormers: number;
  publishedWithFurniture: number;
  stagedWithFurniture: number;
  publishedFurniture: Hist;
  stagedFurniture: Hist;
  /** Staged rows below `furnitureFloor` and how many of them carry furniture. */
  stagedBelowFurnitureFloor: number;
  stagedBelowFurnitureFloorWithFurniture: number;
};

const bump = (h: Hist, k: string, n = 1) => { h[k] = (h[k] ?? 0) + n; };
export const confBin = (c: number) => (Math.round(c * 10) / 10).toFixed(2);
const sortHist = (h: Hist) => Object.fromEntries(Object.entries(h).sort(([a], [b]) => a.localeCompare(b)));
const furnitureKey = (f: RoofFact) => f.furniture.map(i => `${i.kind}:${i.e}:${i.n}:${i.w}:${i.l}:${i.yawDeg}`).join('|');

/** Why one roof's stored fact appeared or disappeared, from the two builds' inputs. */
export function driftCause(id: string, before: ReadonlyMap<string, PandInput> | undefined, after: ReadonlyMap<string, PandInput> | undefined): DriftCause {
  if (!before || !after) return 'unknown';
  const a = before.get(id), b = after.get(id);
  if (!a && b) return 'pand-added';
  if (a && !b) return 'pand-removed';
  if (!a || !b) return 'unknown';
  if (a.outline !== b.outline) return 'outline-changed';
  if (a.roof !== b.roof) return 'roof-type-changed';
  if (a.tile !== b.tile) return 'tile-moved';
  return 'input-unchanged';
}

export function compareRoofFacts(
  published: ReadonlyMap<string, RoofFact>,
  staged: ReadonlyMap<string, RoofFact>,
  opts: { driftFloor?: number; furnitureFloor?: number; inputsBefore?: ReadonlyMap<string, PandInput>; inputsAfter?: ReadonlyMap<string, PandInput> } = {},
): RoofFactsCompare & { gainedAboveFloorIds: Map<DriftCause, string[]>; lostAboveFloorIds: Map<DriftCause, string[]> } {
  const driftFloor = opts.driftFloor ?? 0.4, furnitureFloor = opts.furnitureFloor ?? 0.35;
  const out: RoofFactsCompare = {
    publishedRows: published.size, stagedRows: staged.size, sharedRows: 0, roofsGainingFact: 0, roofsLosingFact: 0,
    gainedByConfidence: {}, lostByConfidence: {}, gainedBySlot: {}, lostBySlot: {}, gainedAboveFloor: 0, lostAboveFloor: 0,
    gainedAboveFloorCause: {}, lostAboveFloorCause: {}, slotChanged: 0, topSlotChanges: [], meanAbsRgbDelta5bit: 0,
    confidenceChanged: 0, furnitureChanged: 0, dormerFlagChanged: 0, publishedSlots: {}, stagedSlots: {},
    publishedDormers: 0, stagedDormers: 0, publishedWithFurniture: 0, stagedWithFurniture: 0, publishedFurniture: {}, stagedFurniture: {},
    stagedBelowFurnitureFloor: 0, stagedBelowFurnitureFloorWithFurniture: 0,
  };
  const gainedIds = new Map<DriftCause, string[]>(), lostIds = new Map<DriftCause, string[]>();
  const slotChanges: Hist = {};
  let rgbSum = 0;
  const tally = (f: RoofFact, slots: Hist, furniture: Hist) => {
    bump(slots, f.slot);
    for (const it of f.furniture) bump(furniture, it.kind);
  };
  for (const [id, p] of published) {
    tally(p, out.publishedSlots, out.publishedFurniture);
    if (p.dormer) out.publishedDormers++;
    if (p.furniture.length) out.publishedWithFurniture++;
    const s = staged.get(id);
    if (!s) {
      out.roofsLosingFact++;
      bump(out.lostByConfidence, confBin(p.confidence));
      bump(out.lostBySlot, p.slot);
      if (p.confidence >= driftFloor - 1e-9) {
        out.lostAboveFloor++;
        const c = driftCause(id, opts.inputsBefore, opts.inputsAfter);
        bump(out.lostAboveFloorCause as Hist, c);
        (lostIds.get(c) ?? lostIds.set(c, []).get(c)!).push(id);
      }
      continue;
    }
    out.sharedRows++;
    if (p.slot !== s.slot) { out.slotChanged++; bump(slotChanges, `${p.slot}->${s.slot}`); }
    rgbSum += (Math.abs(p.rgb[0] - s.rgb[0]) + Math.abs(p.rgb[1] - s.rgb[1]) + Math.abs(p.rgb[2] - s.rgb[2])) / 3 / (255 / 31);
    if (Math.abs(p.confidence - s.confidence) > 1e-9) out.confidenceChanged++;
    if (furnitureKey(p) !== furnitureKey(s)) out.furnitureChanged++;
    if (Boolean(p.dormer) !== Boolean(s.dormer)) out.dormerFlagChanged++;
  }
  for (const [id, s] of staged) {
    tally(s, out.stagedSlots, out.stagedFurniture);
    if (s.dormer) out.stagedDormers++;
    if (s.furniture.length) out.stagedWithFurniture++;
    if (s.confidence < furnitureFloor - 1e-9) { out.stagedBelowFurnitureFloor++; if (s.furniture.length) out.stagedBelowFurnitureFloorWithFurniture++; }
    if (published.has(id)) continue;
    out.roofsGainingFact++;
    bump(out.gainedByConfidence, confBin(s.confidence));
    bump(out.gainedBySlot, s.slot);
    if (s.confidence >= driftFloor - 1e-9) {
      out.gainedAboveFloor++;
      const c = driftCause(id, opts.inputsBefore, opts.inputsAfter);
      bump(out.gainedAboveFloorCause as Hist, c);
      (gainedIds.get(c) ?? gainedIds.set(c, []).get(c)!).push(id);
    }
  }
  out.meanAbsRgbDelta5bit = out.sharedRows ? Number((rgbSum / out.sharedRows).toFixed(4)) : 0;
  out.topSlotChanges = Object.entries(slotChanges).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const k of ['gainedByConfidence', 'lostByConfidence', 'gainedBySlot', 'lostBySlot', 'publishedSlots', 'stagedSlots', 'publishedFurniture', 'stagedFurniture'] as const) out[k] = sortHist(out[k]);
  return { ...out, gainedAboveFloorIds: gainedIds, lostAboveFloorIds: lostIds };
}

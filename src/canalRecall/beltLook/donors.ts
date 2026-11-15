/**
 * Belt look (lane D, 2026-11-15; David: "go for buurt looks + kits rather than trying to get every house perfect"): the
 * canal belt's look is the belt's own read houses. An undescribed belt pand takes the D1 read of the most similar read
 * house (its donor): same canal first, then build year, front width, eaves and roof form. Picking a whole read rather than
 * each field from a distribution keeps a front coherent (a neck gable keeps its attic light and its narrow bays; a wide
 * cornice house keeps its door surround and its stoop) and leaves the belt's mix of crowns, windows, walls and stoops
 * exactly as read: the look's distributions are the donors'.
 *
 * Deterministic per pand: the donor is one of the `DONOR_K` nearest, chosen by a hash of the pand id, never a dice roll
 * at draw time. Pure: no fs, no DOM.
 */
import type { DescriberAnswer } from '../houseSpec/describer.ts';

/** The four canals; any other street of the belt is a cross street. */
export const BELT_CANALS = ['Herengracht', 'Keizersgracht', 'Prinsengracht', 'Singel'] as const;
export type BeltSegment = (typeof BELT_CANALS)[number] | 'cross';
export const segmentOf = (street: string): BeltSegment => (BELT_CANALS as readonly string[]).includes(street) ? street as BeltSegment : 'cross';

/** A read belt house: its read, its cut's wall sample, and what the donor match weighs. */
export interface BeltDonor {
  pandId: string;
  street: string;
  year: number | null;
  /** The cut's wall width (m): the front the read describes. */
  widthM: number;
  /** The cut's wall height (m above the street). */
  heightM: number;
  answer: DescriberAnswer;
  /** The cut's measured wall colour (cuts.json w1 / wallHex): the row solve judges the brick family from it. */
  sample?: string;
}
/** What the match knows of an undescribed pand. */
export interface BeltTarget {
  pandId: string;
  street: string;
  year: number | null;
  widthM: number;
  eavesM: number | null;
  ridgeM: number | null;
  /** 3DBAG roof type (bag tiles `roof`: 1 flat, 2 several flats, 3 slanted). */
  roofCode: number | null;
}

/** D1 crowns that stand a gable over the line. */
export const GABLED_CROWNS = new Set(['neck', 'raised-neck', 'shouldered', 'bell', 'point', 'step', 'spout']);
/** A pand can carry a street gable only over a pitched roof at least this tall (3DBAG ridge - eaves, m): a flat-topped
 *  pand never takes a gabled donor. */
export const GABLE_MIN_RISE_M = 2;
/** The nearest donors one pand chooses among. */
export const DONOR_K = 4;
/** The match weights: one unit is a street segment apart, 50 years, 2 m of width or 3 m of eaves. */
export const DONOR_WEIGHTS = { segment: 1.5, sameStreet: -0.3, yearPer: 50, widthPer: 2, eavesPer: 3, gableOnFlat: 4 } as const;

/** A usable donor read: readable, one front, its crown and storeys seen. */
export function usableDonor(a: DescriberAnswer | null | undefined): a is DescriberAnswer {
  return !!a && a.readable !== false && (a as { extent?: string }).extent !== 'multi' && !!a.crown && a.crown !== 'not-visible'
    && typeof a.storeys === 'number' && a.storeys > 0 && typeof a.bays === 'number' && a.bays > 0;
}

export const gableable = (t: Pick<BeltTarget, 'eavesM' | 'ridgeM' | 'roofCode'>): boolean =>
  t.eavesM !== null && t.ridgeM !== null && t.ridgeM - t.eavesM >= GABLE_MIN_RISE_M && t.roofCode !== 1 && t.roofCode !== 2;

/** The match distance of a donor to a pand (lower is closer). */
export function donorDistance(t: BeltTarget, d: BeltDonor): number {
  const w = DONOR_WEIGHTS;
  let s = segmentOf(t.street) === segmentOf(d.street) ? 0 : w.segment;
  if (t.street === d.street) s += w.sameStreet;
  s += t.year !== null && d.year !== null ? Math.abs(t.year - d.year) / w.yearPer : 1;
  s += Math.abs(t.widthM - d.widthM) / w.widthPer;
  if (t.eavesM !== null) s += Math.abs(t.eavesM - d.heightM) / w.eavesPer;
  if (GABLED_CROWNS.has(String(d.answer.crown)) && !gableable(t)) s += w.gableOnFlat;
  return s;
}

/** FNV-1a of a string: the per-pand choice among the nearest donors. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** The pand's donor: one of the `DONOR_K` nearest (ties broken by pand id), picked by the pand id's hash. */
export function donorFor(t: BeltTarget, donors: readonly BeltDonor[]): { donor: BeltDonor; distance: number; rank: number; of: number } | null {
  const near = donors.filter(d => d.pandId !== t.pandId).map(d => ({ d, s: donorDistance(t, d) }))
    .sort((a, b) => a.s - b.s || (a.d.pandId < b.d.pandId ? -1 : 1)).slice(0, DONOR_K);
  if (!near.length) return null;
  const rank = hash32(t.pandId) % near.length;
  return { donor: near[rank].d, distance: +near[rank].s.toFixed(3), rank, of: near.length };
}

/**
 * The donor's read fitted to the pand: its storeys to the pand's eaves at the donor's own storey pitch, its bays to the
 * pand's width at the donor's own axis, the door kept inside the ground bays. Everything else is the donor's as read.
 */
export function fittedRead(t: BeltTarget, d: BeltDonor): DescriberAnswer {
  const a = structuredClone(d.answer) as DescriberAnswer & { columns?: number[]; storeyParts?: { full?: number }; groundBays?: number; doorIndex?: number };
  const pitch = d.heightM / (d.answer.storeys as number);
  if (t.eavesM !== null && pitch > 2) {
    const n = Math.max(1, Math.round(t.eavesM / pitch));
    if (n !== a.storeys) { a.storeys = n; if (a.storeyParts) a.storeyParts.full = n; delete a.columns; }
  }
  const axis = d.widthM / (d.answer.bays as number);
  if (axis > 0.8) {
    const b = Math.max(1, Math.round(t.widthM / axis));
    if (b !== a.bays) {
      const wasAll = a.groundBays === a.bays;
      a.bays = b; delete a.columns;
      if (wasAll || (typeof a.groundBays === 'number' && a.groundBays > b)) a.groundBays = b;
      if (typeof a.doorIndex === 'number' && typeof a.groundBays === 'number') a.doorIndex = Math.min(a.doorIndex, a.groundBays - 1);
    }
  }
  a.pandId = t.pandId;
  return a;
}

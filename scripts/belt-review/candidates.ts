/**
 * Belt review (R3): which panoramas become a pand's photo candidates, in what order, and which one is the automatic pick.
 * Pure (no network, no disk): unit-tested offline in candidates.test.ts.
 *
 * - Wall candidates are straight views (<= THRESHOLDS.straightDeg, the house:crops wall route). Round 1 takes one panorama
 *   per mission year in house:crops order (crops.ts yearCandidates: clear ray first, then leaf-off, then newer). Round 2 fills
 *   the remaining slots with other capture positions (a camera at least ALT_POSITION_M from every chosen camera of the same
 *   capture day), leaf-off and least oblique first, so a tree or van in one view can be avoided by another.
 * - Two panoramas are the same view when they share an id, or were taken on the same day with cameras under DUP_CAMERA_M apart.
 * - Strip candidates (planStrip, weaker evidence) are a fallback: a narrow wall, no straight view, or too few walls passing.
 */
import { yearCandidates, leafOff } from '../house-crops/crops.ts';
import { THRESHOLDS, hardPass } from '../house-crops/flags.ts';
import { choose, type Cand } from '../house-crops/pick.ts';
import type { PanoPick } from '../pand-reference/select.ts';
import type { Rd } from '../pand-reference/core.ts';
import type { Candidate } from './faceModel.ts';

export const MAX_CANDIDATES = 6;
export const MAX_STRIPS = 2;
/** Same capture day and cameras closer than this: the same view (the car moved one frame). */
export const DUP_CAMERA_M = 3;
/** A second position on a capture day already chosen must stand this far from every chosen camera of that day. */
export const ALT_POSITION_M = 6;
/** Fewer hard-passing wall candidates than this asks for strip slices as well. */
export const MIN_GOOD_WALLS = 2;

export type PoolPick = PanoPick & { blocked: boolean; cam: Rd };

/** `narrow` (flags.ts minWallM 3.5) guards against slivers and window close-ups. On the belt it is often a fact about the
 *  house: Herengracht 62's whole street wall is 3.45 m. For review it stays a hard gate only below this width. */
export const REVIEW_MIN_WALL_M = 2.5;
export const reviewHardPass = (reasons: readonly string[], wallWidthM: number): boolean =>
  hardPass(reasons.filter(r => !(r === 'narrow' && wallWidthM >= REVIEW_MIN_WALL_M)));
const day = (t: string) => t.slice(0, 10);
const dist = (a: Rd, b: Rd) => Math.hypot(a.x - b.x, a.y - b.y);

export function sameView(a: Pick<PoolPick, 'panoId' | 'timestamp' | 'cam'>, b: Pick<PoolPick, 'panoId' | 'timestamp' | 'cam'>): boolean {
  return a.panoId === b.panoId || (day(a.timestamp) === day(b.timestamp) && dist(a.cam, b.cam) < DUP_CAMERA_M);
}

/** Leaf-off first, then least oblique (5 degree steps, so a near-tie goes to the newer year), then newer, then nearer to 15 m. */
export function viewOrder(a: PoolPick, b: PoolPick): number {
  return Number(leafOff(b.timestamp)) - Number(leafOff(a.timestamp))
    || Math.round(a.obliquityDeg / 5) - Math.round(b.obliquityDeg / 5)
    || b.missionYear - a.missionYear
    || Math.abs(a.distM - 15) - Math.abs(b.distM - 15)
    || a.panoId.localeCompare(b.panoId);
}

/** The wall-route panoramas for one pand, in the order they are tried; at most `max`. A blocked ray is taken only when fewer than two clear views exist. */
export function planWallPicks(pool: PoolPick[], max = MAX_CANDIDATES): PoolPick[] {
  const straight = pool.filter(p => p.obliquityDeg <= THRESHOLDS.straightDeg);
  const clear = straight.filter(p => !p.blocked);
  const usePool = clear.length >= 2 ? clear : straight;
  const tier = (p: PanoPick) => ((p as PoolPick).blocked ? 1 : 0);
  const chosen: PoolPick[] = [];
  for (const p of yearCandidates(usePool, tier, max) as PoolPick[]) if (!chosen.some(c => sameView(c, p))) chosen.push(p);
  const rest = usePool.filter(p => !chosen.some(c => sameView(c, p))).sort((a, b) => tier(a) - tier(b) || viewOrder(a, b));
  for (const p of rest) {
    if (chosen.length >= max) break;
    const sameDay = chosen.filter(c => day(c.timestamp) === day(p.timestamp));
    if (sameDay.every(c => dist(c.cam, p.cam) >= ALT_POSITION_M) && !chosen.some(c => sameView(c, p))) chosen.push(p);
  }
  return chosen.slice(0, max);
}

/** Mission years for strip slices: leaf-off first, then newer; only years with a clear view within the 55 degree window. */
export function stripYears(pool: PoolPick[], n = MAX_STRIPS): number[] {
  const best = new Map<number, PoolPick>();
  for (const p of [...pool].filter(p => !p.blocked).sort(viewOrder)) if (!best.has(p.missionYear)) best.set(p.missionYear, p);
  return [...best.values()].sort(viewOrder).slice(0, n).map(p => p.missionYear);
}

/** Strip slices are wanted when the wall is narrow, no straight view exists, or fewer than MIN_GOOD_WALLS wall crops pass the hard flags. */
export const wantsStrips = (wallLenM: number, wallPicks: number, hardPassingWalls: number): boolean =>
  wallLenM < THRESHOLDS.narrowWallM || wallPicks === 0 || hardPassingWalls < MIN_GOOD_WALLS;

/** Display order: hard-passing first (walls, then strips), then the rest (walls, then strips); inside a group leaf-off, least oblique, newer. */
export function orderCandidates(cands: Candidate[]): Candidate[] {
  const group = (c: Candidate) => (c.hardPass ? 0 : 2) + (c.source === 'strip' ? 1 : 0);
  return [...cands].sort((a, b) => group(a) - group(b)
    || Number(b.leafOff) - Number(a.leafOff)
    || Math.round(a.obliquityDeg / 5) - Math.round(b.obliquityDeg / 5)
    || b.year - a.year || a.id.localeCompare(b.id));
}

/** Drop repeats: the same source over the same panorama set (a strip year planned onto the panorama a wall crop used stays). */
export function dedupeCandidates(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return cands.filter(c => { const k = `${c.source}:${[...(c.pano.ids ?? [c.pano.id])].sort().join('+')}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Ordered, deduped, capped at `max` with at most MAX_STRIPS strips (walls give way to strips only past the cap). */
export function finalCandidates(cands: Candidate[], max = MAX_CANDIDATES): Candidate[] {
  const all = orderCandidates(dedupeCandidates(cands));
  const strips = all.filter(c => c.source === 'strip').slice(0, MAX_STRIPS);
  const walls = all.filter(c => c.source === 'wall').slice(0, max - Math.min(strips.length, max));
  return orderCandidates([...walls, ...strips]);
}

/**
 * The automatic pick, with the existing picker (pick.ts `choose`: the highest Jev quality among hard-passing judged
 * candidates, ties to the newer year). Without judge scores: the first hard-passing candidate that is also flag-usable,
 * then the first hard-passing one; none when nothing passes the hard flags.
 */
export function autoPick(cands: Candidate[]): { id: string | null; why: string } {
  const asCand = (c: Candidate): Cand & { id: string } => ({ id: c.id, year: c.year, panoIds: c.pano.ids ?? [c.pano.id], file: c.file, reasons: c.reasons, hard: c.hardPass, ...(c.judge ? { score: c.judge.score, occluded: c.judge.occluded, quality: c.judge.quality } : {}) });
  const ordered = orderCandidates(cands);
  const { best } = choose(ordered.map(asCand));
  if (best) return { id: (best as Cand & { id: string }).id, why: `judge: highest quality ${best.quality} among hard-passing candidates (pick.ts choose)` };
  const usable = ordered.find(c => c.hardPass && c.usable);
  if (usable) return { id: usable.id, why: 'not judged: first hard-passing, flag-usable candidate in display order' };
  const hard = ordered.find(c => c.hardPass);
  if (hard) return { id: hard.id, why: `not judged: first hard-passing candidate (soft flags: ${hard.reasons.join(', ')})` };
  return { id: null, why: 'no candidate passes the hard flags' };
}

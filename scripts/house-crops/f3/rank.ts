/**
 * F3 (#381): choosing the crop. `defaultPick` reproduces today's rule (the first usable year in the default order, else the least broken);
 * `pixelScore` / `rankedPick` is the F3 rule: every hard-passing candidate of every year and both bearings, scored on the occlusion mask,
 * leaf-off dates and obliquity. The model gate (Jev full_front x (1 - occluded), Gemini trunk/branch) ranks the top few on top of this
 * (f3/gate.ts). Pure; tested in rank.test.ts.
 */
import { usability, hardPass, penalty, type CropFlags } from '../flags.ts';

export type Tried = { year: number; panoId: string; date: string; usable: boolean; reasons: string[]; method: 'wall' | 'strip'; obliquity: number; foliage: number; flags?: CropFlags; file?: string; second?: boolean; bearingDeg?: number; leafOff?: boolean; panoIds?: string[] };

/** What crops.ts does today: tries `second: false` candidates in order, stops at the first usable one, else keeps the one with the fewest broken caps and the least overshoot. */
export function defaultPick(tried: Tried[]): Tried | undefined {
  const base = tried.filter(t => !t.second && t.flags);
  const first = base.find(t => usability(t.flags!).usable);
  if (first) return first;
  let best: Tried | undefined;
  for (const t of base) {
    if (!best) { best = t; continue; }
    const ra = usability(t.flags!).reasons.length, rb = usability(best.flags!).reasons.length;
    if (ra < rb || (ra === rb && penalty(t.flags!) < penalty(best.flags!))) best = t;
  }
  return best;
}

/** Higher is better. Hidden share dominates (leaves + trunks + van); a leaf-off date, a straight view and a clear wall rank ahead of otherwise equal crops. */
export function pixelScore(t: Tried): number {
  const f = t.flags!;
  const hidden = f.maskedShare ?? f.foliage;
  return +(1 - 1.5 * hidden - 0.6 * Math.max(0, f.foliage - 0.05) - 0.003 * Math.max(0, f.obliquity - 10) - 0.5 * Math.max(0, f.occluderShare - 0.1) + (t.leafOff ? 0.08 : 0)).toFixed(4);
}

/** Candidates that pass every hard flag, best pixel score first; ties go to the newer year. */
export function rankedCandidates(tried: Tried[]): Tried[] {
  return tried.filter(t => t.flags && hardPass(usability(t.flags).reasons)).sort((a, b) => pixelScore(b) - pixelScore(a) || b.year - a.year);
}
export const rankedPick = (tried: Tried[]): Tried | undefined => rankedCandidates(tried)[0] ?? defaultPick(tried);

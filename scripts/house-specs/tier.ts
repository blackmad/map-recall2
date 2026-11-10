/**
 * Crop confidence tiers (house line H5, H4c verdict #339). `usable` alone is never a quality verdict (precision 0.5 for good), so the
 * writers read the tier:
 *   good      hard flags pass and the Jev judge's quality >= `goodThreshold` (JUDGE_GOOD, 0.5): every writer may use it
 *   fallback  hard flags pass, the judge is below the threshold or has not scored it: only the pixel writer, for the colour family and
 *             the storey count, at lower confidence; the Jev writer skips it
 *   none      a hard flag (void, oblique 55, distance, blocked, narrow, short, blank) fails: no writer reads the crop
 */
import { JUDGE_GOOD, hardPass } from '../house-crops/flags.ts';

export type Tier = 'good' | 'fallback' | 'none';
export type CropCandidate = { file: string; year: number | null; panoIds: string[]; reasons: string[]; quality: number | null };

export const tierOf = (c: Pick<CropCandidate, 'reasons' | 'quality'>, goodThreshold = JUDGE_GOOD): Tier =>
  !hardPass(c.reasons) ? 'none' : c.quality !== null && c.quality >= goodThreshold ? 'good' : 'fallback';

/** The best candidate of a pand: the highest tier, then the higher judge quality, then the newer year. Null when none passes the hard flags. */
export function bestCrop(cands: readonly CropCandidate[], goodThreshold = JUDGE_GOOD): { crop: CropCandidate; tier: Tier } | null {
  const rank = { good: 2, fallback: 1, none: 0 } as const;
  const scored = cands.map(c => ({ crop: c, tier: tierOf(c, goodThreshold) })).filter(x => x.tier !== 'none');
  scored.sort((a, b) => rank[b.tier] - rank[a.tier] || (b.crop.quality ?? -1) - (a.crop.quality ?? -1) || (b.crop.year ?? 0) - (a.crop.year ?? 0));
  return scored[0] ?? null;
}

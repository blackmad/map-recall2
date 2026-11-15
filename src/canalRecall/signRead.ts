// Round 7 (lane retail-look-20261114): the sign read off a panorama confirms or flags a shop's host. The OCR (local
// tesseract, scripts/retail-ground/sign-ocr.ts) reads words with a confidence each; a hosted shop whose name has a
// distinctive word (read with conf >= MATCH_CONF) (>= 4 letters, not generic) that the sign spells within one edit is a `match`; a confident sign
// word (>= MISMATCH_LEN letters, conf >= MISMATCH_CONF) with no match is a `mismatch` (flag the host); else `none`.
// Pure: Node script and tests.
import { nameTokens } from './retailSources.js';

export const MISMATCH_LEN = 5, MISMATCH_CONF = 85, MATCH_CONF = 50;
export type OcrWord = { text: string; conf: number };

/** Levenshtein distance, capped (returns cap + 1 past it). */
export function editDistance(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function signVerdict(name: string, words: readonly OcrWord[]): { verdict: 'match' | 'mismatch' | 'none'; word?: string } {
  const want = nameTokens(name).filter(t => t.length >= 4);
  const read = words.map(w => ({ t: clean(w.text), conf: w.conf })).filter(w => w.t.length >= 3 && w.conf >= MATCH_CONF);
  const glued = read.map(w => w.t).join('');
  for (const t of want) {
    const hit = read.find(w => w.t.length >= 4 && editDistance(w.t, t, 1) <= 1) ?? (t.length >= 5 && glued.includes(t) ? { t } : undefined);
    if (hit) return { verdict: 'match', word: hit.t };
  }
  const strong = read.find(w => /^[a-z]+$/.test(w.t) && w.t.length >= MISMATCH_LEN && w.conf >= MISMATCH_CONF);
  return strong ? { verdict: 'mismatch', word: strong.t } : { verdict: 'none' };
}

/**
 * Dark-finish veto for wall sample v2 (lane d1-wall-colour round 2, 2026-11-14; docs/house-line.md §15). v2 lifts an
 * underexposed wall sample to a standard capture. A front that is genuinely dark (painted black or very dark green, dark
 * brick) must not be lifted: under the veto v2 keeps the wall at the sample's own lightness with no chroma gain
 * (wallSample.ts `wallSampleV2(..., veto)`).
 *
 * Evidence, each with its receipt:
 *  - describer  the D1 reader's own words about the described front: finish `painted-brick` or `brick` and a note naming it
 *               dark or black ("black-painted four-bay house", "this dark three-bay front", "the wall is painted
 *               near-black"). A dark word that belongs to a neighbour, a side wall, the image or the light is not taken.
 *  - captures   several captures of the pand agree it is dark after the per-capture exposure gain: every corrected
 *               OKLab L under `capMaxL`, at least `capMinN` captures.
 *  - neighbours in the same cut (one exposure), the front reads darker than the street wall either side of it
 *               (captures.ts `nb`): the median over captures of L(front) - median L(neighbours) under `nbRel`, with the
 *               neighbours themselves reading normal (median L over `nbMinL`), in at least `nbMinN` captures.
 * Calibration (calibrate.ts round2, 198 rule-10 photo pands of the D1 belt pages and Weteringschans; v2 estimate L against
 * the photo's W1 L for the flagged pands, lifted -> vetoed): describer n 19, |dL| 0.116 -> 0.108; neighbours n 6,
 * 0.068 -> 0.059; captures (capMaxL 0.44) n 14, 0.092 -> 0.108, i.e. worse: a pand all of whose captures read dark after
 * the gain is mostly a dark capture set, not a dark wall, so `captures` is kept as a receipt and does not vote
 * (`captureVotes`). The Jev finish judge is not used. Pure: no DOM, no fs.
 */
export const DARK_FINISH = {
  /** captures: every exposure-corrected capture under this OKLab L */
  capMaxL: 0.4,
  capMinN: 2,
  /** neighbours: front minus neighbours in the same cut, median over captures */
  nbRel: -0.07,
  nbMinL: 0.38,
  nbMinN: 2,
  /** sources needed for the veto */
  minVotes: 1,
  /** whether capture agreement counts as a source (it made |dL| worse on the photos: see the header) */
  captureVotes: false,
};
export type DarkFinishParams = typeof DARK_FINISH;

type AnswerLike = { readable?: boolean; finish?: string | null; notes?: string | null; pale?: boolean | null };
const NOUN = String.raw`(?:front|house|wall|gable|neck-gable|step-gable|bell gable|double front|corner front|eaves front|cornice house|corner house|warehouse front)`;
const DARK_FRONT = new RegExp(String.raw`\b(near-black|black|dark)(?:[- ](?:painted|brick))?\b((?:\s+[\w-]+){0,3}?)\s+${NOUN}\b`, 'gi');
const PAINTED_BLACK = /\b(?:near-black|black)[- ]painted\b|\bpainted (?:near-)?black\b/i;
const OTHER = /neighbou?r|side wall|beyond|across|next door|beside|behind/;
/** The phrase of a D1 answer that calls the described front dark, or null. */
export function describerDarkPhrase(a: AnswerLike | null | undefined): string | null {
  if (!a?.readable || a.pale === true || !['painted-brick', 'brick'].includes(String(a.finish))) return null;
  const t = String(a.notes ?? '');
  for (const m of t.matchAll(DARK_FRONT)) {
    const at = m.index ?? 0, pre = t.slice(Math.max(0, at - 30), at).toLowerCase(), mid = m[2].toLowerCase();
    const post = t.slice(at + m[0].length, at + m[0].length + 16).toLowerCase();
    if (OTHER.test(mid) || /side|neighbou?r/.test(m[0].toLowerCase())) continue;
    // "onto the dark neighbour's", "the dark front beside it": the dark word is about something else, unless the reader
    // says this is the front described ("this dark front holds most of it", "described the dark house")
    if (OTHER.test(pre.slice(-18) + ' ' + post) && !/\bthis\b|described|holds/.test(pre + ' ' + post)) continue;
    if (/^\s*(?:light|image|glass|sky)/.test(post)) continue;
    return m[0];
  }
  const m = PAINTED_BLACK.exec(t);
  if (m) {
    const near = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20).toLowerCase();
    if (!OTHER.test(near) || /\bthis\b|described/.test(near)) return m[0];
  }
  return null;
}

export type CaptureDark = { n: number; maxL: number; dark: boolean };
/** Do the exposure-corrected captures agree the wall is dark? */
export function capturesDark(correctedL: readonly number[], P: DarkFinishParams = DARK_FINISH): CaptureDark | null {
  if (!correctedL.length) return null;
  const maxL = Math.max(...correctedL);
  return { n: correctedL.length, maxL: +maxL.toFixed(3), dark: correctedL.length >= P.capMinN && maxL < P.capMaxL };
}

const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export type NeighbourCapture = { L: number; left?: { L: number } | null; right?: { L: number } | null };
export type NeighbourDark = { n: number; rel: number; nbL: number; dark: boolean };
/** The front against the street wall either side of it in the same cut, over captures. */
export function neighboursDark(caps: readonly NeighbourCapture[], P: DarkFinishParams = DARK_FINISH): NeighbourDark | null {
  const rel: number[] = [], nb: number[] = [];
  for (const c of caps) {
    const sides = [c.left?.L, c.right?.L].filter((x): x is number => typeof x === 'number');
    if (!sides.length) continue;
    const m = sides.reduce((s, x) => s + x, 0) / sides.length;
    rel.push(c.L - m); nb.push(m);
  }
  if (!rel.length) return null;
  const r = median(rel), n = median(nb);
  return { n: rel.length, rel: +r.toFixed(3), nbL: +n.toFixed(3), dark: rel.length >= P.nbMinN && r < P.nbRel && n > P.nbMinL };
}

export type DarkFinishFact = {
  dark: boolean;
  by: Array<'describer' | 'captures' | 'neighbours'>;
  describer: string | null;
  captures: CaptureDark | null;
  neighbours: NeighbourDark | null;
};
export function darkFinish(ev: { describer: string | null; captures: CaptureDark | null; neighbours: NeighbourDark | null }, P: DarkFinishParams = DARK_FINISH): DarkFinishFact {
  const by: DarkFinishFact['by'] = [];
  if (ev.describer) by.push('describer');
  if (ev.captures?.dark && P.captureVotes) by.push('captures');
  if (ev.neighbours?.dark) by.push('neighbours');
  return { dark: by.length >= P.minVotes, by, ...ev };
}

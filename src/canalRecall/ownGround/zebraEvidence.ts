// Zebra score from the orthophoto (pure; scripts/own-ground/build-photo-evidence.ts writes it into photo-evidence).
//
// A planned zebra (surveyMarkings planCrossings: centre, road direction r, the row's extent [from, to] along n = left(r))
// is looked for in the photo along its road: at offset u along r, the luma profile across the row (along n) every
// 0.05 m, averaged over ±0.5 m along r. Its stripes are a periodic signal at the painted pitch (0.8–1.3 m).
//
// `full` (the rule until 2026-10-30): the strongest Fourier amplitude of the whole profile over its mean. Since the
// one-row rule (surveyMarkings, lane zebra-munt 2026-10-30) a planned row runs across every road-level surface, so the
// painted zebra fills only part of it (a carriageway between a fietspad, a parking strip and a tram track), and over a
// long row the amplitude is diluted by the share the stripes cover: the real zebras at the Arcam (Prins Hendrikkade S)
// and both Muntplein rows scored 0.044–0.063 under ZEBRA_SCORE 0.07 and were dropped.
//
// `window` (2026-10-30): the profile less its running median over ±MEDIAN_M (a median follows a shadow edge or the step
// from klinker to asphalt and leaves the stripes, which are narrower than the median's reach), then the same
// periodogram over windows of WINDOW_M sliding along the row every WINDOW_STEP_M, each over its own mean (+10); the
// profile's score is the strongest window. A zebra then shows at its own contrast wherever it lies in the row, and a row
// of plain road scores what one window of plain road scores, whatever its length. A row no longer than
// WINDOW_MIN_ROW_M keeps the whole-row score. ZEBRA_SCORE (0.07) is unchanged: it is the 95th percentile of the windowed
// score 7.5 m along the road from the planned rows (city-wide 2026-10-30, 2047 rows: q50 0.033, q90 0.061, q95 0.071).

export type Rgb = readonly number[];
export interface ZebraPlanLike { centre: readonly [number, number]; r: readonly [number, number]; from: number; to: number }
export interface ZebraScoreOptions {
  /** Search half-range along r, m. */
  searchM: number;
  mode: 'full' | 'window';
}

export const ZEBRA_PITCH_MIN_M = 0.8;
export const ZEBRA_PITCH_MAX_M = 1.3;
export const WINDOW_M = 5;
export const MEDIAN_M = 0.8;
/** Rows up to this long (one carriageway, which a painted zebra spans) keep the whole-row score: dilution under 1.5×. */
export const WINDOW_MIN_ROW_M = 7.5;
export const WINDOW_STEP_M = 0.5;
const V_STEP = 0.05;

const luma = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Strongest amplitude at a painted pitch of the residuals `res` at positions `vs`. */
function pitchAmp(vs: readonly number[], res: readonly number[]): number {
  const k = res.length;
  let amp = 0;
  for (let period = ZEBRA_PITCH_MIN_M; period <= ZEBRA_PITCH_MAX_M + 1e-6; period += 0.05) {
    let re = 0, im = 0;
    for (let i = 0; i < k; i++) { re += res[i] * Math.cos(2 * Math.PI * vs[i] / period); im += res[i] * Math.sin(2 * Math.PI * vs[i] / period); }
    amp = Math.max(amp, 2 * Math.hypot(re, im) / k);
  }
  return amp;
}

const meanOf = (a: readonly number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/** Strongest amplitude at a painted pitch over the mean (+10, dark shadow), of samples `ls` at positions `vs` (the `full` rule). */
export function pitchScore(vs: readonly number[], ls: readonly number[]): number {
  if (ls.length < 40) return 0;
  const mean = meanOf(ls);
  return pitchAmp(vs, ls.map(l => l - mean)) / (mean + 10);
}

/** The profile less its running median over ±MEDIAN_M. */
export function medianResidual(vs: readonly number[], ls: readonly number[]): number[] {
  const out: number[] = [];
  let i0 = 0, i1 = 0;
  for (let i = 0; i < vs.length; i++) {
    while (vs[i0] < vs[i] - MEDIAN_M - 1e-9) i0++;
    while (i1 < vs.length && vs[i1] <= vs[i] + MEDIAN_M + 1e-9) i1++;
    const w = ls.slice(i0, i1).sort((a, b) => a - b);
    out.push(ls[i] - w[w.length >> 1]);
  }
  return out;
}

/** Score of one across-row profile (see the header). */
export function profileScore(vs: readonly number[], ls: readonly number[], mode: ZebraScoreOptions['mode']): number {
  if (mode === 'full' || !vs.length || vs[vs.length - 1] - vs[0] <= WINDOW_MIN_ROW_M) return pitchScore(vs, ls);
  const res = medianResidual(vs, ls);
  let best = 0;
  for (let a = vs[0]; a + WINDOW_M <= vs[vs.length - 1] + 1e-6; a += WINDOW_STEP_M) {
    const i0 = vs.findIndex(v => v >= a - 1e-9), i1 = vs.findIndex(v => v > a + WINDOW_M + 1e-9), j = i1 < 0 ? vs.length : i1;
    if (j - i0 < 40) continue;
    const r = res.slice(i0, j), m = meanOf(r);
    best = Math.max(best, pitchAmp(vs.slice(i0, j), r.map(x => x - m)) / (meanOf(ls.slice(i0, j)) + 10));
  }
  return best;
}

export interface ZebraScore { best: number; bu: number; far: number; us: number[]; score: number[] }

/** The zebra score along the road (see the header); `rgbAt` reads the photo at a game-frame point. */
export function scoreZebra(c: ZebraPlanLike, rgbAt: (x: number, y: number) => Rgb | null | undefined, opts: ZebraScoreOptions): ZebraScore {
  const n: [number, number] = [-c.r[1], c.r[0]], us: number[] = [], score: number[] = [];
  for (let u = -opts.searchM - 1.5; u <= opts.searchM + 1.5 + 1e-6; u += 0.25) {
    const vs: number[] = [], ls: number[] = [];
    for (let v = c.from; v <= c.to; v += V_STEP) {
      let l = 0, m = 0;
      for (const a of [-0.5, 0, 0.5]) { const q = rgbAt(c.centre[0] + c.r[0] * (u + a) + n[0] * v, c.centre[1] + c.r[1] * (u + a) + n[1] * v); if (q) { l += luma(q); m++; } }
      if (m) { vs.push(v); ls.push(l / m); }
    }
    us.push(u); score.push(profileScore(vs, ls, opts.mode));
  }
  // Smoothed over the 3 m stripe length (±1.25 m), the best position within the search.
  let best = -1, bu = 0;
  for (let i = 0; i < us.length; i++) {
    if (Math.abs(us[i]) > opts.searchM) continue;
    let t = 0, k = 0;
    for (let j = 0; j < us.length; j++) if (Math.abs(us[j] - us[i]) <= 1.25) { t += score[j]; k++; }
    if (k && t / k > best) { best = t / k; bu = us[i]; }
  }
  return { best, bu, far: Math.min(score[0], score[score.length - 1]), us, score };
}

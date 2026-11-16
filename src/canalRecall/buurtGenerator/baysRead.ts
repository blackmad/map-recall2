/**
 * Buurt generator round 18 (lane R): a series' window axes from the street panoramas instead of one per `axisM` of front
 * width. The blind test on round 17 (De Wallen) named the bays: "4 instead of 2-3". The width rule cannot see a front
 * whose windows stand wide apart, nor a pair of lights read as one axis.
 *
 * A member's read is the pixel writer's count (houseSpec/writers/pixel.ts): the measured front's window columns on a
 * rhythmic front (punched or columns) whose pitch resolves (PIXEL_BAYS.minPitchScore) and where `columns` and
 * `windowColumns` agree (on the AB07 hand pands that gate took the count from 11/22 to 9/11 right). Several captures of
 * one member must agree; a series takes its members' count when enough of them read and agree, else the width rule
 * stands. Pure: no fs.
 */
import type { FacadeMeasurement } from '../buildingRecipe/measureFacade.ts';
import { PIXEL_BAYS } from '../houseSpec/writers/pixel.ts';

/** A series takes the read when at least `minMembers` members, and at least `cover` of all its members, read, and
 *  `share` of them agree on one count. `cover`: Parnassusweg 131928 (14 members) took 2 from two members of one capture
 *  where the photo shows about 4 window groups a front. */
export const BAYS_READ = { minMembers: 2, cover: 0.25, share: 0.6, maxBays: 8 } as const;

/** Round 19 `raw`: the measure behind a capture (re-gated offline without a download) and the run counter's read. */
export interface BaysRaw { cls: string; columns: number | null; wcols: number | null; pitch: number; usable: number; foliage: number; axes?: number; widthsM?: number[]; centres?: number[]; narrow?: number; storeys?: number; src?: 'pixel' | 'runs'; seen: number; spanM: number }
export interface BaysCapture { pano: string; date: string; cols: number | null; why?: string; raw?: BaysRaw }
/** One member's reads (measured/<district>.json `bays`): `bays` its count when its captures agree, else null. */
export interface MemberBays { bays: number | null; reads: BaysCapture[] }

/** The bay count a measured crop states, when the pixel writer's gate passes; else null. */
export function baysOfMeasure(m: Pick<FacadeMeasurement, 'frontClass' | 'columns' | 'windowColumns' | 'pitchScore' | 'usableFraction'>): number | null {
  if (m.usableFraction < 0.5 || (m.frontClass !== 'punched' && m.frontClass !== 'columns')) return null;
  const cols = m.windowColumns ?? m.columns;
  if (cols === null || cols === undefined || !Number.isInteger(cols) || cols < 1 || cols > BAYS_READ.maxBays) return null;
  return m.columns === m.windowColumns && m.pitchScore >= PIXEL_BAYS.minPitchScore ? cols : null;
}

/** A member's count from its captures: the one count they all state (null reads aside); null when none or they differ. */
export function memberBaysOf(reads: readonly BaysCapture[]): number | null {
  const got = [...new Set(reads.flatMap(r => r.cols === null ? [] : [r.cols]))];
  return got.length === 1 ? got[0] : null;
}

/** A series' count from its members' counts (null: unread): the most common when at least `minMembers` (and `cover`
 *  of the members) read and `share` of the read ones agree; else null (the width rule stands). Ties: the smaller count. */
export function seriesBaysOf(members: ReadonlyArray<number | null | undefined>, captures?: ReadonlyArray<number>): { bays: number; read: number; agree: number } | null {
  const idx = members.flatMap((b, i) => typeof b === 'number' ? [i] : []), read = idx.map(i => members[i] as number);
  // Round 19: a member two captures agree on is two observations towards `minMembers` (a lone front read twice); the
  // `cover` floor still counts members.
  const seen = idx.reduce((n, i) => n + Math.min(2, Math.max(1, captures?.[i] ?? 1)), 0);
  if (seen < BAYS_READ.minMembers || read.length < Math.ceil(members.length * BAYS_READ.cover)) return null;
  const n = new Map<number, number>();
  for (const b of read) n.set(b, (n.get(b) ?? 0) + 1);
  const [bays, agree] = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return agree / read.length >= BAYS_READ.share ? { bays, read: read.length, agree } : null;
}

/**
 * Round 21 (lane R): the counted windows the kit draws (frontKit KitCounted). Round r's blind judges preferred the
 * width rule's narrow painted cells (5 rows of 6) to the counted bays stretched over wider cells, and a fresh hand count
 * of separate window openings on 58 member cuts (pairs counted 2) put the round-19 cascade at 27 of 41 right. A capture
 * is now vetoed when any of its runs is wider than `maxRunM` (no window or erker is: a dark band, foliage or a ribbon;
 * Parnassusweg's 9.3 m runs read "1"), which takes the cascade to 25 of 33 right on windows (17 of 20 on axes), and
 * kept only when as many of its runs are window-sized (`minRunM`-`sizedM`) as it counts (Olympiaplein 067881's "2" was a
 * 2.0 m and a 0.3 m run): 17 of 20 right on windows, 11 of 13 on axes. The width the kit draws is the agreeing members'
 * median window-sized run (frames included); none over `maxWindowM` (a merged pair or an erker, not a window).
 */
export const COUNTED_READ = { maxRunM: 3.2, minRunM: 0.6, sizedM: 2.6, maxWindowM: 1.9 } as const;
/** A member's surviving count and its runs' widths (null: no capture survives, or they differ). */
export function memberCountedOf(m: MemberBays | null | undefined): { n: number; widths: number[]; captures: number } | null {
  const sized = (ws: number[]) => ws.filter(w => w >= COUNTED_READ.minRunM && w <= COUNTED_READ.sizedM);
  const ok = (m?.reads ?? []).filter(c => typeof c.cols === 'number' && Array.isArray(c.raw?.widthsM) && c.raw!.widthsM!.every(w => w <= COUNTED_READ.maxRunM) && sized(c.raw!.widthsM!).length === c.cols);
  if (!ok.length || new Set(ok.map(c => c.cols)).size !== 1) return null;
  return { n: ok[0].cols as number, widths: ok.flatMap(c => sized(c.raw!.widthsM!)), captures: ok.length };
}
/** A series' counted windows: the consensus of its members' surviving counts (seriesBaysOf's floors) and the agreeing
 *  members' median window width; null when there is no consensus or no width. */
export function seriesCountedOf(members: ReadonlyArray<MemberBays | null | undefined>): { n: number; widthM: number; read: number; agree: number } | null {
  const per = members.map(memberCountedOf), v = seriesBaysOf(per.map(p => p?.n ?? null), per.map(p => p?.captures ?? 0));
  if (!v) return null;
  const ws = per.filter(p => p?.n === v.bays).flatMap(p => p!.widths).sort((a, b) => a - b);
  if (!ws.length) return null;
  // Wider than a window: merged pairs or an unlisted erker, which the kit would draw as the wide windows round r lost on.
  const widthM = +(ws.length % 2 ? ws[ws.length >> 1] : (ws[ws.length / 2 - 1] + ws[ws.length / 2]) / 2).toFixed(2);
  if (widthM > COUNTED_READ.maxWindowM) return null;
  return { n: v.bays, widthM, read: v.read, agree: v.agree };
}

/** Round 19: the run counter. The pixel writer's gate needs a resolved pitch, which a front with a stair light beside
 *  wide paired windows never has (1,303 punched fronts rejected in round 18). This counts the window axes on the opening
 *  mask itself: a cell column is an axis column when openings fill at least `fill` of it in at least `storeys` of the
 *  upper storeys; axis columns closer than `mergeM` (a mullion or pier inside one window group) join; runs narrower than
 *  `minM` are noise. `narrowM`: a run this narrow beside wide ones is a stair light. Calibrated on hand counts
 *  (scripts/buurt-generators/bays-calibration.ts). */
export const AXES_RUN = { fill: 0.2, storeys: 0.5, mergeM: 0.3, minM: 0.3, narrowM: 0.9, wideM: 1.3, minUsable: 0.6 } as const;
/** The run counter's count is taken only when it holds at this stricter fill too (round 19 calibration, 30 hand-counted
 *  members: the round-18 gate gave 8 counts, 7 right; the gate then the stable run count gave 22, 18 right). */
export const AXES_STABLE_FILL = 0.3;

/** `centres`: each run's middle as a share of the crop, left to right as seen (the stair light's place). */
export interface AxesRead { axes: number; widthsM: number[]; centres: number[]; narrow: number; storeys: number }

/** The window axes of a measured crop's upper storeys, from its opening mask; null when too little is usable. */
export function axesOfMask(m: Pick<FacadeMeasurement, 'cols' | 'rows' | 'cell' | 'box' | 'mask'>, lines: readonly number[], topM: number, o: { [K in keyof typeof AXES_RUN]?: number } = {}): AxesRead | null {
  const P = { ...AXES_RUN, ...o };
  const MASK_UNUSABLE = 255, open = (v: number) => v === 1 || v === 3;
  const vOf = (r: number) => m.box.v1 - (r + 0.5) * m.cell; // row 0 at the top
  const bands: Array<[number, number]> = [];
  for (let k = 1; k < lines.length; k++) { const lo = lines[k], hi = Math.min(topM, lines[k + 1] ?? topM); if (hi - lo >= 1.5) bands.push([lo, hi]); }
  if (!bands.length) return null;
  const hits = new Array<number>(m.cols).fill(0); let used = 0;
  for (const [lo, hi] of bands) {
    let usable = 0, total = 0; const colOpen = new Array<number>(m.cols).fill(0), colUse = new Array<number>(m.cols).fill(0);
    for (let r = 0; r < m.rows; r++) { const v = vOf(r); if (v < lo || v >= hi) continue;
      for (let c = 0; c < m.cols; c++) { const x = m.mask[r * m.cols + c]; total++; if (x === MASK_UNUSABLE) continue; usable++; colUse[c]++; if (open(x)) colOpen[c]++; } }
    if (!total || usable / total < P.minUsable) continue;
    used++;
    for (let c = 0; c < m.cols; c++) if (colUse[c] && colOpen[c] / colUse[c] >= P.fill) hits[c]++;
  }
  if (!used) return null;
  const need = Math.max(1, Math.ceil(used * P.storeys)), isAxis = hits.map(h => h >= need);
  const runs: Array<[number, number]> = [];
  for (let c = 0; c < m.cols; c++) if (isAxis[c]) { const last = runs[runs.length - 1]; if (last && (c - last[1] - 1) * m.cell <= P.mergeM) last[1] = c; else runs.push([c, c]); }
  const kept = runs.filter(([a, b]) => (b - a + 1) * m.cell >= P.minM), span = m.cols * m.cell;
  const widthsM = kept.map(([a, b]) => +((b - a + 1) * m.cell).toFixed(2));
  const centres = kept.map(([a, b]) => +((m.box.u0 + (a + b + 1) / 2 * m.cell) / (m.box.u0 * 2 + span)).toFixed(3));
  const wide = widthsM.filter(w => w >= P.wideM).length;
  return { axes: widthsM.length, widthsM, centres, narrow: wide ? widthsM.filter(w => w < P.narrowM).length : 0, storeys: used };
}

/** A crop's count: the pixel writer's gate when it passes, else the run counter's when it is stable (the same at
 *  `AXES_STABLE_FILL`) and 1-8; null otherwise. `src` names which. */
export function baysOfCrop(measured: { m: FacadeMeasurement; lines: readonly number[]; topM: number }): { bays: number; src: 'pixel' | 'runs'; runs: AxesRead | null } | { bays: null; runs: AxesRead | null } {
  const runs = axesOfMask(measured.m, measured.lines, measured.topM), px = baysOfMeasure(measured.m);
  if (px !== null) return { bays: px, src: 'pixel', runs };
  const strict = runs ? axesOfMask(measured.m, measured.lines, measured.topM, { fill: AXES_STABLE_FILL }) : null;
  return runs && strict && runs.axes === strict.axes && runs.axes >= 1 && runs.axes <= BAYS_READ.maxBays ? { bays: runs.axes, src: 'runs', runs } : { bays: null, runs };
}

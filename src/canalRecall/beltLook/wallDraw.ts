/**
 * A district's walls drawn run by run (centrum-looks round 3, 2026-11-16).
 *
 * Round 2 drew a family per house (a weighted pick, 30 % kept from the left neighbour). The blind judges lost the look three
 * new Jordaan streets on it: Lindengracht 168662 ("colours alternate red, orange, tan and brown where the photo shows one
 * uniform grey-tan row"), Leidsekade 174376 (orange and tan where red-brown) and Bloemgracht 172858. Builders put up runs of
 * one brick; a street of one period reads as one wall with small house-to-house differences.
 *
 * Wall colour by judgement (David, 2026-11-14): a plausible brick or paint family from the neighbours, never a street held
 * on colour. A free front (no stated colour: see drawWalls in scripts/centrum-looks/generate.ts) takes its run's family:
 *  - a run is the row's consecutive free fronts of one period (before / from 1860); a series (one design) keeps one family
 *    wherever its members stand;
 *  - the run's family, first that applies:
 *    1. measured on the run: at least `runSamples` of its fronts carry a cut sample of their own: the family of the run's
 *       median sample, read absolutely (judgedColour brickFromSample, as the reads' own cuts are);
 *    2. the street's reads: the street's own D1 reads agree (`streetFamily`, measured by the caller: at least 3 reads and
 *       a majority of one family), paint included when the street's readers saw paint;
 *    3. the district's measured period weights (`before1860` / `from1860`, measuredWeights below), a hash of the run's
 *       first pand. These hold brick only: paint is drawn where it is read, stated or measured, never by lot.
 *  - each front then takes its own tone in the family (variedTone by pand id: L within about ±0.025), so a run is one wall
 *    with small differences, not one flat tint.
 * A front whose own read saw unpainted brick (`brickOnly`) never takes a paint family: it takes the run's brick pick.
 *
 * Round 4 (2026-11-16): the photo colour reader (opus on each front's panorama cut, scripts/centrum-looks/photo-reads.ts)
 * names a front's family where the register is silent (confidence >= 0.7). A read front takes its own family, paint or
 * stucco included (drawn where it reads paint), and is drawn even when the look's record called it plaster or paint; a
 * run whose read fronts mostly agree (at least 2, a majority) gives that family to its unread fronts, before samples.
 *
 * Pure: no fs.
 */
import { JUDGED_PALETTE, brickFromSample, lchOf, variedTone, type JudgedFamily } from '../houseSpec/judgedColour.ts';
import { hash32 } from './donors.ts';

export type Weights = Partial<Record<JudgedFamily, number>>;
export interface WallDrawConfig {
  before1860: Weights;
  from1860: Weights;
  /** Fronts of a run with their own sample needed to read the run from its samples. */
  runSamples: number;
  /** false: draw these weights as they stand (the generator still measures and reports); default true. */
  measure?: boolean;
  /** measuredWeights' prior strength, in reads (read by the generator). */
  priorN?: number;
  /** The prior the district's reads are pooled with: 'own' (this file's weights) or another district's id (its measured weights). */
  prior?: string;
}
export interface WallDrawFront {
  pandId: string; year: number | null; free: boolean; sample?: string;
  /** the front's own read saw unpainted brick: never a paint family */
  brickOnly?: boolean;
  /** the front's series (one design): one family wherever its members stand */
  series?: string;
  /** the street's own reads agree on this family (streetFamily below) */
  streetFamily?: JudgedFamily;
  /** the photo reader's family for this front (confidence >= 0.7, register silent), and whether it read stucco */
  photo?: JudgedFamily; photoStucco?: boolean;
}
/** `material`: 'painted-brick' for a paint family, else 'brick'. */
export interface WallDrawn { family: JudgedFamily; hex: string; material: 'brick' | 'painted-brick' | 'stucco'; by: 'photo' | 'run-photo' | 'run-sample' | 'street' | 'draw' | 'series'; why: string }
export const isBrickFamily = (f: JudgedFamily): boolean => f.endsWith('-brick');
export const periodOf = (y: number | null): 'before1860' | 'from1860' => (y !== null && y >= 1860 ? 'from1860' : 'before1860');

const unit = (s: string) => hash32(s) / 0xffffffff;
function weighted(dist: Weights, u: number): JudgedFamily {
  const entries = Object.entries(dist).filter(([f, w]) => (w ?? 0) > 0 && isBrickFamily(f as JudgedFamily)) as [JudgedFamily, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [f, w] of entries) { acc += w / total; if (u < acc) return f; }
  return entries[entries.length - 1][0];
}
const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const okSample = (s?: string) => !!s && /^#[0-9a-f]{6}$/i.test(s);

/**
 * One row's fronts in street order: a drawn wall for each free front, null for the rest (their judged wall stands).
 * `seriesFamily` carries a series' family across rows (pass one map for a whole district).
 */
export function drawRowWalls(fronts: readonly WallDrawFront[], cfg: WallDrawConfig, seriesFamily: Map<string, WallDrawn> = new Map()): (WallDrawn | null)[] {
  const runs: number[][] = [];
  const drawn = (f: WallDrawFront) => f.free || !!f.photo;
  fronts.forEach((f, i) => {
    if (!drawn(f)) return;
    const last = runs[runs.length - 1], prev = fronts[i - 1];
    if (last && last[last.length - 1] === i - 1 && periodOf(prev.year) === periodOf(f.year)) last.push(i);
    else runs.push([i]);
  });
  const out: (WallDrawn | null)[] = fronts.map(() => null);
  for (const run of runs) {
    const fr = run.map(i => fronts[i]), per = periodOf(fr[0].year);
    const brickPick = weighted(cfg[per], unit(`${fr[0].pandId}:run`));
    const samples = fr.filter(f => okSample(f.sample)).map(f => lchOf(f.sample!));
    let fam!: Omit<WallDrawn, 'hex' | 'material'>;
    const st = fr.find(f => f.streetFamily)?.streetFamily;
    const photos = fr.flatMap(f => (f.photo ? [f.photo] : [])), pf = photos.length >= 2 ? streetFamily(photos, 2) : null;
    if (pf) fam = { family: pf, by: 'run-photo', why: `${JUDGED_PALETTE[pf].label}: the run's photo reads (${photos.filter(x => x === pf).length} of ${photos.length})` };
    else if (samples.length >= cfg.runSamples) {
      const s = { L: median(samples.map(x => x.L)), C: median(samples.map(x => x.C)), h: median(samples.map(x => x.h)) };
      const f = brickFromSample(s);
      fam = { family: f, by: 'run-sample', why: `${JUDGED_PALETTE[f].label}: the run's ${samples.length} own cut samples, median L ${s.L.toFixed(2)} C ${s.C.toFixed(3)}` };
    } else if (st) fam = { family: st, by: 'street', why: `${JUDGED_PALETTE[st].label}: the street's own reads agree` };
    else fam = { family: brickPick, by: 'draw', why: `${JUDGED_PALETTE[brickPick].label} from the district's measured ${per === 'from1860' ? 'from-1860' : 'before-1860'} brick` };
    for (const i of run) {
      const f = fronts[i], s = f.series ? seriesFamily.get(f.series) : undefined;
      let d: Omit<WallDrawn, 'hex' | 'material'> = f.photo ? { family: f.photo, by: 'photo', why: `${JUDGED_PALETTE[f.photo].label}: its own photo read` }
        : s ? { family: s.family, by: 'series', why: `its series' ${JUDGED_PALETTE[s.family].label}` } : fam;
      if (!f.photo && f.brickOnly && !isBrickFamily(d.family)) d = { family: brickPick, by: 'draw', why: `${JUDGED_PALETTE[brickPick].label}: its own read saw brick where its run is painted` };
      const material = isBrickFamily(d.family) ? 'brick' : f.photo && f.photoStucco ? 'stucco' : 'painted-brick';
      const w: WallDrawn = { ...d, hex: variedTone(d.family, f.pandId), material };
      if (f.series && !s) seriesFamily.set(f.series, w);
      out[i] = w;
    }
  }
  return out;
}

/** One read's evidence for the weights: its period's year and the family its judgement says. */
export interface WeightEvidence { year: number | null; family: JudgedFamily }
/**
 * The district's period weights measured from its own reads (centrum-looks round 3): the brick families its readers' cut
 * samples say (judgeFront absolute mode: brickFromSample), pooled with a prior worth `priorN` reads. Paint families are
 * counted out (paint is drawn only where read, stated or measured). A period with no reads takes the prior.
 */
export function measuredWeights(evidence: readonly WeightEvidence[], prior: { before1860: Weights; from1860: Weights }, priorN: number) {
  const res = { before1860: {} as Weights, from1860: {} as Weights, n: { before1860: 0, from1860: 0 } };
  for (const per of ['before1860', 'from1860'] as const) {
    const counts: Weights = {};
    for (const e of evidence) if (periodOf(e.year) === per && isBrickFamily(e.family)) { counts[e.family] = (counts[e.family] ?? 0) + 1; res.n[per]++; }
    const pr = prior[per], prTotal = Object.entries(pr).filter(([f]) => isBrickFamily(f as JudgedFamily)).reduce((s, [, w]) => s + (w ?? 0), 0) || 1;
    const fams = [...new Set([...Object.keys(counts), ...Object.keys(pr)])].filter(f => isBrickFamily(f as JudgedFamily)).sort() as JudgedFamily[];
    const total = res.n[per] + priorN;
    for (const f of fams) { const w = ((counts[f] ?? 0) + priorN * ((pr[f] ?? 0) / prTotal)) / total; if (w > 0) res[per][f] = +w.toFixed(3); }
  }
  return res;
}

/**
 * The street's family from its own reads (centrum-looks round 3): at least `minReads` reads and one family held by more
 * than half of them, else null. Each read's family is its judgement (judgeFront, absolute mode), paint included.
 */
export function streetFamily(families: readonly JudgedFamily[], minReads = 3): JudgedFamily | null {
  if (families.length < minReads) return null;
  const c = new Map<JudgedFamily, number>();
  for (const f of families) c.set(f, (c.get(f) ?? 0) + 1);
  const [f, n] = [...c].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return n * 2 > families.length ? f : null;
}

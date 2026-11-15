/**
 * A district's brick drawn house by house (centrum-looks round 2, 2026-11-16). The Jordaan round-1 judges called the look's
 * brick "too dark and uniform" (Westerkade 174838, Rozengracht 168914, Marnixstraat 172599, Noordermarkt 167748): its
 * cut samples are underexposed panorama captures read absolutely (judgedColour brickFromSample), so 1,638 fronts drew
 * near-black dark-grey-brick at one tone per series.
 *
 * Wall colour by judgement (David, 2026-11-14): a plausible brick or paint family from the neighbours, never a street
 * held on colour. A front with no stated colour (brick, not pale, no colour or dark word, no stated finish or spec hex):
 *  1. with its own photo sample and at least `minSamples` samples within `window` fronts in its row: the family from
 *     the sample's lightness against that local median (judgeFront's relative mode: darker steps to purple-brown,
 *     lighter and red to orange-red, much lighter and yellow to buff), never its absolute value;
 *  2. else the previous drawn front's family with probability `keepRun` (builders' runs of one brick), else a weighted
 *     pick from the district's period distribution (`before1860` / `from1860`), a hash of the pand id.
 * Every front then takes its own tone in the family (variedTone by pand id), so a series is not one flat tint.
 *
 * Pure: no fs.
 */
import { JUDGED_PALETTE, judgeFront, lchOf, variedTone, type JudgedFamily } from '../houseSpec/judgedColour.ts';
import { hash32 } from './donors.ts';

export interface WallDrawConfig {
  before1860: Partial<Record<JudgedFamily, number>>;
  from1860: Partial<Record<JudgedFamily, number>>;
  keepRun: number;
  window: number;
  minSamples: number;
}
/** `brickOnly`: the front's own read saw unpainted brick, so the draw keeps to brick families (paint goes to donor-filled fronts). */
export interface WallDrawFront { pandId: string; year: number | null; free: boolean; sample?: string; brickOnly?: boolean }
/** `material`: 'painted-brick' for a paint family, else 'brick'. */
export interface WallDrawn { family: JudgedFamily; hex: string; material: 'brick' | 'painted-brick'; by: 'sample' | 'run' | 'draw'; why: string }
export const isBrickFamily = (f: JudgedFamily): boolean => f.endsWith('-brick');

const unit = (s: string) => hash32(s) / 0xffffffff;
function weighted(dist: Partial<Record<JudgedFamily, number>>, u: number): JudgedFamily {
  const entries = Object.entries(dist).filter(([, w]) => (w ?? 0) > 0) as [JudgedFamily, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [f, w] of entries) { acc += w / total; if (u < acc) return f; }
  return entries[entries.length - 1][0];
}
const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** One row's fronts in street order: a drawn wall for each free front, null for the rest (their judged wall stands). */
export function drawRowWalls(fronts: readonly WallDrawFront[], cfg: WallDrawConfig): (WallDrawn | null)[] {
  const L = fronts.map(f => (f.sample && /^#[0-9a-f]{6}$/i.test(f.sample) ? lchOf(f.sample).L : null));
  const out: (WallDrawn | null)[] = [];
  let prev: JudgedFamily | null = null;
  fronts.forEach((f, i) => {
    if (!f.free) { out.push(null); prev = null; return; }
    let drawn: Omit<WallDrawn, 'hex' | 'material'> | null = null;
    if (L[i] !== null) {
      const near = L.slice(Math.max(0, i - cfg.window), Math.min(L.length, i + cfg.window + 1)).filter((x): x is number => x !== null);
      if (near.length >= cfg.minSamples) {
        const j = judgeFront({ pandId: f.pandId, readable: true, finish: 'brick', pale: false, notes: null, year: f.year, sample: f.sample }, median(near));
        drawn = { family: j.family, by: 'sample', why: j.why };
      }
    }
    if (!drawn) {
      const dist0 = f.year !== null && f.year >= 1860 ? cfg.from1860 : cfg.before1860;
      const dist = f.brickOnly ? Object.fromEntries(Object.entries(dist0).filter(([k]) => isBrickFamily(k as JudgedFamily))) as typeof dist0 : dist0;
      if (prev && (!f.brickOnly || isBrickFamily(prev)) && unit(`${f.pandId}:run`) < cfg.keepRun) drawn = { family: prev, by: 'run', why: `the neighbour's ${JUDGED_PALETTE[prev].label}` };
      else { const fam = weighted(dist, unit(`${f.pandId}:draw`)); drawn = { family: fam, by: 'draw', why: `${JUDGED_PALETTE[fam].label} from the district's ${f.year !== null && f.year >= 1860 ? 'from-1860' : 'before-1860'} brick` }; }
    }
    prev = drawn.family;
    out.push({ ...drawn, hex: variedTone(drawn.family, f.pandId), material: isBrickFamily(drawn.family) ? 'brick' : 'painted-brick' });
  });
  return out;
}

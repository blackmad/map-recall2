/**
 * Landmark triage (GitHub #110): the buildable list before any modelling. Pure rules, no I/O and no LLM call; the CLI
 * `scripts/landmarks/triage.ts` gathers the facts (BAG, 3DBAG tiles, covers, the archived street-wall crops and their
 * measurement) and this module decides.
 *
 * Every evidence threshold is the likeness judge's own (`LIKENESS` in buildingRecipe/likeness.ts), so a wall triage
 * calls judgeable is a wall the judge will not abstain on, and a wall it rejects is one the judge would answer
 * NO EVIDENCE for. The front classes the kit expresses today are `punched`, `columns` and `ribbon`
 * (measureFacade `FrontClass`); a `curtain` front fails the judge ("wall not drawn", #105 §4.1) and is a kit gap.
 */
import {LIKENESS} from '../buildingRecipe/likeness.ts';
import {cropPredatesBuilding} from '../buildingRecipe/measureWriteback.ts';
import type {FrontClass} from '../buildingRecipe/measureFacade.ts';

export type TriageVerdict = 'buildable' | 'kit-gap' | 'no-evidence' | 'not-in-tiles' | 'covered' | 'bespoke';
export const TRIAGE_VERDICTS: readonly TriageVerdict[] = ['buildable', 'kit-gap', 'no-evidence', 'not-in-tiles', 'covered', 'bespoke'];
/** Front classes the large-recipe kit draws and the judge can pass today. */
export const KIT_FRONT_CLASSES: ReadonlySet<FrontClass> = new Set<FrontClass>(['punched', 'columns', 'ribbon']);
/** Street walls with a judgeable crop a building needs before an Opus turn is spent on it. */
export const MIN_JUDGEABLE_STREET_WALLS = 2;
/** A street wall at least this long with no judgeable crop draws blank and holds the review (LIKENESS.wideWallM). */
export const LONG_BLANK_WALL_M = LIKENESS.wideWallM;
/** Built before this year, or a rijksmonument: an ornamented historic front, the bespoke track (Hirsch 1912, Academie van Bouwkunst). */
export const BESPOKE_BUILT_BEFORE = 1915;

/** One archived crop of one exposed wall (`pand-reference-walls/<pand>/walls.json` row), plus its measurement. */
export interface WallCrop {
  tag: string; lengthM: number; crop: boolean;
  capturedAt?: string | null; cameraDistM?: number | null; obliquityDeg?: number | null;
  foliage?: number | null; washedOut?: number | null; missingFraction?: number | null;
  /** from measureFacade on the crop where it ran: usable share of the upper cells, and the class of the front */
  usable?: number | null; frontClass?: FrontClass | null; family?: string | null; glazing?: number | null;
  /** measureWriteback `curtainEvidence` on a curtain reading: why the curtain class is not trusted (empty = trusted) */
  curtainDoubt?: string[];
}
export interface WallInput { wall: string; lengthM: number; street: string | null; crops: WallCrop[] }
export interface WallEvidence {
  wall: string; lengthM: number; street: string | null; judgeable: boolean;
  /** the crop judged (best judgeable, else the straightest) and why it abstains (empty when judgeable) */
  crop: string | null; reasons: string[]; frontClass: FrontClass | null; family: string | null;
}

/** Why the judge would abstain on this crop (empty = judgeable), the likeness judge's thresholds verbatim. */
export function cropAbstains(c: WallCrop, builtYear: number | null): string[] {
  const why: string[] = [];
  if (!c.crop) return ['no crop'];
  const usable = c.usable ?? (c.missingFraction != null ? 1 - c.missingFraction : null);
  if (usable != null && usable < LIKENESS.minUsable) why.push(`usable ${pct(usable)} % < ${pct(LIKENESS.minUsable)} %`);
  if ((c.foliage ?? 0) > LIKENESS.maxFoliage) why.push(`foliage ${pct(c.foliage!)} % > ${pct(LIKENESS.maxFoliage)} %`);
  if ((c.washedOut ?? 0) > LIKENESS.maxWashedOut) why.push(`washed out ${pct(c.washedOut!)} % > ${pct(LIKENESS.maxWashedOut)} %`);
  if ((c.obliquityDeg ?? 0) > LIKENESS.maxObliquityDeg) why.push(`obliquity ${Math.round(c.obliquityDeg!)} deg > ${LIKENESS.maxObliquityDeg}`);
  if ((c.cameraDistM ?? 99) < LIKENESS.minCameraM && c.lengthM > LIKENESS.wideWallM) why.push(`camera ${c.cameraDistM} m < ${LIKENESS.minCameraM} m from a ${Math.round(c.lengthM)} m wall`);
  if (cropPredatesBuilding(c.capturedAt, builtYear)) why.push(`crop ${c.capturedAt?.slice(0, 4)} predates the ${builtYear} building`);
  return why;
}
const pct = (f: number) => Math.round(f * 100);

/** The evidence for one wall: its best judgeable crop (straightest first), else the straightest crop's reasons. */
export function judgeWall(w: WallInput, builtYear: number | null): WallEvidence {
  const crops = w.crops.filter(c => c.crop).sort((a, b) => (a.obliquityDeg ?? 90) - (b.obliquityDeg ?? 90));
  const judged = crops.map(c => ({c, why: cropAbstains(c, builtYear)}));
  const best = judged.find(j => !j.why.length) ?? judged[0];
  if (!best) return {wall: w.wall, lengthM: w.lengthM, street: w.street, judgeable: false, crop: null, reasons: ['no crop'], frontClass: null, family: null};
  // an untrusted curtain reading (glass that does not read as glass, the judge's own test) leaves the class unmeasured
  const doubt = best.c.frontClass === 'curtain' && best.c.curtainDoubt?.length ? best.c.curtainDoubt : null;
  return {wall: w.wall, lengthM: w.lengthM, street: w.street, judgeable: !best.why.length, crop: best.c.tag, reasons: doubt ? [`curtain reading untrusted: ${doubt.join('; ')}`] : best.why,
    frontClass: best.why.length || doubt ? null : best.c.frontClass ?? null, family: best.why.length ? null : best.c.family ?? null};
}

export interface TriageInput {
  /** identity problems that drop the candidate (an underground station, a building:part sum, a name merge) */
  dropped?: string[];
  inTiles: boolean; covered: string | null;
  builtYear: number | null; rijksmonument?: boolean;
  heightM: number | null;
  /** the crops stop under the wall top (rectify.ts `wallHeight` cap) */
  cropCapped: boolean; cropTopM?: number | null;
  walls: WallInput[];
}
export interface TriageResult { verdict: TriageVerdict; reasons: string[]; gaps: string[]; walls: WallEvidence[] }

/** Gap name for a front class the kit cannot pass. */
const classGap = (c: FrontClass) => c === 'curtain' ? 'curtain' : c === 'blank' ? 'blank-front' : c;

export function triageCandidate(t: TriageInput): TriageResult {
  const out = (verdict: TriageVerdict, reasons: string[], gaps: string[] = [], walls: WallEvidence[] = []): TriageResult => ({verdict, reasons, gaps, walls});
  if (t.dropped?.length) return out('no-evidence', t.dropped.map(d => `identity: ${d}`));
  if (!t.inTiles) return out('not-in-tiles', ['pand not in the building tiles: crops and facts cannot run']);
  if (t.covered) return out('covered', [`already drawn by ${t.covered}`]);
  if (t.rijksmonument || (t.builtYear != null && t.builtYear < BESPOKE_BUILT_BEFORE))
    return out('bespoke', [t.rijksmonument ? 'rijksmonument: ornament carries the likeness' : `built ${t.builtYear} (< ${BESPOKE_BUILT_BEFORE}): ornamented historic front`]);
  const walls = t.walls.map(w => judgeWall(w, t.builtYear));
  // street walls are what the judge holds a review on; with no street named nearby every exposed wall counts
  const street = walls.some(w => w.street) ? walls.filter(w => w.street) : walls;
  const ok = street.filter(w => w.judgeable);
  const reasons: string[] = [], gaps: string[] = [];
  if (t.cropCapped) { gaps.push('tower'); reasons.push(`height ${t.heightM} m over the crop cap: crops stop at ${t.cropTopM ?? '?'} m, the upper storeys have no evidence`); }
  // a front class names a gap on a wide street wall (LIKENESS.wideWallM); a short stair or entrance bay is noted only
  for (const w of ok) if (w.frontClass && !KIT_FRONT_CLASSES.has(w.frontClass)) {
    if (w.lengthM < LIKENESS.wideWallM) { reasons.push(`${w.wall} (${Math.round(w.lengthM)} m, short) reads ${w.frontClass}: noted, not a gap`); continue; }
    const g = classGap(w.frontClass);
    if (!gaps.includes(g)) gaps.push(g);
    reasons.push(`${w.wall} (${w.street ?? 'no street'}, ${Math.round(w.lengthM)} m) reads ${w.frontClass}`);
  }
  if (gaps.length) return out('kit-gap', reasons.filter(r => !r.endsWith('noted, not a gap')), gaps, walls);
  const blank = street.filter(w => !w.judgeable && w.lengthM >= LONG_BLANK_WALL_M);
  if (ok.length < MIN_JUDGEABLE_STREET_WALLS || blank.length) {
    reasons.push(`${ok.length} of ${street.length} street walls judgeable (need ${MIN_JUDGEABLE_STREET_WALLS}, and every street wall >= ${LONG_BLANK_WALL_M} m)`);
    for (const w of street.filter(x => !x.judgeable)) reasons.push(`${w.wall} (${w.street ?? 'no street'}, ${Math.round(w.lengthM)} m): ${w.reasons.join('; ')}`);
    return out('no-evidence', reasons, [], walls);
  }
  if (ok.some(w => !w.frontClass)) reasons.push('front class unmeasured on some judgeable walls (no measurement)');
  reasons.push(`${ok.length} judgeable street walls: ${ok.map(w => `${w.wall} ${w.frontClass ?? '?'}`).join(', ')}`);
  return out('buildable', reasons, [], walls);
}

/** A wall faces a street when a routing path passes within `maxM` of its midpoint on its outward side (RD metres). */
export function wallFacesStreet(mid: [number, number], normal: [number, number], path: [number, number][], maxM = 30): number | null {
  let best: number | null = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const s = Math.max(0, Math.min(1, ((mid[0] - a[0]) * dx + (mid[1] - a[1]) * dy) / l2));
    const px = a[0] + s * dx - mid[0], py = a[1] + s * dy - mid[1], d = Math.hypot(px, py);
    if (d > maxM || px * normal[0] + py * normal[1] <= 0) continue;
    if (best === null || d < best) best = d;
  }
  return best;
}

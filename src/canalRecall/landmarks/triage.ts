/**
 * Landmark triage (GitHub #110): the buildable list before any modelling. Pure rules, no I/O and no LLM call; the CLI
 * `scripts/landmarks/triage.ts` gathers the facts (BAG, 3DBAG tiles, covers, the archived street-wall crops and their
 * measurement) and this module decides.
 *
 * Every evidence threshold is the likeness judge's own (`LIKENESS` in buildingRecipe/likeness.ts), so a wall triage
 * calls judgeable is a wall the judge will not abstain on, and a wall it rejects is one the judge would answer
 * NO EVIDENCE for. The front classes the kit expresses today are `punched`, `columns` and `ribbon`
 * (measureFacade `FrontClass`); a `curtain` front is buildable only where the crop shows floor bands the kit draws
 * (floorBands.ts, #116), else a kit gap.
 *
 * Round 2 of the landmark lane (#119) reviewed 20 pands this module called buildable; the holds that the measured crop
 * already decided are kit gaps now, each on a judgeable wide street wall (a short bay is noted only):
 * - `painted-or-clad`: the wall family is unresolved (measureFacade `material.basis` 'unresolved': dark, neutral, no
 *   brick courses, the likeness judge's "brick courses not resolved") on the building's main front (its longest
 *   judgeable street wall >= PAINTED_WALL_M), or on at least PAINTED_SHARE of its judgeable street-wall length: a
 *   painted or metal-clad shed or retail front the kit draws as brick. Per wall it is not decisive: a dark brick
 *   front in shade reads unresolved too (Molenwerf 066028 w04, De Klencke 094874 w04/w08, both installed passes);
 * - `band`: a ribbon storey (an opening >= ROW_OPENINGS.ribbonM) the kit cannot draw: over a punched row on another
 *   storey of the same crop (rowOpenings `ribbonAgainstPunched`, the `rowMismatch` test run within the photo), or on a
 *   wall whose front class is a grid (punched/columns: the kit draws punched windows under the ribbon, which is the
 *   judge's `rowMismatch`): balcony bands, ribbon glazing or a shopfront strip;
 * - `open-deck`: glazing under OPEN_DECK_GLAZING, no brick courses, on a pand whose use is parking (BAG
 *   `overige gebruiksfunctie` alone, or an OSM parking tag): an open parking deck, no wall to draw;
 * - `curtain` (see above).
 * The tower gap reads the archived crop's own height (walls.json `wallHeightM`, an `all-walls.ts --max-height` crop
 * included): a building is a tower gap only when no judgeable street crop covers TOWER_COVER of its height.
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
/** A street wall this long with an unresolved wall family is a painted or clad front (#119: sheds and retail halls 12 m and up). */
export const PAINTED_WALL_M = 12;
/** ... or this share of the judgeable street-wall length (>= PAINTED_WALL_M walls) reads unresolved. */
export const PAINTED_SHARE = 0.5;
/** Front classes the kit draws as a window grid: a ribbon storey on one is drawn as punched windows (rowMismatch). */
const GRID_CLASSES: ReadonlySet<FrontClass> = new Set<FrontClass>(['punched', 'columns']);
/** Upper-storey glazing under this on a parking pand: an open deck, not a wall with windows (#119, 241496 walls[0]). */
export const OPEN_DECK_GLAZING = 0.05;
/** A judgeable street crop must cover this share of the tile height, else the upper storeys have no evidence (tower gap). */
export const TOWER_COVER = 0.8;
/** BAG use that marks a parking building: a parkeergarage carries `overige gebruiksfunctie` alone; or an OSM parking tag. */
export const isParkingUse = (use: string | null | undefined) => !!use && (/^\s*overige gebruiksfunctie\s*$/i.test(use) || /\bparking\b|parkeer/i.test(use));

/** One archived crop of one exposed wall (`pand-reference-walls/<pand>/walls.json` row), plus its measurement. */
export interface WallCrop {
  tag: string; lengthM: number; crop: boolean;
  capturedAt?: string | null; cameraDistM?: number | null; obliquityDeg?: number | null;
  foliage?: number | null; washedOut?: number | null; missingFraction?: number | null;
  /** from measureFacade on the crop where it ran: usable share of the upper cells, and the class of the front */
  usable?: number | null; frontClass?: FrontClass | null; family?: string | null; glazing?: number | null;
  /** measureFacade `material.basis`: 'courses' (brick courses read), 'colour', 'smooth' or 'unresolved' */
  basis?: string | null;
  /** storeys where a ribbon lies over a punched row of another storey of this crop (rowOpenings `ribbonAgainstPunched`) */
  bandStoreys?: {storey: number; againstStorey: number; ribbonM: number}[] | null;
  /** window storeys with an opening >= ROW_OPENINGS.ribbonM (rowOpenings, the photo's wall-coloured cells cut) */
  ribbonStoreys?: number[] | null;
  /** a curtain crop: floorBands.ts `measureFloorBands` proposes bands (the kit draws them, #116) */
  floorBands?: boolean | null;
  /** the crop's height above its base (walls.json `wallHeightM`; rectify.ts cap) */
  wallHeightM?: number | null;
  /** measureWriteback `curtainEvidence` on a curtain reading: why the curtain class is not trusted (empty = trusted) */
  curtainDoubt?: string[];
}
export interface WallInput { wall: string; lengthM: number; street: string | null; crops: WallCrop[] }
export interface WallEvidence {
  wall: string; lengthM: number; street: string | null; judgeable: boolean;
  /** the crop judged (best judgeable, else the straightest) and why it abstains (empty when judgeable) */
  crop: string | null; reasons: string[]; frontClass: FrontClass | null; family: string | null;
  basis?: string | null; glazing?: number | null; bandStoreys?: WallCrop['bandStoreys']; ribbonStoreys?: number[] | null; floorBands?: boolean | null; wallHeightM?: number | null;
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

/** Crop order for judging: the tallest crop first (a `--max-height` tower crop over the 32 m one), then the straightest. */
export const cropOrder = (a: WallCrop, b: WallCrop) => (b.wallHeightM ?? 0) - (a.wallHeightM ?? 0) || (a.obliquityDeg ?? 90) - (b.obliquityDeg ?? 90);

/** The evidence for one wall: its best judgeable crop (tallest, then straightest), else the straightest crop's reasons. */
export function judgeWall(w: WallInput, builtYear: number | null): WallEvidence {
  const crops = w.crops.filter(c => c.crop).sort(cropOrder);
  const judged = crops.map(c => ({c, why: cropAbstains(c, builtYear)}));
  const best = judged.find(j => !j.why.length) ?? [...judged].sort((a, b) => (a.c.obliquityDeg ?? 90) - (b.c.obliquityDeg ?? 90))[0];
  if (!best) return {wall: w.wall, lengthM: w.lengthM, street: w.street, judgeable: false, crop: null, reasons: ['no crop'], frontClass: null, family: null};
  // an untrusted curtain reading (glass that does not read as glass, the judge's own test) leaves the class unmeasured
  const doubt = best.c.frontClass === 'curtain' && best.c.curtainDoubt?.length ? best.c.curtainDoubt : null;
  return {wall: w.wall, lengthM: w.lengthM, street: w.street, judgeable: !best.why.length, crop: best.c.tag, reasons: doubt ? [`curtain reading untrusted: ${doubt.join('; ')}`] : best.why,
    frontClass: best.why.length || doubt ? null : best.c.frontClass ?? null, family: best.why.length ? null : best.c.family ?? null,
    ...(best.why.length ? {} : {basis: best.c.basis ?? null, glazing: best.c.glazing ?? null, bandStoreys: best.c.bandStoreys ?? null, ribbonStoreys: best.c.ribbonStoreys ?? null, floorBands: best.c.floorBands ?? null}), wallHeightM: best.c.wallHeightM ?? null};
}

export interface TriageInput {
  /** identity problems that drop the candidate (an underground station, a building:part sum, a name merge) */
  dropped?: string[];
  inTiles: boolean; covered: string | null;
  builtYear: number | null; rijksmonument?: boolean;
  heightM: number | null;
  /** BAG use (verblijfsobject gebruiksdoel list) or an OSM building/amenity tag, where known: `isParkingUse` */
  use?: string | null;
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
  // the tower gap: no judgeable street crop reaches TOWER_COVER of the tile height (the crop's own wallHeightM)
  if (t.heightM != null) {
    const tallest = Math.max(0, ...(ok.length ? ok : street).map(w => w.wallHeightM ?? 0));
    if (tallest < TOWER_COVER * t.heightM) { gaps.push('tower'); reasons.push(`height ${t.heightM} m: the tallest ${ok.length ? 'judgeable ' : ''}street crop reaches ${tallest ? `${tallest} m` : '?'} (< ${Math.round(TOWER_COVER * 100)} %), the upper storeys have no evidence`); }
  }
  const gap = (g: string, why: string) => { if (!gaps.includes(g)) gaps.push(g); reasons.push(why); };
  const parking = isParkingUse(t.use);
  // a front class names a gap on a wide street wall (LIKENESS.wideWallM); a short stair or entrance bay is noted only
  for (const w of ok) {
    const at = `${w.wall} (${w.street ?? 'no street'}, ${Math.round(w.lengthM)} m)`;
    if (w.frontClass && !KIT_FRONT_CLASSES.has(w.frontClass)) {
      if (w.lengthM < LIKENESS.wideWallM) reasons.push(`${w.wall} (${Math.round(w.lengthM)} m, short) reads ${w.frontClass}: noted, not a gap`);
      else if (w.frontClass === 'curtain' && w.floorBands) reasons.push(`${at} reads curtain with measured floor bands: the kit draws them (floorBands.ts)`);
      else gap(classGap(w.frontClass), `${at} reads ${w.frontClass}${w.frontClass === 'curtain' ? ' without floor bands' : ''}`);
    }
    if (parking && w.lengthM >= LIKENESS.wideWallM && w.glazing != null && w.glazing < OPEN_DECK_GLAZING && w.basis !== 'courses')
      gap('open-deck', `${at} glazing ${w.glazing.toFixed(2)} < ${OPEN_DECK_GLAZING}, no brick courses, on a parking pand (${t.use}): an open deck`);
    const b = w.bandStoreys?.[0], rib = w.frontClass && GRID_CLASSES.has(w.frontClass) ? w.ribbonStoreys ?? [] : [];
    if (b || rib.length) {
      const why = b ? `${at} storey ${b.storey} has a ${b.ribbonM.toFixed(1)} m ribbon over punched windows on storey ${b.againstStorey}: bands (balconies, ribbons, a shopfront strip)`
        : `${at} reads ${w.frontClass} with a ribbon on storey ${rib.join(', ')}: the kit draws windows under it (bands, balconies, a shopfront strip)`;
      if (w.lengthM < LIKENESS.wideWallM) reasons.push(`${why}; short wall: noted, not a gap`); else gap('band', why);
    }
  }
  // painted or clad: unresolved on the main front, or on PAINTED_SHARE of the judgeable street-wall length
  const wide = ok.filter(w => w.lengthM >= PAINTED_WALL_M), main = [...wide].sort((a, b) => b.lengthM - a.lengthM)[0];
  const unresolved = wide.filter(w => w.basis === 'unresolved'), total = wide.reduce((x, w) => x + w.lengthM, 0), share = total ? unresolved.reduce((x, w) => x + w.lengthM, 0) / total : 0;
  if (main && !gaps.includes('open-deck') && (main.basis === 'unresolved' || share >= PAINTED_SHARE))
    gap('painted-or-clad', `wall family unresolved (dark, neutral, brick courses not resolved) on ${main.basis === 'unresolved' ? `the main front ${main.wall} (${main.street ?? 'no street'}, ${Math.round(main.lengthM)} m)` : ''}${main.basis === 'unresolved' && share < 1 ? ', ' : ''}${Math.round(share * 100)} % of ${Math.round(total)} m of street wall (${unresolved.map(w => w.wall).join(', ')}): painted or clad`);
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

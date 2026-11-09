/**
 * Type drafting (city-coverage plan C2 row 2, B6.2): turn the review of a house type from authoring into editing.
 *
 * A "family" is a cluster of pands that one type should describe: the same build-year band, storey count and frontage
 * width band (all read from the buurt survey, so clustering needs no photo). The drafter takes the measured samples of a
 * family's pands (one `PandMeasure` per pand span of a rectified strip), computes median lines across them and emits a
 * `HouseTypeIntent` plus a `draft` block that carries, for every number, where it came from (n, median, quartiles, range).
 *
 * Rules that keep a draft honest:
 *   - fewer than `minSamples` pands (default 8) or fewer than `minFaces` block faces (default 3) is refused: a median of
 *     five pands on one face is that face, not a family ("never tune for one face");
 *   - a field is written only when at least `minShare` of the samples measured it and its spread is under the field's
 *     limit; otherwise it is left out and listed under `draft.omitted` with the reason;
 *   - what the photo measurement cannot say (pane layout, window head kind, cornice kind, crown kind, ground variants,
 *     roof material) is filled with a neutral placeholder and listed under `draft.unmeasured` for the review turn.
 *
 * Pure: no I/O. The strip measurement is scripts/block-face/draft-type.ts; the storey profile below reads a
 * `measureFacade` opening mask.
 */
import type {HouseTypeIntent} from './houseType.ts';

export const DRAFT = {
  minSamples: 8, minFaces: 3, minShare: 0.6,
  /** Width bands (m) of the frontage used to cluster families and to write `match.baysByWidth`. */
  widthBands: [4.9, 6.4, 8] as readonly number[],
  yearBin: 5,
  /** Spread limits (interquartile range) over which a measured line is not a family line. Set from the spreads of the two authored-type self-tests (Kinkerstraat 75 pands, Jan Evertsenstraat 20) before any buurt was drafted. */
  maxColourSpread: 40,
  maxIqr: {storeyM: 0.6, groundM: 1.0, windowH: 0.2, headLine: 0.15, eavesM: 1.2, bays: 1},
} as const;

export interface PandRecord { pandId: string; face: string | null; builtYear: number | null; storeys3dbag: number | null; frontWidthM: number | null; eavesM: number | null }

/** Per-storey reading of one pand's openings (storeys above the ground storey; index 0 = first floor). */
export interface StoreyProfile {
  /** Floor lines above the ground (m): [ground top, 1st/2nd floor, ..., ] one per upper storey, and the eaves. */
  floorM: number[];
  sillM: number[]; headM: number[];
  /** Window rows' extent as a share of the storey height, and the head line as a share of it. */
  windowShare: number[]; headShare: number[];
}

export interface PandMeasure {
  pandId: string; face: string; builtYear: number | null;
  /** Storeys incl. the ground storey: the window storeys the strip shows when read, else the 3DBAG count. */
  storeys: number; storeys3dbag: number | null; widthM: number; eavesM: number;
  /** Eaves the strip skyline read under clean sky (null: unread). */
  skylineEavesM: number | null; crown: {widthM: number; riseM: number} | null;
  /** Window columns counted on the opening mask, and the bay pitch `measureFacade` autocorrelated. */
  windowCols: number | null; pitchColumns: number | null;
  windowWidthM: number | null;
  storey: StoreyProfile | null;
  glazing: number | null;
  palette: {wall: string | null; accent: string | null; frame: string | null; band: string | null; cornice: string | null; stucco: boolean};
  bandRunsM: [number, number][];
  /** 3DBAG roof shape of the pand ('slanted' | 'horizontal' | ...), when the facts had it. */
  roofType: string | null;
}

export interface Stat { n: number; median: number; p25: number; p75: number; min: number; max: number }
export interface ColourStat { n: number; hex: string; /** median RGB distance of the samples from the median colour */ spread: number; max: number }
export interface Provenance { source: string; stat?: Stat; colour?: ColourStat; share?: number; note?: string }

const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const q = (s: number[], p: number) => { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const round = (v: number, d = 2) => +v.toFixed(d);

export function stat(values: (number | null | undefined)[], d = 2): Stat | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!v.length) return null;
  const s = sorted(v);
  return {n: s.length, median: round(q(s, 0.5), d), p25: round(q(s, 0.25), d), p75: round(q(s, 0.75), d), min: round(s[0], d), max: round(s[s.length - 1], d)};
}
export const iqr = (s: Stat) => s.p75 - s.p25;

const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const rgbHex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export function colourStat(hexes: (string | null | undefined)[]): ColourStat | null {
  const v = hexes.filter((h): h is string => !!h && /^#[0-9a-f]{6}$/i.test(h)).map(hexRgb);
  if (v.length < 3) return null;
  const med = [0, 1, 2].map(c => q(sorted(v.map(p => p[c])), 0.5));
  const dist = v.map(p => Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]));
  return {n: v.length, hex: rgbHex(med), spread: round(q(sorted(dist), 0.5), 1), max: round(Math.max(...dist), 1)};
}

const mode = (v: number[]) => { const c = new Map<number, number>(); v.forEach(x => c.set(x, (c.get(x) ?? 0) + 1)); return [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]; };

/** Frontage width band label (the same bands everywhere: survey listing, clustering, `match.baysByWidth`). */
export function widthBand(w: number, bands: readonly number[] = DRAFT.widthBands): string {
  const i = bands.findIndex(b => w < b);
  return i < 0 ? `${bands[bands.length - 1]}+` : i === 0 ? `<${bands[0]}` : `${bands[i - 1]}-${bands[i]}`;
}

export interface FamilyKey { yearFrom: number; yearTo: number; storeys: number; width: string }
export const familyId = (k: FamilyKey) => `${k.yearFrom}-${k.yearTo}:${k.storeys}:${k.width}`;
export function parseFamilyId(id: string): FamilyKey {
  const m = /^(\d{4})-(\d{4}):(\d+):(.+)$/.exec(id);
  if (!m) throw Error(`family id "${id}": expected <yearFrom>-<yearTo>:<storeys>:<width band>, e.g. 1910-1914:5:4.9-6.4`);
  return {yearFrom: +m[1], yearTo: +m[2], storeys: +m[3], width: m[4]};
}
export const inFamily = (p: Pick<PandRecord, 'builtYear' | 'storeys3dbag' | 'frontWidthM'>, k: FamilyKey): boolean =>
  p.builtYear !== null && p.storeys3dbag !== null && p.frontWidthM !== null && p.builtYear >= k.yearFrom && p.builtYear <= k.yearTo && p.storeys3dbag === k.storeys && widthBand(p.frontWidthM) === k.width;

export interface Family { key: FamilyKey; id: string; pands: PandRecord[]; faces: string[]; eavesM: number | null }

/**
 * Families of a buurt from its survey: the `yearBin`-year bin of the build year x 3DBAG storeys x width band. Pands
 * without a year, a width, a storey count or a face (a lone pand, not a row) are left out.
 */
export function clusterFamilies(pands: PandRecord[], o: {yearBin?: number; before?: number} = {}): Family[] {
  const bin = o.yearBin ?? DRAFT.yearBin, groups = new Map<string, PandRecord[]>();
  for (const p of pands) {
    if (p.builtYear === null || p.storeys3dbag === null || p.frontWidthM === null || !p.face) continue;
    if (o.before !== undefined && p.builtYear >= o.before) continue;
    const y0 = Math.floor(p.builtYear / bin) * bin, key: FamilyKey = {yearFrom: y0, yearTo: y0 + bin - 1, storeys: p.storeys3dbag, width: widthBand(p.frontWidthM)};
    const id = familyId(key);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(p);
  }
  return [...groups].map(([id, ps]) => ({key: parseFamilyId(id), id, pands: ps, faces: [...new Set(ps.map(p => p.face!))], eavesM: stat(ps.map(p => p.eavesM))?.median ?? null}))
    .sort((a, b) => b.pands.length - a.pands.length || a.id.localeCompare(b.id));
}

/**
 * Per-storey reading from an opening mask (`measureFacade` mask: 255 unusable, opening cells per `isOpen`), row 0 at
 * `topM`. The share of opening cells per row is smoothed over 0.3 m; rows above half the way from its 10th to its 90th
 * percentile, between `fromM` (the top of the ground storey, 4.4 m) and `topMarginM` under the eaves, are window rows;
 * runs closer than `mergeM` (a transom) are one window, and a run of at least `minRunM` is one storey's windows. The
 * number of runs is the number of window storeys above the ground storey (the 3DBAG count includes an attic the
 * windows do not show); 2..6 runs or the pand is not read (null). Floor lines sit midway between a head and the sill
 * above; the first floor line is one median half-gap under the lowest sill; the last storey runs to the eaves.
 */
export function storeyProfile(a: {mask: ArrayLike<number>; cols: number; rows: number; cell: number; topM: number; eavesM: number; isOpen: (v: number) => boolean; fromM?: number; topMarginM?: number; minRunM?: number; mergeM?: number; diag?: {why?: string; runs?: number}}): StoreyProfile | null {
  const {cols, rows, cell} = a, fromM = a.fromM ?? 4.4, topMargin = a.topMarginM ?? 0.7, minRun = a.minRunM ?? 0.6, merge = a.mergeM ?? 0.4;
  const no = (why: string) => { if (a.diag) a.diag.why = why; return null; };
  if (cols < 4) return no('narrow');
  const c0 = Math.floor(cols * 0.05), c1 = cols - c0, raw: number[] = [], vOf = (j: number) => a.topM - (j + 0.5) * cell;
  for (let j = 0; j < rows; j++) {
    let o = 0, u = 0;
    for (let i = c0; i < c1; i++) { const m = a.mask[j * cols + i]; if (m === 255) continue; u++; if (a.isOpen(m)) o++; }
    raw.push(u >= (c1 - c0) * 0.4 ? o / u : NaN);
  }
  const prof = raw.map((_, j) => { let s = 0, n = 0; for (let k = -1; k <= 1; k++) { const v = raw[j + k]; if (v !== undefined && !Number.isNaN(v)) { s += v; n++; } } return n ? s / n : NaN; });
  const inBody = (j: number) => vOf(j) >= fromM && vOf(j) <= a.eavesM - topMargin;
  const body = prof.filter((v, j) => !Number.isNaN(v) && inBody(j));
  if (body.length < 10) return no('unusable body rows');
  const sb = sorted(body), thr = (q(sb, 0.1) + q(sb, 0.9)) / 2;
  if (q(sb, 0.9) - q(sb, 0.1) < 0.08) return no('no window contrast');
  // window runs, bottom to top, transoms merged
  const raws: {sill: number; head: number}[] = [];
  let start = -1;
  for (let j = rows - 1; j >= -1; j--) {
    const on = j >= 0 && inBody(j) && prof[j] > thr;
    if (on && start < 0) start = j;
    if (!on && start >= 0) { raws.push({sill: vOf(start) - cell / 2, head: vOf(j + 1) + cell / 2}); start = -1; }
  }
  const runs: {sill: number; head: number}[] = [];
  for (const r of raws) { const l = runs[runs.length - 1]; if (l && r.sill - l.head < merge) l.head = r.head; else runs.push({...r}); }
  const real = runs.filter(r => r.head - r.sill >= minRun), upper = real.length;
  if (a.diag) a.diag.runs = upper;
  if (upper < 2 || upper > 6) return no(`${upper} window runs`);
  const floor: number[] = [];
  for (let i = 1; i < upper; i++) floor[i] = (real[i - 1].head + real[i].sill) / 2;
  const gaps = real.slice(1).map((r, i) => r.sill - floor[i + 1]);
  floor[0] = real[0].sill - q(sorted(gaps), 0.5);
  // The last storey ends at the cornice, but the 3DBAG eaves can stand over a roof storey the windows do not show: it
  // is at most as tall as the median inner storey (floor to floor) over the last window row.
  const inner = floor.slice(1).map((f, i) => f - floor[i]), topH = Math.min(a.eavesM - floor[upper - 1], inner.length ? q(sorted(inner), 0.5) : Infinity);
  const tops = [...floor.slice(1), floor[upper - 1] + topH];
  const heights = tops.map((t, i) => t - floor[i]);
  if (heights.some(h => h < 1.5 || h > 6)) return no(`storey heights ${heights.map(h => round(h, 1)).join('/')}`);
  return {
    floorM: [...floor.map(f => round(f)), round(tops[upper - 1])], sillM: real.map(r => round(r.sill)), headM: real.map(r => round(r.head)),
    windowShare: real.map((r, i) => round((r.head - r.sill) / heights[i])), headShare: real.map((r, i) => round((r.head - floor[i]) / heights[i])),
  };
}

export class DraftRefused extends Error { constructor(public reasons: string[]) { super(`draft refused: ${reasons.join('; ')}`); } }

export interface DraftOptions { id: string; district: string; buurt: string; family: FamilyKey; minSamples?: number; minFaces?: number; minShare?: number; generatedAt?: string }
export interface DraftBlock {
  generator: string; generatedAt: string; buurt: string; family: string;
  n: number; faces: Record<string, number>; pands: string[];
  fields: Record<string, Provenance>;
  omitted: Record<string, string>;
  unmeasured: string[];
  observations: Record<string, Provenance>;
}
/** The `match` block of a library type (read by auto-place), as far as a draft writes it. */
export interface DraftMatch { years: [number, number]; eavesM: [number, number]; storeys3dbag: number[]; roof: 'flat' | 'pitched'; baysByWidth?: {maxWidthM: number; bays: number}[]; stucco: boolean; note: string }
export type DraftedType = HouseTypeIntent & {district: string; match: DraftMatch; draft: DraftBlock};

const GENERATOR = 'scripts/block-face/draft-type.ts (src/canalRecall/blockFace/typeDraft.ts)';

/** Draft a type from the measured samples of one family. Throws `DraftRefused` when the cluster is too small or too narrow. */
export function draftType(samples: PandMeasure[], o: DraftOptions): DraftedType {
  const minSamples = o.minSamples ?? DRAFT.minSamples, minFaces = o.minFaces ?? DRAFT.minFaces, minShare = o.minShare ?? DRAFT.minShare;
  const faces: Record<string, number> = {};
  for (const s of samples) faces[s.face] = (faces[s.face] ?? 0) + 1;
  const reasons: string[] = [];
  if (samples.length < minSamples) reasons.push(`${samples.length} measured pands < ${minSamples}`);
  if (Object.keys(faces).length < minFaces) reasons.push(`${Object.keys(faces).length} block faces < ${minFaces} (a median of one or two faces is those faces)`);
  if (reasons.length) throw new DraftRefused(reasons);

  const N = samples.length, fields: Record<string, Provenance> = {}, omitted: Record<string, string> = {}, observations: Record<string, Provenance> = {};
  const unmeasured = ['body.windows (pane layout)', 'body.windowHead (head kind: flat / segmental / round)', 'body.cornice kind (simple is a placeholder; presence is measured)', 'crowns (kind, dormers, gable: only the skyline rise is measured)', 'grounds (door side, shop; the ground storey is not read)', 'roof.material (3DBAG gives the shape, not the covering)', 'palettes.*.door'];

  // --- storeys, widths, years, eaves ---
  const stoMode = mode(samples.map(s => s.storeys));
  const storeys = stoMode[0];
  const sto3 = stat(samples.map(s => s.storeys3dbag));
  fields['body.storeys'] = {source: `mode of the storeys over ${N} pands (window storeys + ground where the strip profile was read, else 3DBAG)`, share: round(stoMode[1] / N), stat: stat(samples.map(s => s.storeys))!,
    note: sto3 ? `3DBAG storeys median ${sto3.median} (it counts an attic the windows do not show)` : undefined};
  const years = stat(samples.map(s => s.builtYear)), widths = stat(samples.map(s => s.widthM))!, eaves3 = stat(samples.map(s => s.eavesM))!;
  if (!years) throw new DraftRefused(['no build years']);
  // Ranges are p10..p90 (rounded outward), not min..max: one merged double-width pand must not stretch the type's fit.
  const span = (v: (number | null)[], d: number): [number, number] => { const s = sorted(v.filter((x): x is number => x !== null)), f = 10 ** d; return [Math.floor(q(s, 0.1) * f) / f, Math.ceil(q(s, 0.9) * f) / f]; };
  const yearsR = span(samples.map(s => s.builtYear), 0), widthR = span(samples.map(s => s.widthM), 1), eavesR = span(samples.map(s => s.eavesM), 1);
  fields['match.years'] = {source: 'BAG build year, p10..p90 over the family', stat: years};
  fields['fit.widthM'] = {source: 'BAG/3DBAG front width, p10..p90 (rounded outward to 0.1 m)', stat: widths};
  fields['match.eavesM'] = {source: '3DBAG eaves, p10..p90 (rounded outward to 0.1 m)', stat: eaves3};
  const skyEaves = stat(samples.map(s => s.skylineEavesM));
  if (skyEaves) observations['skyline.eavesM'] = {source: `strip skyline cornice line (${skyEaves.n} of ${N} pands read under clean sky)`, stat: skyEaves, note: `3DBAG median ${eaves3.median} m`};
  const eavesM = skyEaves && skyEaves.n / N >= minShare && iqr(skyEaves) <= DRAFT.maxIqr.eavesM ? skyEaves.median : eaves3.median;

  // --- bays: counted on the opening mask, cross-checked with the autocorrelated pitch ---
  const bayBands = new Map<string, number[]>();
  for (const s of samples) if (s.windowCols) { const b = widthBand(s.widthM); (bayBands.get(b) ?? bayBands.set(b, []).get(b)!).push(s.windowCols); }
  const allCols = stat(samples.map(s => s.windowCols)), pitchCols = stat(samples.map(s => s.pitchColumns));
  let bays: number | undefined;
  if (allCols && allCols.n / N >= minShare) {
    bays = Math.round(allCols.median);
    fields['body.bays'] = {source: `window columns counted on the opening mask (${allCols.n} of ${N} pands)`, stat: allCols, note: iqr(allCols) > DRAFT.maxIqr.bays ? 'spread over one bay: the family may be two families (split by width or year)' : undefined};
  } else omitted['body.bays'] = `window columns read on ${allCols?.n ?? 0} of ${N} pands (< ${minShare * 100} %)`;
  if (pitchCols) observations['autocorrelated bay columns'] = {source: `measureFacade pitch, ${pitchCols.n} pands`, stat: pitchCols};
  const baysByWidth: {maxWidthM: number; bays: number}[] = [];
  // one entry per width band with >= 3 counted pands, ascending; the edge of a band is its upper bound
  const edges = [...DRAFT.widthBands, 99];
  for (const [i, edge] of edges.entries()) {
    const v = bayBands.get(widthBand(i === 0 ? DRAFT.widthBands[0] - 0.01 : edge === 99 ? DRAFT.widthBands[DRAFT.widthBands.length - 1] + 0.01 : edge - 0.01));
    if (v && v.length >= 3) baysByWidth.push({maxWidthM: edge, bays: Math.round(stat(v)!.median)});
  }
  // collapse equal neighbours; the last entry must reach 99
  const bw = baysByWidth.filter((b, i) => i === baysByWidth.length - 1 || baysByWidth[i + 1].bays !== b.bays);
  if (bw.length) bw[bw.length - 1] = {...bw[bw.length - 1], maxWidthM: 99};

  // --- storey lines and windows ---
  const profiles = samples.map(s => s.storey).filter((p): p is StoreyProfile => !!p && p.windowShare.length === storeys - 1);
  const upper = storeys - 1;
  let storeyHeights: number[] | undefined, windowHeights: number[] | undefined, headLines: number[] | undefined;
  const profiled = samples.filter(s => s.storey).length;
  // read on at least 40 % of the family, and the storey count the windows show agrees on >= minShare of those read
  if (profiles.length / N >= 0.4 && profiles.length / Math.max(1, profiled) >= minShare) {
    const floors = Array.from({length: upper + 1}, (_, i) => stat(profiles.map(p => p.floorM[i]))!);
    const hs = Array.from({length: upper}, (_, i) => stat(profiles.map(p => p.floorM[i + 1] - p.floorM[i]))!);
    const ground = floors[0];
    const spreadOk = hs.every(h => iqr(h) <= DRAFT.maxIqr.storeyM) && iqr(ground) <= DRAFT.maxIqr.groundM;
    if (spreadOk) {
      storeyHeights = [round(ground.median), ...hs.map(h => round(h.median))];
      fields['body.storeyHeights'] = {source: `storey profile on the opening mask: ground = first floor line, upper = floor-to-floor, last = to the eaves (${profiles.length} of ${N} pands; ${profiled} read, the rest show another storey count)`, stat: stat(profiles.map(p => p.floorM[1] - p.floorM[0]))!, note: `per storey medians (m): ${storeyHeights.join(', ')}; ground ${ground.median} (IQR ${round(iqr(ground))})`};
    } else omitted['body.storeyHeights'] = `storey IQR over the limit (${DRAFT.maxIqr.storeyM} m, ground ${DRAFT.maxIqr.groundM} m): ground ${round(iqr(ground))}, upper ${hs.map(h => round(iqr(h))).join('/')}; medians were ${[ground, ...hs].map(h => h.median).join('/')} m`;
    const ws = Array.from({length: upper}, (_, i) => stat(profiles.map(p => p.windowShare[i]))!), hl = Array.from({length: upper}, (_, i) => stat(profiles.map(p => p.headShare[i]))!);
    if (ws.every(w => iqr(w) <= DRAFT.maxIqr.windowH)) {
      // The ground storey is a shop in these rows and is not read: it repeats the first upper storey (listed as unmeasured).
      windowHeights = [ws[0].median, ...ws.map(w => w.median)];
      fields['body.windowHeights'] = {source: `window row extent / storey height per storey (${profiles.length} of ${N} pands)`, stat: ws[0], note: `per upper storey medians ${ws.map(w => w.median).join(', ')}; ground entry repeats storey 1`};
      unmeasured.push('body.windowHeights[0] (ground storey repeats the first upper storey)');
    } else omitted['body.windowHeights'] = `window share IQR over ${DRAFT.maxIqr.windowH} (${ws.map(w => round(iqr(w))).join('/')}); medians were ${ws.map(w => w.median).join('/')}`;
    if (windowHeights && hl.every(h => iqr(h) <= DRAFT.maxIqr.headLine)) {
      headLines = [hl[0].median, ...hl.map(h => h.median)];
      fields['body.headLines'] = {source: `window head height / storey height per storey (${profiles.length} of ${N} pands)`, stat: hl[0], note: `per upper storey medians ${hl.map(h => h.median).join(', ')}; ground entry repeats storey 1`};
    } else if (windowHeights) omitted['body.headLines'] = `head line IQR over ${DRAFT.maxIqr.headLine} (${hl.map(h => round(iqr(h))).join('/')}); medians were ${hl.map(h => h.median).join('/')}`;
  } else omitted['body.storeyHeights/windowHeights/headLines'] = `storey profile: ${profiled} of ${N} pands read, ${profiles.length} agree on ${storeys} storeys (needs >= 40 % of the family and >= ${minShare * 100} % of those read)`;
  const ww = stat(samples.map(s => s.windowWidthM));
  if (ww) observations['window width (m)'] = {source: `median width of the opening-column runs, ${ww.n} pands`, stat: ww};
  const gl = stat(samples.map(s => s.glazing));
  if (gl) observations['glazing share (upper storeys)'] = {source: `measureFacade not-wall share, ${gl.n} pands`, stat: gl};

  // --- crown (skyline only) ---
  const crowned = samples.filter(s => s.crown && s.crown.riseM >= 0.6);
  observations['skyline crown'] = {source: `strip skyline: columns standing > 0.6 m over the cornice line`, share: round(crowned.length / N), stat: stat(crowned.map(s => s.crown!.riseM)) ?? undefined, note: crowned.length ? `median width ${stat(crowned.map(s => s.crown!.widthM))!.median} m; the crown kind is not measured` : 'none read'};

  // --- bands (positions only, as observations) ---
  const runs = samples.flatMap(s => s.bandRunsM.filter(r => r[0] > 4.4 && r[1] < eavesM - 0.3).map(r => ({r, id: s.pandId})));
  if (runs.length) {
    const centres = runs.map(r => (r.r[0] + r.r[1]) / 2), withBand = new Set(runs.map(r => r.id)).size;
    observations['bands'] = {source: `palette band-row runs between 4.4 m and the cornice, ${withBand} of ${N} pands`, share: round(withBand / N), stat: stat(centres)!, note: 'band kind (storey / lintel / speklagen / painted) is not measured; heights are the run centres above the ground'};
  }

  // --- palette ---
  const wall = colourStat(samples.map(s => s.palette.wall)), frame = colourStat(samples.map(s => s.palette.frame)), accent = colourStat(samples.map(s => s.palette.accent)), cornice = colourStat(samples.map(s => s.palette.cornice)), band = colourStat(samples.map(s => s.palette.band));
  const stuccoShare = samples.filter(s => s.palette.stucco).length / N;
  if (!wall) throw new DraftRefused(['no wall colour measured']);
  const palette: Record<string, string> = {door: 'black'};
  // A colour is written only when the pands agree on it: the median distance (RGB) of the samples from the median colour.
  const put = (key: 'brick' | 'frame' | 'stone' | 'cornice', c: ColourStat | null, source: string) => {
    if (!c) { omitted[`palettes.measured.${key}`] = 'measured on fewer than 3 pands'; return; }
    if (c.spread > DRAFT.maxColourSpread) { omitted[`palettes.measured.${key}`] = `pands disagree: median distance ${c.spread} from the median ${c.hex} (limit ${DRAFT.maxColourSpread}), n=${c.n}`; return; }
    fields[`palettes.measured.${key}`] = {source, colour: c}; palette[key] = c.hex;
  };
  put('brick', wall, 'median RGB of the per-pand wall colour (palette-from-strip.ts / stripPalette.ts)');
  put('frame', frame, 'median per-pand frame colour');
  put('stone', accent ?? band, `median per-pand ${accent ? 'accent' : 'band'} colour`);
  put('cornice', cornice, 'median per-pand cornice colour');
  if (!palette.brick) throw new DraftRefused([`the wall colour is not a family colour: ${omitted['palettes.measured.brick']}`]);
  if (stuccoShare >= 0.5) observations['stucco'] = {source: 'stripPalette stucco flag', share: round(stuccoShare), note: 'the wall is painted or stuccoed on most pands: check wallMaterial'};
  const corniceShare = samples.filter(s => s.palette.cornice).length / N;

  const roofShape = mode(samples.map(s => (s.roofType === 'horizontal' ? 0 : s.roofType === null ? -1 : 1)).filter(x => x >= 0));

  const body: any = {storeys, ...(bays ? {bays} : {bays: 3}), cornice: corniceShare >= 0.5 ? 'simple' : 'none', windows: 'sash'};
  if (storeyHeights) body.storeyHeights = storeyHeights;
  if (windowHeights) body.windowHeights = windowHeights;
  if (headLines) body.headLines = headLines;
  if (!bays) unmeasured.push('body.bays (placeholder 3)');

  const idShort = `${o.family.yearFrom}-${o.family.yearTo}, ${o.family.storeys} storeys, ${o.family.width} m wide`;
  const type: DraftedType = {
    schemaVersion: 1, kind: 'house-type', id: o.id, district: o.district,
    description: `DRAFT (${GENERATOR}) for the review turn. ${o.buurt} family ${idShort}: ${N} pands on ${Object.keys(faces).length} block faces; median cornice ${eavesM} m, ${bays ?? '?'} window columns, wall ${wall.hex}. Pane layout, head kind, cornice kind, crowns and ground variants are NOT measured: see draft.unmeasured.`,
    fit: {widthM: widthR, storeys: [storeys]},
    match: {
      years: yearsR, eavesM: eavesR, storeys3dbag: [...new Set([storeys, ...(sto3 ? [Math.round(sto3.median)] : [])])].sort((x, y) => x - y),
      roof: roofShape && roofShape[0] === 0 ? 'flat' : 'pitched',
      ...(bw.length ? {baysByWidth: bw} : {}), stucco: stuccoShare >= 0.5,
      note: `drafted: ${N} pands, ${Object.keys(faces).length} faces; see draft.fields for n and spread of every number`,
    } as any,
    body: body as any,
    crowns: {plain: {gable: 'cornice', note: `placeholder: ${crowned.length} of ${N} pands show a skyline crown over the cornice (draft.observations); the crown kind is for the review turn`}} as any,
    palettes: {measured: palette} as any,
    roof: {material: roofShape && roofShape[0] === 0 ? 'bitumen' : 'black-tile'} as any,
    rhythm: {bays: bays ? `${bays} window axes (${allCols!.n} of ${N} pands counted)` : 'unread', photoRows: [1, ...Array(upper).fill(bays ?? 3)], photoGroundRows: 1},
    evidence: Object.entries(faces).map(([face, n]) => ({face, pands: samples.filter(s => s.face === face).map(s => s.pandId.slice(-6)), citation: `drafted from ${n} pand spans of the ${face} strip (draft.fields carry the medians)`})),
    notes: [`Draft, not installed. Medians over ${N} pands; refused below ${minSamples} pands or ${minFaces} faces.`],
    draft: {generator: GENERATOR, generatedAt: o.generatedAt ?? new Date().toISOString().slice(0, 10), buurt: o.buurt, family: familyId(o.family), n: N, faces, pands: samples.map(s => s.pandId), fields, omitted, unmeasured, observations},
  } as DraftedType;
  fields['match.baysByWidth'] = {source: `window columns by frontage width band (bands with >= 3 pands): ${bw.map(b => `<${b.maxWidthM}: ${b.bays}`).join(', ') || 'none'}`};
  return type;
}

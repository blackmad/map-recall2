/**
 * Painted and metal-clad walls in the large-recipe tier (GitHub #146): `walls[i].wallFamily`.
 *
 * Triage parked 82 pands as `painted-or-clad`: wide street walls whose photo wall family is unresolved (measureFacade
 * `material.basis` 'unresolved': dark, neutral, no brick courses), which the kit drew as brick. Since the city look is on
 * by default (#137) the `paint` material slot draws a flat measured colour with no grain (look/palette.ts `cityTint`
 * keeps a paint hex as authored, sampled on the plain white cell), so such a wall can be drawn as what it is:
 *
 * - `{kind: 'paint', colour}`: the group's wall in one flat measured colour (render, painted concrete, a painted or
 *   enamelled panel front). Unlike `cladding.kind: 'paint'` (brick painted over: the brick texture in the paint colour)
 *   no course lines are drawn.
 * - `{kind: 'metal', colour, ribPitch?}`: metal cladding, the sheet in the measured colour with vertical ribs at the
 *   measured pitch (blockBuilding/cladding.ts `ribs` geometry), ribs a shade darker or in `lines`.
 *
 * Both compile to the group's existing cladding fit (so the geometry, plinth clipping and line breaks round openings
 * are cladding.ts's), with their own slot names exported as the `paint` material slot: no new shader, no new cell.
 * `from` (fraction of the eaves) keeps a plinth below it in the wall colour.
 *
 * The measurement side (`wallFamilyEvidence`, `proposeWallFamily`) runs only where the wall family is unresolved and
 * proposes paint when the wall cells are flat (no courses, low cell-to-cell spread) and metal when the wall shows a
 * regular vertical rib period. Pure: no I/O.
 */
import {CLADDING} from '../blockBuilding/cladding.ts';
import type {FacadeBox, FacadeImage, WallMaterial} from './measureFacade.ts';

export const WALL_FAMILY_KINDS = ['paint', 'metal'] as const;
export type WallFamilyKind = typeof WALL_FAMILY_KINDS[number];
export interface WallFamilyIntent {kind: WallFamilyKind; colour: string; ribPitch?: number; lines?: string; from?: number}
const KEYS = ['kind', 'colour', 'ribPitch', 'lines', 'from'];
const HEX = /^#[0-9a-f]{6}$/i;
/**
 * Measured rib pitch range (m): trapezoidal sheet profiles run 0.15..0.33 m (Praxis Draaierweg 124847 walls[0] ~0.2 m,
 * below cladding.ts's 0.25 m drawing minimum, which is moot: wall-family ribs are drawn at >= DRAWN_RIB_MIN_M) up to the
 * kit's 2 m.
 */
export const RIB_PITCH = {min: 0.15, max: CLADDING.ribs.max} as const;

/** Problems with `walls[i].wallFamily`; `w` is the wall group (system, other wall fields it excludes). */
export function wallFamilyProblems(input: unknown, at: string, w: {system?: string; cladding?: unknown; wallMaterial?: unknown; houses?: unknown; wallSplit?: unknown}): string[] {
  if (input === undefined) return [];
  const where = `${at}.wallFamily`, f = input as Record<string, unknown>;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return [`${where}: an object {${KEYS.join(', ')}}`];
  const p: string[] = [];
  for (const k of Object.keys(f)) if (!KEYS.includes(k)) p.push(`${where}.${k}: unknown field (${KEYS.join(', ')})`);
  if (!(WALL_FAMILY_KINDS as readonly string[]).includes(f.kind as string)) p.push(`${where}.kind: one of ${WALL_FAMILY_KINDS.join(', ')}`);
  if (typeof f.colour !== 'string' || !HEX.test(f.colour)) p.push(`${where}.colour: the measured #rrggbb tint`);
  if (f.lines !== undefined && (f.kind !== 'metal' || typeof f.lines !== 'string' || !HEX.test(f.lines))) p.push(`${where}.lines: a #rrggbb rib colour, metal only`);
  if (f.ribPitch !== undefined && (f.kind !== 'metal' || !(typeof f.ribPitch === 'number' && f.ribPitch >= RIB_PITCH.min && f.ribPitch <= RIB_PITCH.max))) p.push(`${where}.ribPitch: metal only, metres ${RIB_PITCH.min}..${RIB_PITCH.max}`);
  if (f.from !== undefined && !(typeof f.from === 'number' && f.from >= 0 && f.from <= 0.9)) p.push(`${where}.from: fraction of the eaves 0..0.9 (a plinth below keeps the wall colour)`);
  if (w.cladding !== undefined) p.push(`${where}: not with cladding (one wall finish per group)`);
  if (w.wallMaterial !== undefined) p.push(`${where}: not with wallMaterial (the family is the material)`);
  if (w.houses !== undefined) p.push(`${where}: not with houses (each house has its own wall slot)`);
  if (w.wallSplit !== undefined) p.push(`${where}: not with wallSplit`);
  if (w.system === 'curtain-wall' || w.system === 'glazed-hall') p.push(`${where}: over a wall with a face (not a curtain wall or glazed hall)`);
  return p;
}

/** The cladding a wall family compiles to (cladding.ts), and its slot base names (exported as the `paint` slot). */
export function wallFamilyCladding(f: WallFamilyIntent): {kind: 'paint' | 'ribs'; colour: string; lines?: string; pitch?: number; from?: number; to?: undefined; rowPitch?: undefined; side?: undefined; slot: string; lineSlot: string} {
  return f.kind === 'paint'
    ? {kind: 'paint', colour: f.colour, ...(f.from !== undefined ? {from: f.from} : {}), slot: 'paintwall', lineSlot: 'paintline'}
    : {kind: 'ribs', colour: f.colour, ...(f.lines ? {lines: f.lines} : {}), pitch: drawnRibPitch(f.ribPitch), ...(f.from !== undefined ? {from: f.from} : {}), slot: 'metalwall', lineSlot: 'metalrib'};
}
/**
 * Ribs are drawn at the measured pitch's multiple of at least DRAWN_RIB_MIN_M (every k-th rib): each rib is a box broken
 * round every window (cladding.ts), and a 45 m shed front at the measured 0.3-0.5 m doubles a 9k-triangle recipe past the
 * 12k budget (politie-van-leijenberghlaan walls[0]: 9.1k bare, 15.3k at 0.5 m, 12.1k at 1 m). From the street the ribs
 * read as a vertical texture; the intent keeps the measured pitch.
 */
export const DRAWN_RIB_MIN_M = 1.0;
export const drawnRibPitch = (measured?: number) => { const p = measured ?? DRAWN_RIB_MIN_M; return +(p * Math.ceil(DRAWN_RIB_MIN_M / p - 1e-9)).toFixed(3); };
/** Block-kit slot bases of a wall family: drawn with the city look's flat `paint` material slot. */
export const WALL_FAMILY_SLOTS: ReadonlySet<string> = new Set(['paintwall', 'paintline', 'metalwall', 'metalrib']);

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/**
 * Thresholds of the proposal, set on the triage crops (2026-10-31, `staging/painted-clad/calibrate.ts` in lane #146: 125
 * unresolved street-wall crops of the painted-or-clad pands, 45 brick controls). The decisive filter is upstream: a
 * proposal is made only where measureFacade leaves the family unresolved (no courses, dark and neutral). Within that:
 * - `flatCv`: the wall cells' luma spread (sd / mean of the 10 cm cells' mean luma, after a 1 m high pass that removes
 *   shading). Unresolved walls read 0.027..0.23; the two brick fronts in shade that read unresolved and passed review
 *   (Molenwerf 066028 w04 0.142, De Klencke 094874 w08 0.406) stay above 0.12.
 * - `textureCv`: measureFacade's pooled course texture (`material.texture.cv`): paint and render 0.007..0.035, the
 *   Molenwerf control 0.037.
 * - warm darks (`warmHue`, `warmSat`): a dark red-brown is blurred brick before it is paint (pand 243823 w01, long-format
 *   brick at cell spread 0.044): not proposed.
 * - ribs: a column-profile period of at most `ribMaxM` (real profiles 0.2-0.5 m; longer periods are the pier and window
 *   rhythm, which brick controls show at 0.9-1.9 m with r up to 0.88), autocorrelation >= `ribScore` and prominence over
 *   the half-lag trough >= `ribProminence` (242134 w07, dark ribbed metal: 0.30 m, r 0.75, prominence 1.0).
 */
export const WALL_FAMILY = {flatCv: 0.12, textureCv: 0.035, warmHue: 40, warmSat: 0.12, ribMaxM: 0.6, ribScore: 0.5, ribProminence: 0.5, minCells: 300} as const;

export interface WallFamilyEvidence {
  /** wall cells read */
  cells: number;
  /** spread of the wall cells' mean luma after a 1 m high pass, relative to the mean (flat colour: low) */
  cellCv: number;
  /** a regular vertical rib period along the wall (m), its autocorrelation and prominence; null when none */
  rib: {pitchM: number; score: number; prominence: number} | null;
}

const luma = (im: FacadeImage, p: number) => 0.299 * im.rgb[p * 3] + 0.587 * im.rgb[p * 3 + 1] + 0.114 * im.rgb[p * 3 + 2];

/** Cell statistics of the wall cells (`cells`: indexes on the measurement grid of `box`, row 0 at box.v1). */
export function wallFamilyEvidence(im: FacadeImage, box: FacadeBox, cell: number, cells: readonly number[]): WallFamilyEvidence {
  const cols = Math.max(1, Math.floor((box.u1 - box.u0) / cell)), rows = Math.max(1, Math.floor((box.v1 - box.v0) / cell));
  const sum = new Float64Array(cols * rows), cnt = new Float64Array(cols * rows), want = new Uint8Array(cols * rows);
  for (const k of cells) want[k] = 1;
  // per pixel: its cell, luma; and a column profile of the wall pixels' high-passed luma (per pixel column)
  const colSum = new Float64Array(im.width), colN = new Float64Array(im.width);
  const yOf = new Float32Array(im.width * im.height).fill(NaN);
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
    const p = y * im.width + x; if (im.valid && im.valid[p] < 128) continue;
    const u = (x + 0.5) / im.ppm - box.u0, v = box.v1 - (im.topM - (y + 0.5) / im.ppm);
    const i = Math.floor(u / cell), j = Math.floor(v / cell); if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
    const k = j * cols + i; if (!want[k]) continue;
    const Y = luma(im, p); sum[k] += Y; cnt[k]++; yOf[p] = Y;
  }
  // column profile: each wall pixel minus its row's local mean (±0.5 m) so shading and the window rhythm's slow swing drop out
  const half = Math.max(2, Math.round(im.ppm * 0.5));
  for (let y = 0; y < im.height; y++) {
    const row = yOf.subarray(y * im.width, (y + 1) * im.width);
    const pre = new Float64Array(im.width + 1), preN = new Float64Array(im.width + 1);
    for (let x = 0; x < im.width; x++) { const ok = Number.isFinite(row[x]); pre[x + 1] = pre[x] + (ok ? row[x] : 0); preN[x + 1] = preN[x] + (ok ? 1 : 0); }
    for (let x = 0; x < im.width; x++) {
      if (!Number.isFinite(row[x])) continue;
      const a = Math.max(0, x - half), b = Math.min(im.width, x + half + 1), n = preN[b] - preN[a];
      if (n < half) continue;
      colSum[x] += row[x] - (pre[b] - pre[a]) / n; colN[x]++;
    }
  }
  // cell spread after a 1 m high pass over the wall cells' means
  const means: {k: number; m: number}[] = []; for (const k of cells) if (cnt[k] > 0) means.push({k, m: sum[k] / cnt[k]});
  const meanAt = new Float64Array(cols * rows).fill(NaN); for (const {k, m} of means) meanAt[k] = m;
  const r = Math.max(1, Math.round(0.5 / cell)); let s2 = 0, sm = 0, n2 = 0;
  for (const {k, m} of means) {
    const i = k % cols, j = (k - i) / cols; let a = 0, c = 0;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue; const v = meanAt[jj * cols + ii]; if (Number.isFinite(v)) { a += v; c++; } }
    const d = m - a / c; s2 += d * d; sm += m; n2++;
  }
  const cellCv = n2 ? Math.sqrt(s2 / n2) / Math.max(20, sm / n2) : 0;
  return {cells: means.length, cellCv: +cellCv.toFixed(4), rib: ribPeriod(colSum, colN, im.ppm)};
}

/** The dominant period of the column profile in RIB_PITCH (m), from its normalised autocorrelation. */
export function ribPeriod(colSum: Float64Array, colN: Float64Array, ppm: number): WallFamilyEvidence['rib'] {
  const minRows = Math.max(5, Math.max(...colN) * 0.3);
  const prof: number[] = [], okAt: boolean[] = [];
  for (let x = 0; x < colSum.length; x++) { const ok = colN[x] >= minRows; okAt.push(ok); prof.push(ok ? colSum[x] / colN[x] : 0); }
  const lagMin = Math.max(3, Math.round(RIB_PITCH.min * ppm)), lagMax = Math.round(RIB_PITCH.max * ppm);
  const ac = (l: number) => { let s = 0, a = 0, b = 0, n = 0; for (let x = 0; x + l < prof.length; x++) if (okAt[x] && okAt[x + l]) { s += prof[x] * prof[x + l]; a += prof[x] ** 2; b += prof[x + l] ** 2; n++; } return n > lagMax && a > 0 && b > 0 ? s / Math.sqrt(a * b) : 0; };
  const R = new Map<number, number>(); for (let l = Math.max(1, Math.floor(lagMin / 2)); l <= lagMax + Math.ceil(lagMin / 2); l++) R.set(l, ac(l));
  let best: WallFamilyEvidence['rib'] = null;
  for (let l = lagMin; l <= lagMax; l++) {
    const v = R.get(l)!; if (!(v > 0 && v >= (R.get(l - 1) ?? -1) && v >= (R.get(l + 1) ?? -1))) continue;
    // prominence over the trough at half the lag (a periodic profile swings negative half a period on)
    const trough = R.get(Math.max(1, Math.round(l / 2))) ?? 0, prom = v - trough;
    if (!best || v > best.score) best = {pitchM: +(l / ppm).toFixed(3), score: +v.toFixed(3), prominence: +prom.toFixed(3)};
  }
  return best;
}

export interface WallFamilyProposal {kind: WallFamilyKind; colour: string; ribPitch?: number; why: string}

/**
 * The family a measured wall proposes, or null with the reason: only where the wall family is unresolved (a resolved
 * brick, stone or pale paint keeps its route); metal when a rib period is regular, else paint when the cells are flat.
 */
export function proposeWallFamily(material: Pick<WallMaterial, 'basis'> & {texture?: {cv: number} | null} | null | undefined, wallHex: string, e: WallFamilyEvidence | null | undefined): {proposal: WallFamilyProposal | null; why: string} {
  if (material?.basis !== 'unresolved') return {proposal: null, why: `wall family ${material?.basis ?? 'unmeasured'}: not proposed`};
  if (!e || e.cells < WALL_FAMILY.minCells) return {proposal: null, why: `${e?.cells ?? 0} wall cells < ${WALL_FAMILY.minCells}: tint not measurable`};
  const F = WALL_FAMILY, rib = e.rib;
  if (rib && rib.pitchM <= F.ribMaxM && rib.score >= F.ribScore && rib.prominence >= F.ribProminence)
    return {proposal: {kind: 'metal', colour: wallHex, ribPitch: rib.pitchM, why: `rib period ${rib.pitchM} m (r ${rib.score}, prominence ${rib.prominence}): metal ${wallHex}`}, why: 'metal'};
  const [h, sat] = hueSat(wallHex);
  if ((h <= F.warmHue || h >= 340) && sat >= F.warmSat) return {proposal: null, why: `${wallHex} is a warm dark (hue ${Math.round(h)}, saturation ${sat.toFixed(2)}): blurred brick before paint`};
  const tcv = material.texture?.cv ?? null;
  if (e.cellCv <= F.flatCv && (tcv === null || tcv <= F.textureCv))
    return {proposal: {kind: 'paint', colour: wallHex, why: `flat colour (cell spread ${e.cellCv} <= ${F.flatCv}, texture ${tcv?.toFixed(3) ?? '-'}, no courses): paint ${wallHex}`}, why: 'paint'};
  return {proposal: null, why: `cell spread ${e.cellCv}${tcv !== null ? `, texture ${tcv.toFixed(3)}` : ''} not flat (<= ${F.flatCv}, <= ${F.textureCv}) and no rib period${rib ? ` (best ${rib.pitchM} m r ${rib.score})` : ''}`};
}
const hueSat = (hex: string): [number, number] => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s];
};

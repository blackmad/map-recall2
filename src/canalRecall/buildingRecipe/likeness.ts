/**
 * Likeness of a fitted `kind: large` wall group to its photograph: the model's front-on orthographic elevation
 * (`renderElevation` in landmarks/facadeCompare.ts, 10 cm cells, coloured with what the game draws: `cityLookTint`,
 * the glass texture's mean for glass, the raw tint where a material says `tintSource: "measured"`) against the
 * rectified photo measured by measureFacade.ts on the same panel box (cropToPanel.ts places it).
 *
 * The photo is measured on the box grown by `PAD_M`, and slid over the model by up to +-0.5 m along and up the wall
 * to the shift with the best not-wall IoU (BAG edge vs 3DBAG plane and the panorama's ground estimate disagree by
 * decimetres); the shift is reported. Gated per group (any failure = FAIL):
 *
 * - wall colour: the same family (facade/materials.ts `wallFamily`) and |dL| <= 0.12 (HSL lightness) between the
 *   photo's light-trim-normalised wall and the model's game wall colour; hue within 12 degrees only when both
 *   saturations exceed 0.08 (as blockFace/wallColour.ts); where the photo's exposure could not be normalised and its
 *   warm wall is darker than the model's by at most 0.35 with the same chromaticity, the wall is in shade or overcast
 *   light and is judged on chromaticity (`shadedWallMatch`, a WARN, GitHub #61);
 * - glazing: not-wall share per upper storey band within 0.15, and the upper-storey mean within 0.10; pale photo panels
 *   the model draws as panels of the same colour are not glazing (`rereadPalePanels`), and where the photo admits a
 *   second reading (measureFacade `altMask`: a blend cluster on the enrichment threshold) the nearer reading judges;
 * - columns: the window-column count (bays from the autocorrelation of the upper-storey not-wall profile, times the
 *   windows grouped in each bay: measureFacade `windowGroupOf`) within 20 %, and the same window shape class (tall > 1.4
 *   / square / wide < 0.7, height over one window's width); where the photo's window storeys are a mixed-width row
 *   (no shape class holds 80 % of the openings, p90 width >= 1.8 x the median) and the model reproduces its per-storey opening sequences (rowOpenings.ts:
 *   openings per storey within 20 %, the tall/square/wide mix within 0.35, median and p90 widths within x1.5), those
 *   judge the columns and shape instead of the fold, which cannot describe a mixed row; and a storey that is one
 *   ribbon (>= 8 m, glass along its length: cut where the photo is wall-coloured) on one side against a punched row
 *   under it (windows under 4 m covering under 60 % of its span) on the other fails (rowOpenings `rowMismatch`);
 * - report only: not-wall mask IoU (WARN under 0.45), glass colour, the ground band (0..2.5 m, never pooled).
 *
 * Curtain walls (GitHub #114): the photo reads a curtain front's mullion and transom grid as wall or trim (its wall
 * cluster is the grid or the spandrels: photo glazing 0.70..0.87 on the #105 glass fronts), while the model drew the
 * grid as frame slots, i.e. openings, and had no wall slot at all without spandrels ("wall not drawn", glazing 1.00).
 * Where the group's system is `curtain-wall` or the photo's front class is `curtain`, and the model draws a curtain
 * grid (`modelElevation` `curtain`: a `curtain-wall` group, or a front with no wall-slot material, whose modal frame
 * material over the upper cells is the grid), the model is read the way the photo is: its wall is the spandrel material
 * when it draws one, else the grid's; grid cells of the wall colour are wall, lighter ones trim, darker ones glazing
 * (the photo's dark / light split); and the mask goes through the photo's 3x3 majority clean-up (measureFacade
 * `majorityClean`), so a grid line one cell wide vanishes on both sides. The same LIKENESS constants judge it.
 *
 * NO EVIDENCE (abstain) when under 40 % of the upper cells are usable, foliage covers over 25 %, over 30 % is
 * washed out, the view is more than 45 degrees oblique, or the camera stood under 8 m from a wall over 15 m wide (for a
 * mosaic: one crop from under 8 m covering over 15 m of it).
 */
import {cityLookTint} from '../look/cityLook.ts';
import type {MaterialSlot} from '../look/palette.ts';
import {nearestMaterial, wallFamily} from '../facade/materials.ts';
import {rgbToHsl, WALL_TOLERANCE} from '../blockFace/wallColour.ts';
import {renderElevation, type MaterialSoup} from '../landmarks/facadeCompare.ts';
import {compareRowOpenings, ROW_OPENINGS, rowOpenings, type RowOpeningsComparison} from './rowOpenings.ts';
import {analyseMask, chromaticity, hex, isOpeningCell, majorityClean, MASK, rgbToLab, SAME_MATERIAL, wallMaterialOf, type FacadeBox, type FacadeMeasurement, type MaskGrid, type Rgb} from './measureFacade.ts';

export const PAD_M = 0.5;
export const LIKENESS = {dL: 0.12, hueDeg: WALL_TOLERANCE.hueDeg, satForHue: 0.08, storeyGlazing: 0.15, meanGlazing: 0.1, columns: 0.2, iouWarn: 0.45,
  minUsable: 0.4, maxFoliage: 0.25, maxWashedOut: 0.3, maxObliquityDeg: 45, minCameraM: 8, wideWallM: 15,
  shadeMaxDL: 0.35, panelMinLift: 15, panelMaxDE: 20, panelMinSolid: 0.5} as const;
/** Mean of the game's glass texture (look/slotCells.ts `paintGlassCanvas` gradient #8aa1b0 / #4d606c / #3c474e), drawn under a white tint. */
export const GAME_GLASS: Rgb = [88, 106, 117];
const WALL_SLOTS = new Set(['brick', 'stucco', 'stone']);
const OPENING_SLOTS = new Set(['glass', 'frame', 'door']);
const TRIM_SLOTS = new Set(['accent']);

export interface PanelFrame { o: number[]; r: number[]; n: number[]; uMin: number; uMax: number }

/**
 * Colour the game draws for a material (sRGB). A measured tint (`tintSource: "measured"` in the material extras, the
 * runtime bypass of lane B, or a tint listed in `measuredTints` until the exporter writes that extra) is drawn as is.
 */
export function gameColour(m: MaterialSoup['materials'][number] & {tintSource?: string}, measuredTints?: Set<string>): Rgb {
  const slot = m.materialSlot ?? m.slot, tint = m.tint ?? hex(m.rgb);
  if ((m.tintSource === 'measured' || measuredTints?.has(tint.toLowerCase())) && m.tint) return hexRgb(m.tint);
  if (slot === 'glass') return GAME_GLASS;
  if (!slot) return m.rgb;
  return hexRgb(cityLookTint(slot as MaterialSlot, tint));
}
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;

export interface ModelElevation {
  cols: number; rows: number; cell: number; box: FacadeBox;
  mask: Uint8Array; colours: Uint8Array;
  /** `wallToday`: through cityLookTint even when the tint is measured (what the game draws before the measured-tint bypass ships) */
  wall: Rgb | null; wallToday: Rgb | null; glass: Rgb | null; wallSlot: string | null;
  grid: MaskGrid;
  /** the group's system, when the caller knows it (curtain symmetry) */
  system?: string;
  /** the model read as the photo reads a curtain front (file header), when it draws a curtain grid; `grid` on `mask` */
  curtain?: CurtainReading;
}
export interface CurtainReading { mask: Uint8Array; wall: Rgb; wallToday: Rgb; wallSlot: string; mullion: Rgb; grid: MaskGrid }

/** The model's elevation of one panel on the box (panel u, height above ground), classed like the photo. */
export function modelElevation(soup: MaterialSoup, panel: PanelFrame, box: FacadeBox, lines: number[], cell = 0.1, measuredTints?: Set<string>, behindM = 1.5, system?: string): ModelElevation {
  const bearing = (Math.atan2(panel.n[0], -panel.n[2]) * 180 / Math.PI + 360) % 360;
  const nx = Math.sin(bearing * Math.PI / 180), nz = -Math.cos(bearing * Math.PI / 180), tx = nz, tz = -nx;
  const tOf = (u: number) => (panel.o[0] + panel.r[0] * u) * tx + (panel.o[2] + panel.r[2] * u) * tz;
  const t0 = Math.min(tOf(box.u0), tOf(box.u1)), t1 = Math.max(tOf(box.u0), tOf(box.u1));
  // the band is pinned to the panel's own plane (+1 m for canopies, balconies, column bays standing proud), not to the
  // front-most geometry in the span: Waagdragerhof's warehouse front (walls[2]) sits 10+ m behind a nearer volume;
  // 1.5 m behind the plane, or `behindM` for a group with deeper loggias (their glazing is the facade the photo shows)
  const frontDepth = panel.o[0] * nx + panel.o[2] * nz + 1;
  const el = renderElevation(soup, {name: 'panel', bearing, span: [t0 - 0.05, t1 + 0.05], depthBand: 1 + Math.max(1.5, behindM), frontDepth}, cell);
  const cols = Math.max(1, Math.floor((box.u1 - box.u0) / cell)), rows = Math.max(1, Math.floor((box.v1 - box.v0) / cell)), N = cols * rows;
  const matAt = new Int32Array(N).fill(-1), shade = new Float32Array(N);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u = box.u0 + (i + 0.5) * cell, v = box.v1 - (j + 0.5) * cell;
    const px = Math.floor((tOf(u) - el.tMin) / cell), py = Math.floor((el.yMax - v) / cell);
    if (px < 0 || py < 0 || px >= el.W || py >= el.H) continue;
    matAt[j * cols + i] = el.mat[py * el.W + px]; shade[j * cols + i] = el.shade[py * el.W + px];
  }
  const colourOf = soup.materials.map(m => gameColour(m, measuredTints)), todayOf = soup.materials.map(m => gameColour(m));
  const slotOf = soup.materials.map(m => m.materialSlot ?? m.slot ?? '');
  // the wall: the modal wall-slot material over the cells above the ground band
  const votes = new Map<number, number>();
  for (let k = 0; k < N; k++) { const m = matAt[k]; if (m >= 0 && WALL_SLOTS.has(slotOf[m]) && box.v1 - (Math.floor(k / cols) + 0.5) * cell >= 2.5) votes.set(m, (votes.get(m) ?? 0) + 1); }
  const wallMat = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
  const wall = wallMat >= 0 ? colourOf[wallMat] : null, wallToday = wallMat >= 0 ? todayOf[wallMat] : null, wallLab = wall ? rgbToLab(wall) : null;
  const mask = new Uint8Array(N).fill(MASK.unusable), colours = new Uint8Array(N * 3).fill(255);
  const glassCells: Rgb[] = [];
  for (let k = 0; k < N; k++) {
    const m = matAt[k]; if (m < 0) continue;
    const slot = slotOf[m], c = colourOf[m];
    colours.set(c.map(v => Math.round(v * Math.min(1, shade[k]))) as Rgb, k * 3);
    if (!WALL_SLOTS.has(slot) && !OPENING_SLOTS.has(slot) && !TRIM_SLOTS.has(slot)) continue; // roofs, plant: not facade
    const lab = rgbToLab(c);
    const differs = !wallLab || Math.hypot((lab[0] - wallLab[0]) * 0.5, lab[1] - wallLab[1], lab[2] - wallLab[2]) > 15;
    if (WALL_SLOTS.has(slot) && !differs) { mask[k] = MASK.wall; continue; }
    // openings (glass, frames, railings, doors, curtain mullions) as the photo's opening pass reads them; a wall-slot
    // material of another colour (stone bands, sills, a rendered block) and accents are trim, not glazing
    mask[k] = OPENING_SLOTS.has(slot) ? (!wallLab || lab[0] < wallLab[0] + 5 ? MASK.dark : MASK.frame) : MASK.trim;
    if (slot === 'glass') glassCells.push(c);
  }
  const grid = analyseMask({mask, cols, rows, cell, box, lines});
  const curtain = curtainReading({matAt, cols, rows, cell, box, lines, slotOf, colourOf, todayOf, wallMat, system});
  return {cols, rows, cell, box, mask, colours, wall, wallToday, glass: glassCells[0] ?? null, wallSlot: wallMat >= 0 ? slotOf[wallMat] : null, grid,
    ...(system !== undefined ? {system} : {}), ...(curtain ? {curtain} : {})};
}

/**
 * The model's curtain grid read as the photo reads one (file header): null unless the group is a `curtain-wall` or the
 * front has no wall-slot material, and a frame material (the grid) shows above the ground band.
 */
export function curtainReading(a: {matAt: Int32Array; cols: number; rows: number; cell: number; box: FacadeBox; lines: number[]; slotOf: string[]; colourOf: Rgb[]; todayOf: Rgb[]; wallMat: number; system?: string}): CurtainReading | null {
  const {matAt, cols, rows, cell, box, slotOf, colourOf} = a, N = cols * rows;
  if (a.system !== 'curtain-wall' && a.wallMat >= 0) return null;
  const votes = new Map<number, number>();
  for (let k = 0; k < N; k++) { const m = matAt[k]; if (m >= 0 && slotOf[m] === 'frame' && box.v1 - (Math.floor(k / cols) + 0.5) * cell >= 2.5) votes.set(m, (votes.get(m) ?? 0) + 1); }
  const grid = [...votes].sort((x, y) => y[1] - x[1])[0]?.[0] ?? -1;
  if (grid < 0) return null;
  const wallMat = a.wallMat >= 0 ? a.wallMat : grid, wallLab = rgbToLab(colourOf[wallMat]);
  const raw = new Uint8Array(N).fill(MASK.unusable);
  for (let k = 0; k < N; k++) {
    const m = matAt[k]; if (m < 0) continue;
    const slot = slotOf[m];
    if (!WALL_SLOTS.has(slot) && !OPENING_SLOTS.has(slot) && !TRIM_SLOTS.has(slot)) continue;
    const lab = rgbToLab(colourOf[m]), same = Math.hypot((lab[0] - wallLab[0]) * 0.5, lab[1] - wallLab[1], lab[2] - wallLab[2]) <= 15;
    // the grid and the wall-slot materials: wall when of the wall colour, else the photo's light / dark split of not-wall cells
    if (m === grid || WALL_SLOTS.has(slot)) raw[k] = same ? MASK.wall : m === grid ? (lab[0] > wallLab[0] + 5 ? MASK.trim : MASK.dark) : MASK.trim;
    else raw[k] = OPENING_SLOTS.has(slot) ? (lab[0] < wallLab[0] + 5 ? MASK.dark : MASK.frame) : MASK.trim;
  }
  const mask = majorityClean(raw, cols, rows);
  return {mask, wall: colourOf[wallMat], wallToday: a.todayOf[wallMat], wallSlot: slotOf[wallMat], mullion: colourOf[grid], grid: analyseMask({mask, cols, rows, cell, box, lines: a.lines})};
}

export type Verdict = 'PASS' | 'WARN' | 'FAIL' | 'NO EVIDENCE';

/** NO EVIDENCE when the photo abstains; FAIL on a colour, glazing or shape miss; WARN on a column-count miss or a mask IoU under 0.45. */
export function likenessVerdict(a: {abstain: string[]; fails: string[]; warns: string[]; iou: number | null}): Verdict {
  return a.abstain.length ? 'NO EVIDENCE' : a.fails.length ? 'FAIL' : a.warns.length || (a.iou !== null && a.iou < LIKENESS.iouWarn) ? 'WARN' : 'PASS';
}
export interface LikenessResult {
  verdict: Verdict; reasons: string[];
  shift: {uM: number; vM: number}; iou: number | null;
  wall: {photo: string; photoRaw: string; model: string | null; modelToday: string | null; photoFamily: string; modelFamily: string | null; photoMaterial: string; modelMaterial: string | null; dL: number | null; dHue: number | null; pass: boolean};
  glass: {photo: string | null; model: string | null};
  glazing: {photo: (number | null)[]; model: (number | null)[]; photoMean: number; modelMean: number; maxDiff: number | null; meanDiff: number; pass: boolean};
  /** photo / model: bays (the grid pitch; measure.ts proposes bays from it); windows: window columns (bays x windows per
   *  bay), what `pass` judges, so paired windows in a bay compare with a photo whose pitch is the single window */
  columns: {photo: number | null; model: number | null; windows?: {photo: number | null; model: number | null}; pass: boolean | null};
  /** the photo's grid on the model's box after the shift (what `columns` and `shape` are judged on): its bay pitch and folded window */
  photoGrid: {pitchM: number | null; window: MaskGrid['window']};
  shape: {photo: string | null; model: string | null; pass: boolean | null};
  /** per-storey opening sequences (rowOpenings.ts); `sequenceMatch`: they judged the shape and columns (a mixed photo row the model matches) */
  openings?: RowOpeningsComparison & {sequenceMatch: boolean};
  classes: {photo: string; model: string};
  ground: {photo: number | null; model: number | null};
  evidence: {usable: number; foliage: number; washedOut: number; obliquityDeg: number | null; cameraDistM: number | null; widthM: number; abstain: string[]};
  /** what the gate re-read on the photo before judging (GitHub #61), report only: pale panels the model draws, a shaded wall */
  rereads?: string[];
  /** the model read as a curtain front (GitHub #114, file header), report only */
  modelReading?: string;
}

/** Photo mask window at (du, dv) cells into the padded measurement, the model's size. */
export function photoWindow(photo: FacadeMeasurement, padCells: number, du: number, dv: number, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(cols * rows).fill(MASK.unusable);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const pi = i + padCells + du, pj = j + padCells - dv;
    if (pi < 0 || pj < 0 || pi >= photo.cols || pj >= photo.rows) continue;
    out[j * cols + i] = photo.mask[pj * photo.cols + pi];
  }
  return out;
}

/** The photo's colour cluster per cell (-1 = none) at (du, dv) cells into the padded measurement, the model's size (as `photoWindow`). */
export function photoClusterWindow(photo: FacadeMeasurement, padCells: number, du: number, dv: number, cols: number, rows: number): Int16Array {
  const out = new Int16Array(cols * rows).fill(-1);
  if (!photo.labels) return out;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const pi = i + padCells + du, pj = j + padCells - dv;
    if (pi < 0 || pj < 0 || pi >= photo.cols || pj >= photo.rows) continue;
    out[j * cols + i] = photo.labels[pj * photo.cols + pi];
  }
  return out;
}

/**
 * Pale panels (GitHub #61, Politie IJ-tunnel walls[1]): a band of light enamel or stone panels is one solid not-wall
 * colour cluster, which the photo's opening pass groups into an opening, while the model draws the same band as a
 * panel (trim). A photo opening cell is re-read as trim where the model draws trim at that cell and the photo's cluster
 * there is (a) solid (>= `panelMinSolid` of its cells inside it: a material, not frames or bars), (b) at least
 * `panelMinLift` L* lighter than the photo's wall cluster and (c) within `panelMaxDE` (CIE76) of the model's colour at
 * that cell. Glazing the model draws as glass, or a model without a panel there, is never re-read. Returns the cells
 * re-read (the window is changed in place).
 */
export function rereadPalePanels(win: Uint8Array, clusters: Int16Array, photo: FacadeMeasurement, model: Pick<ModelElevation, 'mask' | 'colours'>): number {
  const cl = photo.clusters, wc = photo.wallCluster;
  if (!cl || wc === undefined || !cl[wc]) return 0;
  const wallL = cl[wc].lab[0];
  const panel = cl.map(c => !c.wall && (c.solid ?? 0) >= LIKENESS.panelMinSolid && c.lab[0] >= wallL + LIKENESS.panelMinLift);
  if (!panel.some(Boolean)) return 0;
  let n = 0;
  for (let k = 0; k < win.length; k++) {
    const c = clusters[k];
    if (c < 0 || !panel[c] || !isOpeningCell(win[k]) || model.mask[k] !== MASK.trim) continue;
    const ml = rgbToLab([model.colours[k * 3], model.colours[k * 3 + 1], model.colours[k * 3 + 2]]), pl = cl[c].lab;
    if (Math.hypot(ml[0] - pl[0], ml[1] - pl[1], ml[2] - pl[2]) > LIKENESS.panelMaxDE) continue;
    win[k] = MASK.trim; n++;
  }
  return n;
}

/**
 * A wall in shade (GitHub #61, Spinozastraat 51 walls[0]): an overcast or shaded crop whose exposure could not be
 * normalised (no light trim: `normalisation.ref` null) shows a wall darker than the sunlit colour the model was measured
 * from. Shading scales the channels together, so the chromaticity (r, g, b shares) stays the material's: the wall is
 * judged on it instead of lightness when the model is the lighter (by over `LIKENESS.dL`, at most `shadeMaxDL`), the
 * families agree, the wall is warm (red share - blue share >= SAME_MATERIAL.minWarmth, x100: brick, sandstone) and the
 * photo's chromaticity lies within SAME_MATERIAL.maxDist x the model's distance from neutral of the model's, and at
 * least SAME_MATERIAL.minChromaShare as far from neutral (measureFacade `sameMaterialClusters`, the same test for a lit
 * and a shaded cluster of one wall). Never when the photo is the lighter, or its exposure was normalised.
 */
export function shadedWallMatch(photoWall: Rgb, modelWall: Rgb, dL: number, normalised: boolean): boolean {
  if (normalised || dL <= LIKENESS.dL || dL > LIKENESS.shadeMaxDL) return false;
  const N3 = 100 / 3, m = chromaticity(modelWall), p = chromaticity(photoWall);
  if (m[0] - m[2] < SAME_MATERIAL.minWarmth) return false;
  const fromNeutral = (q: Rgb) => Math.hypot(q[0] - N3, q[1] - N3, q[2] - N3), mn = fromNeutral(m);
  return Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) <= SAME_MATERIAL.maxDist * mn && fromNeutral(p) >= SAME_MATERIAL.minChromaShare * mn;
}

/** Glazing differences of a photo grid against the model's: the largest per upper storey band, and the upper-storey mean. */
export function glazingMiss(pg: Pick<MaskGrid, 'storeyGlazing' | 'glazing'>, mg: Pick<MaskGrid, 'storeyGlazing' | 'glazing'>): {maxDiff: number | null; meanDiff: number} {
  const bands = pg.storeyGlazing.map((p, s) => (p !== null && mg.storeyGlazing[s] !== null && mg.storeyGlazing[s] !== undefined ? Math.abs(p - mg.storeyGlazing[s]!) : null)).filter((d): d is number => d !== null);
  return {maxDiff: bands.length ? Math.max(...bands) : null, meanDiff: Math.abs(pg.glazing - mg.glazing)};
}

/** Opening IoU over the cells both sides can see (facade cells only, above the ground band). */
export function notWallIoU(a: Uint8Array, b: Uint8Array, cols: number, rows: number, box: FacadeBox, cell: number, groundBandM = 2.5): number | null {
  let inter = 0, uni = 0, seen = 0;
  for (let j = 0; j < rows; j++) {
    if (box.v1 - (j + 0.5) * cell < groundBandM) continue;
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i; if (a[k] === MASK.unusable || b[k] === MASK.unusable) continue;
      seen++; const x = isOpeningCell(a[k]), y = isOpeningCell(b[k]);
      if (x && y) inter++; if (x || y) uni++;
    }
  }
  return seen >= 50 && uni > 0 ? inter / uni : null;
}

/** Widest stretch (m) of a mosaic that one crop from a camera under 8 m covers: per crop tag the summed width of its pieces. */
export function closeCameraSpan(pieces: readonly {u0: number; u1: number; crop: {tag: string; cameraDistM?: number}}[]): number {
  const span = new Map<string, number>();
  for (const q of pieces) if ((q.crop.cameraDistM ?? 99) < LIKENESS.minCameraM) span.set(q.crop.tag, (span.get(q.crop.tag) ?? 0) + q.u1 - q.u0);
  return Math.max(0, ...span.values());
}

/**
 * `cameraSpanM`: the widest stretch of the wall that a camera under 8 m away covers (a mosaic of segment crops, each
 * from its own nearby panorama, `all-walls.ts --segment`); default the whole box width (one crop for the wall).
 */
export function compareLikeness(a: {photo: FacadeMeasurement; padCells: number; model: ModelElevation; lines: number[]; obliquityDeg?: number; cameraDistM?: number; cameraSpanM?: number}): LikenessResult {
  const {photo, padCells} = a, cr = a.model.curtain;
  // curtain symmetry (file header): the model's curtain grid read as the photo reads one
  const curtainMode = !!cr && (a.model.system === 'curtain-wall' || photo.frontClass === 'curtain');
  const model: ModelElevation = curtainMode ? {...a.model, mask: cr.mask, wall: cr.wall, wallToday: cr.wallToday, wallSlot: cr.wallSlot, grid: cr.grid} : a.model;
  const {cols, rows, cell, box} = model;
  // best shift within +-PAD_M
  let best = {du: 0, dv: 0, iou: -1};
  for (let dv = -padCells; dv <= padCells; dv++) for (let du = -padCells; du <= padCells; du++) {
    const iou = notWallIoU(model.mask, photoWindow(photo, padCells, du, dv, cols, rows), cols, rows, box, cell);
    if (iou !== null && (iou > best.iou + 1e-9 || (Math.abs(iou - best.iou) < 1e-9 && Math.abs(du) + Math.abs(dv) < Math.abs(best.du) + Math.abs(best.dv)))) best = {du, dv, iou};
  }
  const clusterWin = photoClusterWindow(photo, padCells, best.du, best.dv, cols, rows), mg = model.grid;
  const rereads: string[] = [];
  // the photo's readings: its mask, and where it has an undecided blend cluster (measureFacade `altMask`) the mask with
  // that cluster as wall; the gate judges the reading nearer the model (the photo cannot tell which it is)
  const reading = (m: Uint8Array) => {
    const w = photoWindow({...photo, mask: m}, padCells, best.du, best.dv, cols, rows), panels = rereadPalePanels(w, clusterWin, photo, model);
    return {win: w, panels, pg: analyseMask({mask: w, cols, rows, cell, box, lines: a.lines})};
  };
  const first = reading(photo.mask), alt = photo.altMask ? reading(photo.altMask) : null;
  const miss = (r: typeof first) => { const g = glazingMiss(r.pg, mg); return Math.max((g.maxDiff ?? 0) / LIKENESS.storeyGlazing, g.meanDiff / LIKENESS.meanGlazing); };
  const chosen = alt && miss(alt) < miss(first) ? alt : first, {win, pg} = chosen;
  if (alt) rereads.push(`photo glazing ${first.pg.glazing.toFixed(2)} with the undecided blend cluster as not-wall, ${alt.pg.glazing.toFixed(2)} as wall: judged on the ${chosen === alt ? 'second' : 'first'}`);
  if (chosen.panels) rereads.push(`${(chosen.panels * cell * cell).toFixed(1)} m2 of pale photo openings read as the model's panels (solid cluster, colour within dE ${LIKENESS.panelMaxDE})`);
  const widthM = box.u1 - box.u0;
  const usable = (() => { let n = 0, u = 0; for (let j = 0; j < rows; j++) { if (box.v1 - (j + 0.5) * cell < 2.5) continue; for (let i = 0; i < cols; i++) { n++; if (win[j * cols + i] !== MASK.unusable) u++; } } return n ? u / n : 0; })();
  const abstain: string[] = [];
  if (usable < LIKENESS.minUsable) abstain.push(`usable upper cells ${(usable * 100).toFixed(0)} % < 40 %`);
  if (photo.foliageFraction > LIKENESS.maxFoliage) abstain.push(`foliage ${(photo.foliageFraction * 100).toFixed(0)} % > 25 %`);
  if (photo.washedOutFraction > LIKENESS.maxWashedOut) abstain.push(`washed out ${(photo.washedOutFraction * 100).toFixed(0)} % > 30 %`);
  if ((a.obliquityDeg ?? 0) > LIKENESS.maxObliquityDeg) abstain.push(`obliquity ${a.obliquityDeg} deg > 45`);
  const closeSpanM = a.cameraSpanM ?? widthM;
  if ((a.cameraDistM ?? 99) < LIKENESS.minCameraM && closeSpanM > LIKENESS.wideWallM) abstain.push(`camera ${a.cameraDistM} m < 8 m from a ${closeSpanM.toFixed(0)} m wall`);

  // wall colour
  const pw = photo.wall.normalised, mw = model.wall;
  const ph = rgbToHsl(pw), mh = mw ? rgbToHsl(mw) : null;
  let dHue: number | null = null;
  if (mh && Math.min(ph[1], mh[1]) > LIKENESS.satForHue) { dHue = mh[0] - ph[0]; if (dHue > 180) dHue -= 360; if (dHue < -180) dHue += 360; }
  // Families: the photo's from its texture and colour (measureFacade `material`; null = unresolved: a dark neutral that is
  // not smooth, which overcast brick and black paint both give); the model's from its colour, and where the colour alone
  // is unresolved, from the slot the kit draws (a brick slot is drawn as brick).
  const pFamResolved = photo.material ? photo.material.family : wallFamily(pw);
  const pFam = pFamResolved ?? wallFamily(pw);
  const mFam = mw ? (wallMaterialOf(mw, null).family ?? (model.wallSlot === 'brick' ? 'brick' : wallFamily(mw))) : null;
  const dL = mh ? mh[2] - ph[2] : null;
  const famPass = pFamResolved === null || pFamResolved === mFam;
  const huePass = dHue === null || Math.abs(dHue) <= LIKENESS.hueDeg;
  const shaded = !!mw && famPass && huePass && Math.abs(dL!) > LIKENESS.dL && shadedWallMatch(pw, mw, dL!, photo.normalisation.ref !== null);
  const wallPass = !!mw && famPass && (Math.abs(dL!) <= LIKENESS.dL || shaded) && huePass;
  // glazing per upper storey band
  const {maxDiff, meanDiff} = glazingMiss(pg, mg);
  // the photo's opening pass abstains where it cannot tell frames from bands: no glazing verdict there (a warning)
  const glazingAbstain = photo.openings?.abstain ?? null;
  const glazingPass = glazingAbstain !== null || ((maxDiff === null || maxDiff <= LIKENESS.storeyGlazing) && meanDiff <= LIKENESS.meanGlazing);
  // columns and window shape (not where the photo shows no rhythm: curtain walls, blank fronts)
  const rhythmic = pg.frontClass !== 'curtain' && pg.frontClass !== 'blank';
  const pW = pg.windowColumns, mW = mg.windowColumns;
  const gridColPass = !rhythmic || pW === null ? null : mW !== null && Math.abs(mW - pW) <= LIKENESS.columns * pW;
  const gridShapePass = !rhythmic || !pg.window ? null : !!mg.window && mg.window.shape === pg.window.shape;
  // Per-storey opening sequences (rowOpenings.ts, GitHub #58): a row of mixed windows (a wide 3-4-light window and two
  // narrow slots, repeated) folds into one typical window and a pitch that counts every slot, so the fold calls an
  // exact model "wide vs tall" and 4 columns vs 16 (Stadsloket Zuidoost walls[2]). Where the photo's window storeys are
  // a mixed-width row (no shape class holds 80 % of their measured openings, and the p90 opening is at least 1.8 x the
  // median: wide windows among narrow ones, not shape noise on alike windows) and the model's sequences match them on all three
  // counts (openings per storey within 20 %, shape mix within 0.35, median and p90 widths within x1.5), the sequences
  // judge the shape and the columns instead of the fold. Everywhere else the fold judges as before: a uniform row, or a
  // mixed row the model does not reproduce, keeps the fold's verdict (the gate is not looser).
  // the photo's wall-coloured cells, so a ribbon is cut where it is brick or a sill course (rowOpenings `wallLike`)
  const wallLike = photo.clusters ? Uint8Array.from(clusterWin, c => (c >= 0 && photo.clusters![c]?.wall ? 1 : 0)) : undefined;
  const openings = rhythmic ? compareRowOpenings(rowOpenings({mask: win, cols, rows, cell, box, lines: a.lines, wallLike}), rowOpenings({mask: model.mask, cols, rows, cell, box, lines: a.lines})) : undefined;
  const mixedRow = !!openings && openings.mixPass !== null && Math.max(...Object.values(openings.photo.mix)) < ROW_OPENINGS.uniformShare
    && openings.photo.widthP50 !== null && openings.photo.widthP90 !== null && openings.photo.widthP90 >= ROW_OPENINGS.mixedWidthRatio * openings.photo.widthP50;
  const sequenceMatch = mixedRow && openings!.countPass === true && openings!.mixPass === true && openings!.widthPass === true;
  const colPass = sequenceMatch && gridColPass === false ? true : gridColPass;
  const shapePass = sequenceMatch && gridShapePass === false ? true : gridShapePass;
  const reasons: string[] = [];
  if (!wallPass) reasons.push(`wall ${!mw ? 'not drawn' : !famPass ? `family ${mFam} vs photo ${pFam}` : Math.abs(dL!) > LIKENESS.dL ? `dL ${dL! > 0 ? '+' : ''}${dL!.toFixed(2)}` : `hue ${dHue!.toFixed(0)} deg`}`);
  if (!glazingPass) reasons.push(`glazing ${maxDiff !== null && maxDiff > LIKENESS.storeyGlazing ? `storey band off by ${maxDiff.toFixed(2)}` : ''}${meanDiff > LIKENESS.meanGlazing ? ` mean ${mg.glazing.toFixed(2)} vs photo ${pg.glazing.toFixed(2)}` : ''}`.trim());
  // column count: WARN only until bay-pitch detection is reliable (it counts mullion halves and ribbon panes as columns:
  // Spinoza Lyceum 30 vs 16 bays, Wibautstraat 78 28 vs 8 ribbons, both reading right on the sheet)
  const warns: string[] = [];
  if (glazingAbstain) warns.push(`glazing not judged (${glazingAbstain})`);
  if (shaded) warns.push(`wall judged on chromaticity: the photo's exposure is not normalised and the wall reads ${dL! > 0 ? '+' : ''}${dL!.toFixed(2)} darker than the model's in shade or overcast light`);
  if (pFamResolved === null) warns.push(`wall family unresolved (${hex(pw)} is dark and neutral, brick courses not resolved): lightness and hue judged only`);
  if (colPass === false) warns.push(`columns ${mW ?? 'none'} vs photo ${pW}`);
  if (shapePass === false) reasons.push(`window shape ${mg.window?.shape ?? 'none'} vs photo ${pg.window!.shape}`);
  // a storey that is a ribbon on one side and windows on the other (rowOpenings `rowMismatch`): a FAIL whatever the fold says
  if (openings?.rowMismatch.length) reasons.push(...openings.reasons.filter(r => r.startsWith('storey ')));
  const iou = best.iou >= 0 ? +best.iou.toFixed(3) : null;
  const verdict = likenessVerdict({abstain, fails: reasons, warns, iou});
  if (verdict === 'WARN' || verdict === 'FAIL') reasons.push(...warns);
  if (verdict === 'WARN' && iou !== null && iou < LIKENESS.iouWarn) reasons.push(`mask IoU ${iou} < 0.45`);
  const pm = nearestMaterial(pw, pFam === 'paint' ? 'paint' : pFam), mm = mw && mFam ? nearestMaterial(mw, mFam === 'paint' ? 'paint' : mFam) : null;
  return {verdict, reasons: abstain.length ? abstain : reasons, shift: {uM: +(best.du * cell).toFixed(2), vM: +(best.dv * cell).toFixed(2)}, iou,
    wall: {photo: photo.wall.hex, photoRaw: photo.wall.rawHex, model: mw ? hex(mw) : null, modelToday: model.wallToday ? hex(model.wallToday) : null, photoFamily: pFamResolved ?? 'unresolved', modelFamily: mFam, photoMaterial: pm.material.id, modelMaterial: mm?.material.id ?? null, dL: dL === null ? null : +dL.toFixed(3), dHue: dHue === null ? null : +dHue.toFixed(1), pass: wallPass},
    glass: {photo: photo.glass?.hex ?? null, model: model.glass ? hex(model.glass) : null},
    glazing: {photo: pg.storeyGlazing, model: mg.storeyGlazing, photoMean: pg.glazing, modelMean: mg.glazing, maxDiff: maxDiff === null ? null : +maxDiff.toFixed(3), meanDiff: +meanDiff.toFixed(3), pass: glazingPass},
    columns: {photo: pg.columns, model: mg.columns, windows: {photo: pW, model: mW}, pass: colPass}, photoGrid: {pitchM: pg.pitchM, window: pg.window}, shape: {photo: pg.window?.shape ?? null, model: mg.window?.shape ?? null, pass: shapePass}, ...(openings ? {openings: {...openings, sequenceMatch}} : {}),
    classes: {photo: pg.frontClass, model: mg.frontClass}, ground: {photo: pg.ground.glazing, model: mg.ground.glazing},
    evidence: {usable: +usable.toFixed(3), foliage: photo.foliageFraction, washedOut: photo.washedOutFraction, obliquityDeg: a.obliquityDeg ?? null, cameraDistM: a.cameraDistM ?? null, widthM: +widthM.toFixed(2), abstain},
    ...(rereads.length ? {rereads} : {}),
    ...(curtainMode ? {modelReading: `curtain grid ${hex(cr.mullion)} read as the photo reads one: wall ${hex(cr.wall)} (${cr.wall === cr.mullion ? 'the grid' : 'the spandrels'}), model glazing ${a.model.grid.glazing.toFixed(2)} -> ${cr.grid.glazing.toFixed(2)}`} : {})};
}

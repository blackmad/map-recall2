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
 *   saturations exceed 0.08 (as blockFace/wallColour.ts);
 * - glazing: not-wall share per upper storey band within 0.15, and the upper-storey mean within 0.10;
 * - columns: the column count (autocorrelation of the upper-storey not-wall profile) within 20 %, and the same window
 *   shape class (tall > 1.4 / square / wide < 0.7, height over width);
 * - report only: not-wall mask IoU (WARN under 0.45), glass colour, the ground band (0..2.5 m, never pooled).
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
import {analyseMask, hex, isOpeningCell, MASK, rgbToLab, wallMaterialOf, type FacadeBox, type FacadeMeasurement, type MaskGrid, type Rgb} from './measureFacade.ts';

export const PAD_M = 0.5;
export const LIKENESS = {dL: 0.12, hueDeg: WALL_TOLERANCE.hueDeg, satForHue: 0.08, storeyGlazing: 0.15, meanGlazing: 0.1, columns: 0.2, iouWarn: 0.45,
  minUsable: 0.4, maxFoliage: 0.25, maxWashedOut: 0.3, maxObliquityDeg: 45, minCameraM: 8, wideWallM: 15} as const;
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
}

/** The model's elevation of one panel on the box (panel u, height above ground), classed like the photo. */
export function modelElevation(soup: MaterialSoup, panel: PanelFrame, box: FacadeBox, lines: number[], cell = 0.1, measuredTints?: Set<string>): ModelElevation {
  const bearing = (Math.atan2(panel.n[0], -panel.n[2]) * 180 / Math.PI + 360) % 360;
  const nx = Math.sin(bearing * Math.PI / 180), nz = -Math.cos(bearing * Math.PI / 180), tx = nz, tz = -nx;
  const tOf = (u: number) => (panel.o[0] + panel.r[0] * u) * tx + (panel.o[2] + panel.r[2] * u) * tz;
  const t0 = Math.min(tOf(box.u0), tOf(box.u1)), t1 = Math.max(tOf(box.u0), tOf(box.u1));
  // the band is pinned to the panel's own plane (+1 m for canopies, balconies, column bays standing proud), not to the
  // front-most geometry in the span: Waagdragerhof's warehouse front (walls[2]) sits 10+ m behind a nearer volume
  const frontDepth = panel.o[0] * nx + panel.o[2] * nz + 1;
  const el = renderElevation(soup, {name: 'panel', bearing, span: [t0 - 0.05, t1 + 0.05], depthBand: 2.5, frontDepth}, cell);
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
  return {cols, rows, cell, box, mask, colours, wall, wallToday, glass: glassCells[0] ?? null, wallSlot: wallMat >= 0 ? slotOf[wallMat] : null, grid};
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
  columns: {photo: number | null; model: number | null; pass: boolean | null};
  /** the photo's grid on the model's box after the shift (what `columns` and `shape` are judged on): its bay pitch and folded window */
  photoGrid: {pitchM: number | null; window: MaskGrid['window']};
  shape: {photo: string | null; model: string | null; pass: boolean | null};
  classes: {photo: string; model: string};
  ground: {photo: number | null; model: number | null};
  evidence: {usable: number; foliage: number; washedOut: number; obliquityDeg: number | null; cameraDistM: number | null; widthM: number; abstain: string[]};
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
  const {photo, model, padCells} = a, {cols, rows, cell, box} = model;
  // best shift within +-PAD_M
  let best = {du: 0, dv: 0, iou: -1};
  for (let dv = -padCells; dv <= padCells; dv++) for (let du = -padCells; du <= padCells; du++) {
    const iou = notWallIoU(model.mask, photoWindow(photo, padCells, du, dv, cols, rows), cols, rows, box, cell);
    if (iou !== null && (iou > best.iou + 1e-9 || (Math.abs(iou - best.iou) < 1e-9 && Math.abs(du) + Math.abs(dv) < Math.abs(best.du) + Math.abs(best.dv)))) best = {du, dv, iou};
  }
  const win = photoWindow(photo, padCells, best.du, best.dv, cols, rows);
  const pg = analyseMask({mask: win, cols, rows, cell, box, lines: a.lines}), mg = model.grid;
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
  const wallPass = !!mw && famPass && Math.abs(dL!) <= LIKENESS.dL && (dHue === null || Math.abs(dHue) <= LIKENESS.hueDeg);
  // glazing per upper storey band
  const bands = pg.storeyGlazing.map((p, s) => (p !== null && mg.storeyGlazing[s] !== null && mg.storeyGlazing[s] !== undefined ? Math.abs(p - mg.storeyGlazing[s]!) : null)).filter((d): d is number => d !== null);
  const maxDiff = bands.length ? Math.max(...bands) : null;
  const meanDiff = Math.abs(pg.glazing - mg.glazing);
  // the photo's opening pass abstains where it cannot tell frames from bands: no glazing verdict there (a warning)
  const glazingAbstain = photo.openings?.abstain ?? null;
  const glazingPass = glazingAbstain !== null || ((maxDiff === null || maxDiff <= LIKENESS.storeyGlazing) && meanDiff <= LIKENESS.meanGlazing);
  // columns and window shape (not where the photo shows no rhythm: curtain walls, blank fronts)
  const rhythmic = pg.frontClass !== 'curtain' && pg.frontClass !== 'blank';
  const colPass = !rhythmic || pg.columns === null ? null : mg.columns !== null && Math.abs(mg.columns - pg.columns) <= LIKENESS.columns * pg.columns;
  const shapePass = !rhythmic || !pg.window ? null : !!mg.window && mg.window.shape === pg.window.shape;
  const reasons: string[] = [];
  if (!wallPass) reasons.push(`wall ${!mw ? 'not drawn' : !famPass ? `family ${mFam} vs photo ${pFam}` : Math.abs(dL!) > LIKENESS.dL ? `dL ${dL! > 0 ? '+' : ''}${dL!.toFixed(2)}` : `hue ${dHue!.toFixed(0)} deg`}`);
  if (!glazingPass) reasons.push(`glazing ${maxDiff !== null && maxDiff > LIKENESS.storeyGlazing ? `storey band off by ${maxDiff.toFixed(2)}` : ''}${meanDiff > LIKENESS.meanGlazing ? ` mean ${mg.glazing.toFixed(2)} vs photo ${pg.glazing.toFixed(2)}` : ''}`.trim());
  // column count: WARN only until bay-pitch detection is reliable (it counts mullion halves and ribbon panes as columns:
  // Spinoza Lyceum 30 vs 16 bays, Wibautstraat 78 28 vs 8 ribbons, both reading right on the sheet)
  const warns: string[] = [];
  if (glazingAbstain) warns.push(`glazing not judged (${glazingAbstain})`);
  if (pFamResolved === null) warns.push(`wall family unresolved (${hex(pw)} is dark and neutral, brick courses not resolved): lightness and hue judged only`);
  if (colPass === false) warns.push(`columns ${mg.columns ?? 'none'} vs photo ${pg.columns}`);
  if (shapePass === false) reasons.push(`window shape ${mg.window?.shape ?? 'none'} vs photo ${pg.window!.shape}`);
  const iou = best.iou >= 0 ? +best.iou.toFixed(3) : null;
  const verdict = likenessVerdict({abstain, fails: reasons, warns, iou});
  if (verdict === 'WARN' || verdict === 'FAIL') reasons.push(...warns);
  if (verdict === 'WARN' && iou !== null && iou < LIKENESS.iouWarn) reasons.push(`mask IoU ${iou} < 0.45`);
  const pm = nearestMaterial(pw, pFam === 'paint' ? 'paint' : pFam), mm = mw && mFam ? nearestMaterial(mw, mFam === 'paint' ? 'paint' : mFam) : null;
  return {verdict, reasons: abstain.length ? abstain : reasons, shift: {uM: +(best.du * cell).toFixed(2), vM: +(best.dv * cell).toFixed(2)}, iou,
    wall: {photo: photo.wall.hex, photoRaw: photo.wall.rawHex, model: mw ? hex(mw) : null, modelToday: model.wallToday ? hex(model.wallToday) : null, photoFamily: pFamResolved ?? 'unresolved', modelFamily: mFam, photoMaterial: pm.material.id, modelMaterial: mm?.material.id ?? null, dL: dL === null ? null : +dL.toFixed(3), dHue: dHue === null ? null : +dHue.toFixed(1), pass: wallPass},
    glass: {photo: photo.glass?.hex ?? null, model: model.glass ? hex(model.glass) : null},
    glazing: {photo: pg.storeyGlazing, model: mg.storeyGlazing, photoMean: pg.glazing, modelMean: mg.glazing, maxDiff: maxDiff === null ? null : +maxDiff.toFixed(3), meanDiff: +meanDiff.toFixed(3), pass: glazingPass},
    columns: {photo: pg.columns, model: mg.columns, pass: colPass}, photoGrid: {pitchM: pg.pitchM, window: pg.window}, shape: {photo: pg.window?.shape ?? null, model: mg.window?.shape ?? null, pass: shapePass},
    classes: {photo: pg.frontClass, model: mg.frontClass}, ground: {photo: pg.ground.glazing, model: mg.ground.glazing},
    evidence: {usable: +usable.toFixed(3), foliage: photo.foliageFraction, washedOut: photo.washedOutFraction, obliquityDeg: a.obliquityDeg ?? null, cameraDistM: a.cameraDistM ?? null, widthM: +widthM.toFixed(2), abstain}};
}

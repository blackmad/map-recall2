/**
 * Per-house likeness: each wall group's main panel is paired with an archived crop (cropToPanel.ts), the photo is
 * measured (measureFacade.ts) and compared with the model's elevation (likeness.ts). Used by `large.ts` (contact
 * sheet header, report.json `likeness`), `measure.ts` (measured.json, intent fields) and `install-large.ts` (refuses
 * FAIL / NO EVIDENCE on a photographed group). Crops come from `$MAP_RECALL_SOURCE_DATA/pand-reference-walls/<pand>/`
 * (`all-walls.ts --archive`); without that variable the house has no likeness (`null`).
 */
import {lightBands, type LightBand} from '../../src/canalRecall/buildingRecipe/lightBands.ts';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {CompiledLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {panelEaves} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {CROP_MIN_OVERLAP, cropsOfWallsJson, panelCoverageStraight, type CropMatch, type CropWall} from '../../src/canalRecall/buildingRecipe/cropToPanel.ts';
import {insidePanel} from '../../src/canalRecall/blockBuilding/panels.ts';
import {measureFacade, MASK, type FacadeBox, type FacadeImage, type FacadeMeasurement} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {closeCameraSpan, compareLikeness, LIKENESS, modelElevation, PAD_M, type LikenessResult, type ModelElevation} from '../../src/canalRecall/buildingRecipe/likeness.ts';
import {loadMaterialSoup} from '../landmarks/material-soup.ts';
import {pandWallsDir, sha256Of, sourceDataRoot, sourceRef} from './sourceData.ts';

export interface GroupLikeness {
  group: number; panel: number; status: 'measured' | 'no-photo';
  /** the crop covering most of the panel, and every piece of the mosaic (cropToPanel `panelCoverage`) */
  crop?: CropWall & {ref: string}; match?: CropMatch; pieces?: {tag: string; ref: string; sha256?: string; capturedAt?: string; u0: number; u1: number}[]; coverage?: number;
  box?: FacadeBox; photo?: FacadeMeasurement; model?: ModelElevation; likeness?: LikenessResult;
  /** the photo mosaic (RGB) on the model's box after the best shift, for the sheet */
  photoRgb?: {data: Buffer; width: number; height: number};
  /** the padded photo mosaic as measured (metric image, its box and the fit lines), for sheets and probes */
  photoImage?: {image: FacadeImage; box: FacadeBox; lines: number[]; inside?: (u: number, v: number) => boolean};
  /** the model and comparison inputs, so a review script can replay another measurement or likeness version on this group */
  replay?: {soup: Parameters<typeof modelElevation>[0]; panel: Parameters<typeof modelElevation>[1]; measuredTints?: Set<string>; obliquityDeg: number; cameraDistM: number; cameraSpanM?: number};
  /** measured values for the intent: on the panel's own width (bays) */
  measured?: {wall: string; wallRaw: string; glass: string | null; trim: string | null; glazing: number; storeyGlazing: (number | null)[]; ground: number | null; bays: number | null; pitchM: number | null; storeyM: number | null;
    window: FacadeMeasurement['window']; frontClass: FacadeMeasurement['frontClass']; normalisation: FacadeMeasurement['normalisation']; usable: number; foliage: number; washedOut: number;
    /** two wall materials along the panel (at = fraction of the panel width from uMin), null when one colour */
    split: FacadeMeasurement['split'];
    /** the front's colour segments along the panel (fractions of the panel width from uMin; rowSplit.ts) */
    rowJoints?: NonNullable<FacadeMeasurement['rowJoints']>;
    /** light horizontal bands across the wall (lightBands.ts), bottom to top; absent in older reports */
    lightBands?: LightBand[]};
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const PPM = 50;

export async function houseLikeness(built: CompiledLargeBuilding, glbFile: string, measuredTints?: Set<string>): Promise<GroupLikeness[] | null> {
  if (!sourceDataRoot()) return null;
  const pand = built.recipe.pandId, dir = pandWallsDir(pand), wallsFile = path.join(dir, 'walls.json');
  if (!fs.existsSync(wallsFile)) return null;
  const crops = cropsOfWallsJson(JSON.parse(fs.readFileSync(wallsFile, 'utf8')));
  const soup = await loadMaterialSoup(glbFile);
  const decoded = new Map<string, {rgb: Buffer; valid?: Uint8Array; width: number; height: number}>();
  const load = async (c: CropWall) => {
    if (decoded.has(c.tag)) return decoded.get(c.tag)!;
    const bytes = fs.readFileSync(path.join(dir, c.file));
    if (c.sha256 && sha256Of(bytes) !== c.sha256) throw Error(`${c.file}: sha256 differs from walls.json`);
    const {data, info} = await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const maskFile = path.join(dir, c.file.replace(/\.jpg$/, '.mask.png'));
    const valid = fs.existsSync(maskFile) ? new Uint8Array(await sharp(maskFile).extractChannel(0).raw().toBuffer()) : undefined;
    const d = {rgb: data, valid, width: info.width, height: info.height}; decoded.set(c.tag, d); return d;
  };
  const out: GroupLikeness[] = [];
  const g0 = built.facts.heights.groundNAP;
  for (const g of built.recipe.groups) {
    if (g.mainPanel === null || g.system === 'blank') continue;
    const p = built.panels[g.mainPanel];
    const {pieces, coverage} = panelCoverageStraight(crops, p, built.anchorRD, LIKENESS.maxObliquityDeg);
    if (coverage < CROP_MIN_OVERLAP || !pieces.length) { out.push({group: g.index, panel: p.index, status: 'no-photo', coverage}); continue; }
    // Mosaic in panel metres (u from uMin - pad, v from the ground), each column from its piece's crop.
    const box: FacadeBox = {u0: p.uMin, u1: p.uMax, v0: Math.max(0, p.vMin), v1: panelEaves(p)};
    const W = box.u1 - box.u0 + 2 * PAD_M, H = box.v1 - box.v0 + 2 * PAD_M, topM = box.v1 + PAD_M;
    const width = Math.round(W * PPM), height = Math.round(H * PPM), rgb = new Uint8Array(width * height * 3), valid = new Uint8Array(width * height);
    for (const piece of pieces) {
      const c = piece.crop, img = await load(c), k = (piece.match.alongAtUMax - piece.match.alongAtUMin) / Math.max(1e-6, p.uMax - p.uMin), cTop = c.baseZ + c.wallHeightM - g0;
      const lo = piece.u0 === pieces[0].u0 ? piece.u0 - PAD_M : piece.u0, hi = piece.u1 === pieces[pieces.length - 1].u1 ? piece.u1 + PAD_M : piece.u1;
      for (let x = Math.max(0, Math.floor((lo - box.u0 + PAD_M) * PPM)); x < Math.min(width, Math.ceil((hi - box.u0 + PAD_M) * PPM)); x++) {
        const u = box.u0 - PAD_M + (x + 0.5) / PPM, cx = Math.floor((piece.match.alongAtUMin + (u - p.uMin) * k) * c.ppm);
        if (cx < 0 || cx >= img.width) continue;
        for (let y = 0; y < height; y++) {
          const v = topM - (y + 0.5) / PPM, cy = Math.floor((cTop - v) * c.ppm);
          if (cy < 0 || cy >= img.height) continue;
          const q = cy * img.width + cx;
          if (img.valid && img.valid[q] < 128) continue;
          const o = y * width + x; valid[o] = 255; rgb[o * 3] = img.rgb[q * 3]; rgb[o * 3 + 1] = img.rgb[q * 3 + 1]; rgb[o * 3 + 2] = img.rgb[q * 3 + 2];
        }
      }
    }
    const image = {width, height, rgb, valid, ppm: PPM, topM};
    const photoBox: FacadeBox = {u0: 0, u1: W, v0: box.v0 - PAD_M, v1: topM};
    const inside = (u: number, v: number) => insidePanel(p, [u + box.u0 - PAD_M, v]);
    const photo = measureFacade({image, box: photoBox, lines: g.lines, inside});
    const model = modelElevation(soup, p, box, g.lines, 0.1, measuredTints, g.loggiaDepthM !== undefined ? g.loggiaDepthM + 0.1 : undefined);
    const main = [...pieces].sort((a, b) => (b.u1 - b.u0) - (a.u1 - a.u0))[0];
    const replay = {soup, panel: p, measuredTints, obliquityDeg: Math.max(...pieces.map(q => q.crop.obliquityDeg ?? 0)), cameraDistM: Math.min(...pieces.map(q => q.crop.cameraDistM ?? 99)),
      ...(pieces.length > 1 ? {cameraSpanM: closeCameraSpan(pieces)} : {})};
    const likeness = compareLikeness({photo, padCells: Math.round(PAD_M / photo.cell), model, lines: g.lines, obliquityDeg: replay.obliquityDeg, cameraDistM: replay.cameraDistM, cameraSpanM: replay.cameraSpanM});
    // the mosaic on the model box after the shift, for the sheet
    const x0 = Math.max(0, Math.round((PAD_M + likeness.shift.uM) * PPM)), wpx = Math.min(width - x0, Math.round((box.u1 - box.u0) * PPM));
    const y0 = Math.max(0, Math.round((PAD_M - likeness.shift.vM) * PPM)), hpx = Math.min(height - y0, Math.round((box.v1 - box.v0) * PPM));
    const photoRgb = wpx > 4 && hpx > 4 ? {data: await sharp(Buffer.from(rgb), {raw: {width, height, channels: 3}}).extract({left: x0, top: y0, width: wpx, height: hpx}).raw().toBuffer(), width: wpx, height: hpx} : undefined;
    const bays = photo.pitchM ? Math.max(1, Math.round((box.u1 - box.u0) / photo.pitchM)) : null;
    const toPanel = (f: number) => r3(Math.max(0, Math.min(1, (box.u0 - PAD_M + f * W - p.uMin) / Math.max(1e-6, p.uMax - p.uMin))));
    out.push({group: g.index, panel: p.index, status: 'measured', crop: {...main.crop, ref: sourceRef(pand, main.crop.file)}, match: main.match, coverage,
      pieces: pieces.map(q => ({tag: q.crop.tag, ref: sourceRef(pand, q.crop.file), sha256: q.crop.sha256, capturedAt: q.crop.capturedAt, u0: r3(q.u0 - p.uMin), u1: r3(q.u1 - p.uMin)})),
      box, photo, model, likeness, photoRgb, photoImage: {image, box: photoBox, lines: g.lines, inside}, replay,
      measured: {wall: photo.wall.hex, wallRaw: photo.wall.rawHex, glass: photo.glass?.hex ?? null, trim: photo.trim?.hex ?? null, glazing: photo.glazing, storeyGlazing: photo.storeyGlazing, ground: photo.ground.glazing, bays,
        pitchM: photo.pitchM, storeyM: photo.storeyM, window: photo.window, frontClass: photo.frontClass, normalisation: photo.normalisation, usable: photo.usableFraction, foliage: photo.foliageFraction, washedOut: photo.washedOutFraction,
        // the colour split as a fraction of the panel width from uMin (the photo box is padded by PAD_M)
        lightBands: lightBands(photo, g.lines, {image, wall: photo.wall.raw}),
        split: photo.split ? {...photo.split, at: r3(Math.max(0, Math.min(1, (box.u0 - PAD_M + photo.split.at * W - p.uMin) / Math.max(1e-6, p.uMax - p.uMin))))} : null,
        ...(photo.rowJoints ? {rowJoints: photo.rowJoints.map(s => ({...s, from: toPanel(s.from), to: toPanel(s.to)}))} : {})}});
  }
  return out;
}

/** report.json / measured.json form (no masks or pixels). */
export function likenessSummary(groups: GroupLikeness[]) {
  return groups.map(g => g.status === 'no-photo' ? {group: g.group, panel: g.panel, verdict: 'NO PHOTO', coverage: g.coverage} : {
    group: g.group, panel: g.panel, verdict: g.likeness!.verdict, reasons: g.likeness!.reasons,
    crop: {ref: g.crop!.ref, sha256: g.crop!.sha256, panoId: g.crop!.panoId, capturedAt: g.crop!.capturedAt, obliquityDeg: g.crop!.obliquityDeg, cameraDistM: g.crop!.cameraDistM},
    pieces: g.pieces, coverage: g.coverage,
    placement: {offsetM: g.match!.offsetM, angleDeg: g.match!.angleDeg, overlap: g.match!.overlapFraction, along: [g.match!.alongAtUMin, g.match!.alongAtUMax], shift: g.likeness!.shift, box: g.box && {u0: r3(g.box.u0), u1: r3(g.box.u1), v0: r3(g.box.v0), v1: r3(g.box.v1)}},
    likeness: {...g.likeness!, reasons: undefined, verdict: undefined}, measured: g.measured,
  });
}

// ---- sheet ------------------------------------------------------------------------------------------------------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Row 1 (photo with masks hatched | model elevation in game tints | 50 % overlay) and row 2 (swatches, numbers, verdict). */
export async function likenessRows(g: GroupLikeness, maxWidth = 640): Promise<{row1: Buffer; row2: Buffer; width: number}> {
  const box = g.box!, model = g.model!, like = g.likeness!, photo = g.photo!;
  const W = box.u1 - box.u0, H = box.v1 - box.v0, S = Math.max(4, Math.min(30, maxWidth / W, 420 / H)), pw = Math.round(W * S), ph = Math.round(H * S);
  const photoImg = g.photoRgb ? await sharp(g.photoRgb.data, {raw: {width: g.photoRgb.width, height: g.photoRgb.height, channels: 3}}).resize(pw, ph, {fit: 'fill'}).raw().toBuffer() : Buffer.alloc(pw * ph * 3, 200);
  // hatch the photo's mask (at the best shift): glazing blue, light trim amber, unusable grey
  const pad = Math.round(PAD_M / photo.cell), du = Math.round(like.shift.uM / photo.cell), dv = Math.round(like.shift.vM / photo.cell);
  const hatched = Buffer.from(photoImg);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = Math.floor(x / S / photo.cell) + pad + du, j = Math.floor(y / S / photo.cell) + pad - dv;
    const m = i >= 0 && j >= 0 && i < photo.cols && j < photo.rows ? photo.mask[j * photo.cols + i] : MASK.unusable;
    const on = (x + y) % 7 < 2, q = (y * pw + x) * 3;
    const col = m === MASK.dark ? [40, 120, 255] : m === MASK.trim ? [255, 190, 40] : m === MASK.unusable ? [128, 128, 128] : null;
    if (col && on) { hatched[q] = col[0]; hatched[q + 1] = col[1]; hatched[q + 2] = col[2]; }
  }
  const modelImg = Buffer.alloc(pw * ph * 3);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = Math.min(model.cols - 1, Math.floor(x / S / model.cell)), j = Math.min(model.rows - 1, Math.floor(y / S / model.cell)), k = j * model.cols + i, q = (y * pw + x) * 3;
    modelImg[q] = model.colours[k * 3]; modelImg[q + 1] = model.colours[k * 3 + 1]; modelImg[q + 2] = model.colours[k * 3 + 2];
  }
  const overlay = Buffer.alloc(pw * ph * 3);
  for (let q = 0; q < overlay.length; q++) overlay[q] = (photoImg[q] + modelImg[q]) >> 1;
  const png = (b: Buffer) => sharp(b, {raw: {width: pw, height: ph, channels: 3}}).png().toBuffer();
  const gap = 8, cap = 26, width = pw * 3 + gap * 2;
  const caption = (t: string) => Buffer.from(`<svg width="${pw}" height="${cap}"><rect width="100%" height="100%" fill="#1f2328"/><text x="6" y="18" font-family="Helvetica, Arial" font-size="14" fill="#fff">${esc(t)}</text></svg>`);
  const row1 = await sharp({create: {width, height: ph + cap, channels: 3, background: '#f4f4f2'}}).composite([
    {input: caption(`photo ${g.pieces!.map(q => `${q.tag} ${q.capturedAt}`).join(' + ')} (glazing blue, trim amber, unusable grey)`), left: 0, top: 0}, {input: await png(hatched), left: 0, top: cap},
    {input: caption('model elevation, game tints, same px/m'), left: pw + gap, top: 0}, {input: await png(modelImg), left: pw + gap, top: cap},
    {input: caption(`50 % overlay (shift ${like.shift.uM} m along, ${like.shift.vM} m up)`), left: 2 * (pw + gap), top: 0}, {input: await png(overlay), left: 2 * (pw + gap), top: cap},
  ]).png().toBuffer();
  const sw = (x: number, c: string | null, label: string) => `<rect x="${x}" y="10" width="54" height="40" fill="${c ?? '#ffffff'}" stroke="#333"/>${c ? '' : `<line x1="${x}" y1="10" x2="${x + 54}" y2="50" stroke="#c00"/>`}<text x="${x}" y="66" font-family="Helvetica, Arial" font-size="11" fill="#1f2328">${esc(label)}</text><text x="${x}" y="79" font-family="Helvetica, Arial" font-size="11" fill="#555">${c ?? '-'}</text>`;
  const L = like, colour = {PASS: '#1a7f37', WARN: '#9a6700', FAIL: '#cf222e', 'NO EVIDENCE': '#57606a'}[L.verdict];
  const pct = (v: number | null) => (v === null ? '-' : (v * 100).toFixed(0));
  const lines = [
    `wall: photo ${L.wall.photoFamily} (${L.wall.photoMaterial}) vs model ${L.wall.modelFamily ?? '-'} (${L.wall.modelMaterial ?? '-'}), dL ${L.wall.dL ?? '-'}${L.wall.dHue !== null ? `, dHue ${L.wall.dHue}` : ''} ${L.wall.pass ? 'ok' : 'FAIL'}`,
    `glazing % per upper storey: photo ${L.glazing.photo.slice(1).map(pct).join(' ')} | model ${L.glazing.model.slice(1).map(pct).join(' ')}; mean ${pct(L.glazing.photoMean)} vs ${pct(L.glazing.modelMean)} ${L.glazing.pass ? 'ok' : 'FAIL'}`,
    `columns ${L.columns.photo ?? '-'} vs ${L.columns.model ?? '-'} ${L.columns.pass === null ? 'n/a' : L.columns.pass ? 'ok' : 'FAIL'}; window ${L.shape.photo ?? '-'} vs ${L.shape.model ?? '-'} ${L.shape.pass === null ? 'n/a' : L.shape.pass ? 'ok' : 'FAIL'}; class ${L.classes.photo} vs ${L.classes.model}`,
    `mask IoU ${L.iou ?? '-'} (report only, warn < 0.45); ground band glazing ${pct(L.ground.photo)} vs ${pct(L.ground.model)} %; usable ${pct(L.evidence.usable)} %, foliage ${pct(L.evidence.foliage)} %, washed ${pct(L.evidence.washedOut)} %`,
  ];
  const h2 = 200;
  const svg = `<svg width="${width}" height="${h2}"><rect width="100%" height="100%" fill="#ffffff"/>
    ${sw(10, photo.wall.rawHex, 'photo wall raw')}${sw(80, photo.wall.hex, 'normalised')}${sw(150, L.wall.model, 'model wall')}${sw(220, photo.glass?.hex ?? null, 'photo not-wall')}${sw(290, L.glass.model, 'model glass')}
    ${lines.map((t, i) => `<text x="370" y="${22 + i * 18}" font-family="Helvetica, Arial" font-size="13" fill="#1f2328">${esc(t)}</text>`).join('')}
    <text x="10" y="128" font-family="Helvetica, Arial" font-size="34" font-weight="bold" fill="${colour}">${L.verdict}</text>
    <text x="10" y="156" font-family="Helvetica, Arial" font-size="14" fill="${colour}">${esc(L.reasons.join('; ') || 'colour, glazing, columns and window shape read the same')}</text>
    <text x="10" y="184" font-family="Helvetica, Arial" font-size="11" fill="#57606a">${esc(`exposure: ${photo.normalisation.method}, gain ${photo.normalisation.gain}; placement offset ${g.match!.offsetM} m, angle ${g.match!.angleDeg} deg, overlap ${pct(g.match!.overlapFraction)} %; obliquity ${g.crop!.obliquityDeg} deg, camera ${g.crop!.cameraDistM} m`)}</text></svg>`;
  return {row1, row2: await sharp(Buffer.from(svg)).png().toBuffer(), width};
}

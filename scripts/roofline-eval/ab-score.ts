/**
 * Second half of the A/B renderer test (see ab-test-renderer.ts's header for
 * the full setup): segments path B (already run via segment.py) and scores
 * both paths' roofline height against 3DBAG's own `b3_h_dak_max`, plus
 * builds a side-by-side overlay per wall.
 *
 * Run: npx tsx scripts/roofline-eval/ab-score.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { rescueSky, resampleProfile, stripBoundaries, type Luma, type Mask } from '../../src/canalRecall/facade/stripRoofline.ts';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';

const outDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/ab-renderer-test';
const segMasksDir = path.join(outDir, 'seg', 'masks', 's1');

interface Row {
  address: string; pandId: string; panoramaId: string; roofMax3dbag: number | null;
  pathAFile: string; pathAFrame: StripFrame; pathACoverage: number; pathAMedianUp: number | null;
  pathBFile: string; pathBFrame: StripFrame;
  poseA: { note: string; cameraHeight: number; offsetM: number; z: number };
  poseB: { note: string; cameraHeight: number; z: number };
}
const rows = JSON.parse(await readFile(path.join(outDir, 'ab-manifest.json'), 'utf8')) as Row[];

async function loadLuma(file: string): Promise<Luma> {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, values: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
async function loadMaskFile(file: string): Promise<Mask> {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`${file}: expected 1-channel mask, got ${info.channels}`);
  return { width: info.width, height: info.height, labels: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
function medianUp(profile: Array<[number, number | null]>): number | null {
  const ups = profile.map(([, up]) => up).filter((u): u is number => u !== null);
  if (!ups.length) return null;
  const sorted = [...ups].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

interface Scored extends Row { pathBCoverage: number; pathBMedianUp: number | null; offsetA: number | null; offsetB: number | null }
const scored: Scored[] = [];

for (const row of rows) {
  const pathBFullFile = path.join(outDir, row.pathBFile);
  const maskFile = path.join(segMasksDir, row.pathBFile.replace(/\.jpg$/i, '.mask.png'));
  const luma = await loadLuma(pathBFullFile);
  const mask = await loadMaskFile(maskFile);
  const rescue = rescueSky(mask, luma);
  const boundaries = stripBoundaries({ width: mask.width, height: mask.height, labels: rescue.labels }, luma);
  const profile = resampleProfile(row.pathBFrame, boundaries.rowPx);
  const coverage = boundaries.rowPx.filter(v => v !== null).length / boundaries.rowPx.length;
  const up = medianUp(profile);
  const offsetA = row.pathAMedianUp !== null && row.roofMax3dbag !== null ? Math.round((row.pathAMedianUp - row.roofMax3dbag) * 1000) / 1000 : null;
  const offsetB = up !== null && row.roofMax3dbag !== null ? Math.round((up - row.roofMax3dbag) * 1000) / 1000 : null;
  scored.push({ ...row, pathBCoverage: coverage, pathBMedianUp: up, offsetA, offsetB });
  console.log(`${row.address}: path A median up ${row.pathAMedianUp?.toFixed(2) ?? 'n/a'} (offset ${offsetA?.toFixed(2) ?? 'n/a'}), `
    + `path B median up ${up?.toFixed(2) ?? 'n/a'} (offset ${offsetB?.toFixed(2) ?? 'n/a'}), `
    + `b3_h_dak_max ${row.roofMax3dbag?.toFixed(2) ?? 'n/a'}, A-B diff ${(row.pathAMedianUp !== null && up !== null) ? (row.pathAMedianUp - up).toFixed(2) : 'n/a'}`);
}

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const offsetsA = scored.map(r => r.offsetA).filter((v): v is number => v !== null);
const offsetsB = scored.map(r => r.offsetB).filter((v): v is number => v !== null);
console.log('');
console.log(`Median offset vs b3_h_dak_max -- path A (rectifyWall, as cut): ${median(offsetsA)?.toFixed(3) ?? 'n/a'} m (n=${offsetsA.length})`);
console.log(`Median offset vs b3_h_dak_max -- path B (rectifyFacade, A5 method): ${median(offsetsB)?.toFixed(3) ?? 'n/a'} m (n=${offsetsB.length})`);

await writeFile(path.join(outDir, 'ab-scored.json'), `${JSON.stringify(scored, null, 2)}\n`);

// ---- side-by-side overlay per wall ----
function setPixel(rgb: Uint8ClampedArray, width: number, height: number, x: number, y: number, colour: [number, number, number], half = 1) {
  for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
    const px = x + dx, py = y + dy;
    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    const i = (py * width + px) * 3;
    rgb[i] = colour[0]; rgb[i + 1] = colour[1]; rgb[i + 2] = colour[2];
  }
}

const cards: Array<{ png: Buffer; label: string }> = [];
for (const row of scored) {
  // Path A image + its snapped boundary (yellow), path B image + its snapped boundary (yellow), side by side.
  const panels: Buffer[] = [];
  for (const { file, frame } of [{ file: row.pathAFile, frame: row.pathAFrame }, { file: path.join(outDir, row.pathBFile), frame: row.pathBFrame }]) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
    const width = info.width, height = info.height;
    const luma = await loadLuma(file);
    const isPathA = file === row.pathAFile;
    const mask = isPathA
      ? await loadMaskFile(path.join('/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/v2/masks/s1', path.basename(file).replace(/\.jpg$/i, '.mask.png')))
      : await loadMaskFile(path.join(segMasksDir, path.basename(file).replace(/\.jpg$/i, '.mask.png')));
    const rescue = rescueSky(mask, luma);
    const boundaries = stripBoundaries({ width: mask.width, height: mask.height, labels: rescue.labels }, luma);
    for (let x = 0; x < width; x++) {
      const snapped = boundaries.snappedPx[x];
      if (snapped !== null) setPixel(pixels, width, height, x, snapped, [255, 220, 0], 1);
    }
    // 3DBAG roof-max reference line, drawn in cyan, using this panel's own frame.
    if (row.roofMax3dbag !== null) {
      const roofRow = Math.round((frame.topNap - row.roofMax3dbag) * frame.pixelsPerMetreY);
      for (let x = 0; x < width; x += 4) setPixel(pixels, width, height, x, roofRow, [0, 200, 255], 1);
    }
    const png = await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width, height, channels: 3 } })
      .resize(260, Math.round(height * 260 / width), { kernel: 'nearest' }).png().toBuffer();
    panels.push(png);
  }
  const [pngA, pngB] = panels;
  const metaA = await sharp(pngA).metadata(), metaB = await sharp(pngB).metadata();
  const h = Math.max(metaA.height ?? 0, metaB.height ?? 0);
  const gap = 10;
  const composite = await sharp({ create: { width: 260 * 2 + gap, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: pngA, left: 0, top: 0 }, { input: pngB, left: 260 + gap, top: 0 }])
    .png().toBuffer();
  cards.push({
    png: composite,
    label: `${row.address}  A(rectifyWall)=${row.pathAMedianUp?.toFixed(2) ?? 'n/a'} off=${row.offsetA?.toFixed(2) ?? 'n/a'}   `
      + `B(rectifyFacade)=${row.pathBMedianUp?.toFixed(2) ?? 'n/a'} off=${row.offsetB?.toFixed(2) ?? 'n/a'}   3DBAG=${row.roofMax3dbag?.toFixed(2) ?? 'n/a'}`,
  });
}

const labelH = 24;
const gap = 12;
let y = 50;
const composites: sharp.OverlayOptions[] = [];
const cardWidth = 260 * 2 + 10;
for (const c of cards) {
  const meta = await sharp(c.png).metadata();
  composites.push({ input: c.png, left: 10, top: y });
  const svg = Buffer.from(`<svg width="${cardWidth}" height="${labelH}"><rect width="100%" height="100%" fill="white"/><text x="2" y="17" font-size="11" font-family="monospace" fill="black">${c.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  composites.push({ input: svg, left: 10, top: y + (meta.height ?? 0) });
  y += (meta.height ?? 0) + labelH + gap;
}
const header = `<svg width="${cardWidth + 20}" height="50"><rect width="100%" height="100%" fill="white"/>
<text x="10" y="20" font-size="14" font-family="monospace" fill="black">A/B renderer test: rectifyWall (left) vs rectifyFacade (right), same wall + panorama + extent</text>
<text x="10" y="38" font-size="11" font-family="monospace" fill="#555">yellow = snapped roofline this render; cyan dashes = 3DBAG b3_h_dak_max, drawn on each panel's own frame</text></svg>`;
const sheet = await sharp({ create: { width: cardWidth + 20, height: y, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite([{ input: Buffer.from(header), left: 0, top: 0 }, ...composites])
  .png().toBuffer();
await writeFile(path.join(outDir, 'ab-sheet.png'), sheet);
console.log(`\nWrote ${path.join(outDir, 'ab-sheet.png')} and ab-scored.json`);

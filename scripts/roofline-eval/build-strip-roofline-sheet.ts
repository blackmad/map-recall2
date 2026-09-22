/**
 * A2 overlay: coarse (thin) and snapped (thick) roofline over the strip's own
 * top, for a sample of walls, tiled onto one PNG so the edge-snap can be
 * judged by eye rather than trusted from a coverage percentage.
 *
 * Run: npx tsx scripts/roofline-eval/build-strip-roofline-sheet.ts [--count=24] [--out=FILE]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { stripBoundaries, type Luma, type Mask } from '../../src/canalRecall/facade/stripRoofline.ts';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';

const cacheRoot = process.env.ROOFLINE_CACHE
  ?? '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache';
const buildingTwinCache = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.cache/facade-twin';
const stripsDir = path.join(buildingTwinCache, 'strips-roofline-v2');
const masksDir = path.join(cacheRoot, 'roofline-eval/v2/masks/s1');
const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const m = /^--([^=]+)=(.*)$/.exec(arg);
  if (m) args.set(m[1], m[2]);
}
const count = Number(args.get('count') ?? 24);
const outFile = args.get('out') ?? path.join(cacheRoot, 'roofline-eval/strip-profiles/_sheet.png');
// Only the top band matters for a roofline sheet; below this the wall body adds nothing.
const CROP_HEIGHT = 420;
const THUMB_WIDTH = 240;

interface ManifestStrip {
  file: string; pandId: string; address: string | null; frame: StripFrame;
}
interface Manifest { strips: ManifestStrip[] }
const manifest = JSON.parse(await readFile(path.join(stripsDir, 'manifest.json'), 'utf8')) as Manifest;

const byWall = new Map<string, ManifestStrip[]>();
for (const strip of manifest.strips) {
  const list = byWall.get(strip.pandId);
  if (list) list.push(strip); else byWall.set(strip.pandId, [strip]);
}
// Deterministic, spread-out sample rather than the first N alphabetically,
// so the sheet isn't just every Herengracht house in a row.
const wallIds = [...byWall.keys()].sort();
const stride = Math.max(1, Math.floor(wallIds.length / count));
const sampled = wallIds.filter((_, i) => i % stride === 0).slice(0, count);

async function loadLuma(file: string): Promise<Luma> {
  const { data, info } = await sharp(path.join(stripsDir, file)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, values: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
async function loadMask(file: string): Promise<Mask> {
  const maskPath = path.join(masksDir, file.replace(/\.jpg$/i, '.mask.png'));
  const { data, info } = await sharp(maskPath).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, labels: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

function setPixel(rgb: Uint8ClampedArray, width: number, height: number, x: number, y: number, colour: [number, number, number]) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const i = (y * width + x) * 3;
  rgb[i] = colour[0]; rgb[i + 1] = colour[1]; rgb[i + 2] = colour[2];
}

const cards: Array<{ png: Buffer; label: string }> = [];

for (const pandId of sampled) {
  const strip = byWall.get(pandId)![0];
  const rgbFull = await sharp(path.join(stripsDir, strip.file)).raw().toBuffer({ resolveWithObject: true });
  const luma = await loadLuma(strip.file);
  const mask = await loadMask(strip.file);
  const boundaries = stripBoundaries(mask, luma);
  const pixels = new Uint8ClampedArray(rgbFull.data.buffer, rgbFull.data.byteOffset, rgbFull.data.length);
  const width = rgbFull.info.width, height = rgbFull.info.height;
  for (let x = 0; x < width; x++) {
    const coarse = boundaries.coarsePx[x];
    if (coarse !== null) setPixel(pixels, width, height, x, coarse, [255, 214, 0]); // thin: yellow, 1px
    const snapped = boundaries.snappedPx[x];
    if (snapped !== null) {
      for (let dy = -1; dy <= 1; dy++) setPixel(pixels, width, height, x, snapped + dy, [255, 32, 96]); // thick: magenta, 3px
    }
  }
  const cropHeight = Math.min(CROP_HEIGHT, height);
  const cropped = sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width, height, channels: 3 } })
    .extract({ left: 0, top: 0, width, height: cropHeight })
    .resize(THUMB_WIDTH, Math.round(cropHeight * THUMB_WIDTH / width), { kernel: 'nearest' });
  const png = await cropped.png().toBuffer();
  const coverage = boundaries.rowPx.filter(v => v !== null).length / boundaries.rowPx.length;
  cards.push({ png, label: `${strip.address ?? pandId}  ${(coverage * 100).toFixed(0)}%` });
}

const cols = 6;
const rows = Math.ceil(cards.length / cols);
const labelH = 22;
const gap = 6;
const cellW = THUMB_WIDTH + gap;
const cellH = Math.round(CROP_HEIGHT * THUMB_WIDTH / 300) + labelH + gap; // approx; actual thumbs vary slightly in height, composite handles offset
const sheetW = cols * cellW + gap;
const sheetH = rows * (Math.round(CROP_HEIGHT * THUMB_WIDTH / 220) + labelH + gap) + gap + 40;

const composites: sharp.OverlayOptions[] = [];
let maxRowHeight = 0;
const rowHeights: number[] = [];
let y = 40;
for (let r = 0; r < rows; r++) {
  const rowCards = cards.slice(r * cols, r * cols + cols);
  let rowMaxH = 0;
  for (const c of rowCards) {
    const meta = await sharp(c.png).metadata();
    rowMaxH = Math.max(rowMaxH, (meta.height ?? CROP_HEIGHT) + labelH);
  }
  rowHeights.push(rowMaxH);
  let x = gap;
  for (const c of rowCards) {
    const meta = await sharp(c.png).metadata();
    composites.push({ input: c.png, left: x, top: y });
    const svg = Buffer.from(`<svg width="${THUMB_WIDTH}" height="${labelH}"><rect width="100%" height="100%" fill="white"/><text x="2" y="15" font-size="11" font-family="monospace" fill="black">${c.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
    composites.push({ input: svg, left: x, top: y + (meta.height ?? CROP_HEIGHT) });
    x += cellW;
  }
  y += rowMaxH + gap;
}
const totalH = y + gap;

const header = `<svg width="${sheetW}" height="40"><rect width="100%" height="100%" fill="white"/>
<text x="10" y="18" font-size="14" font-family="monospace" fill="black">A2 roofline sheet: yellow=coarse (thin), magenta=snapped (thick). Label: address, consensus-eligible column coverage.</text>
<text x="10" y="34" font-size="11" font-family="monospace" fill="#555">${sampled.length} of ${wallIds.length} walls, one view each (first view in the manifest).</text></svg>`;

await mkdir(path.dirname(outFile), { recursive: true });
const sheet = await sharp({ create: { width: sheetW, height: totalH, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite([{ input: Buffer.from(header), left: 0, top: 0 }, ...composites])
  .png().toBuffer();
await writeFile(outFile, sheet);
console.log(`Contact sheet: ${sampled.length} walls -> ${outFile} (${(sheet.length / 1024).toFixed(0)} KB, ${sheetW}x${totalH})`);

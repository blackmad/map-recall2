/**
 * A5 overlay: for each scored Oud-Zuid elevation, draw the PHOTO roofline
 * (consensus, magenta) and the SCAN roofline (R1 gold, cyan) on the
 * elevation's first crop, plus a contact sheet of all elevations.
 *
 * Depends on `extract-oudzuid-rooflines.ts` having already written
 * `a5-elevations-full.json` (photoProfile/goldProfile/frames per elevation).
 *
 * Run: npx tsx scripts/roofline-eval/build-oudzuid-overlay-sheet.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';

const viewsDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/facade-eval/oudzuid/elevation-views-v1';
const outDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/oudzuid-a5';
const overlaysDir = path.join(outDir, 'overlays');

interface ElevationResult {
  id: string; tile: string; buildingId: string; widthM: number; views: number;
  goldShape: string; photoShape: string; shapeAgree: boolean;
  goldCoverage: number; photoCoverage: number;
  medianSignedErrorM: number | null; medianAbsErrorM: number | null; peakErrorM: number | null; abstained: boolean;
  photoProfile: Array<[number, number | null]>; goldProfile: Array<[number, number | null]>;
  frames: Array<{ file: string; panoramaId: string; frame: StripFrame }>;
}

const results = JSON.parse(await readFile(path.join(outDir, 'a5-elevations-full.json'), 'utf8')) as ElevationResult[];

function setPixel(rgb: Uint8ClampedArray, width: number, height: number, x: number, y: number, colour: [number, number, number], halfWidth = 1) {
  for (let dy = -halfWidth; dy <= halfWidth; dy++) {
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const px = x + dx, py = y + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const i = (py * width + px) * 3;
      rgb[i] = colour[0]; rgb[i + 1] = colour[1]; rgb[i + 2] = colour[2];
    }
  }
}

function profileToPx(frame: StripFrame, profile: Array<[number, number | null]>): Array<[number, number] | null> {
  return profile.map(([along, up]) => {
    if (up === null) return null;
    const x = Math.round((along + frame.marginM) * frame.pixelsPerMetreX);
    const y = Math.round((frame.topNap - up) * frame.pixelsPerMetreY);
    return [x, y];
  });
}

await mkdir(overlaysDir, { recursive: true });
const cards: Array<{ png: Buffer; label: string }> = [];

for (const elevation of results) {
  const view = elevation.frames[0];
  const { data, info } = await sharp(path.join(viewsDir, view.file)).raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const width = info.width, height = info.height;

  const photoPx = profileToPx(view.frame, elevation.photoProfile);
  const goldPx = profileToPx(view.frame, elevation.goldProfile);
  for (const p of goldPx) if (p) setPixel(pixels, width, height, p[0], p[1], [0, 200, 255], 2); // scan: cyan, thick
  for (const p of photoPx) if (p) setPixel(pixels, width, height, p[0], p[1], [255, 20, 147], 1); // photo: magenta, thin (drawn after so it stays visible where they overlap)

  const png = await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width, height, channels: 3 } }).png().toBuffer();
  await writeFile(path.join(overlaysDir, `${elevation.id.replace(/[/:]/g, '_')}.png`), png);

  const thumbW = 260;
  const thumb = await sharp(png).resize(thumbW, Math.round(height * thumbW / width), { kernel: 'nearest' }).png().toBuffer();
  const label = `${elevation.id.split(':').pop()}  err=${elevation.medianSignedErrorM?.toFixed(2) ?? 'n/a'}m  `
    + `photo=${elevation.photoShape}/gold=${elevation.goldShape} ${elevation.shapeAgree ? 'OK' : 'X'}  cov=${Math.round(elevation.photoCoverage * 100)}%`;
  cards.push({ png: thumb, label });
  console.log(`overlay ${elevation.id} -> ${view.file}`);
}

const cols = 5;
const rows = Math.ceil(cards.length / cols);
const labelH = 26;
const gap = 8;
const thumbW = 260;
let maxThumbH = 0;
for (const c of cards) { const meta = await sharp(c.png).metadata(); maxThumbH = Math.max(maxThumbH, meta.height ?? 0); }
const cellW = thumbW + gap;
const cellH = maxThumbH + labelH + gap;
const sheetW = cols * cellW + gap;
const sheetH = rows * cellH + gap + 46;

const composites: sharp.OverlayOptions[] = [];
for (let i = 0; i < cards.length; i++) {
  const row = Math.floor(i / cols), col = i % cols;
  const x = gap + col * cellW, y = 46 + gap + row * cellH;
  composites.push({ input: cards[i].png, left: x, top: y });
  const svg = Buffer.from(`<svg width="${thumbW}" height="${labelH}"><rect width="100%" height="100%" fill="white"/><text x="2" y="17" font-size="10" font-family="monospace" fill="black">${cards[i].label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  composites.push({ input: svg, left: x, top: y + maxThumbH });
}
const header = `<svg width="${sheetW}" height="46"><rect width="100%" height="100%" fill="white"/>
<text x="10" y="18" font-size="14" font-family="monospace" fill="black">A5: photo roofline (magenta) vs scan roofline (cyan), 10 Oud-Zuid gold elevations, one view each</text>
<text x="10" y="36" font-size="11" font-family="monospace" fill="#555">err = median(photo up - scan up) over overlapping resolved columns, this view's own frame</text></svg>`;

const sheet = await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite([{ input: Buffer.from(header), left: 0, top: 0 }, ...composites])
  .png().toBuffer();
const sheetPath = path.join(outDir, 'a5-sheet.png');
await writeFile(sheetPath, sheet);
console.log(`wrote ${cards.length} overlays to ${overlaysDir} and a contact sheet to ${sheetPath}`);

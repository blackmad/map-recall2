/**
 * Contact sheet of the top blank walls (issue #341): one tile per pand, front and 3/4 installed-route previews from
 * scripts/house-preview/preview.ts side by side, labelled with the walls it holds. Read-only; run after suppressed-faces.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dir = path.join(ROOT, 'artifacts/house-audit');
const report = JSON.parse(fs.readFileSync(path.join(dir, 'suppressed-faces.json'), 'utf8'));
const pands: string[] = [...new Set<string>(report.top20RidePriority.map((w: { pand: string }) => w.pand))];
const TILE_W = 640, H = 560;
const tiles: { input: Buffer; left: number; top: number }[] = [];
const labels: string[] = [];
let row = 0;
for (const [i, pand] of pands.entries()) {
  const walls = report.top20RidePriority.filter((w: { pand: string }) => w.pand === pand);
  const front = path.join(dir, 'sheet', pand, 'front.png'), three = path.join(dir, 'sheet', pand, 'threeq.png');
  const a = await sharp(front).resize({ width: TILE_W, height: H, fit: 'inside' }).png().toBuffer();
  const b = await sharp(three).resize({ width: TILE_W, height: H, fit: 'inside' }).png().toBuffer();
  const top = row * (H + 40);
  tiles.push({ input: a, left: 0, top: top + 40 }, { input: b, left: TILE_W, top: top + 40 });
  const text = `${pand}  ${walls.map((w: { street: string; lengthM: number; bare: boolean | null; coveredOutward: boolean }) => `${w.street} ${w.lengthM} m ${w.coveredOutward ? 'bare' : 'no geometry'}`).join(' | ')}`;
  labels.push(`<text x="4" y="${top + 26}" font-family="Helvetica" font-size="18" fill="#222">${i + 1}. ${text.replace(/&/g, '&amp;')}</text>`);
  row++;
}
const W = TILE_W * 2, HT = row * (H + 40);
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HT}"><rect width="100%" height="100%" fill="#f4f1ea"/>${labels.join('')}</svg>`);
const out = path.join(dir, 'contact-suppressed-faces.jpg');
await sharp({ create: { width: W, height: HT, channels: 3, background: '#f4f1ea' } })
  .composite([{ input: svg, left: 0, top: 0 }, ...tiles])
  .jpeg({ quality: 80 }).toFile(out);
console.log(`wrote ${path.relative(ROOT, out)} (${pands.length} pands)`);

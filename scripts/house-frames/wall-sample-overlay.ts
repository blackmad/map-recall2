/**
 * Draws the wall-colour sample points (analyse.ts wallLab: COLOUR_BAND_M on the wall plane, inner 80 %) on a frames
 * pand's photo and game halves, to check what the metric reads (lane W3). Kept: green; dropped (leaf/sky): red.
 *   node --import tsx scripts/house-frames/wall-sample-overlay.ts <framesDir> <key> <out.png>
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameFor, wallPoint } from './pose.ts';
import { COLOUR_BAND_M } from './analyse.ts';

const [dir, key, out] = process.argv.slice(2);
const prepared: any[] = JSON.parse(fs.readFileSync(path.join(dir, 'prepared.json'), 'utf8')).prepared;
const prep = prepared.find(p => p.key === key)!;
const frame = frameFor(prep.pose), wall = prep.wall;
const photo = sharp(path.join(dir, key, 'photo.jpg')).removeAlpha();
const meta = await photo.metadata();
const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), v0 = Math.min(COLOUR_BAND_M[0], wall.heightM * 0.3), v1 = Math.min(COLOUR_BAND_M[1], wall.heightM * 0.85);
const dots: string[] = [];
for (let i = 0; i < 24; i++) for (let j = 0; j < 16; j++) {
  const s = wallPoint(frame, prep.pose, wall, len * (0.1 + 0.8 * (i + 0.5) / 24), v0 + (v1 - v0) * (j + 0.5) / 16);
  if (s.depth > 0) dots.push(`<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="2.5" fill="lime"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">${dots.join('')}</svg>`;
await photo.composite([{ input: Buffer.from(svg) }]).png().toFile(out);
console.log(out, 'band', v0.toFixed(1), v1.toFixed(1), 'm; height', wall.heightM);

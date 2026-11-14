/**
 * Retail-look sheet (lane retail-look-20261114): per front, the ground storey cut from house:frames rule-10 likeness
 * frames (first person 72 deg, 1440 x 900 at dpr 2), side by side: photo | each run. The crop is the list entry's
 * `crop` ([x0, y0, x1, y1] as fractions of the frame), default the lower half.
 *
 *   node --import tsx scripts/retail-ground/look-sheet.ts --list=scripts/retail-ground/look-fronts.json \
 *     --runs=off:artifacts/retail-look/before-off,on:artifacts/retail-look/before-on --out=artifacts/retail-look/sheet.jpg
 *   [--frame=likeness|game] (game: the wide pano-lens frame, for poses the likeness search could not hold)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const list = JSON.parse(fs.readFileSync(arg('list') ?? 'scripts/retail-ground/look-fronts.json', 'utf8')) as Array<{ key: string; case?: string; crop?: [number, number, number, number]; frame?: 'likeness' | 'game' }>;
const runs = (arg('runs') ?? '').split(',').filter(Boolean).map(r => { const [label, dir] = r.split(':'); return { label, dir }; });
const OUT = arg('out') ?? 'artifacts/retail-look/sheet.jpg';
const CELL_W = Number(arg('cell') ?? 900), CAPTION = 34;

const tiles: sharp.OverlayOptions[] = [];
let y = 0, rowH = 0;
const cols = 1 + runs.length;
const text = (s: string, w: number, h: number, size = 20) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="${h - 10}" font-family="Helvetica" font-size="${size}" fill="#eee">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const header = `Retail look: ground storeys, ${['photo', ...runs.map(r => r.label)].join(' | ')} (rule 10 frames, first person 72 deg, dpr 2)`;
tiles.push({ input: text(header, CELL_W * cols, 44, 24), left: 0, top: 0 }); y = 44;
for (const e of list) {
  const frame = e.frame ?? 'likeness';
  const photoPath = path.join(runs[0].dir, e.key, frame === 'likeness' ? 'likeness-photo.jpg' : 'photo.jpg');
  if (!fs.existsSync(photoPath)) { console.warn(`skip ${e.key}: no ${photoPath}`); continue; }
  const meta = await sharp(photoPath).metadata();
  const [x0, y0, x1, y1] = e.crop ?? [0, 0.5, 1, 1];
  const ext = { left: Math.round(x0 * meta.width!), top: Math.round(y0 * meta.height!), width: Math.round((x1 - x0) * meta.width!), height: Math.round((y1 - y0) * meta.height!) };
  const h = Math.round(CELL_W * ext.height / ext.width);
  tiles.push({ input: text(`${e.key}: ${e.case ?? ''}`, CELL_W * cols, CAPTION), left: 0, top: y }); y += CAPTION;
  const srcs = [photoPath, ...runs.map(r => path.join(r.dir, e.key, frame === 'likeness' ? 'likeness.png' : 'game.png'))];
  for (const [i, src] of srcs.entries()) {
    if (!fs.existsSync(src)) continue;
    const m = await sharp(src).metadata();
    const same = await sharp(src).resize(meta.width, meta.height, { fit: 'fill' }).png().toBuffer();
    const img = await sharp(await sharp(same).extract(ext).png().toBuffer()).resize(CELL_W, h).jpeg().toBuffer();
    tiles.push({ input: img, left: i * CELL_W, top: y });
    void m;
  }
  y += h + 6; rowH = h;
}
void rowH;
await sharp({ create: { width: CELL_W * cols, height: y, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 85 }).toFile(OUT);
console.log(`wrote ${OUT} (${list.length} fronts, ${cols} columns)`);

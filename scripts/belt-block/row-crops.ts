/**
 * Block pilot helper: cut each house's column out of the review's row photo (50 px/m, ground at y = groundPx) from the
 * first row that is not the strip's dark background, and draw a metre ruler on the left (tick every metre, long tick
 * every 5 m) so heights can be read off by eye. Usage: row-crops.ts <row.png> <row.json> <outDir> [groundPx=1300] [n=19]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [, , src, rowJson, outDir, gArg, nArg] = process.argv;
const ground = +(gArg ?? 1300), n = +(nArg ?? 19), ppm = 50;
const layout = JSON.parse(fs.readFileSync(rowJson, 'utf8')).layout.pands.slice(0, n) as {pandId: string; x: number; w: number}[];
const {data, info} = await sharp(src).flatten({background: '#26292e'}).raw().toBuffer({resolveWithObject: true});
fs.mkdirSync(outDir, {recursive: true});
for (const p of layout) {
  let top = 0;
  for (let y = 0; y < info.height; y++) {
    let bg = 0;
    for (let x = p.x + 5; x < p.x + p.w - 5; x += 3) { const o = (y * info.width + x) * info.channels; if (Math.abs(data[o] - 38) < 8 && Math.abs(data[o + 1] - 41) < 8 && Math.abs(data[o + 2] - 46) < 8) bg++; }
    if (bg < (p.w - 10) / 3 * 0.5) { top = y; break; }
  }
  const R = 36, W = p.w + R, H = info.height - top, ruler = Buffer.alloc(R * H * 4, 255);
  for (let y = 0; y < H; y++) {
    const m = (ground - (y + top)) / ppm;
    const k = Math.round(m * ppm);
    if (k % ppm === 0) { const len = Math.round(m) % 5 === 0 ? R : 12; for (let x = R - len; x < R; x++) ruler.writeUInt32BE(0xff0000ff, (y * R + x) * 4); }
  }
  const col = await sharp(src).extract({left: p.x, top, width: p.w, height: H}).png().toBuffer();
  await sharp({create: {width: W, height: H, channels: 4, background: '#ffffff'}})
    .composite([{input: ruler, raw: {width: R, height: H, channels: 4}, left: 0, top: 0}, {input: col, left: R, top: 0}])
    .png().toFile(path.join(outDir, `${p.pandId}.png`));
  console.log(p.pandId, 'top', top, 'photo top above ground m', ((ground - top) / ppm).toFixed(2));
}

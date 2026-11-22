/**
 * Block pilot helper: median colour of boxes on the review's row photo (50 px/m, ground at y = 1300), each box given as
 * pand s0 s1 y0 y1 in metres (s from the left edge of that pand's column, y above the street).
 * Usage: sample.ts <row.png> <row.json> "<pand> s0 s1 y0 y1" ...
 */
import fs from 'node:fs';
import sharp from 'sharp';

const [, , src, rowJson, ...boxes] = process.argv;
const layout = JSON.parse(fs.readFileSync(rowJson, 'utf8')).layout.pands as {pandId: string; x: number; w: number}[];
const {data, info} = await sharp(src).flatten({background: '#000000'}).raw().toBuffer({resolveWithObject: true});
const hex = (v: number[]) => '#' + v.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
for (const b of boxes) {
  const [pand, ...n] = b.split(/\s+/), [s0, s1, y0, y1] = n.map(Number), p = layout.find(q => q.pandId.endsWith(pand))!;
  const ch: number[][] = [[], [], []];
  for (let y = Math.round(1300 - y1 * 50); y < 1300 - y0 * 50; y++) for (let x = Math.round(p.x + s0 * 50); x < p.x + s1 * 50; x++) {
    const o = (y * info.width + x) * info.channels;
    for (let k = 0; k < 3; k++) ch[k].push(data[o + k]);
  }
  const med = ch.map(a => a.sort((u, v) => u - v)[a.length >> 1] ?? 0);
  console.log(b.padEnd(34), hex(med), `n=${ch[0].length}`);
}

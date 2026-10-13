/**
 * The orthophoto's colour cast as a function of luma, measured on the roofs themselves: most roofs
 * are neutral greys, so the median (r - y, g - y, b - y) per 8-luma bin over a city-wide sample is
 * the cast. `classifyRoof` subtracts it before reading colour. Prints a table for roofSlots.ts.
 *
 *   tsx scripts/roofs/calibrate-cast.mts [--every=400]
 */
import path from 'node:path';
import { OrthoMosaic } from './orthoTiles.ts';
import { readPands, roofPixels } from './roofPixels.ts';

const every = Number(process.argv.find(a => a.startsWith('--every='))?.slice(8) ?? 400);
const mosaic = new OrthoMosaic('Actueel_ortho25', 14);
const bins: Array<{ r: number[]; g: number[]; b: number[] }> = Array.from({ length: 32 }, () => ({ r: [], g: [], b: [] }));
let k = 0, used = 0;
for (const p of readPands(path.resolve('public/data/extracts/amsterdam/bag-tiles/14'))) {
  if (k++ % every || p.areaM2 < 30) continue;
  const [a, b, c, d] = p.bbox;
  await mosaic.load(a, b, c, d);
  const px = roofPixels(p, mosaic, 0.5, 400);
  for (let i = 0; i < px.n; i++) {
    const r = px.rgb[i * 3], g = px.rgb[i * 3 + 1], bl = px.rgb[i * 3 + 2], y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const bin = bins[Math.min(31, Math.floor(y / 8))];
    if (bin.r.length < 40000) { bin.r.push(r - y); bin.g.push(g - y); bin.b.push(bl - y); }
  }
  used++;
  if (mosaic.size > 300) mosaic.clear();
}
const med = (v: number[]) => { const s = v.slice().sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
const table = bins.map((bin, i) => bin.r.length > 200 ? [i * 8 + 4, +med(bin.r).toFixed(1), +med(bin.g).toFixed(1), +med(bin.b).toFixed(1), bin.r.length] : null).filter(Boolean);
console.log(`roofs ${used}`);
console.log(JSON.stringify(table));

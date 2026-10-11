/**
 * Dominant colours of a rectangle in the cached survey crops (made by camera-sheets.ts --survey), for the palette tints of a
 * type spec. The game's cityWallTint lifts photo-sampled brick/render, so authored tints must be photo medians of the wall.
 *
 *   node --import tsx scripts/building-types/sample-colours.ts 2102138:0.05,0.30,0.35,0.75 2088711:0.0,0.3,0.3,0.7 ...
 *
 * Each argument is <pand id (full or last 7 digits)>:<x0>,<y0>,<x1>,<y1> with the rectangle in 0..1 crop coordinates (over the
 * 1000 x 750 crop, origin top-left). Prints the plain median, the median of the warm (brick/render-like) pixels and a 4-means clustering (centre colour, share of pixels): the wall
 * is normally the largest cluster; windows, sky and shadows fall into the others, so use a rectangle that is mostly facade.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const dir = '.cache/building-types/crops', files = fs.readdirSync(dir);
const hex = (c: number[]) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function kmeans(px: number[][], k: number): {c: number[]; n: number}[] {
  const sorted = [...px].sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
  let cs = Array.from({length: k}, (_, i) => sorted[Math.floor((i + 0.5) * sorted.length / k)].slice());
  let counts = new Array(k).fill(0);
  for (let it = 0; it < 12; it++) {
    const sum = cs.map(() => [0, 0, 0]); counts = new Array(k).fill(0);
    for (const p of px) {
      let b = 0, bd = 1e9;
      for (let i = 0; i < k; i++) { const d = (p[0] - cs[i][0]) ** 2 + (p[1] - cs[i][1]) ** 2 + (p[2] - cs[i][2]) ** 2; if (d < bd) { bd = d; b = i; } }
      counts[b]++; for (let c = 0; c < 3; c++) sum[b][c] += p[c];
    }
    cs = cs.map((c, i) => (counts[i] ? sum[i].map(v => v / counts[i]) : c));
  }
  return cs.map((c, i) => ({c, n: counts[i] / px.length})).sort((a, b) => b.n - a.n);
}

for (const arg of process.argv.slice(2)) {
  const [id, rect] = arg.split(':');
  const f = files.find(n => n === `${id}.jpg`) ?? files.find(n => n.endsWith(`${id}.jpg`));
  if (!f || !rect) throw new Error(`bad argument ${arg}`);
  const [x0, y0, x1, y1] = rect.split(',').map(Number);
  const img = sharp(`${dir}/${f}`), {width = 0, height = 0} = await img.metadata();
  const {data, info} = await img.extract({left: Math.round(x0 * width), top: Math.round(y0 * height), width: Math.max(1, Math.round((x1 - x0) * width)), height: Math.max(1, Math.round((y1 - y0) * height))}).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const px: number[][] = [];
  for (let i = 0; i < data.length; i += info.channels * 3) px.push([data[i], data[i + 1], data[i + 2]]);
  const med = [0, 1, 2].map(c => median(px.map(p => p[c])));
  const warm = px.filter(p => p[0] > p[1] && p[1] >= p[2] && p[0] - p[2] > 35 && p[0] > 60);
  const warmMed = warm.length > 20 ? [0, 1, 2].map(c => median(warm.map(p => p[c]))) : med;
  console.log(f.replace('.jpg', ''), rect, 'median', hex(med), 'warm-median', hex(warmMed), `(${(warm.length / px.length * 100).toFixed(0)}% warm)`, '| clusters', kmeans(px, 4).map(k => `${hex(k.c)} ${(k.n * 100).toFixed(0)}%`).join('  '));
}

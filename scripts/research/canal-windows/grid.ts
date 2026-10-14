/**
 * Reading aids for the canal-window survey (2026-10-14), on the rectified 50 px/m crops in staging/pand-reference-walls.
 *
 *   grid:   node --import tsx scripts/research/canal-windows/grid.ts --bag=<id> [--scale=3] [--from=<m> --to=<m>]
 *           -> staging/canal-windows/grid-<id>.png: the crop enlarged with a metric grid (0.1 m faint, 0.5 m mid, 1 m strong,
 *           metre labels from the crop's left and bottom edge), optionally only the band from..to metres above the bottom.
 *   profile: node --import tsx scripts/research/canal-windows/grid.ts --bag=<id> --profile=<x0>,<x1>[,<from>,<to>]
 *           -> light runs (white stone/paint) down a pier strip x0..x1 m: each run's bottom/top in metres and its median colour,
 *           with the strip's median wall colour; used to measure speklagen spacing and band depth.
 *   sample: node --import tsx scripts/research/canal-windows/grid.ts --bag=<id> --sample=<x0>,<y0>,<x1>,<y1>[;...]
 *           -> the median colour (hex) of each box, metres from the crop's left / bottom edge.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = 'staging/pand-reference-walls';
const dir = fs.readdirSync(root).find(d => d.endsWith(arg('bag')))!, file = path.join(root, dir, process.argv.includes('--alt') ? 'front-alt.jpg' : 'front.jpg');
const ppm = JSON.parse(fs.readFileSync(path.join(root, dir, 'reference.json'), 'utf8')).primary.crop.pixelsPerMetre as number;
const meta = await sharp(file).metadata(), W = meta.width!, H = meta.height!;
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export async function sampleBoxes(boxes: number[][]): Promise<string[]> {
  const {data} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return boxes.map(([x0, y0, x1, y1]) => {
    const ch: number[][] = [[], [], []];
    for (let y = Math.round(H - y1 * ppm); y < Math.round(H - y0 * ppm); y++) for (let x = Math.round(x0 * ppm); x < Math.round(x1 * ppm); x++) for (let k = 0; k < 3; k++) ch[k].push(data[(y * W + x) * 3 + k]);
    return '#' + ch.map(c => Math.round(median(c)).toString(16).padStart(2, '0')).join('');
  });
}

if (arg('profile')) {
  const [x0, x1, from = 0, to = H / ppm] = arg('profile').split(',').map(Number);
  const {data} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rows: {y: number; c: number[]}[] = [];
  for (let y = Math.round(H - to * ppm); y < Math.round(H - from * ppm); y++) {
    const ch: number[][] = [[], [], []];
    for (let x = Math.round(x0 * ppm); x < Math.round(x1 * ppm); x++) for (let k = 0; k < 3; k++) ch[k].push(data[(y * W + x) * 3 + k]);
    rows.push({y: (H - y) / ppm, c: ch.map(median)});
  }
  const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], wall = median(rows.map(r => lum(r.c)));
  const hexOf = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  console.log(`wall lum ${wall.toFixed(0)} chroma ${median(rows.map(r => (Math.max(...r.c) - Math.min(...r.c)) / Math.max(1, Math.max(...r.c)))).toFixed(2)} ${hexOf([0, 1, 2].map(k => median(rows.map(r => r.c[k]))))}`);
  let run: typeof rows = [];
  const flush = () => { if (run.length) console.log(`light ${run.at(-1)!.y.toFixed(2)}-${run[0].y.toFixed(2)} m (${(run.length / ppm).toFixed(2)} m) ${hexOf([0, 1, 2].map(k => median(run.map(r => r.c[k]))))}`); run = []; };
  // Light stone: clearly less saturated than the brick and at least as bright (sunlit orange brick can out-shine shaded stone).
  const chroma = (c: number[]) => (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
  const wallChroma = median(rows.map(r => chroma(r.c)));
  for (const r of rows) { if (lum(r.c) > wall * 0.95 && chroma(r.c) < Math.min(0.22, wallChroma * 0.6)) run.push(r); else flush(); }
  flush();
} else if (arg('sample')) {
  const boxes = arg('sample').split(';').map(b => b.split(',').map(Number));
  const hexes = await sampleBoxes(boxes);
  boxes.forEach((b, i) => console.log(b.join(','), hexes[i]));
} else {
  const s = Number(arg('scale', '3')), from = Number(arg('from', '0')), to = Number(arg('to', String(H / ppm)));
  const top = Math.max(0, Math.round(H - to * ppm)), bottom = Math.min(H, Math.round(H - from * ppm)), h = bottom - top;
  const w = Math.round(W * s), hh = Math.round(h * s), lines: string[] = [];
  for (let k = 0; k * 0.1 <= W / ppm + 1e-6; k++) { const x = k * 0.1 * ppm * s; lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${hh}" stroke="${k % 10 ? (k % 5 ? '#ffff0040' : '#ffff0090') : '#ff0'}" stroke-width="${k % 10 ? 1 : 2}"/>`); if (k % 10 === 0) lines.push(`<text x="${x + 3}" y="14" font-size="13" fill="#ff0" font-family="Helvetica">${k / 10}</text>`); }
  for (let k = Math.ceil(from * 10); k * 0.1 <= to + 1e-6; k++) { const y = hh - (k * 0.1 - from) * ppm * s; lines.push(`<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="${k % 10 ? (k % 5 ? '#00ffff40' : '#00ffff90') : '#0ff'}" stroke-width="${k % 10 ? 1 : 2}"/>`); if (k % 10 === 0) lines.push(`<text x="3" y="${y - 3}" font-size="13" fill="#0ff" font-family="Helvetica">${k / 10}</text>`); }
  const out = `staging/canal-windows/grid-${arg('bag')}${process.argv.includes('--alt') ? '-alt' : ''}.png`;
  await sharp(file).extract({left: 0, top, width: W, height: h}).resize(w, hh, {kernel: 'nearest'}).composite([{input: Buffer.from(`<svg width="${w}" height="${hh}">${lines.join('')}</svg>`), left: 0, top: 0}]).png().toFile(out);
  console.log(out, w, hh);
}

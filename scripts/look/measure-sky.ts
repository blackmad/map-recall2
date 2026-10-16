// The clear Amsterdam sky as the municipal panoramas see it (open data, CC BY 4.0), for the sunny look's sky
// gradient (src/canalRecall/look/sunny.ts SKY).
//   npx tsx scripts/look/measure-sky.ts [<source-data>/pand-reference-walls]
// Every archived panorama view (*.thumb.jpg) whose top band is mostly blue sky counts as a clear-sky capture. Sky
// pixels are blue-dominant (b >= r + 25, b >= g, luma >= 90). Per view: the median of the sky pixels in the top tenth
// of the frame ("upper") and of the lowest tenth of the rows that hold sky ("low", the sky just above the
// roofline). Prints the medians over the clear views.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.argv[2] ?? path.resolve('../map-recall2-source-data/pand-reference-walls');
const files = fs.readdirSync(root).flatMap(d => { try { return fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.thumb.jpg')).map(f => path.join(root, d, f)); } catch { return []; } });
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const med = (a: number[]) => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
const medRgb = (px: number[][]) => [0, 1, 2].map(c => med(px.map(p => p[c])));
const upper: number[][] = [], low: number[][] = [];
let clear = 0;
for (const f of files) {
  const { data, info } = await sharp(f).resize(200, 200, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, isSky = (i: number) => { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; return b >= r + 25 && b >= g && luma(r, g, b) >= 90; };
  let topSky = 0;
  for (let y = 0; y < H * 0.1; y++) for (let x = 0; x < W; x++) if (isSky(y * W + x)) topSky++;
  if (topSky < W * H * 0.1 * 0.6) continue;
  clear++;
  const rows: number[] = [];
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (isSky(y * W + x)) n++; if (n > W * 0.2) rows.push(y); }
  const lowFrom = rows[Math.floor(rows.length * 0.9)];
  const up: number[][] = [], lo: number[][] = [];
  for (const y of rows) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!isSky(i)) continue;
    const p = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    if (y < H * 0.1) up.push(p); if (y >= lowFrom) lo.push(p);
  }
  if (up.length) upper.push(medRgb(up)); if (lo.length) low.push(medRgb(lo));
}
const u = medRgb(upper), l = medRgb(low);
console.log(JSON.stringify({ views: files.length, clear, upper: u, upperLuma: Math.round(luma(u[0], u[1], u[2])), low: l, lowLuma: Math.round(luma(l[0], l[1], l[2])) }));

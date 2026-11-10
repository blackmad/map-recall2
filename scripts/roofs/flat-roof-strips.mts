/**
 * Lane R5-E (#265) strips: the user's U1 shot | main | lane at the same pose, and the PDOK orthophoto (Beeldmateriaal
 * Nederland, CC BY 4.0) of the frame's roofs beside the lane frame, plus per-lid swatches (orthophoto median | main |
 * lane) from the U1 tables (scripts/roofs/flat-roof-u1-table.mts).
 *
 *   npx tsx scripts/roofs/flat-roof-strips.mts --user=<user shot png> --before=artifacts/flat-roofs/u1-main.png
 *     --after=artifacts/flat-roofs/u1-lane.png --before-table=…-table.json --after-table=…-table.json --out=<dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { OrthoMosaic, LUCHTFOTO_LICENCE } from './orthoTiles.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const OUT = path.resolve(arg('out') ?? 'artifacts/flat-roofs/strips');
fs.mkdirSync(OUT, { recursive: true });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (w: number, h: number, t: string, size = 22) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="10" y="${Math.round(h / 2 + size / 3)}" font-family="Helvetica" font-size="${size}" fill="#fff">${esc(t)}</text></svg>`);

// The user's shot: the browser chrome cut off (the page starts 40 px in and 72 px down at DPR 2).
async function userFrame(file: string, w: number, h: number) {
  const meta = await sharp(file).metadata();
  return sharp(file).extract({ left: 40, top: 72, width: meta.width! - 40, height: meta.height! - 72 }).resize(w, h, { fit: 'fill' }).png().toBuffer();
}

async function frames() {
  const W = 1232, H = 706, files = [arg('user'), arg('before'), arg('after')];
  const titles = ['user, build 7cda9af (2026-11-08)', 'main (flags off)', 'lane R5-E (flatRoofTone + flatRoofSurface)'];
  const parts: sharp.OverlayOptions[] = [];
  for (const [i, f] of files.entries()) {
    if (!f || !fs.existsSync(f)) continue;
    const img = i === 0 ? await userFrame(f, W, H) : await sharp(f).resize(W, H).png().toBuffer();
    parts.push({ input: label(W, 36, titles[i]), left: i * (W + 8), top: 0 }, { input: img, left: i * (W + 8), top: 36 });
  }
  await sharp({ create: { width: 3 * W + 16, height: H + 36, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 85 }).toFile(path.join(OUT, 'u1-user-main-lane.jpg'));
}

/** North-up orthophoto of the frame's roofs (the lids' bounding box), each table lid outlined and numbered. */
async function ortho() {
  const table = JSON.parse(fs.readFileSync(arg('after-table') ?? arg('before-table')!, 'utf8')) as Array<{ id: string; ring?: number[][]; lngLat?: number[][] }>;
  const rows = JSON.parse(fs.readFileSync(arg('after-json') ?? arg('before-json')!, 'utf8')).rows as Array<{ id: string; feature: { geometry: { type: string; coordinates: any } } }>;
  const rings = table.map(t => { const r = rows.find(r => r.id.endsWith(t.id)); const g = r!.feature.geometry; return (g.type === 'Polygon' ? g.coordinates : g.coordinates[0])[0] as number[][]; });
  const pts = rings.flat().map(([lng, lat]) => lngLatToRd(lng, lat));
  const pad = 20, minX = Math.min(...pts.map(p => p[0])) - pad, maxX = Math.max(...pts.map(p => p[0])) + pad, minY = Math.min(...pts.map(p => p[1])) - pad, maxY = Math.max(...pts.map(p => p[1])) + pad;
  const m = new OrthoMosaic('Actueel_ortho25', 14);
  await m.load(minX, minY, maxX, maxY);
  const w = Math.round((maxX - minX) / m.res), h = Math.round((maxY - minY) / m.res), buf = Buffer.alloc(w * h * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = m.pixel(minX + (i + .5) * m.res, maxY - (j + .5) * m.res); if (p) buf.set(p, (j * w + i) * 3); }
  const toPx = ([lng, lat]: number[]) => { const [x, y] = lngLatToRd(lng, lat); return [(x - minX) / m.res, (maxY - y) / m.res]; };
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${rings.map((r, k) => { const ps = r.map(toPx); const c = ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length], [0, 0]); return `<polygon points="${ps.map(p => p.join(',')).join(' ')}" fill="none" stroke="#ff0" stroke-width="3"/><text x="${c[0]}" y="${c[1]}" font-family="Helvetica" font-size="40" fill="#ff0" stroke="#000" stroke-width="1.5">${k + 1}</text>`; }).join('')}</svg>`;
  await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(path.join(OUT, 'u1-orthophoto-lids.jpg'));
  fs.writeFileSync(path.join(OUT, 'ORTHO-ATTRIBUTION.txt'), `${LUCHTFOTO_LICENCE}\n`);
}

/** Per lid: orthophoto median | main | lane swatches, luma printed. */
async function swatches() {
  const before = JSON.parse(fs.readFileSync(arg('before-table')!, 'utf8')) as any[], after = fs.existsSync(arg('after-table') ?? '') ? JSON.parse(fs.readFileSync(arg('after-table')!, 'utf8')) as any[] : [];
  const S = 70, rowH = S + 8, W = 900, parts: sharp.OverlayOptions[] = [{ input: label(W, 36, '#  pand  year   orthophoto | main | lane  (median luma)', 18), left: 0, top: 0 }];
  const grey = (y: number) => { const v = Math.max(0, Math.min(255, Math.round(y))); return sharp({ create: { width: S, height: S, channels: 3, background: { r: v, g: v, b: v } } }).png().toBuffer(); };
  for (const [k, b] of before.entries()) {
    const a = after.find(x => x.id === b.id), top = 40 + k * rowH;
    parts.push({ input: label(330, S, `${k + 1}  ${b.id.slice(-8)}  ${b.year ?? '–'}  ${b.source}`, 18), left: 0, top });
    parts.push({ input: await grey(b.ortho), left: 340, top }, { input: label(60, S, String(b.ortho), 18), left: 340 + S, top });
    parts.push({ input: await grey(b.rendered), left: 480, top }, { input: label(110, S, `${b.rendered} (${b.delta > 0 ? '+' : ''}${b.delta})`, 18), left: 480 + S, top });
    if (a) parts.push({ input: await grey(a.rendered), left: 670, top }, { input: label(160, S, `${a.rendered} (${a.delta > 0 ? '+' : ''}${a.delta})`, 18), left: 670 + S, top });
  }
  await sharp({ create: { width: W, height: 40 + before.length * rowH, channels: 3, background: '#222' } }).composite(parts).png().toFile(path.join(OUT, 'u1-lid-luma.png'));
}

await frames();
if (arg('before-table')) { await swatches(); await ortho(); }
console.log('strips in', OUT);

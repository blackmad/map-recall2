/**
 * Evidence strip for the Raadhuisstraat gallery: one rectified Gemeente Amsterdam panorama crop (CC BY 4.0) per BAG
 * front chord (each chord is one house / one gallery bay), from the Keizersgracht tower to the Herengracht corner, plus
 * the two canal fronts, laid side by side with a metre ruler. Output: artifacts/landmark-briefs/raadhuisstraat-galerij/strip.jpg
 * and strip.json (chord index, s along the front, length, panorama id and date).
 *
 *   node --import tsx scripts/landmarks/raadhuisstraat-galerij-strip.ts [--ppm=40]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {listPanos, rankPanos, type Wall} from '../pand-reference/select.ts';
import {loadPano, rectifyWall} from '../pand-reference/rectify.ts';
import fp from './raadhuisstraat-galerij-footprints.json' with {type: 'json'};
import {frontChords} from './raadhuisstraat-galerij-curve.ts';

const ppm = Number(process.argv.find(a => a.startsWith('--ppm='))?.slice(6) ?? 40);
const out = path.resolve('artifacts/landmark-briefs/raadhuisstraat-galerij/strip');
fs.mkdirSync(out, {recursive: true});
const [ax, ay] = fp.anchorRD;
const chords = frontChords();
const rows: {i: number; label: string; s0: number; len: number; pano?: string; date?: string; file?: string}[] = [];
const toWall = (a: number[], b: number[]): Wall => {
  // native (x east, z south) -> RD (x east, y north)
  const A = {x: a[0] + ax, y: ay - a[1]}, B = {x: b[0] + ax, y: ay - b[1]}, len = Math.hypot(B.x - A.x, B.y - A.y);
  // outward = right of a->b in native (front runs west->east with the street to the north) -> in RD, left of a->b
  let nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
  return {a: A, b: B, len, nx, ny, mid: {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2}, roadDistM: 0, facing: 0};
};
const walls: {label: string; s0: number; w: Wall}[] = chords.map((c, i) => ({label: `c${String(i).padStart(2, '0')}`, s0: c.s0, w: toWall(c.a, c.b)}));
// canal fronts: Keizersgracht (west) and Herengracht (east) from the union ring extremes
const ring = fp.nativeRing as number[][];
const west = ring.filter(p => p[0] < -56.4), east = ring.filter(p => p[0] > 42.25);
const span = (pts: number[][]) => { const s = [...pts].sort((p, q) => p[1] - q[1]); return [s[0], s.at(-1)!]; };
{ const [n, s] = span(west); const w = toWall(s, n); w.nx = -1; w.ny = 0; walls.push({label: 'keizersgracht', s0: -1, w}); }
{ const [n, s] = span(east); const w = toWall(n, s); w.nx = 1; w.ny = 0; walls.push({label: 'herengracht', s0: -1, w}); }
for (const [i, {label, s0, w}] of walls.entries()) {
  const ranked = rankPanos(w, await listPanos(w.mid, 40));
  const pick = ranked.find(p => p.obliquityDeg < 30) ?? ranked[0];
  const row: (typeof rows)[number] = {i, label, s0: +s0.toFixed(2), len: +w.len.toFixed(2)};
  if (pick) {
    const pano = await loadPano(pick);
    const crop = pano ? rectifyWall(pano.img, pick, w, 22, ppm, undefined, 30) : null;
    if (crop) { row.file = path.join(out, `${label}.jpg`); fs.writeFileSync(row.file, crop.jpeg); row.pano = pick.panoId; row.date = pick.timestamp.slice(0, 10); }
  }
  rows.push(row);
  console.log(label, row.len, row.pano ?? 'NO PANORAMA', row.date ?? '');
}
fs.writeFileSync(path.join(out, '../strip.json'), JSON.stringify(rows, null, 1));
// strip: chords in order, ruler every metre
const ims = [];
for (const r of rows) if (r.file) ims.push({r, b: await sharp(r.file).toBuffer(), m: await sharp(r.file).metadata()});
const H = Math.max(...ims.map(i => i.m.height!)) + 30, gap = 6;
let x = 30; const comps: sharp.OverlayOptions[] = [];
let svg = '';
for (const i of ims) {
  comps.push({input: i.b, left: x, top: H - i.m.height!});
  svg += `<rect x="${x}" y="0" width="${i.m.width}" height="28" fill="#000"/><text x="${x + 3}" y="19" font-size="16" fill="#fff" font-family="sans-serif">${i.r.label} ${i.r.len}m</text>`;
  x += i.m.width! + gap;
}
let ruler = '';
for (let m = 0; m * ppm < H - 30; m++) { const y = H - m * ppm; ruler += `<line x1="0" x2="${x}" y1="${y}" y2="${y}" stroke="${m % 5 ? '#0ff' : '#f0f'}" stroke-width="${m % 5 ? 0.5 : 1}" opacity="0.6"/><text x="2" y="${y - 2}" font-size="12" fill="#ff0">${m}</text>`; }
await sharp({create: {width: x, height: H, channels: 3, background: '#222'}}).composite([...comps, {input: Buffer.from(`<svg width="${x}" height="${H}">${svg}${ruler}</svg>`), left: 0, top: 0}]).jpeg({quality: 82}).toFile(path.join(out, '../strip.jpg'));
console.log('strip', x, H);

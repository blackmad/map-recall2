/**
 * Whole-face rectified crops of a landmark's street faces, one plane through two ring vertices of
 * `<id>-footprints.json` (ringRD), from the straightest Gemeente Amsterdam panoramas (CC BY 4.0). Generalises
 * nieuw-engeland-crops.ts: landmark-brief.ts splits faces at every pilaster jog and drops short pieces, so this draws
 * the whole face once for counting bays and storeys and for the likeness comparison.
 *
 *   node --import tsx scripts/landmarks/face-crops.ts --id=<id> --faces=north:3:4,west:4:0 [--height=12] [--ppm=40] [--n=3] [--radius=45]
 *
 * Writes artifacts/landmark-briefs/<id>/face-<name>-<n>.jpg and prints each panorama id and date. Not committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {listPanos, rankPanos, type Wall} from '../pand-reference/select';
import {loadPano, rectifyWall} from '../pand-reference/rectify';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('id');
if (!id || !arg('faces')) { console.error('--id=<id> --faces=name:i:j,... required'); process.exit(2); }
const src = JSON.parse(fs.readFileSync(path.join('scripts/landmarks', `${id}-footprints.json`), 'utf8')) as {ringRD: number[][]};
const R = src.ringRD;
const H = Number(arg('height', '12')), PPM = Number(arg('ppm', '40')), N = Number(arg('n', '3')), RADIUS = Number(arg('radius', '45'));
const out = `artifacts/landmark-briefs/${id}`;
fs.mkdirSync(out, {recursive: true});
for (const spec of arg('faces').split(',')) {
  const [name, si, sj] = spec.split(':');
  const a = {x: R[Number(si)][0], y: R[Number(si)][1]}, b = {x: R[Number(sj)][0], y: R[Number(sj)][1]};
  const len = Math.hypot(b.x - a.x, b.y - a.y), tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
  const wall: Wall = {a, b, len, nx: ty, ny: -tx, mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, roadDistM: 0, facing: 0};
  const panos = await listPanos(wall.mid, RADIUS);
  const win = {minD: 6, maxD: RADIUS, strict: [9, 35] as [number, number], maxObliquityDeg: 45};
  let picks = rankPanos(wall, panos, win);
  if (!picks.length) { wall.nx = -wall.nx; wall.ny = -wall.ny; picks = rankPanos(wall, panos, win); }
  console.log(name, len.toFixed(1), 'm', picks.length, 'candidates');
  let n = 0;
  for (const p of picks) {
    if (n >= N) break;
    const img = await loadPano(p);
    if (!img) continue;
    const c = rectifyWall(img.img, p, wall, H, PPM, undefined, H + 3);
    if (!c || c.missingFraction > 0.35) continue;
    const f = `${out}/face-${name}-${n}.jpg`;
    fs.writeFileSync(f, c.jpeg);
    console.log(' ', f, p.panoId, String(p.timestamp).slice(0, 10), `d=${p.distM.toFixed(0)} obl=${p.obliquityDeg.toFixed(0)} ppm=${c.ppm.toFixed(1)} ${c.width}x${c.height} miss=${c.missingFraction.toFixed(2)}`);
    n++;
  }
}

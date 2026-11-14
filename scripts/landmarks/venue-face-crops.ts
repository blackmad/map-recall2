/**
 * Whole-face rectified crops for a bespoke landmark, one plane per face between two BAG ring vertices (landmark-brief.ts
 * splits a pilastered front at every 0.2 m jog and skips walls its neighbour test misreads as covered; Arti et
 * Amicitiae's Rokin front was missed that way, 2026-11-14).
 *
 *   node --import tsx scripts/landmarks/venue-face-crops.ts --pand=<BAG pand> --id=<slug>              # list ring edges
 *   node --import tsx scripts/landmarks/venue-face-crops.ts --pand=<BAG pand> --id=<slug> \
 *        --faces=rokin:51:0:22,spui:0:21:22 [--per=3] [--ppm=50] [--max-d=40]
 *
 * A face `name:i:j:h` runs from ring vertex i to vertex j (RD, BAG order) with wall height h m; its outward side is
 * picked from the panoramas. BAG ring from the PDOK BAG WFS (CC0), cached in .cache/bag-wfs/<pand>.json; Gemeente
 * Amsterdam panoramas (CC BY 4.0). Writes artifacts/landmark-briefs/<id>/face-<name>-<n>.jpg and prints pano id, date,
 * distance and obliquity. Not committed. Requests name the repo URL as contact.
 */
import fs from 'node:fs';
import path from 'node:path';
import {listPanos, rankPanos, type Wall} from '../pand-reference/select';
import {loadPano, rectifyWall} from '../pand-reference/rectify';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const pand = arg('pand'), id = arg('id', `pand-${pand}`);
if (!pand) { console.error('--pand required'); process.exit(2); }
const UA = {'User-Agent': 'map-recall2 landmark lane (+https://github.com/blackmad/map-recall2)'};
const cache = path.join('.cache', 'bag-wfs', `${pand}.json`);
const url = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${pand}</Literal></PropertyIsEqualTo></Filter>`)}`;
if (!fs.existsSync(cache)) {
  const r = await fetch(url, {headers: UA});
  if (!r.ok) throw Error(`${url}: ${r.status}`);
  fs.mkdirSync(path.dirname(cache), {recursive: true});
  fs.writeFileSync(cache, await r.text());
}
const g = JSON.parse(fs.readFileSync(cache, 'utf8'));
const ring: number[][] = g.features[0].geometry.coordinates[0].slice(0, -1);
type XY = {x: number; y: number};
const P = (i: number): XY => ({x: ring[i % ring.length][0], y: ring[i % ring.length][1]});
const facesArg = arg('faces');
if (!facesArg) {
  console.log(pand, 'bouwjaar', g.features[0].properties.bouwjaar, ring.length, 'vertices');
  for (let i = 0; i < ring.length; i++) {
    const a = P(i), b = P(i + 1), L = Math.hypot(b.x - a.x, b.y - a.y);
    const brg = (Math.atan2(b.y - a.y, -(b.x - a.x)) * 180 / Math.PI + 360) % 360; // right-hand normal bearing (clockwise ring: outward)
    if (L >= 0.5) console.log(i, `${a.x.toFixed(2)},${a.y.toFixed(2)}`, `${L.toFixed(2)} m`, `normal ${brg.toFixed(0)}`);
  }
  process.exit(0);
}
const per = Number(arg('per', '3')), ppm = Number(arg('ppm', '50')), maxD = Number(arg('max-d', '40'));
const out = path.join('artifacts/landmark-briefs', id);
fs.mkdirSync(out, {recursive: true});
for (const spec of facesArg.split(',')) {
  const [name, i, j, h] = spec.split(':');
  const a = P(Number(i)), b = P(Number(j));
  const len = Math.hypot(b.x - a.x, b.y - a.y), tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
  const wall: Wall = {a, b, len, nx: ty, ny: -tx, mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, roadDistM: 0, facing: 0};
  const panos = await listPanos(wall.mid, maxD + 5);
  const win = {minD: 5, maxD, strict: [9, 30] as [number, number], maxObliquityDeg: 45};
  let picks = rankPanos(wall, panos, win);
  if (!picks.length) { wall.nx = -wall.nx; wall.ny = -wall.ny; picks = rankPanos(wall, panos, win); }
  console.log(name, len.toFixed(2), 'm', picks.length, 'candidates');
  let n = 0;
  const years = new Set<string>();
  for (const p of picks) {
    if (n >= per) break;
    const yr = String(p.timestamp).slice(0, 4);
    if (years.has(yr) && picks.length > per * 2) continue;
    const img = await loadPano(p);
    if (!img) continue;
    const c = rectifyWall(img.img, p, wall, Number(h) - 1.5, ppm, undefined, Number(h));
    if (!c || c.missingFraction > 0.35) continue;
    const f = `${out}/face-${name}-${n}.jpg`;
    fs.writeFileSync(f, c.jpeg);
    years.add(yr);
    console.log(' ', f, p.panoId, String(p.timestamp).slice(0, 10), `d=${p.distM.toFixed(0)} obl=${p.obliquityDeg.toFixed(0)} ppm=${c.ppm.toFixed(1)} ${c.width}x${c.height} miss=${c.missingFraction.toFixed(2)}`);
    n++;
  }
}

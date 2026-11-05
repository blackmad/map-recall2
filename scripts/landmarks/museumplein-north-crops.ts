/**
 * Reference crops for the Stedelijk Museum and the Albert Heijn on the Museumplein: the walls landmark-brief.ts cannot reach
 * (the 2012 pand 0363100012251804 shares every BAG edge with the 1895 pand, so the brief finds no exposed wall; the grass
 * roof of the Albert Heijn has no walls in the usual sense) and aimed views from named points.
 *
 *   node --import tsx scripts/landmarks/museumplein-north-crops.ts --id=stedelijk-museum
 *
 * Walls and views are given in the native frame of scripts/landmarks/<id>-footprints.json (x east, z south, metres from its
 * anchor). Writes artifacts/landmark-briefs/<id>/x-<name>.jpg (rectified, 50 px/m nominal) and v-<name>.jpg (aimed thumbnail of
 * the nearest panorama to the camera point), and prints the panorama id, date and distance of each. Panoramas: Gemeente
 * Amsterdam, CC BY 4.0, cached in .cache/pand-reference.
 */
import fs from 'node:fs';
import path from 'node:path';
import {cachedBytes, lngLatToRd, rdToLngLat, type Rd} from '../pand-reference/core.ts';
import {listPanos, rankPanos, type Wall} from '../pand-reference/select.ts';
import {loadPano, rectifyWall} from '../pand-reference/rectify.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const id = process.argv.find(a => a.startsWith('--id='))?.slice(5) ?? 'stedelijk-museum';
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7)?.split(',');
const fp = JSON.parse(fs.readFileSync(path.join(ROOT, `scripts/landmarks/${id}-footprints.json`), 'utf8'));
const [ax, ay] = fp.anchorRD as [number, number];
const rd = ([x, z]: number[]): Rd => ({x: ax + x, y: ay - z});
type WallSpec = {name: string; a: number[]; b: number[]; height: number; years?: number[]};
type ViewSpec = {name: string; cam: number[]; target: number[]; fov: number; pitch: number; year?: number};
const SPECS: Record<string, {walls: WallSpec[]; views: ViewSpec[]}> = {
  'stedelijk-museum': {
    walls: [
      // The bathtub's Museumplein (SSE) face, its WSW end on the Van Baerlestraat side and its ENE end, under the overhang.
      {name: 'tub-sse', a: [-22, 57.5], b: [57.7, 24.7], height: 18},
      {name: 'tub-wsw', a: [-29, 31], b: [-22.5, 57.7], height: 18},
      {name: 'tub-ene', a: [49.9, 6.6], b: [57.7, 24.7], height: 18},
      {name: 'box-wsw', a: [-13.4, 76.9], b: [-10.5, 83.6], height: 18},
      {name: 'box-sse', a: [-10.5, 83.6], b: [5.5, 76.7], height: 18},
      {name: 'box-nnw', a: [2.6, 70.0], b: [-13.4, 76.9], height: 18},
      {name: 'box-ene', a: [5.5, 76.7], b: [2.6, 70.0], height: 18},
    ],
    views: [
      {name: 'museumplein-se', cam: [40, 75], target: [15, 40], fov: 90, pitch: 12},
      {name: 'museumplein-s', cam: [10, 95], target: [10, 45], fov: 90, pitch: 12},
      {name: 'vanbaerle-sw', cam: [-45, 60], target: [-5, 40], fov: 90, pitch: 12},
      {name: 'vanbaerle-w', cam: [-60, 25], target: [-30, 15], fov: 90, pitch: 15},
      {name: 'pp-nw', cam: [-20, -40], target: [0, -12], fov: 90, pitch: 15},
      {name: 'pp-n', cam: [5, -45], target: [5, -10], fov: 80, pitch: 20},
      {name: 'pp-ne', cam: [45, -45], target: [25, -15], fov: 90, pitch: 15},
      {name: 'east-e', cam: [70, 10], target: [40, 15], fov: 90, pitch: 12},
      {name: 'corner-vb-pp', cam: [-70, -10], target: [-45, 10], fov: 90, pitch: 15},
      {name: 'user-corner', cam: [-70, 45], target: [0, 70], fov: 90, pitch: 8},
      {name: 'plein-far-se', cam: [75, 95], target: [10, 45], fov: 100, pitch: 8},
      {name: 'plein-far-s', cam: [30, 115], target: [10, 45], fov: 100, pitch: 8},
      {name: 'vanbaerle-ssw', cam: [-50, 95], target: [10, 50], fov: 100, pitch: 8},
      {name: 'plein-e', cam: [90, 50], target: [20, 45], fov: 100, pitch: 8},
    ],
  },
  'albert-heijn-museumplein': {
    // Native frame of albert-heijn-museumplein-footprints.json: the NW edge (the shopfront under the raised lawn) runs from the
    // raised tip (-55.8, 22.9) at the Van Baerlestraat to (19.1, -23.4); its outward normal is (-0.526, -0.851).
    walls: [
      {name: 'front-w', a: [-55.8, 22.9], b: [-18.3, -0.25], height: 8},
      {name: 'front-e', a: [-18.3, -0.25], b: [19.1, -23.4], height: 8},
      {name: 'tip-sw', a: [-29.4, 42.2], b: [-55.8, 22.9], height: 8},
    ],
    views: [
      {name: 'tip-from-vanbaerle', cam: [-80, 25], target: [-50, 22], fov: 90, pitch: 5},
      {name: 'tip-from-nw', cam: [-62, 5], target: [-48, 18], fov: 90, pitch: 5},
      {name: 'front-mid', cam: [-24.6, -10.5], target: [-18.3, -0.25], fov: 100, pitch: 5},
      {name: 'front-west', cam: [-43, 4], target: [-37, 14], fov: 100, pitch: 5},
      {name: 'front-east', cam: [-6, -22], target: [1, -12], fov: 100, pitch: 5},
      {name: 'along-from-ne', cam: [20, -32], target: [-40, 14], fov: 70, pitch: 3},
      {name: 'tip-from-s', cam: [-40, 55], target: [-50, 25], fov: 90, pitch: 5},
      {name: 'vent-225637', cam: [25, -48], target: [31.8, -39], fov: 80, pitch: 5},
    ],
  },
};
const spec = SPECS[id];
const dir = path.join(ROOT, 'artifacts/landmark-briefs', id);
fs.mkdirSync(dir, {recursive: true});
for (const w of spec.walls) {
  if (only && !only.includes(w.name)) continue;
  const a = rd(w.a), b = rd(w.b), len = Math.hypot(b.x - a.x, b.y - a.y);
  // Outward normal: right of a -> b in RD (y north), i.e. walls are listed clockwise seen from above.
  const nx = (b.y - a.y) / len, ny = -(b.x - a.x) / len;
  const wall: Wall = {a, b, len, nx, ny, mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, roadDistM: 0, facing: 0};
  const picks = rankPanos(wall, await listPanos(wall.mid, 45), {minD: 6, maxD: 45, strict: [10, 35], maxObliquityDeg: 50});
  let n = 0;
  for (const pick of picks) {
    if (n >= 2) break;
    const pano = await loadPano(pick).catch(() => null);
    const crop = pano ? rectifyWall(pano.img, pick, wall, w.height, 40, undefined, 24) : null;
    if (!crop || crop.missingFraction > 0.25) continue;
    const file = path.join(dir, `x-${w.name}${n ? '.alt' : ''}.jpg`);
    fs.writeFileSync(file, crop.jpeg);
    console.log(`x-${w.name}${n ? '.alt' : ''}`, pick.panoId, pick.timestamp.slice(0, 10), `${pick.distM.toFixed(0)} m`, `${pick.obliquityDeg.toFixed(0)} deg`, `${crop.ppm.toFixed(1)} px/m`, `${crop.wallWidthM.toFixed(1)} x ${crop.wallHeightM.toFixed(1)} m`);
    n++;
  }
  if (!n) console.log(`x-${w.name}: no usable panorama`);
}
for (const v of spec.views) {
  if (only && !only.includes(v.name)) continue;
  const c = rd(v.cam), t = rd(v.target);
  const panos = await listPanos(c, 15);
  if (!panos.length) { console.log(`v-${v.name}: no panorama within 15 m`); continue; }
  const pick = panos.map(p => ({p, d: (() => { const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]); return Math.hypot(q.x - c.x, q.y - c.y); })()}))
    .sort((a, b) => (a.d - b.d) + (Number(String(b.p.timestamp).slice(0, 4)) - Number(String(a.p.timestamp).slice(0, 4))) * 1.5)[0];
  const q = lngLatToRd([pick.p.geometry.coordinates[0], pick.p.geometry.coordinates[1]]);
  const heading = Math.round((Math.atan2(t.x - q.x, t.y - q.y) * 180 / Math.PI + 360) % 360);
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.p.pano_id}/?width=1000&aspect=1.5&fov=${v.fov}&heading=${heading}&pitch=${v.pitch}`;
  try {
    fs.writeFileSync(path.join(dir, `v-${v.name}.jpg`), await cachedBytes(url, '.jpg'));
    const [lng, lat] = rdToLngLat(q);
    console.log(`v-${v.name}`, pick.p.pano_id, String(pick.p.timestamp).slice(0, 10), `cam ${lng.toFixed(6)},${lat.toFixed(6)} heading ${heading}`);
  } catch (e) { console.log(`v-${v.name}:`, String(e).split('\n')[0]); }
}

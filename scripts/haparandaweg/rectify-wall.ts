/**
 * Rectified straight-on elevations of every exposed wall of a pand whose outward bearing is within --tol of --bearing.
 *   node --import tsx scripts/haparandaweg/rectify-wall.ts --bag=0363100012243309 --bearing=140 [--tol=15] [--out=artifacts/haparandaweg/ref/<bag>] [--ppm=50] [--year=2021]
 * Writes <out>/wall-<bearing>-<k>.jpg (+ .json with the wall ends and panorama) for each wall, best panorama per wall.
 */
import fs from 'node:fs';
import path from 'node:path';
import { findPands, neighbourhood, normId, rdToLngLat } from '../pand-reference/core.ts';
import { exposedWalls, listPanos, rankPanos } from '../pand-reference/select.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const bag = normId(arg('bag')), want = Number(arg('bearing')), tol = Number(arg('tol', '15')), ppm = Number(arg('ppm', '50'));
const out = arg('out', `artifacts/haparandaweg/ref/${bag}`);
fs.mkdirSync(out, { recursive: true });
const fp = (await findPands([bag])).get(bag)!;
const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
const walls = exposedWalls(fp, await neighbourhood(centre));
let k = 0;
for (const w of walls.sort((a, b) => b.len - a.len)) {
  const br = (Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360;
  const d = Math.abs(((br - want + 540) % 360) - 180);
  if (d > tol || w.len < 3) continue;
  let picks = rankPanos(w, await listPanos(w.mid));
  if (arg('year')) picks = picks.filter(p => String(p.missionYear) === arg('year'));
  const pick = picks[0];
  const [a, b] = [rdToLngLat(w.a), rdToLngLat(w.b)];
  console.log(`wall ${k}: bearing ${br.toFixed(0)} len ${w.len.toFixed(1)} ends ${a.map(v => v.toFixed(6))} -> ${b.map(v => v.toFixed(6))} pano ${pick?.panoId} ${pick?.missionYear} dist ${pick?.distM.toFixed(0)} obliq ${pick?.obliquityDeg.toFixed(0)}`);
  if (!pick) continue;
  const pano = await loadPano(pick);
  if (!pano) continue;
  const crop = rectifyWall(pano.img, pick, w, fp.height, ppm);
  if (!crop) continue;
  const base = path.join(out, `wall-${Math.round(br)}-${k}`);
  fs.writeFileSync(`${base}.jpg`, crop.jpeg);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ bearing: br, lengthM: w.len, startLngLat: a, endLngLat: b, pano: pick.panoId, year: pick.missionYear, distM: pick.distM, obliquityDeg: pick.obliquityDeg, crop: { width: crop.width, height: crop.height, ppm: crop.ppm, wallHeightM: crop.wallHeightM, baseZ: crop.baseZ, groundSource: crop.groundSource } }, null, 1));
  console.log(`  -> ${base}.jpg ${crop.width}x${crop.height}`);
  k++;
}

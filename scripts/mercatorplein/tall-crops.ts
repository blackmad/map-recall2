/**
 * Tall rectified crops (whole tower height, 50 px/m) and up-looking aimed thumbnails of chosen walls of a pand, for the tower
 * stages above the brief's crops (the brief crops a wall up to its tile height only).
 *
 *   node --import tsx scripts/mercatorplein/tall-crops.ts --pand=0363100012073289 --id=mercatorplein-zuidtoren [--height=37] [--n=3] [--min-len=3] w01-164 w02-344
 *
 * Wall tags are those of the brief (exposed walls >= min-len sorted by length). Writes
 * artifacts/landmark-briefs/<id>/tall-<tag>-<k>.jpg (+ .json with panorama id, date, camera) and up-<tag>-<k>.jpg.
 * Panoramas: Gemeente Amsterdam, CC BY 4.0.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {cachedBytes, findPands, neighbourhood, normId, rdToLngLat} from '../pand-reference/core.ts';
import {exposedWalls, listPanos, rankPanos} from '../pand-reference/select.ts';
import {loadPano, rectifyWall} from '../pand-reference/rectify.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const tags = process.argv.slice(2).filter(a => !a.startsWith('--'));
const pand = normId(arg('pand')), id = arg('id'), H = Number(arg('height', '37')), N = Number(arg('n', '3')), minLen = Number(arg('min-len', '4'));
if (!id) throw new Error('--id required');
const fp = (await findPands([pand])).get(pand);
if (!fp) throw new Error(`pand not in tiles: ${pand}`);
const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
const all = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len).filter(w => w.len >= minLen).slice(0, 30);
const bearingOf = (w: {nx: number; ny: number}) => Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);
const out = path.resolve('artifacts/landmark-briefs', id);
fs.mkdirSync(out, {recursive: true});
for (const [i, w] of all.entries()) {
  const tag = `w${String(i + 1).padStart(2, '0')}-${bearingOf(w)}`;
  if (tags.length && !tags.includes(tag)) continue;
  const ranked = rankPanos(w, await listPanos(w.mid, 60));
  // one pick per capture year, nearest-first within the ranking, so the crops span several dates
  const seen = new Set<string>(), picks = [];
  for (const p of ranked) { const y = p.timestamp.slice(0, 4); if (seen.has(y)) continue; seen.add(y); picks.push(p); if (picks.length >= N) break; }
  console.log(tag, picks.map(p => `${p.panoId} ${p.timestamp.slice(0, 10)} d${p.distM.toFixed(0)} ob${p.obliquityDeg.toFixed(0)}`).join(' | '));
  for (const [k, pick] of picks.entries()) {
    const pano = await loadPano(pick); if (!pano) continue;
    const crop = rectifyWall(pano.img, pick, w, H, 50);
    if (crop) {
      fs.writeFileSync(path.join(out, `tall-${tag}-${k}.jpg`), crop.jpeg);
      fs.writeFileSync(path.join(out, `tall-${tag}-${k}.json`), JSON.stringify({panoId: pick.panoId, capturedAt: pick.timestamp.slice(0, 10), distM: pick.distM, obliquityDeg: pick.obliquityDeg, ppm: 50, width: crop.width, height: crop.height, baseZ: crop.baseZ, wallHeightM: crop.wallHeightM, camera: crop.camera, wallRD: {a: w.a, b: w.b, normal: [w.nx, w.ny]}}, null, 1));
      console.log('  wrote', `tall-${tag}-${k}.jpg`, crop.width, crop.height);
    }
    const [lng, lat] = rdToLngLat(w.mid), cam = pick.record.geometry.coordinates;
    const dx = (lng - cam[0]) * 111320 * Math.cos(lat * Math.PI / 180), dy = (lat - cam[1]) * 110540;
    const heading = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360), d = Math.max(pick.distM, 4);
    const pitch = Math.round(Math.atan((H * 0.7) / d) * 180 / Math.PI);
    const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.panoId}/?width=1000&aspect=1&fov=70&heading=${heading}&pitch=${Math.min(pitch, 50)}`;
    try { const bytes = await cachedBytes(url, '.jpg'); fs.writeFileSync(path.join(out, `up-${tag}-${k}.jpg`), await sharp(bytes).jpeg({quality: 85}).toBuffer()); } catch (e) { console.log('  thumb failed', String(e).slice(0, 80)); }
  }
}

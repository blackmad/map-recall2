/**
 * Aimed panorama views of a point (a tower top, a corner) from panoramas at a chosen distance band, one per capture year
 * and direction, for the faces the per-wall crops cannot reach (tower tops 30+ m up, faces behind the square's trees).
 *
 *   node --import tsx scripts/mercatorplein/aim.ts --at=4.85128,52.37036 --h=30 --min=25 --max=70 --n=8 --out=artifacts/mercatorplein/aim/north-tower [--fov=45]
 *
 * Writes <out>/<panoId>.jpg and index.json (panorama id, date, distance, bearing from the target to the camera, heading,
 * pitch). Panoramas: Gemeente Amsterdam, CC BY 4.0 (thumbnail API).
 */
import fs from 'node:fs';
import path from 'node:path';
import {cachedBytes, lngLatToRd} from '../pand-reference/core.ts';
import {listPanos} from '../pand-reference/select.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const rd = arg('rd') ? arg('rd').split(',').map(Number) : null, [lng, lat] = rd ? [0, 0] : arg('at').split(',').map(Number), h = Number(arg('h', '25')), lo = Number(arg('min', '20')), hi = Number(arg('max', '70'));
const n = Number(arg('n', '8')), fov = Number(arg('fov', '45')), out = path.resolve(arg('out', 'artifacts/mercatorplein/aim'));
fs.mkdirSync(out, {recursive: true});
const target = rd ? {x: rd[0], y: rd[1]} : lngLatToRd([lng, lat]);
const panos = await listPanos(target, hi);
const rows = panos.map(p => {
  const [plng, plat] = p.geometry.coordinates, c = lngLatToRd([plng, plat]), dx = target.x - c.x, dy = target.y - c.y, d = Math.hypot(dx, dy);
  return {p, c, d, heading: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, from: (Math.atan2(-dx, -dy) * 180 / Math.PI + 360) % 360, year: String(p.timestamp ?? p.properties?.timestamp ?? '').slice(0, 4)};
}).filter(r => r.d >= lo && r.d <= hi && r.from >= Number(arg("from-min", "0")) && r.from <= Number(arg("from-max", "360")));
// spread: one per 30-degree sector of approach and year, nearest first
const seen = new Set<string>(), pick: typeof rows = [];
for (const r of rows.sort((a, b) => a.d - b.d)) { const k = `${Math.round(r.from / 30)}-${r.year}`; if (seen.has(k)) continue; seen.add(k); pick.push(r); if (pick.length >= n) break; }
const index: object[] = [];
for (const r of pick) {
  const id = r.p.pano_id ?? r.p.id, pitch = arg("pitch") ? Number(arg("pitch")) : Math.round(Math.atan((h - 2.4) / r.d) * 180 / Math.PI * Number(arg("pitch-k", "0.75")));
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${id}/?width=1000&aspect=1&fov=${fov}&heading=${Math.round(r.heading)}&pitch=${pitch}`;
  try { fs.writeFileSync(path.join(out, `${id}.jpg`), await cachedBytes(url, '.jpg')); index.push({id, date: r.year, distM: Math.round(r.d), from: Math.round(r.from), heading: Math.round(r.heading), pitch, fov, panoRD: [+r.c.x.toFixed(2), +r.c.y.toFixed(2)], url}); console.log(id, r.year, Math.round(r.d), 'm from', Math.round(r.from)); }
  catch (e) { console.log('failed', id, String(e).slice(0, 80)); }
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 1));

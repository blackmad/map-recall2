// Aimed perspective views of a bridge from the nearest panoramas beside it (the public thumbnail endpoint), for reading
// what a rectified face cannot show: a bascule's portal or its absence, lamps, the bridge-keeper's house.
//   npx tsx scripts/bridge-reference/thumb.ts BRU0151 [BRU0345 …]    # artifacts/bridges/<id>/aimed-<n>.jpg
import { mkdirSync, writeFileSync } from 'node:fs';
import { cachedBytes, lngLatToRd, rdToLngLat } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';
import { bridgeFace } from './geometry.ts';

export async function aimedViews(id: string, count = 3): Promise<{ file: string; pano: string; url: string; distM: number; angleDeg: number }[]> {
  const face = bridgeFace(id);
  if (!face) return [];
  const panos = [...await listPanos(face.mid, 70), ...await listPanos(face.mid, 70, 'surface-water')];
  // Beside the bridge, not on it: 18-60 m off, at least 35° off the deck axis, newest first among the straightest.
  const cands = panos.map(p => {
    const rd = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]), dx = rd.x - face.mid.x, dy = rd.y - face.mid.y, d = Math.hypot(dx, dy);
    const along = Math.abs(dx * face.u.x + dy * face.u.y) / (d || 1);
    return { p, d, angle: Math.acos(Math.min(1, along)) * 180 / Math.PI, year: Number(p.mission_year) };
  }).filter(c => c.d > 18 && c.d < 60 && c.angle > 35).sort((a, b) => b.angle - a.angle + (b.year - a.year) * 2);
  const out: { file: string; pano: string; url: string; distM: number; angleDeg: number }[] = [];
  const picked: typeof cands = [];
  for (const c of cands) { if (picked.every(q => Math.abs(q.angle - c.angle) > 8 || q.year !== c.year)) picked.push(c); if (picked.length >= count) break; }
  mkdirSync(`artifacts/bridges/${id}`, { recursive: true });
  for (const [i, c] of picked.entries()) {
    const [lng, lat] = rdToLngLat(face.mid), cam = c.p.geometry.coordinates;
    const dx = (lng - cam[0]) * 111320 * Math.cos(lat * Math.PI / 180), dy = (lat - cam[1]) * 111320;
    const heading = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360), fov = Math.round(Math.min(90, Math.max(40, 2 * Math.atan(((face.deck[1] - face.deck[0]) / 2 + 6) / c.d) * 180 / Math.PI)));
    const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${c.p.pano_id}/?width=900&aspect=1.6&fov=${fov}&heading=${heading}&pitch=4`;
    try {
      const bytes = await cachedBytes(url, '.jpg'), file = `artifacts/bridges/${id}/aimed-${i}.jpg`;
      writeFileSync(file, bytes);
      out.push({ file, pano: c.p.pano_id, url, distM: Math.round(c.d), angleDeg: Math.round(c.angle) });
    } catch { /* next */ }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) for (const id of process.argv.slice(2)) console.log(id, JSON.stringify(await aimedViews(id)));

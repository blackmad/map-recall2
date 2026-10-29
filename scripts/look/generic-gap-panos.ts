/**
 * The real street at each generic-uplift spot (generic-gap-sheet.ts): the most recent Gemeente Amsterdam panorama
 * (CC BY 4.0) within 25 m of the spot, looking along the street like the chase camera.
 *   npx tsx scripts/look/generic-gap-panos.ts <spots.json> <outDir>  -> <outDir>/<slug>.jpg, <outDir>/panos.json
 * spots.json: [{ slug, name, lng, lat, bearing }]
 */
import fs from 'node:fs';
import path from 'node:path';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';

const [spotsFile, outDir] = process.argv.slice(2);
const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8')) as { slug: string; lng: number; lat: number; bearing: number }[];
fs.mkdirSync(outDir, { recursive: true });
const record: unknown[] = [];
for (const s of spots) {
  const c = lngLatToRd([s.lng, s.lat]), panos = await listPanos(c, 25);
  const pick = panos.map(p => { const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]); return { p, d: Math.hypot(q.x - c.x, q.y - c.y) }; })
    .sort((a, b) => String(b.p.timestamp).slice(0, 4).localeCompare(String(a.p.timestamp).slice(0, 4)) || a.d - b.d)[0];
  if (!pick) { console.log(s.slug, 'no panorama'); continue; }
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.p.pano_id}/?width=1000&aspect=1.6&fov=80&heading=${Math.round(s.bearing)}&pitch=-5`;
  fs.writeFileSync(path.join(outDir, `${s.slug}.jpg`), await cachedBytes(url, '.jpg'));
  record.push({ slug: s.slug, pano: pick.p.pano_id, date: String(pick.p.timestamp).slice(0, 10), distM: Math.round(pick.d), url });
  console.log(s.slug, pick.p.pano_id, String(pick.p.timestamp).slice(0, 10), `${pick.d.toFixed(0)} m`);
}
fs.writeFileSync(path.join(outDir, 'panos.json'), JSON.stringify(record, null, 1));

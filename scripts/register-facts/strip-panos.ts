/**
 * The real street for each register-recipes strip house: the most recent Gemeente Amsterdam panorama (CC BY 4.0) within
 * 30 m of the camera spot, headed at the house from where the panorama itself stands.
 *   npx tsx scripts/register-facts/strip-panos.ts <spots.gap.json> <outDir>  -> <outDir>/<slug>.jpg, <outDir>/panos.json
 * spots: [{ slug, house: [lng, lat], eye: [lng, lat] }]
 */
import fs from 'node:fs';
import path from 'node:path';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';

const [spotsFile, outDir] = process.argv.slice(2);
const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8')) as { slug: string; house: [number, number]; eye: [number, number] }[];
fs.mkdirSync(outDir, { recursive: true });
const record: unknown[] = [];
for (const s of spots) {
  const c = lngLatToRd(s.eye), h = lngLatToRd(s.house), panos = await listPanos(c, 30);
  const pick = panos.map(p => { const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]); return { p, q, d: Math.hypot(q.x - c.x, q.y - c.y) }; })
    .sort((a, b) => String(b.p.timestamp).slice(0, 4).localeCompare(String(a.p.timestamp).slice(0, 4)) || a.d - b.d)[0];
  if (!pick) { console.log(s.slug, 'no panorama'); continue; }
  // RD is x east, y north: the compass heading from the panorama to the house.
  const heading = Math.round(((Math.atan2(h.x - pick.q.x, h.y - pick.q.y) * 180 / Math.PI) + 360) % 360);
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.p.pano_id}/?width=1000&aspect=1.6&fov=80&heading=${heading}&pitch=-5`;
  fs.writeFileSync(path.join(outDir, `${s.slug}.jpg`), await cachedBytes(url, '.jpg'));
  record.push({ slug: s.slug, pano: pick.p.pano_id, date: String(pick.p.timestamp).slice(0, 10), distM: Math.round(pick.d), heading, url });
  console.log(s.slug, pick.p.pano_id, String(pick.p.timestamp).slice(0, 10), `${pick.d.toFixed(0)} m heading ${heading}`);
}
fs.writeFileSync(path.join(outDir, 'panos.json'), JSON.stringify(record, null, 1));

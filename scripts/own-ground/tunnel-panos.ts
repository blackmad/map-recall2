// Aimed panorama views (data.amsterdam.nl, open data) of a tunnel site: the newest panorama within `radius` of a
// camera point, looking at a target point. For judging the tunnel cuts (tunnels.ts) against the street.
//
//   npx tsx scripts/own-ground/tunnel-panos.ts <id> <camLng> <camLat> <targetLng> <targetLat> [radius=25] [fov=80]
//   -> artifacts/tunnel-places/panos/<id>.jpg
import { mkdirSync, writeFileSync } from 'node:fs';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';

const [id, ...rest] = process.argv.slice(2);
const [camLng, camLat, tLng, tLat, radius = 25, fov = 80] = rest.map(Number);
const panos = await listPanos(lngLatToRd([camLng, camLat]), radius);
if (!panos.length) { console.log(id, 'no panorama within', radius, 'm'); process.exit(0); }
const c = panos.map(p => ({ p, d: Math.hypot((p.geometry.coordinates[0] - camLng) * 67960, (p.geometry.coordinates[1] - camLat) * 111320), year: Number(p.mission_year) }))
  .sort((a, b) => b.year - a.year || a.d - b.d)[0];
const cam = c.p.geometry.coordinates, dx = (tLng - cam[0]) * 111320 * Math.cos(tLat * Math.PI / 180), dy = (tLat - cam[1]) * 111320;
const heading = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360);
const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${c.p.pano_id}/?width=900&aspect=1.6&fov=${fov}&heading=${heading}&pitch=-4`;
mkdirSync('artifacts/tunnel-places/panos', { recursive: true });
writeFileSync(`artifacts/tunnel-places/panos/${id}.jpg`, await cachedBytes(url, '.jpg'));
console.log(id, c.p.pano_id, c.year, `${c.d.toFixed(0)} m from the camera point`, 'heading', heading);

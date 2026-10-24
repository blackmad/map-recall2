/**
 * The real street beside each period-walls strip camera (tests/e2e/period-walls-strip.spec.ts): the nearest recent
 * Gemeente Amsterdam panorama (CC BY 4.0) to the place's centre, looking along the street like the chase camera.
 *   npx tsx scripts/look/period-walls-panos.ts  -> artifacts/period-walls/strip/pano/<place>.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';
import { listPanos } from '../pand-reference/select.ts';
import { WALL_PLACES, move } from '../../tests/e2e/periodWallPlaces.ts';

const out = path.resolve('artifacts/period-walls/strip/pano');
fs.mkdirSync(out, { recursive: true });
const shots = WALL_PLACES.flatMap(p => [{ name: p.name, at: p.centre, heading: p.axis }, ...(p.row ? [{ name: `${p.name}-row`, at: move(p.row.target, p.row.from, 14), heading: (p.row.from + 180) % 360 }] : [])]);
for (const place of shots) {
  const c = lngLatToRd(place.at), panos = await listPanos(c, 25);
  const pick = panos.map(p => ({ p, d: Math.hypot(...((q => [q.x - c.x, q.y - c.y])(lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]])) as [number, number])) }))
    .sort((a, b) => String(b.p.timestamp).slice(0, 4).localeCompare(String(a.p.timestamp).slice(0, 4)) || a.d - b.d)[0];
  if (!pick) { console.log(place.name, 'no panorama'); continue; }
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.p.pano_id}/?width=1000&aspect=1.6&fov=80&heading=${Math.round(place.heading)}&pitch=-5`;
  fs.writeFileSync(path.join(out, `${place.name}.jpg`), await cachedBytes(url, '.jpg'));
  console.log(place.name, pick.p.pano_id, String(pick.p.timestamp).slice(0, 10), `${pick.d.toFixed(0)} m`);
}

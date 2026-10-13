// node panopick.mjs lat lng outwardBearing dist fov out.jpg [width] [headingOffset]
// Chooses the panorama nearest to the point `dist` m out from (lat,lng) along the outward bearing and aims at (lat,lng).
import fs from 'node:fs';
const [lat, lng, brg, dist, fov, out, width = '1600', off = '0'] = process.argv.slice(2);
const b = +brg * Math.PI / 180, d = +dist;
const mlat = 111320, mlng = 111320 * Math.cos(+lat * Math.PI / 180);
const ilat = +lat + d * Math.cos(b) / mlat, ilng = +lng + d * Math.sin(b) / mlng;
const list = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${ilng},${ilat}&srid=4326&radius=25&page_size=30&newest_in_range=true`)).json();
const items = (list._embedded?.panoramas ?? []).map(p => {
  const [plng, plat] = p.geometry.coordinates;
  const ex = (ilng - plng) * mlng, ey = (ilat - plat) * mlat;
  const tx = (+lng - plng) * mlng, ty = (+lat - plat) * mlat;
  return {id: p.pano_id, err: Math.hypot(ex, ey), year: p.mission_year, dist: Math.hypot(tx, ty), heading: (Math.atan2(tx, ty) * 180 / Math.PI + 360) % 360};
}).sort((x, y) => x.err - y.err);
if (!items.length) { console.log('no pano'); process.exit(1); }
const p = items[0];
const heading = (p.heading + +off + 360) % 360;
const r = await fetch(`https://api.data.amsterdam.nl/panorama/thumbnail/${p.id}/?width=${width}&fov=${fov}&heading=${heading.toFixed(0)}`);
if (!r.ok) throw Error(String(r.status));
fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
console.log(JSON.stringify({id: p.id, year: p.year, distToTarget: +p.dist.toFixed(1), heading: +heading.toFixed(0), url: `https://api.data.amsterdam.nl/panorama/thumbnail/${p.id}/?width=${width}&fov=${fov}&heading=${heading.toFixed(0)}`}));

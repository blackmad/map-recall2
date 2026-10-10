// node panoshoot.mjs <panoId> <targetLat> <targetLng> <fov> <out.jpg> [width=1600] [headingOffset=0]
// Fetches a thumbnail of a specific panorama aimed at a target point (use ids from panolist.mjs).
import fs from 'node:fs';
const [id, tlat, tlng, fov, out, width = '1600', off = '0'] = process.argv.slice(2);
const meta = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/${id}/`)).json();
const [plng, plat] = meta.geometry.coordinates;
const mlat = 111320, mlng = 111320 * Math.cos(+tlat * Math.PI / 180);
const dx = (+tlng - plng) * mlng, dy = (+tlat - plat) * mlat;
const heading = ((Math.atan2(dx, dy) * 180 / Math.PI + +off) + 360) % 360;
const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${id}/?width=${width}&fov=${fov}&heading=${heading.toFixed(0)}`;
const r = await fetch(url);
if (!r.ok) throw Error(String(r.status));
fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
console.log(JSON.stringify({id, ts: meta.timestamp?.slice(0, 10), dist: Math.round(Math.hypot(dx, dy)), url}));

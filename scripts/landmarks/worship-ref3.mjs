// Usage: node scripts/landmarks/worship-ref3.mjs <out.jpg> <targetLng> <targetLat> <camBearingFromTarget> <camDist> [fov=70] [pitch=10] [radius=14]
// Saves the municipal panorama nearest to the point <camDist> metres from the target along <camBearingFromTarget>
// (compass degrees), aimed at the target: a facade photo taken from that side.
import fs from 'node:fs';
const [out, lng, lat, brg, dist, fov = '70', pitch = '10', radius = '14'] = process.argv.slice(2);
const mx = 111320 * Math.cos(+lat * Math.PI / 180), my = 111320, b = +brg * Math.PI / 180;
const cl = +lng + Math.sin(b) * +dist / mx, ct = +lat + Math.cos(b) * +dist / my;
const j = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${cl},${ct}&srid=4326&radius=${radius}&page_size=20&newest_in_range=true`)).json();
const cands = (j._embedded?.panoramas ?? []).map(p => {
  const [x, y] = p.geometry.coordinates, dx = (+lng - x) * mx, dy = (+lat - y) * my;
  return {id: p.pano_id, off: Math.hypot((x - cl) * mx, (y - ct) * my), d: Math.hypot(dx, dy), heading: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, year: p.mission_year};
}).sort((a, c) => a.off - c.off);
if (!cands.length) { console.log('none'); process.exit(1); }
const c = cands[0];
const r = await fetch(`https://api.data.amsterdam.nl/panorama/thumbnail/${c.id}/?width=1400&fov=${fov}&heading=${c.heading.toFixed(0)}&pitch=${pitch}`);
fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
console.log(c.id, 'camera dist to target', c.d.toFixed(0), 'looking', c.heading.toFixed(0), c.year, 'offset from wanted', c.off.toFixed(0));

// Usage: node scripts/landmarks/worship-ref2.mjs <outPrefix> <lng> <lat> [minDist=18] [maxDist=45] [fov=70] [pitch=12] [count=3]
// Saves up to <count> municipal panorama views aimed at the point from cameras minDist..maxDist metres away
// (spread around the compass), as <outPrefix>-<n>.jpg, printing camera distance and bearing.
import fs from 'node:fs';
const [prefix, lng, lat, minD = '18', maxD = '45', fov = '70', pitch = '12', count = '3'] = process.argv.slice(2);
const mx = 111320 * Math.cos(+lat * Math.PI / 180), my = 111320;
const j = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&srid=4326&radius=${maxD}&page_size=60&newest_in_range=true`)).json();
const cands = (j._embedded?.panoramas ?? []).map(p => {
  const dx = (+lng - p.geometry.coordinates[0]) * mx, dy = (+lat - p.geometry.coordinates[1]) * my;
  return {id: p.pano_id, d: Math.hypot(dx, dy), bearing: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, year: p.mission_year};
}).filter(c => c.d >= +minD && c.d <= +maxD).sort((a, b) => a.d - b.d);
const picked = [];
for (const c of cands) {
  if (picked.every(p => Math.abs(((p.bearing - c.bearing + 540) % 360) - 180) > 35)) picked.push(c);
  if (picked.length >= +count) break;
}
let n = 0;
for (const c of picked) {
  const r = await fetch(`https://api.data.amsterdam.nl/panorama/thumbnail/${c.id}/?width=1200&fov=${fov}&heading=${c.bearing.toFixed(0)}&pitch=${pitch}`);
  fs.writeFileSync(`${prefix}-${n}.jpg`, Buffer.from(await r.arrayBuffer()));
  console.log(n++, c.id, 'dist', c.d.toFixed(0), 'looking', c.bearing.toFixed(0), c.year);
}
if (!picked.length) console.log('none', cands.length);

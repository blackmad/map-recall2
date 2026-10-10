// node around.mjs lat lng radius minD fov outPrefix [maxShots=4] [width=1600]
// Shoots newest-date panoramas at distinct bearings around a target, aimed at the target.
import fs from 'node:fs';
const [lat, lng, radius, minD, fov, prefix, maxShots = '4', width = '1600'] = process.argv.slice(2);
const mlat = 111320, mlng = 111320 * Math.cos(+lat * Math.PI / 180);
const out = [];
for (let page = 1; page <= 6; page++) {
  const r = await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&srid=4326&radius=${radius}&page_size=50&page=${page}`);
  if (!r.ok) break;
  const j = await r.json();
  const items = j._embedded?.panoramas ?? [];
  if (!items.length) break;
  for (const p of items) {
    const [plng, plat] = p.geometry.coordinates;
    const dx = (plng - +lng) * mlng, dy = (plat - +lat) * mlat;
    out.push({id: p.pano_id, ts: p.timestamp?.slice(0, 10), brg: Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360), dist: Math.round(Math.hypot(dx, dy))});
  }
  if (!j._links?.next?.href) break;
}
const BR = process.env.BRG ? +process.env.BRG : null, BT = +(process.env.BTOL ?? 35);
const good = out.filter(o => o.dist >= +minD && (BR === null || Math.min(Math.abs(o.brg - BR), 360 - Math.abs(o.brg - BR)) <= BT)).sort((a, b) => b.ts.localeCompare(a.ts));
const chosen = [];
for (const o of good) {
  if (chosen.every(c => Math.abs(((c.brg - o.brg + 540) % 360) - 180) > 35 || true) && chosen.every(c => Math.min(Math.abs(c.brg - o.brg), 360 - Math.abs(c.brg - o.brg)) > 40)) chosen.push(o);
  if (chosen.length >= +maxShots) break;
}
let i = 0;
for (const o of chosen) {
  const f = `${prefix}-${o.ts}-b${o.brg}-d${o.dist}.jpg`;
  const meta = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/${o.id}/`)).json();
  const [plng, plat] = meta.geometry.coordinates;
  const dx = (+lng - plng) * mlng, dy = (+lat - plat) * mlat;
  const heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${o.id}/?width=${width}&fov=${fov}&heading=${heading.toFixed(0)}&pitch=${process.env.PITCH ?? 0}${process.env.ASPECT ? "&aspect=" + process.env.ASPECT : ""}`;
  const r = await fetch(url);
  if (!r.ok) { console.log('fail', o.id, r.status); continue; }
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  console.log(f, o.id, o.ts);
}

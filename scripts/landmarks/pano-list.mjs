// node panolist.mjs lat lng radius : list panoramas (newest per ~8 m cell) with bearing FROM target and distance
const [lat, lng, radius] = process.argv.slice(2);
const mlat = 111320, mlng = 111320 * Math.cos(+lat * Math.PI / 180);
const out = [];
for (let page = 1; page <= 10; page++) {
  const r = await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&srid=4326&radius=${radius}&page_size=100&page=${page}&newest_in_range=true`);
  if (!r.ok) { console.log('http', r.status); break; }
  const j = await r.json();
  const items = j._embedded?.panoramas ?? [];
  for (const p of items) {
    const [plng, plat] = p.geometry.coordinates;
    const dx = (plng - +lng) * mlng, dy = (plat - +lat) * mlat;
    out.push({id: p.pano_id, ts: p.timestamp?.slice(0, 10), brg: Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360), dist: Math.round(Math.hypot(dx, dy)), x: +dx.toFixed(1), z: +(-dy).toFixed(1)});
  }
  if (!j._links?.next?.href || !items.length) break;
}
out.sort((a, b) => a.brg - b.brg);
for (const o of out) console.log(o.brg, o.dist, o.ts, o.id, o.x, o.z);

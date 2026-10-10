// node panolist.mjs lat lng radius [targetLat targetLng]
// Lists every municipal panorama (all capture dates, not only the newest) within `radius` m of a point, with the
// compass bearing/distance from the target to each capture point, so leaf-off (winter) frames can be picked by hand.
const [lat, lng, radius = '40', tlat = lat, tlng = lng] = process.argv.slice(2);
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
    const dx = (plng - +tlng) * mlng, dy = (plat - +tlat) * mlat;
    out.push({id: p.pano_id, ts: p.timestamp?.slice(0, 10), fromTargetBearing: Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360), dist: Math.round(Math.hypot(dx, dy))});
  }
  if (!j._links?.next?.href) break;
}
out.sort((a, b) => (a.ts ?? '').localeCompare(b.ts ?? ''));
for (const o of out) console.log(`${o.ts} brg ${String(o.fromTargetBearing).padStart(3)} d ${String(o.dist).padStart(3)} ${o.id}`);

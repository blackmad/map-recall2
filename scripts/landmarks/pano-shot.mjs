// node panoshot.mjs <outDir> <anchorLat> <anchorLng> <fov> <pitch> <panoId[:dHeading]> ...
// Shoots each panorama aimed at the anchor (plus optional heading offset); writes <id>.jpg and <id>.json (meta + camera in
// native east/south metres from the anchor, heading, fov, pitch) for camera-matched renders.
import fs from 'node:fs';
const [outDir, lat, lng, fov, pitch, ...ids] = process.argv.slice(2);
const mlat = 111320, mlng = 111320 * Math.cos(+lat * Math.PI / 180);
fs.mkdirSync(outDir, {recursive: true});
for (const spec of ids) {
  const [id, dh = '0'] = spec.split(':');
  const metaRaw = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/${id}/`)).text();
  const meta = JSON.parse(metaRaw);
  const [plng, plat, palt] = meta.geometry.coordinates;
  const x = (plng - +lng) * mlng, z = -(plat - +lat) * mlat;
  const heading = ((Math.atan2(-x, z) * 180 / Math.PI + 360 + +dh) % 360);
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${id}/?width=1600&fov=${fov}&heading=${heading.toFixed(1)}&pitch=${pitch}&aspect=1.5`;
  const r = await fetch(url);
  if (!r.ok) { console.log('fail', id, r.status); continue; }
  const name = `${id}${dh !== '0' ? '_h' + dh : ''}`;
  fs.writeFileSync(`${outDir}/${name}.jpg`, Buffer.from(await r.arrayBuffer()));
  fs.writeFileSync(`${outDir}/${name}.json`, JSON.stringify({panorama: id, timestamp: meta.timestamp, url, metaUrl: `https://api.data.amsterdam.nl/panorama/panoramas/${id}/`, licence: 'CC BY 4.0, Gemeente Amsterdam', camera: {x: +x.toFixed(2), z: +z.toFixed(2), alt: palt, heading: +heading.toFixed(1), fov: +fov, pitch: +pitch}, meta}, null, 1));
  console.log(`${outDir}/${name}.jpg`, x.toFixed(1), z.toFixed(1), 'h', heading.toFixed(0));
}

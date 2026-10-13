#!/usr/bin/env node
// Aimed perspective view from a Gemeente Amsterdam panorama (CC BY 4.0) through the public thumbnail endpoint.
//   node scripts/landmarks/pano-view.mjs --pano=<panoId> --heading=166 --pitch=35 --fov=60 --out=artifacts/landmark-refs/<id>/pediment.jpg [--width=1400]
//   node scripts/landmarks/pano-view.mjs --near=<lat>,<lng> [--radius=60] [--year=2023]    list panoramas near a point (id, date, distance, heading to the point)
// Attribution for every use: "Gemeente Amsterdam panoramas, CC BY 4.0" (https://api.data.amsterdam.nl/panorama/).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d = '') => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const UA = 'MapRecall-LandmarkRefs/1.0 (open-data reference views; CC BY 4.0 Gemeente Amsterdam panoramas)';
if (opt('near')) {
  const [lat, lng] = opt('near').split(',').map(Number), radius = opt('radius', '60');
  const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=${radius}&page_size=100`;
  const d = await (await fetch(url, {headers: {'User-Agent': UA}})).json();
  const rows = (d._embedded?.panoramas ?? []).map(p => {
    const [x, y] = p.geometry.coordinates;
    const dx = (lng - x) * 111320 * Math.cos(lat * Math.PI / 180), dy = (lat - y) * 110540;
    return {id: p.pano_id, date: (p.timestamp ?? '').slice(0, 10), dist: Math.round(Math.hypot(dx, dy)), heading: Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360)};
  }).filter(r => !opt('year') || r.date.startsWith(opt('year'))).sort((a, b) => a.dist - b.dist);
  for (const r of rows.slice(0, 40)) console.log(`${r.id}  ${r.date}  ${r.dist} m  heading-to-point ${r.heading}`);
  process.exit(0);
}
// --shots=panoId:heading:name,panoId:heading:name writes <dir>/<name>.jpg for each (with --dir=<dir>)
const shots = opt('shots') ? opt('shots').split(',').map(x => x.split(':')) : [[opt('pano'), opt('heading', '0'), null]];
for (const [pano, heading, name] of shots) {
const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pano}/?width=${opt('width', '1400')}&aspect=${opt('aspect', '1.4')}&fov=${opt('fov', '60')}&heading=${heading}&pitch=${opt('pitch', '0')}`;
const r = await fetch(url, {headers: {'User-Agent': UA}});
if (!r.ok) { console.error('failed', r.status, url); continue; }
const dest = name ? path.join(opt('dir', '.'), `${name}.jpg`) : opt('out');
fs.mkdirSync(path.dirname(dest), {recursive: true});
fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
console.log('wrote', dest, url);
}

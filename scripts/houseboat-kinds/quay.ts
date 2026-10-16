// One orthophoto of a quay with every boat outline coloured by the kind the
// classifier draws (red barge, yellow hullbox, cyan ark) and numbered.
//   npx tsx scripts/houseboat-kinds/quay.ts <name> <lat> <lng> [radiusM=45]
import fs from 'node:fs';
import proj4 from 'proj4';
import sharp from 'sharp';
import { houseboatFrame, houseboatKind, type Houseboat } from '../../src/canalRecall/houseboats.ts';
import { classifyHouseboatHullBefore } from './before.ts';

const RD = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
const [name, lat, lng, radius = '45'] = process.argv.slice(2);
const R = +radius, PX = 0.08, OUT = 'artifacts/houseboat-kinds/quays';
fs.mkdirSync(OUT, { recursive: true });
const [cx, cy] = proj4('EPSG:4326', RD, [+lng, +lat]) as [number, number];
const bbox = [cx - R, cy - R, cx + R, cy + R], size = Math.round(2 * R / PX);
const cache = `${OUT}/${name}.jpg`;
if (!fs.existsSync(cache)) {
  const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
  url.search = new URLSearchParams({ service: 'WMS', version: '1.3.0', request: 'GetMap', layers: 'Actueel_orthoHR', styles: '', crs: 'EPSG:28992', bbox: bbox.join(','), width: String(size), height: String(size), format: 'image/jpeg' }).toString();
  fs.writeFileSync(cache, Buffer.from(await (await fetch(url)).arrayBuffer()));
}
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const colour = { barge: '#ff3b30', hullbox: '#ffd60a', ark: '#00e5ff' } as const;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`;
const listed: string[] = [];
for (const boat of boats) {
  const rd = boat.ring.map(([x, y]) => proj4('EPSG:4326', RD, [x, y]) as [number, number]);
  if (!rd.some(([x, y]) => x > bbox[0] && x < bbox[2] && y > bbox[1] && y < bbox[3])) continue;
  const f = houseboatFrame(boat);
  if (!f) continue;
  const kind = (process.env.BEFORE ? classifyHouseboatHullBefore : houseboatKind)(boat.id, f.local, f.length, f.width);
  const px = rd.map(([x, y]) => [(x - bbox[0]) / PX, (bbox[3] - y) / PX]);
  const mx = px.reduce((a, p) => a + p[0], 0) / px.length, my = px.reduce((a, p) => a + p[1], 0) / px.length;
  listed.push(boat.id);
  svg += `<polygon points="${px.map(p => p.join(',')).join(' ')}" fill="none" stroke="${colour[kind]}" stroke-width="2.5" stroke-opacity="0.85"/>`;
  svg += `<text x="${mx}" y="${my}" font-family="Helvetica" font-size="26" font-weight="bold" fill="${colour[kind]}" stroke="#000" stroke-width="1">${listed.length}</text>`;
}
svg += '</svg>';
const tag = process.env.BEFORE ? 'before' : 'after';
await sharp(cache).composite([{ input: Buffer.from(svg) }]).png().toFile(`${OUT}/${name}-${tag}.png`);
console.log(listed.map((id, i) => `${i + 1}:${id}`).join(' '));

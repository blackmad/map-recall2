// node --import tsx scripts/landmarks/big-neighbours.ts <id> <wallIdx> <t> <out> : 3DBAG pands (height, floors) within 3 m of a point at tangent t / out offset from the wall (out<0 = behind the wall), to prove a party wall.
import fs from 'node:fs';
import {rawWall} from './big-kit';
const [id, idx, ts, outs] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const w = rawWall(src, +idx), t = +ts, o = +outs;
const x = w.f.origin[0] + w.f.tangent[0] * t + w.f.n[0] * o, z = w.f.origin[1] + w.f.tangent[1] * t + w.f.n[1] * o;
const [lon0, lat0] = src.anchor;
const lon = lon0 + x / (111320 * Math.cos(lat0 * Math.PI / 180)), lat = lat0 - z / 111320;
const d = 0.00003;
const r = await (await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&f=json`)).json();
for (const f of r.features) console.log(f.properties.identificatie, f.properties.bouwjaar, f.properties.status);
console.log('point', lon, lat);

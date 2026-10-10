// node --import tsx scripts/landmarks/big-mid.ts <id> <wallIdx> <t0> <t1> : lat lng of the wall segment midpoint (for big-pano-around)
import fs from 'node:fs';
import {rawWall} from './big-kit';
const [id, idx, a, b] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const w = rawWall(src, +idx), t = (+a + +b) / 2;
const x = w.f.origin[0] + w.f.tangent[0] * t, z = w.f.origin[1] + w.f.tangent[1] * t;
const [lon0, lat0] = src.anchor;
console.log((lat0 - z / 111320).toFixed(6), (lon0 + x / (111320 * Math.cos(lat0 * Math.PI / 180))).toFixed(6), 'bearing', w.bearing.toFixed(1));

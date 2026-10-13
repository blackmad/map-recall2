// node --import tsx scripts/landmarks/big-camwall.ts <id> <wallIdx> <tMid> <dist> [yaw=0] : prints "x z heading" for big-camshot.mjs, a camera <dist> m in front of the wall at tangent tMid looking at it.
import fs from 'node:fs';
import {rawWall} from './big-kit';
const [id, idx, tm, dist, yaw = '0'] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const w = rawWall(src, +idx), t = +tm;
const x = w.f.origin[0] + w.f.tangent[0] * t + w.f.n[0] * +dist, z = w.f.origin[1] + w.f.tangent[1] * t + w.f.n[1] * +dist;
console.log(x.toFixed(2), z.toFixed(2), ((w.bearing + 180 + +yaw) % 360).toFixed(1));

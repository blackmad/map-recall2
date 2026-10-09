// Usage: node --import tsx scripts/landmarks/worship-wall-detail.ts <id> <wallIndex,..>
// Prints each shell wall's endpoints (x,z), normal and height outline, for pinning features to the right plane.
import fs from 'node:fs';
import {wallsOf} from './worship-walls';
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${process.argv[2]}-footprints.json`, 'utf8'));
const want = new Set(process.argv[3].split(',').map(Number));
for (const w of wallsOf(src)) {
  if (!want.has(w.index)) continue;
  const p = (t: number) => [w.origin[0] + w.tangent[0] * t, w.origin[1] + w.tangent[1] * t].map(v => +v.toFixed(2));
  console.log(`#${w.index} n=(${w.n.map(v => v.toFixed(3))}) t0=(${p(0)}) t1=(${p(w.length)}) len=${w.length.toFixed(2)} poly=${JSON.stringify(w.poly.map(q => q.map(v => +v.toFixed(1))))}`);
}

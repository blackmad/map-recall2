import fs from 'node:fs';
import {wallsOf} from './worship-walls';
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${process.argv[2]}-footprints.json`, 'utf8'));
const dir = (n: number[]) => { const a = (Math.atan2(n[0], -n[1]) * 180 / Math.PI + 360) % 360; return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8] + Math.round(a); };
for (const w of wallsOf(src)) {
  const mid = w.length / 2;
  const x = w.origin[0] + w.tangent[0] * mid, z = w.origin[1] + w.tangent[1] * mid;
  if (w.length > 1.5) console.log(`#${w.index} faces ${dir(w.n)} len ${w.length.toFixed(1)} mid(${x.toFixed(1)},${z.toFixed(1)}) base ${w.base.toFixed(1)} top ${wallTopMax(w).toFixed(1)}`);
}
function wallTopMax(w: {poly: [number, number][]}) { return Math.max(...w.poly.map(p => p[1])); }

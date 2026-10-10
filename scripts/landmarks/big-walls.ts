// node --import tsx scripts/landmarks/big-walls.ts <id> [minArea=20] : list the 3DBAG wall faces (index, facing bearing, length, base, top range)
import fs from 'node:fs';
import {wallsOf} from './worship-walls';
const [id, minArea = '20'] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
for (const w of wallsOf(src)) {
  const tops = w.poly.map(p => p[1]);
  const area = (() => { let a = 0; for (let i = 0; i < w.poly.length; i++) { const p = w.poly[i], q = w.poly[(i + 1) % w.poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; })();
  if (area < +minArea) continue;
  const brg = (Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360;
  const ox = w.origin[0], oz = w.origin[1], ex = ox + w.tangent[0] * w.length, ez = oz + w.tangent[1] * w.length;
  console.log(`wall ${w.index} brg ${brg.toFixed(1)} len ${w.length.toFixed(2)} y ${Math.min(...tops).toFixed(1)}..${Math.max(...tops).toFixed(1)} area ${area.toFixed(0)} from (${ox.toFixed(1)},${oz.toFixed(1)}) to (${ex.toFixed(1)},${ez.toFixed(1)})`);
}

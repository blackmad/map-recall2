// node --import tsx scripts/landmarks/big-plane.ts <id> <refWallIndex> <idx,idx,...> : plane offset (m, outward +) and tangent range of walls expressed in the reference wall's frame.
import fs from 'node:fs';
import {rawWall} from './big-kit';
const [id, ref, list] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const r = rawWall(src, +ref);
for (const i of list.split(',').map(Number)) {
  const w = rawWall(src, i);
  const a = w.f.origin, b: [number, number] = [a[0] + w.f.tangent[0] * w.len, a[1] + w.f.tangent[1] * w.len];
  const loc = (p: [number, number]) => ({t: (p[0] - r.f.origin[0]) * r.f.tangent[0] + (p[1] - r.f.origin[1]) * r.f.tangent[1], out: (p[0] - r.f.origin[0]) * r.f.n[0] + (p[1] - r.f.origin[1]) * r.f.n[1]});
  const A = loc(a), B = loc(b);
  console.log(`wall ${i} brg ${w.bearing.toFixed(1)} t ${A.t.toFixed(2)}..${B.t.toFixed(2)} out ${A.out.toFixed(2)}..${B.out.toFixed(2)} y ${w.base.toFixed(1)}..${w.top.toFixed(1)}`);
}

// node --import tsx scripts/landmarks/list-boundary-edges.ts <id> minx,miny,minz,maxx,maxy,maxz [limit] : welded edges used by one triangle only, inside a box.
import {loadSoup} from '../audit-glb-quality';

const id = process.argv[2];
const [x0, y0, z0, x1, y1, z1] = process.argv[3].split(',').map(Number);
const limit = Number(process.argv[4] ?? 60);
const s = await loadSoup(`public/canal-drive/models/${id}.glb`);
const P = s.positions, I = s.indices;
const key = (i: number) => `${Math.round(P[i * 3] * 200)},${Math.round(P[i * 3 + 1] * 200)},${Math.round(P[i * 3 + 2] * 200)}`;
const edges = new Map<string, {a: number; b: number; n: number}>();
for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) {
  const a = I[t * 3 + k], b = I[t * 3 + (k + 1) % 3], ka = key(a), kb = key(b);
  if (ka === kb) continue;
  const e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  const cur = edges.get(e);
  if (cur) cur.n++; else edges.set(e, {a, b, n: 1});
}
const f = (i: number) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]].map(v => v.toFixed(2)).join(',');
let shown = 0, total = 0;
for (const e of edges.values()) {
  if (e.n !== 1) continue;
  const mx = (P[e.a * 3] + P[e.b * 3]) / 2, my = (P[e.a * 3 + 1] + P[e.b * 3 + 1]) / 2, mz = (P[e.a * 3 + 2] + P[e.b * 3 + 2]) / 2;
  if (mx < x0 || mx > x1 || my < y0 || my > y1 || mz < z0 || mz > z1) continue;
  total++;
  if (shown++ < limit) console.log(f(e.a), '->', f(e.b));
}
console.log('boundary edges in box:', total);

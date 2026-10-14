/** Lists triangles within R m of a point of the exported GLB: `node --import tsx scripts/landmarks/roeterseiland-probe.ts x y z [R]`. */
import {loadMaterialSoup} from './material-soup';
const [x, y, z, R = '0.25'] = process.argv.slice(2);
const s = await loadMaterialSoup('public/canal-drive/models/roeterseiland-rec-a.glb') as any;
const P = [+x, +y, +z];
for (let t = 0; t < s.indices.length / 3; t++) {
  const v = [0, 1, 2].map(k => [0, 1, 2].map(a => s.positions[s.indices[t * 3 + k] * 3 + a]));
  const c = [0, 1, 2].map(a => (v[0][a] + v[1][a] + v[2][a]) / 3);
  if (Math.hypot(c[0] - P[0], c[1] - P[1], c[2] - P[2]) > +R) continue;
  const e1 = v[1].map((q: number, a: number) => q - v[0][a]), e2 = v[2].map((q: number, a: number) => q - v[0][a]);
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n) || 1;
  console.log(s.materials[s.triMaterial[t]].name, 'n', n.map(q => (q / l).toFixed(2)).join(','), 'c', c.map(q => q.toFixed(3)).join(','), 'area', (l / 2).toFixed(2), 'd', ((c[0] * n[0] + c[1] * n[1] + c[2] * n[2]) / l).toFixed(3));
}

/** Prints the worst opening issues of the exported GLB grouped by kind and material set: `node --import tsx scripts/landmarks/roeterseiland-issues.ts [--detail] [file]`. */
import {loadMaterialSoup} from './material-soup';
import {auditOpenings, GEOMETRY_THRESHOLDS} from '../../src/canalRecall/landmarks/geometryAudit';
const file = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'public/canal-drive/models/roeterseiland-rec-a.glb';
const soup = await loadMaterialSoup(file);
const r = auditOpenings(soup, {...GEOMETRY_THRESHOLDS, floatTol: 0.1, joinTol: 0.1});
console.log('assemblies', r.assemblies, 'issues', r.issues.length);
const groups = new Map<string, typeof r.issues>();
for (const i of r.issues) { const k = `${i.kind}/${i.severity}/${i.materials.join('+')}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
for (const [k, l] of groups) {
  console.log(k, l.length);
  for (const i of l.slice(0, 12)) console.log('   ', i.min.map(v => v.toFixed(1)).join(','), '->', i.max.map(v => v.toFixed(1)).join(','), 'gap', i.gap.toFixed(3), 'outside', i.outside, 'tris', i.triangles.length);
}
if (process.argv.includes('--detail')) {
  const s = soup as any;
  for (const i of r.issues.filter(x => x.severity === 'fail' && x.triangles.length > 6)) {
    const byMat = new Map<string, {n: number; area: number; vert: number}>();
    for (const t of i.triangles) {
      const v = [0, 1, 2].map(k => [0, 1, 2].map(a => s.positions[s.indices[t * 3 + k] * 3 + a]));
      const e1 = v[1].map((q: number, a: number) => q - v[0][a]), e2 = v[2].map((q: number, a: number) => q - v[0][a]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n), name = s.materials[s.triMaterial[t]].name;
      const m = byMat.get(name) ?? byMat.set(name, {n: 0, area: 0, vert: 0}).get(name)!;
      m.n++; m.area += l / 2; if (Math.abs(n[1] / l) < 0.7) m.vert += l / 2;
    }
    console.log(i.kind, i.min.map(v => v.toFixed(1)).join(','), [...byMat].map(([k, m]) => `${k}: ${m.n} tris ${m.area.toFixed(1)} m2 (vertical ${m.vert.toFixed(1)})`).join(' | '));
  }
}

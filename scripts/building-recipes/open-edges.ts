import fs from 'node:fs';
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {validateIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';
import * as T from 'three';
const id = process.argv[2], dir = `scripts/building-recipes/houses/${id}`;
const b = compileBuilding(validateIntent(JSON.parse(fs.readFileSync(dir + '/intent.json', 'utf8'))), JSON.parse(fs.readFileSync(dir + '/facts.json', 'utf8')));
b.group.updateMatrixWorld(true);
const edges = new Map<string, {n: number; names: Set<string>; a: number[]; b: number[]}>();
const key = (p: T.Vector3) => [p.x, p.y, p.z].map(v => Math.round(v * 100)).join(',');
b.group.traverse(o => {
  if (!(o instanceof T.Mesh)) return;
  const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const v = [0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, i + k).applyMatrix4(o.matrixWorld));
    for (let k = 0; k < 3; k++) {
      const x = v[k], y = v[(k + 1) % 3], ka = key(x), kb = key(y); if (ka === kb) continue;
      const kk = ka < kb ? ka + '|' + kb : kb + '|' + ka, e = edges.get(kk) ?? {n: 0, names: new Set(), a: x.toArray(), b: y.toArray()}; e.n++; e.names.add(o.name); edges.set(kk, e);
    }
  }
});
const byName = new Map<string, number>();
for (const e of edges.values()) if (e.n === 1 && Math.max(e.a[1], e.b[1]) > .05) for (const n of e.names) byName.set(n.split('/').slice(0, 2).join('/'), (byName.get(n.split('/').slice(0, 2).join('/')) ?? 0) + Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1], e.a[2] - e.b[2]));
console.log([...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} ${v.toFixed(1)}`).join('\n'));

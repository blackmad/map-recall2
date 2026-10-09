/** Diagnostic: list genuine open edges (T-junction seams excluded) of a compiled house by mesh name. */
import * as T from 'three';
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {pointTriangleDistance} from '../../src/canalRecall/buildingRecipe/gates.ts';
import {loadIntent} from './compile.ts';
import fs from 'node:fs';

const id = process.argv[2];
const {intent} = await loadIntent(id);
const b = compileBuilding(intent, JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8')));
b.group.updateMatrixWorld(true);
const tris: {a: number[]; b: number[]; c: number[]; name: string}[] = [];
b.group.traverse(o => {
  if (!(o instanceof T.Mesh)) return;
  const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) { const v = [0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, i + k).applyMatrix4(o.matrixWorld).toArray()); tris.push({a: v[0], b: v[1], c: v[2], name: o.name}); }
});
const key = (p: number[]) => p.map(v => Math.round(v * 100)).join(',');
const edges = new Map<string, {n: number; a: number[]; b: number[]; name: string}>();
for (const t of tris) for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
  const ka = key(p), kb = key(q); if (ka === kb) continue;
  const k = ka < kb ? ka + '|' + kb : kb + '|' + ka, e = edges.get(k) ?? {n: 0, a: p, b: q, name: t.name}; e.n++; edges.set(k, e);
}
const open = [...edges.values()].filter(e => e.n === 1 && Math.max(e.a[1], e.b[1]) > .05).filter(e => ![.25, .5, .75].every(t => {
  const q = e.a.map((v, i) => v + (e.b[i] - v) * t);
  return tris.some(tr => tr.name !== e.name && pointTriangleDistance(q, tr) < .01) || tris.some(tr => { const own = [tr.a, tr.b, tr.c].filter(v => key(v) === key(e.a) || key(v) === key(e.b)).length === 2; return !own && pointTriangleDistance(q, tr) < .01; });
}));
for (const e of open.sort((x, y) => Math.hypot(...y.a.map((v, i) => v - y.b[i])) - Math.hypot(...x.a.map((v, i) => v - x.b[i]))).slice(0, 12))
  console.log(e.name.padEnd(36), e.a.map(v => v.toFixed(2)).join(','), '→', e.b.map(v => v.toFixed(2)).join(','), Math.hypot(...e.a.map((v, i) => v - e.b[i])).toFixed(2));

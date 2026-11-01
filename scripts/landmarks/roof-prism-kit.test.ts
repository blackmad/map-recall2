import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink} from './nearbar-kit';
import {gridFacade, roofPrism} from './roof-prism-kit';
import type {Wall} from './worship-walls';

/** Minimal BuildingTools stand-in that keeps every added geometry with its colour. */
function collector() {
  const parts: {g: T.BufferGeometry; c: string}[] = [];
  const b = {add: (g: T.BufferGeometry, c: string, x = 0, y = 0, z = 0) => { g.translate(x, y, z); parts.push({g, c}); }} as unknown as BuildingTools;
  return {b, parts};
}
/** Boundary edges (used by one triangle) after welding positions to the millimetre. */
function boundaryEdges(gs: T.BufferGeometry[]) {
  const key = (v: T.Vector3) => `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)},${Math.round(v.z * 1000)}`;
  const count = new Map<string, number>();
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0, p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      const k = [0, 1, 2].map(j => key(new T.Vector3().fromBufferAttribute(p, i + j)));
      for (let j = 0; j < 3; j++) { const e = [k[j], k[(j + 1) % 3]].sort().join('|'); count.set(e, (count.get(e) ?? 0) + 1); }
    }
  }
  return [...count.values()].filter(n => n === 1).length;
}

test('roofPrism closes a sloped roof polygon with a courtyard hole', () => {
  const {b, parts} = collector();
  const outer = [[0, 10, 0], [10, 12, 0], [10, 12, 10], [0, 10, 10], [0, 10, 0]];
  const hole = [[4, 10.8, 4], [4, 10.8, 6], [6, 11.2, 6], [6, 11.2, 4]];
  roofPrism(b, [outer, hole], 'ochre', 'slate');
  assert.equal(parts.length, 2);
  assert.equal(boundaryEdges(parts.map(p => p.g)), 0, 'walls, floor and roof form one closed shell');
  const roof = parts.find(p => p.c === 'slate')!.g, n = roof.getAttribute('normal');
  for (let i = 0; i < n.count; i++) assert.ok(n.getY(i) > 0.9, 'the roof faces up');
});

test('gridFacade piers cover under 30 % of each storey ribbon and stay under the wall top', () => {
  setSink(0);
  const {b, parts} = collector();
  const w: Wall = {n: [0, 1], origin: [0, 0], tangent: [1, 0], length: 20, base: 0, poly: [[0, 0], [20, 0], [20, 30], [0, 30]], index: 0};
  gridFacade(b, w, {y0: 4, pitch: 3.6, colPitch: 2, pierW: 0.5, pierD: 0.14, winBottom: 1, winH: 2, pier: 'dark', glass: 'glass', margin: 1});
  const glass = parts.filter(p => p.c === 'glass'), piers = parts.filter(p => p.c === 'dark');
  assert.ok(glass.length >= 6);
  const span = (g: T.BufferGeometry): [number, number] => { g.computeBoundingBox(); return [g.boundingBox!.min.x, g.boundingBox!.max.x]; };
  const [g0, g1] = span(glass[0].g);
  const covered = piers.reduce((a, p) => { const [p0, p1] = span(p.g); return a + Math.max(0, Math.min(p1, g1) - Math.max(p0, g0)); }, 0) / (g1 - g0);
  assert.ok(covered < 0.3, `piers cover ${covered.toFixed(2)} of the ribbon`);
  for (const p of parts) { p.g.computeBoundingBox(); assert.ok(p.g.boundingBox!.max.y <= 30 - 0.3 + 1e-6, 'nothing reaches the wall top'); }
});

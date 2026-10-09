import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildNassaukerk} from './landmarks/nassaukerk-builder';
import {buildKoningskerk} from './landmarks/koningskerk-builder';
import {buildSintOlofskapel} from './landmarks/sint-olofskapel-builder';

// Custom-massed worship lane: model must sit on the BAG ring bounds, reach the stated height, and have no floating parts.
// maxY is the intended top above local ground (3DBAG eave/ridge reading, plus any turret/spire seen in photographs).
const cases = [
  {id: 'sint-olofskapel', build: buildSintOlofskapel, minY: 24, maxY: 25.5},
  {id: 'nassaukerk', build: buildNassaukerk, minY: 27.2, maxY: 27.6}, // weathervane finial, as 3DBAG's 27.4 m
  {id: 'koningskerk', build: buildKoningskerk, minY: 20, maxY: 20.6}, // photo-estimated 20 m tower over the 11 m hall
];
for (const c of cases) {
  const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${c.id}-footprints.json`, 'utf8'));
  const parts: T.BufferGeometry[] = [];
  const add: BuildingTools['add'] = (g, _colour, x = 0, y = 0, z = 0, a = 0) => { g.rotateY(a); g.translate(x, y, z); parts.push(g); };
  const box: BuildingTools['box'] = (x, y, z, w, h, d, colour, a = 0) => { const g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); add(g, colour, x, y, z, a); };
  c.build(0, 0, {add, box} as unknown as BuildingTools);
  const bb = new T.Box3();
  for (const g of parts) { g.computeBoundingBox(); bb.union(g.boundingBox!); }
  const ring: number[][] = src.nativeRing;
  const rb = new T.Box3(new T.Vector3(Math.min(...ring.map(p => p[0])), 0, Math.min(...ring.map(p => p[1]))), new T.Vector3(Math.max(...ring.map(p => p[0])), 0, Math.max(...ring.map(p => p[1]))));
  assert.ok(bb.min.y >= -0.02, `${c.id}: below ground ${bb.min.y}`);
  assert.ok(bb.max.y >= c.minY && bb.max.y <= c.maxY, `${c.id}: height ${bb.max.y} outside ${c.minY}-${c.maxY}`);
  for (const k of ['x', 'z'] as const) assert.ok(bb.min[k] >= rb.min[k] - 1.2 && bb.max[k] <= rb.max[k] + 1.2, `${c.id}: ${k} outside BAG ring bounds`);
  const grown = rb.clone().expandByScalar(1.2); grown.min.y = -1; grown.max.y = 100;
  const floating = parts.filter(g => !grown.intersectsBox(g.boundingBox!)).length;
  assert.equal(floating, 0, `${c.id}: floating parts`);
  let down = 0;
  for (const g of parts) if (g.userData.role === 'roof') {
    const ng = g.index ? g.toNonIndexed() : g, pos = ng.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const a = new T.Vector3().fromBufferAttribute(pos, i), b = new T.Vector3().fromBufferAttribute(pos, i + 1), d = new T.Vector3().fromBufferAttribute(pos, i + 2);
      if (b.sub(a).cross(d.sub(a)).y < -1e-3) down++;
    }
  }
  assert.equal(down, 0, `${c.id}: downward roof faces`);
  console.log(JSON.stringify({id: c.id, parts: parts.length, bounds: [bb.min.toArray(), bb.max.toArray()].map(a => a.map(n => +n.toFixed(1)))}));
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {toLocal} from './landmarks/nightlife-geometry';
import {buildSeaPalace} from './landmarks/sea-palace-builder';

// Bounds/height against the surveyed outline (and 3DBAG LoD2.2 where the host is a BAG pand), no floating parts.
type Case = {id: string; build: (w: number, d: number, b: BuildingTools) => void; ring: number[][]; minTop: number; maxTop: number; slack: number; minY?: number};
const spec = (id: string) => JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8'));
const cases: Case[] = [];
{
  const s = spec('sea-palace');
  cases.push({id: 'sea-palace', build: buildSeaPalace, ring: toLocal(s.buildingFootprint.coordinates[0], s.surveyed.anchor), minTop: 12, maxTop: 14, slack: 1.0, minY: -1.0});
}
for (const c of cases) {
  const parts: {g: T.BufferGeometry; colour: string}[] = [];
  const add: BuildingTools['add'] = (g, colour, x = 0, y = 0, z = 0, a = 0) => { g.rotateY(a); g.translate(x, y, z); parts.push({g, colour}); };
  const box: BuildingTools['box'] = (x, y, z, w, h, d, colour, a = 0) => add(new T.BoxGeometry(w, h, d), colour, x, y + h / 2, z, a);
  c.build(0, 0, {add, box} as unknown as BuildingTools);
  const bb = new T.Box3();
  for (const p of parts) { p.g.computeBoundingBox(); bb.union(p.g.boundingBox!); }
  const xs = c.ring.map(p => p[0]), zs = c.ring.map(p => p[1]);
  const shell = new T.Box3(new T.Vector3(Math.min(...xs), -50, Math.min(...zs)), new T.Vector3(Math.max(...xs), 50, Math.max(...zs)));
  assert.ok(bb.min.y >= (c.minY ?? -0.02), `${c.id}: below ground ${bb.min.y}`);
  assert.ok(bb.max.y >= c.minTop && bb.max.y <= c.maxTop, `${c.id}: top ${bb.max.y} outside ${c.minTop}-${c.maxTop}`);
  for (const k of ['x', 'z'] as const) assert.ok(bb.min[k] >= shell.min[k] - c.slack && bb.max[k] <= shell.max[k] + c.slack, `${c.id}: ${k} extent outside outline`);
  const grown = shell.clone().expandByScalar(c.slack);
  let floating = 0, roofDown = 0;
  for (const p of parts) {
    p.g.computeBoundingBox();
    if (!grown.intersectsBox(p.g.boundingBox!)) floating++;
    if (p.g.userData.role === 'roof') {
      const g = p.g.index ? p.g.toNonIndexed() : p.g, pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i += 3) {
        const a = new T.Vector3().fromBufferAttribute(pos, i), b = new T.Vector3().fromBufferAttribute(pos, i + 1), d = new T.Vector3().fromBufferAttribute(pos, i + 2);
        if (b.sub(a).cross(d.sub(a)).y < -1e-3) roofDown++;
      }
    }
  }
  assert.equal(floating, 0, `${c.id}: floating parts`);
  assert.equal(roofDown, 0, `${c.id}: downward roof faces`);
  console.log(JSON.stringify({id: c.id, parts: parts.length, bounds: [bb.min.toArray(), bb.max.toArray()].map(a => a.map(n => +n.toFixed(2)))}));
}

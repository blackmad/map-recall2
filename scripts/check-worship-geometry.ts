import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildPetrusEnPaulusKerk} from './landmarks/petrus-en-paulus-kerk-builder';
import {buildMaartenLutherkerk} from './landmarks/maarten-lutherkerk-builder';

// Bounds/height against 3DBAG LoD2.2, upward roofs, no part floating off the shell.
const cases = [
  {id: 'petrus-en-paulus-kerk', build: buildPetrusEnPaulusKerk, extraHeight: 1.2},
  {id: 'maarten-lutherkerk', build: buildMaartenLutherkerk, extraHeight: 6.0}, // slim copper spire above the surveyed tower roof
];
for (const c of cases) {
  const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${c.id}-footprints.json`, 'utf8'));
  const parts: {g: T.BufferGeometry; colour: string}[] = [];
  const add: BuildingTools['add'] = (g, colour, x = 0, y = 0, z = 0, a = 0) => { g.rotateY(a); g.translate(x, y, z); parts.push({g, colour}); };
  c.build(0, 0, {add} as unknown as BuildingTools);
  const box = new T.Box3();
  for (const p of parts) { p.g.computeBoundingBox(); box.union(p.g.boundingBox!); }
  const surf: number[][] = src.surfaces.flatMap((s: any) => s.rings.flat());
  const sx = surf.map(v => v[0]), sy = surf.map(v => v[1]), sz = surf.map(v => v[2]);
  const sb = new T.Box3(new T.Vector3(Math.min(...sx), Math.min(...sy), Math.min(...sz)), new T.Vector3(Math.max(...sx), Math.max(...sy), Math.max(...sz)));
  assert.ok(box.min.y >= -0.02, `${c.id}: below ground ${box.min.y}`);
  assert.ok(box.max.y <= sb.max.y + c.extraHeight, `${c.id}: taller than 3DBAG ${box.max.y} vs ${sb.max.y}`);
  assert.ok(box.max.y >= sb.max.y - 0.2, `${c.id}: lower than 3DBAG`);
  for (const k of ['x', 'z'] as const) {
    assert.ok(box.min[k] >= sb.min[k] - 0.7 && box.max[k] <= sb.max[k] + 0.7, `${c.id}: ${k} extent outside shell`);
  }
  const grown = sb.clone().expandByScalar(0.8);
  let floating = 0, roofDown = 0, roofFaces = 0;
  for (const p of parts) {
    p.g.computeBoundingBox();
    if (!grown.intersectsBox(p.g.boundingBox!)) floating++;
    if (p.g.userData.role === 'roof') {
      const g = p.g.index ? p.g.toNonIndexed() : p.g, pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i += 3) {
        const a = new T.Vector3().fromBufferAttribute(pos, i), b = new T.Vector3().fromBufferAttribute(pos, i + 1), d = new T.Vector3().fromBufferAttribute(pos, i + 2);
        roofFaces++;
        { const ny = b.sub(a).cross(d.sub(a)).y; if (ny < -1e-3) { roofDown++; console.log("down", ny, a.toArray(), pos.count); } }
      }
    }
  }
  assert.equal(floating, 0, `${c.id}: floating parts`);
  assert.equal(roofDown, 0, `${c.id}: downward roof faces`);
  console.log(JSON.stringify({id: c.id, parts: parts.length, roofFaces, bounds: [box.min.toArray(), box.max.toArray()].map(a => a.map(n => +n.toFixed(2))), shellMaxY: +sb.max.y.toFixed(2)}));
}

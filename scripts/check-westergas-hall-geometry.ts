import assert from 'node:assert/strict';
import * as T from 'three';
import data from './landmarks/westergas-hall-footprints.json';
import specs from './landmarks/westergas-hall-specs.json';
import { buildWestergasHall } from './landmarks/westergas-hall-builders.ts';
const everyId = new Set<string>();
for (const spec of specs) {
  for (const id of spec.suppressOsmIds) { assert.ok(!everyId.has(id), `${id} belongs to exactly one ensemble`); everyId.add(id); }
  assert.equal(spec.spatialSuppression, false);
  assert.ok(spec.footprint.lengthMetres < 80 && spec.footprint.widthMetres < 50, 'scope remains inside its actual hall, no same-suffix BAG record elsewhere');
  assert.ok(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012236902'), 'actual central connector stays separate');
  const triangles: { c: string; p: T.Vector3[] }[] = [];
  const add = (g: T.BufferGeometry, c: string, x = 0, y = 0, z = 0, a = 0) => {
    g.rotateY(a); g.translate(x, y, z); const flat = g.index ? g.toNonIndexed() : g, p = flat.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) triangles.push({ c, p: [0, 1, 2].map(j => new T.Vector3(p.getX(i + j), p.getY(i + j), p.getZ(i + j))) });
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, a = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a);
  buildWestergasHall(spec.id, 1, 1, { add, box } as any);
  assert.ok(triangles.length < 38000);
  const roofs = triangles.filter(t => t.c === 'slate');
  for (const t of roofs) {
    const normal = t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0]));
    assert.ok(normal.y > 0, 'pitched roof panels face upward');
  }
  const ray = new T.Ray(new T.Vector3(), new T.Vector3(0, -1, 0)), hit = new T.Vector3();
  const heightAt = (x: number, z: number) => {
    ray.origin.set(x, 40, z);
    return Math.max(...roofs.map(t => ray.intersectTriangle(t.p[0], t.p[1], t.p[2], false, hit) ? hit.y : -Infinity));
  };
  if (spec.id === 'machinegebouw') {
    assert.ok(Math.abs(heightAt(0, -3.15) - 12.825) < .01, 'main hall ridge is surveyed12.8m');
    assert.ok(Math.abs(heightAt(0, 5.55) - 10.175) < .01, 'side hall ridge stays lower10.15m');
    assert.ok(heightAt(0, 2.55) < 7.4, 'real valley separates parallel roofs');
  } else {
    assert.ok(Math.abs(heightAt(0, -.25) - 15.355) < .01, 'main hall keeps surveyed15.33m ridge');
    assert.ok(heightAt(-23.5, 0) < 9.15, 'west entrance annex is independently lower');
    assert.equal(heightAt(-30, 0), -Infinity, 'no roof is extended across neighboring WestWeelde');
  }
  const parent = data.buildings.find(b => b.id === spec.id)!;
  assert.equal(parent.parents.length, 1, 'current scoped hall has exactly one physical parent');
  assert.equal(spec.suppressOsmIds.length, 2, 'only actual OSM and BAG aliases are replaced');
  assert.ok(Math.max(...triangles.flatMap(t => t.p.map(p => p.y))) < 15.8);
  console.log(`${spec.id}: ${triangles.length} triangles; surveyed independent roof levels; exact single-parent scope.`);
}
assert.equal(everyId.size, 4);

/** Actual irregular canal-house outlines must not grow decorated facades inside their roof deck. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorateRoof, roofPlanForFeature, roofTriangles, type RoofTri } from '../src/canalRecall/roofMesh.ts';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/irregular-canal-roofs.json', import.meta.url), 'utf8')).features;
const dims = { bayM: 5, storeyM: 3.1, cellM: 1.2 };
let corrected = 0;
for (const feature of fixtures) {
  const before = JSON.stringify(feature), decorated = decorateRoof(feature);
  const roof = roofPlanForFeature(decorated)!;
  const piece = roof.pieces![0], rect = piece.rect, plan = piece.plan;
  const eaves = Number(decorated.properties.roofEavesHeightM), height = feature.properties.height;
  const oldPlan = { ...plan, gableEnds: undefined };
  const oldTriangles = roofTriangles(rect, oldPlan, eaves, dims), triangles = roofTriangles(rect, plan, eaves, dims);
  assert.equal(decorated.geometry, feature.geometry);
  assert.equal(decorated.properties.height, height, 'source roof envelope is not flattened');
  assert.equal(eaves, height - plan.riseM, 'same roof rise and wall eaves');
  assert.equal(JSON.stringify(feature), before, 'source cache remains immutable');
  if (!plan.gableEnds) {
    assert.deepEqual(triangles, oldTriangles, 'simple supported stepped frontage is unchanged');
    continue;
  }
  corrected++;
  assert.equal(plan.gableEnds.filter(Boolean).length, 1, 'real house retains its one supported exterior gable');
  for (const end of [-1, 1]) {
    const plane = end * rect.len / 2;
    // Include the slab's front, rear and coping, but exclude slopes/chimneys away from this end.
    const endFaces = (tris: RoofTri[]) => tris.filter(t => t.p.every(p => {
      const u = (p[0] - rect.cx) * rect.ux + (p[1] - rect.cy) * rect.uy;
      return Math.abs(u - plane) <= 0.34;
    }));
    const was = endFaces(oldTriangles), now = endFaces(triangles);
    if (plan.gableEnds[end < 0 ? 0 : 1]) {
      assert.deepEqual(now, was, 'supported exterior ornament and silhouette are preserved exactly');
    } else {
      assert.ok(Math.max(...was.flatMap(t => t.p.map(p => p[2]))) > height + 0.5, 'fixture reproduces the former internal ornate crown');
      assert.ok(now.length > 0, 'internal roof end remains closed');
      assert.ok(Math.max(...now.flatMap(t => t.p.map(p => p[2]))) <= height + 1e-8, 'unsupported end closes to roof ridge without a floating crown');
      assert.ok(now.every(t => t.part === 'plate'), 'unsupported internal plane has no facade coping or decorative bands');
    }
  }
}
assert.equal(corrected, 2);
console.log('Roof exterior-support regressions passed: two real irregular houses retain source heights and exterior gables; internal ornaments removed; rectangular stepped house unchanged.');

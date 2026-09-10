import assert from 'node:assert/strict';
import { ShapeUtils, Vector2 } from 'three';
import { buildElevations } from '../src/canalRecall/facade/elevations.ts';
import { compileRecipe, recipeContainsPoint, type Triangulate } from '../src/canalRecall/facade/recipe.ts';
import { recipeDevelopmentFixtures } from '../src/canalRecall/facade/recipeFixtures.ts';

const triangulate: Triangulate = (outer, holes) => ShapeUtils.triangulateShape(outer.map(p => new Vector2(...p)), holes.map(h => h.map(p => new Vector2(...p))));
const recipes = await recipeDevelopmentFixtures();
const assets = await Promise.all(recipes.map(r => compileRecipe(r, triangulate)));
let checks = 0;
const check = (condition: unknown, why: string) => { assert.ok(condition, why); checks++; };
for (const [i, asset] of assets.entries()) {
  check(asset.meshHash === (await compileRecipe(structuredClone(recipes[i]), triangulate)).meshHash, 'Compilation is deterministic');
  check(asset.meshes.every(m => m.buildingId === asset.buildingId && m.positions.length === m.triangles.length * 9), 'Merged triangles preserve building IDs');
  check(asset.triangleCount <= 1500 && asset.meshes.length <= 5, 'Ordinary mesh fits triangle and draw-call budgets');
  check(asset.origin.groundNapM === 0 && asset.bounds.min[2] === 0, 'Zero NAP is valid, and local ground is zero');
  check(asset.disposition === 'diagnostic-only', 'Compilation does not approve evidence');
}
const courtyard = assets[2];
check(!recipeContainsPoint(courtyard.collision, { x: 9, y: 12 }), 'Courtyard collider stays open');
check(!recipeContainsPoint(courtyard.collision, { x: 20, y: 5 }), 'Passage between parts stays open');
check(recipeContainsPoint(courtyard.collision, { x: 2, y: 3 }), 'Solid footprint still collides');
let roofArea = 0;
for (const m of courtyard.meshes.filter(m => m.surface === 'roof')) for (let i = 0; i < m.positions.length; i += 9) {
  const [ax, ay, , bx, by, , cx, cy] = m.positions.slice(i, i + 9);
  const area = ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
  check(area > 0, 'Roof faces point upward');
  roofArea += area;
  check(recipeContainsPoint(courtyard.collision, { x: (ax + bx + cx) / 3 + courtyard.origin.x, y: (ay + by + cy) / 3 + courtyard.origin.y }), 'Roof triangle does not fill courtyard or passage');
}
check(Math.abs(roofArea - (18 * 25 - 10 * 13 + 6 * 12)) < 1e-6, 'Roof area equals exact solid footprint');
const narrow = recipes[1];
const glass = assets[1].meshes.find(m => m.surface === 'glass')!;
check(glass.positions.every((v, i) => i % 3 !== 1 || v < 0), 'South-facing openings are outside the south wall, not the rear');
check(assets[1].bounds.max[2] === 14, 'Explicit stepped profile controls the silhouette');
const changed = structuredClone(narrow); changed.palette.value.wall = '#112233';
const changedAsset = await compileRecipe(changed, triangulate);
check(changedAsset.recipeHash !== assets[1].recipeHash && changedAsset.meshHash !== assets[1].meshHash, 'Palette changes invalidate recipe and asset hashes');
const changedGround = structuredClone(narrow); changedGround.groundNapM.value = 1.3;
check((await compileRecipe(changedGround, triangulate)).origin.groundNapM === 1.3, 'Ground datum survives compilation separately from local dimensions');
const rotated = structuredClone(narrow);
rotated.footprint.value.forEach(p => [p.outer, ...p.holes].forEach(r => r.forEach(p => { const x = p.x; p.x = -p.y; p.y = x; })));
rotated.elevations[0].elevationId = buildElevations(rotated.footprint.value[0].outer, { pandId: rotated.buildingId }).find(w => w.normal.x > 0.9)!.elevationId;
const rotatedAsset = await compileRecipe(rotated, triangulate);
const rg = rotatedAsset.meshes.find(m => m.surface === 'glass')!;
check(rg.positions.every((v, i) => i % 3 !== 0 || v + rotatedAsset.origin.x > 0), 'Rotating the footprint rotates frontage correctly');
const failures: Array<[string, (r: typeof narrow) => void, RegExp]> = [
  ['wrong wall', r => { r.elevations[0].elevationId = 'other-building:e:wrong'; }, /does not exist/],
  ['escaped opening', r => { r.elevations[0].openings.value[0].leftM = 200; }, /escapes/],
  ['overlap', r => { r.elevations[0].openings.value.push({ ...r.elevations[0].openings.value[0], id: 'overlap' }); }, /overlaps/],
  ['stale geometry', r => { r.footprint.state = 'stale'; }, /stale/],
  ['unknown height', r => { r.wallTopM.basis = 'unknown'; }, /unknown/],
  ['invalid height', r => { r.wallTopM.value = NaN; }, /height/],
  ['wrong identity', r => { r.buildingId = 'bag:123'; }, /identity/],
  ['missing source', r => { r.identity.sourceHash = ''; }, /hash/],
  ['invalid hole', r => { r.footprint.value[0].holes = [[{ x: 100, y: 100 }, { x: 101, y: 100 }, { x: 101, y: 101 }]]; }, /outside/],
];
for (const [name, mutate, pattern] of failures) {
  const bad = structuredClone(narrow); mutate(bad);
  await assert.rejects(() => compileRecipe(bad, triangulate), pattern, name); checks++;
}
console.log(`Recipe compiler: ${checks} checks passed; triangles ${assets.map(a => a.triangleCount).join(', ')}. No real-building appearance acceptance asserted.`);

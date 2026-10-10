import assert from 'node:assert/strict';
import test from 'node:test';
import {isRoseGarden, planRoseGarden, roseBushInstances, roseBushVertexColours, type LngLat} from './roseBeds.ts';

const lat0 = 52.3576, lng0 = 4.8637;
const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
const at = (x: number, y: number): LngLat => [lng0 + x / kx, lat0 + y / ky];
const square = (h: number) => [[at(-h, -h), at(h, -h), at(h, h), at(-h, h), at(-h, -h)]];

test('rose tags: named rosaria, rose descriptions and rose flowerbeds qualify; plain gardens do not', () => {
  assert.ok(isRoseGarden({leisure: 'garden', name: 'Rosarium'}));
  assert.ok(isRoseGarden({leisure: 'garden', name: 'Rozentuin'}));
  assert.ok(isRoseGarden({leisure: 'garden', description: 'roses garden'}));
  assert.ok(isRoseGarden({leisure: 'garden', 'garden:type': 'rose_garden'}));
  assert.ok(isRoseGarden({landuse: 'flowerbed', flowers: 'roses'}));
  assert.ok(isRoseGarden({landuse: 'flowerbed', genus: 'Rosa'}));
  assert.ok(!isRoseGarden({leisure: 'garden', name: 'Hortus Botanicus', 'garden:type': 'botanical'}));
  assert.ok(!isRoseGarden({leisure: 'park', name: 'Rosarium'}), 'a park is not a bed');
  assert.ok(!isRoseGarden({leisure: 'garden', name: 'Rozengracht 12'}));
});

test('a cross of paths splits a square garden into four beds; no bush on a path', () => {
  const halfWidth = (2.2 + .5) / 2;
  const input = {id: 'a1', name: 'Test', polygons: [square(8)], obstacles: {
    lines: [{coordinates: [at(-9, 0), at(9, 0)], halfWidth}, {coordinates: [at(0, -9), at(0, 9)], halfWidth}],
    polygons: [], points: [{coordinates: at(4, 4), radius: 1}]}};
  const plan = planRoseGarden(input);
  assert.equal(plan.beds.length, 4);
  assert.deepEqual(planRoseGarden(input), plan, 'deterministic');
  assert.ok(plan.bushes.length / 4 > 4 * 12, `bushes ${plan.bushes.length / 4}`);
  const counts = new Map<number, number>();
  const local = roseBushInstances(plan, {west: -180, east: 180, south: -90, north: 90});
  for (let i = 0; i < plan.bushes.length; i += 4) {
    const r = local[i / 4], x = (r.lng - lng0) * kx, y = (r.lat - lat0) * ky;
    assert.ok(Math.abs(x) >= halfWidth + .4 && Math.abs(y) >= halfWidth + .4, `bush on path at ${x},${y}`);
    assert.ok(Math.abs(x) <= 8 - .4 && Math.abs(y) <= 8 - .4, 'bush beyond the garden edge');
    assert.ok(Math.hypot(x - 4, y - 4) >= 1.4, 'bush on furniture');
    counts.set(plan.bushes[i + 2], (counts.get(plan.bushes[i + 2]) || 0) + 1);
  }
  assert.equal(counts.size, 4, 'every bed is planted');
  for (const bed of plan.beds) assert.ok(bed.spacing >= .72 && bed.spacing <= .94);
  const instances = roseBushInstances(plan, {west: -180, east: 180, south: -90, north: 90});
  assert.equal(instances.length, plan.bushes.length / 4);
  for (const r of instances) assert.ok(r.radius > .4 && r.radius < .6 && r.height > .4 && r.height < .8);
  const west = roseBushInstances(plan, {west: -180, east: lng0, south: -90, north: 90});
  assert.ok(west.length > 0 && west.length < instances.length, 'bounds cull bushes');
});

test('a bed pattern drops verge slivers and odd remnants but keeps partial beds', () => {
  // Nine 4×4 m beds on a 6 m grid, inside a garden that leaves a 2 m verge strip
  // on one side and a big remnant on another.
  const lines = [];
  for (const v of [-9, -3, 3, 9]) {
    lines.push({coordinates: [at(v, -9), at(v, 9)], halfWidth: 1});
    lines.push({coordinates: [at(-9, v), at(9, v)], halfWidth: 1});
  }
  const garden = [[at(-11.4, -9), at(25, -9), at(25, 9), at(-11.4, 9), at(-11.4, -9)]];
  const plan = planRoseGarden({id: 'a2', name: 'Pattern', polygons: [garden], obstacles: {lines, polygons: [], points: []}});
  assert.equal(plan.beds.length, 9, plan.beds.map(b => b.area).join(','));
});

test('shrub faces: upper faces flower, the underside stays foliage', () => {
  // Two triangles: one high on the shrub, one below its equator.
  const colours = roseBushVertexColours([0, 0, 1, .5, 0, .8, 0, .5, .8, 0, 0, -1, .5, 0, -.8, 0, .5, -.8]);
  assert.equal(colours.length, 18);
  assert.equal(colours[9], 0, 'underside never blooms');
  for (let v = 0; v < 6; v++) assert.ok(colours[v * 3 + 1] >= .8 && colours[v * 3 + 1] <= 1.2);
  assert.equal(colours[0], colours[3], 'flat per face');
});

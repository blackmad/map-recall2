import assert from 'node:assert/strict';
import {test} from 'node:test';
import polygonClipping from 'polygon-clipping';
import {cleanPlan, edgeNormal, ringArea, roofTiers, simplifyRing, snapLevels, snapToLevels, type PlanPoint, type RoofPlane} from './roofTiers';

const rect = (x0: number, x1: number, z0: number, z1: number): PlanPoint[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const area = (plans: PlanPoint[][][]) => plans.reduce((s, p) => s + p.reduce((t, r) => t + ringArea(r), 0), 0);

// A podium 40 x 20 at 9 m carrying a 10 x 10 tower at 60 m, the tower split into two 3DBAG planes 0.4 m apart in height.
const podiumAndTower: RoofPlane[] = [
  {ring: rect(0, 40, 0, 20), height: 9},
  {ring: rect(15, 20, 5, 15), height: 60.2},
  {ring: rect(20, 25, 5, 15), height: 59.8},
];

test('planes within mergeM share one level, the area-weighted mean', () => {
  const {levels, levelOf} = snapLevels(podiumAndTower, 1.5);
  assert.equal(levels.length, 2);
  assert.ok(Math.abs(levels[1] - 60) < 1e-9);
  assert.deepEqual(levelOf, [0, 1, 1]);
});

test('explicit levels: every plane takes the nearest, unused levels are dropped', () => {
  const {levels, levelOf} = snapToLevels(podiumAndTower, [6.8, 9.5, 41.2, 62.2]);
  assert.deepEqual(levels, [9.5, 62.2]);
  assert.deepEqual(levelOf, [0, 1, 1]);
});

test('tiers nest: the lower plan contains the upper, roofs exclude the slab above, outer rings counter-clockwise', () => {
  const tiers = roofTiers(podiumAndTower, {minAreaM2: 1, simplifyM: 0});
  assert.equal(tiers.length, 2);
  const [podium, tower] = tiers;
  assert.deepEqual([podium.bottom, tower.bottom, tower.top], [0, 9, 60]);
  assert.ok(Math.abs(area(podium.plan) - 800) < 1e-6);
  assert.ok(Math.abs(area(tower.plan) - 100) < 1e-6, 'the two tower planes union into one 10 x 10 slab');
  assert.ok(Math.abs(area(podium.roof) - 700) < 1e-6, 'podium roof = podium minus tower footprint');
  for (const t of tiers) for (const poly of t.plan) assert.ok(ringArea(poly[0]) > 0);
  // Upper plan inside lower: difference is empty.
  const rest = polygonClipping.difference(tower.plan.map(p => p.map(r => [...r, r[0]])) as never, podium.plan.map(p => p.map(r => [...r, r[0]])) as never);
  assert.equal(rest.length, 0);
});

test('cuts remove an authored volume from every tier', () => {
  const tiers = roofTiers(podiumAndTower, {minAreaM2: 1, simplifyM: 0, cuts: [[rect(30, 50, -5, 25)]]});
  assert.ok(Math.abs(area(tiers[0].plan) - 600) < 1e-6);
});

test('cleanPlan drops slivers below minArea and winds holes clockwise', () => {
  const out = cleanPlan([[[...rect(0, 10, 0, 10), [0, 0]].reverse() as never, [...rect(2, 4, 2, 4), [2, 2]] as never], [[...rect(20, 20.5, 0, 1), [20, 0]] as never]], 1, 0);
  assert.equal(out.length, 1);
  assert.ok(ringArea(out[0][0]) > 0 && ringArea(out[0][1]) < 0);
});

test('simplifyRing removes collinear jitter but keeps corners', () => {
  const r: PlanPoint[] = [[0, 0], [5, 0.05], [10, 0], [10, 10], [0, 10]];
  assert.equal(simplifyRing(r, 0.2).length, 4);
});

test('edgeNormal points out of a counter-clockwise ring', () => {
  assert.deepEqual(edgeNormal([0, 0], [1, 0]), [0, -1]);
});

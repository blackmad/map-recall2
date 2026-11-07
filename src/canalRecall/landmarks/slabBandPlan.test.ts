import assert from 'node:assert/strict';
import test from 'node:test';
import {arclengthNear, mullionStations, perimeter, ringArea, roundedRectPlan, slabBandOutline, type PlanPt} from './slabBandPlan';

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const inside = (q: PlanPt, r: PlanPt[]) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j];
    if ((zi > q[1]) !== (zj > q[1]) && q[0] < (xj - xi) * (q[1] - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
};

test('rounded rectangle: area and perimeter of a stadium-cornered box', () => {
  const r = roundedRectPlan(0, 20, 0, 10, 3, 32);
  const want = 20 * 10 - (4 - Math.PI) * 9;
  assert.ok(Math.abs(Math.abs(ringArea(r)) - want) < 0.05, `area ${ringArea(r)} vs ${want}`);
  assert.ok(Math.abs(perimeter(r).total - (2 * (14 + 4) + 2 * Math.PI * 3)) < 0.05);
  assert.equal(roundedRectPlan(0, 4, 0, 4, 0).length, 4);
  assert.ok(roundedRectPlan(0, 4, 0, 2, 5).every(([, z]) => z >= -1e-9 && z <= 2 + 1e-9), 'radius clamps to half the short side');
});

test('full band: outer ring proud by `out`, hole inside the ring by `inset`', () => {
  const r: PlanPt[] = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const {outer, hole} = slabBandOutline(r, {out: 0.8, inset: 0.3});
  assert.ok(hole);
  const xs = outer.map(p => p[0]), hs = hole!.map(p => p[0]);
  assert.ok(near(Math.min(...xs), -0.8) && near(Math.max(...xs), 10.8));
  assert.ok(near(Math.min(...hs), 0.3) && near(Math.max(...hs), 9.7));
  assert.ok(near(Math.abs(ringArea(outer)) - Math.abs(ringArea(hole!)), 11.6 * 7.6 - 9.4 * 5.4));
  // independent of the ring's winding
  const cw = slabBandOutline([...r].reverse(), {out: 0.8, inset: 0.3});
  assert.ok(near(Math.abs(ringArea(cw.outer)), Math.abs(ringArea(outer))));
});

test('partial band follows the corner and ends in rounded tips; the glass beyond it stays clear', () => {
  const r = roundedRectPlan(0, 30, 0, 20, 4, 12);
  const s0 = arclengthNear(r, [5, 0]), s1 = arclengthNear(r, [30, 12]);
  const {outer, hole} = slabBandOutline(r, {out: 1.0, inset: 0.4, from: s0, to: s1, tipSteps: 8});
  assert.equal(hole, undefined);
  // covers a point just outside the face near the middle of the run and just outside the rounded corner
  assert.ok(inside([15, -0.5], outer));
  const cornerOut: PlanPt = [26 + 4 * Math.cos(-Math.PI / 4) + 0.5 * Math.cos(-Math.PI / 4), 4 + 4 * Math.sin(-Math.PI / 4) + 0.5 * Math.sin(-Math.PI / 4)];
  assert.ok(inside(cornerOut, outer), 'band sweeps round the corner');
  // the far faces have no slab
  assert.ok(!inside([15, 20.5], outer));
  assert.ok(!inside([-0.5, 10], outer));
  // tips bulge past the end points by half the slab depth, no further
  const startX = Math.min(...outer.filter(p => p[1] < 0.5).map(p => p[0]));
  assert.ok(Math.abs(startX - (5 - 0.7)) < 0.02, `tip reaches ${startX}`);
  assert.ok(Math.max(...outer.map(p => p[1])) <= 12 + 0.7 + 1e-6);
  // area: the run along the ring times the depth, the extra of one convex quarter turn, and the two half-circle tips
  const P = perimeter(r).total, run = (((s1 - s0) % P) + P) % P;
  const want = run * 1.4 + (Math.PI / 4) * (1.0 ** 2 - 0.4 ** 2) + Math.PI * 0.7 ** 2;
  assert.ok(Math.abs(Math.abs(ringArea(outer)) - want) < 0.1, `area ${ringArea(outer)} vs ${want}`);
});

test('partial band wrapping past vertex 0 and a range of a whole perimeter', () => {
  const r: PlanPt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const P = perimeter(r).total;
  const w = slabBandOutline(r, {out: 0.5, inset: 0.2, from: P - 3, to: 3});
  assert.ok(inside([0.2, -0.2], w.outer) && inside([-0.2, 2], w.outer));
  assert.ok(!inside([5, -0.2], w.outer));
  assert.ok(slabBandOutline(r, {out: 0.5, inset: 0.2, from: 1, to: 1 + P}).hole, 'a whole lap is a full band');
  assert.throws(() => slabBandOutline(r, {out: 0, inset: 0.2}));
});

test('mullion stations: straight edges only, on the module, inside the margins', () => {
  const r = roundedRectPlan(0, 20, 0, 10, 2, 8);
  const st = mullionStations(r, 1.8, 2, 0.3);
  assert.ok(st.length > 0);
  for (const s of st) {
    const onEdge = near(s.p[1], 0) || near(s.p[1], 10) || near(s.p[0], 0) || near(s.p[0], 20);
    assert.ok(onEdge, `station ${s.p} is on a straight face`);
    assert.ok(near(Math.hypot(...s.n), 1));
  }
  const south = st.filter(s => near(s.p[1], 0)).map(s => s.p[0]).sort((a, b) => a - b);
  for (let i = 1; i < south.length; i++) assert.ok(near(south[i] - south[i - 1], 1.8, 1e-6));
  assert.ok(south[0] >= 2.3 - 1e-9 && south.at(-1)! <= 17.7 + 1e-9);
  assert.throws(() => mullionStations(r, 0));
});

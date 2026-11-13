import test from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../../../src/canalRecall/ownMap/mapCamera.ts';
import { clusterNormals, coverOk, greedyCover, crownMarginM, cutFrame, cutPoints, estimateBytes, fitView, neighbourWidthM, numberFronts, sizeFor, windowRegion } from './describe-cut.ts';

const pose = (over = {}) => ({ eyeHeightM: 2.44, headingDeg: 0, lookDownDeg: 0, vfovDeg: 90, width: 1000, height: 1000, ...over });

test('cutFrame: heading north, level: a point straight ahead lands in the centre; east is right; up is up', () => {
  const f = cutFrame(pose());
  const c = project(f, [0, 20, 2.44]);
  assert.ok(Math.abs(c.x - 500) < 1e-6 && Math.abs(c.y - 500) < 1e-6 && c.depth > 0);
  assert.ok(project(f, [5, 20, 2.44]).x > 500);
  assert.ok(project(f, [0, 20, 10]).y < 500);
  // 45 deg off-axis at vfov 90 reaches the frame edge.
  assert.ok(Math.abs(project(f, [0, 20, 22.44]).y) < 1e-6);
});

test('cutFrame: it may look up (negative lookDown), unlike the game camera', () => {
  const f = cutFrame(pose({ headingDeg: 90, lookDownDeg: -20 }));
  const p = project(f, [20, 0, 2.44 + 20 * Math.tan(20 * Math.PI / 180)]);
  assert.ok(Math.abs(p.x - 500) < 1e-6 && Math.abs(p.y - 500) < 1e-6);
});

test('fitView: centres horizontally on the heading and vertically on the span; every point inside', () => {
  const pts: Array<[number, number, number]> = [[-6, 20, 0], [10, 20, 0], [-6, 20, 18], [10, 20, 18], [0, 16, 0]];
  const fit = fitView(pts, 2.44, 0, 0.04);
  assert.deepEqual(fit.clipped, []);
  const sz = sizeFor(fit, 1400);
  assert.equal(Math.max(sz.width, sz.height), 1400);
  const f = cutFrame({ eyeHeightM: 2.44, headingDeg: 0, lookDownDeg: fit.lookDownDeg, vfovDeg: sz.vfovDeg, width: sz.width, height: sz.height });
  const ys = pts.map(p => project(f, p)).map(s => { assert.ok(s.x >= 0 && s.x <= sz.width && s.y >= 0 && s.y <= sz.height, JSON.stringify(s)); return s.y; });
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - sz.height / 2) < 0.03 * sz.height);
  assert.ok(fit.lookDownDeg < 0, 'a tall wall 20 m off is fitted by looking up');
});

test('fitView: a front too wide for the cap is listed as clipped', () => {
  const fit = fitView([[-60, 5, 0], [60, 5, 0], [0, 5, 3]], 2.44, 0);
  assert.ok(fit.clipped.includes('sides'));
});

test('fitView: a front too tall for the lens keeps its top in frame and loses the street', () => {
  const pts: Array<[number, number, number]> = [[-3, 5, 0], [3, 5, 0], [-3, 5, 22], [3, 5, 22], [0, 2, 0]];
  const fit = fitView(pts, 2.44, 0, 0.04);
  assert.ok(fit.clipped.includes('bottom'));
  const sz = sizeFor(fit, 1400);
  const f = cutFrame({ eyeHeightM: 2.44, headingDeg: 0, lookDownDeg: fit.lookDownDeg, vfovDeg: sz.vfovDeg, width: sz.width, height: sz.height });
  const top = project(f, [0, 5, 22]);
  assert.ok(top.y > 0 && top.y < 0.1 * sz.height, `top at ${top.y}`);
  assert.ok(project(f, [0, 2, 0]).y > sz.height, 'the street point falls below the frame');
});

test('sizeFor: the aspect is clamped to 2:1 by widening the short axis', () => {
  const s = sizeFor({ lookDownDeg: 0, halfX: 1, halfY: 0.1, clipped: [] }, 1400);
  assert.equal(s.width, 1400); assert.equal(s.height, 700);
});

test('cutPoints: one house either side, 30 % margin over the wall top, ground toward the camera', () => {
  const wall = { a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, heightM: 15 };
  const pts = cutPoints(wall, { x: 3, y: -20 }, p => [p.x, p.y]);
  assert.equal(neighbourWidthM(6), 6); assert.equal(neighbourWidthM(20), 9); assert.equal(neighbourWidthM(2), 5);
  assert.equal(crownMarginM(15), 4.5); assert.equal(crownMarginM(6), 3);
  assert.equal(Math.min(...pts.map(p => p[0])), -6); assert.equal(Math.max(...pts.map(p => p[0])), 12);
  assert.equal(Math.max(...pts.map(p => p[2])), 19.5);
  assert.equal(Math.min(...pts.map(p => p[1])), -4, 'street points stand up to 4 m in front of the wall, on the camera side');
});

test('windowRegion: first storey above a taller ground floor, middle axis, a margin on the storey cell', () => {
  // The brief's plain rule (groundRatio 1, margin 0.25): storey 3 m, bay 2 m; bays 0..3 -> the middle-left (1), storey 3..6 m.
  assert.deepEqual(windowRegion(8, 12, 4, 4, 0.25, 1), { u0: 1.5, u1: 4.5, v0: 2.25, v1: 6.75 });
  // Default: the ground floor is 1.25 storeys: 12.75 / (3 + 1.25) = 3 m storeys, ground 3.75 m.
  const r = windowRegion(9, 12.75, 4, 3);
  assert.ok(Math.abs(r.v0 - (3.75 - 0.3)) < 1e-9 && Math.abs(r.v1 - (6.75 + 0.3)) < 1e-9, JSON.stringify(r));
  assert.ok(Math.abs(r.u0 - 2.7) < 1e-9 && Math.abs(r.u1 - 6.3) < 1e-9);
  assert.equal(windowRegion(5, 4, 1, 1).v0, 0);
});

test('estimateBytes: mean cached size per kind when 3+ samples, else the default', () => {
  const e = estimateBytes({ small: 10, medium: 2 }, { small: [1, 2, 3], medium: [5] }, { small: 100, medium: 1000 });
  assert.equal(e.bytes, 10 * 2 + 2 * 1000);
  assert.deepEqual(e.perKind.small, { n: 10, mean: 2 });
});

test('numberFronts: left to right from 1', () => {
  assert.deepEqual(numberFronts([{ x: 300, id: 'b' }, { x: 100, id: 'a' }, { x: 900, id: 'c' }]).map(f => [f.id, f.n]), [['a', 1], ['b', 2], ['c', 3]]);
});

test('clusterNormals: the two sides of a street split, one side stays together', () => {
  assert.deepEqual(clusterNormals([{ nx: 0, ny: 1 }, { nx: 0.2, ny: 0.98 }, { nx: 0, ny: -1 }]), [[0, 1], [2]]);
});

test('greedyCover: one capture for three neighbours beats three own picks; preferred wins ties', () => {
  const c = greedyCover(new Map([['a', ['pa', 'x']], ['b', ['pb', 'x']], ['c', ['pc', 'x']], ['d', ['pd']]]));
  assert.deepEqual([...c].sort(), [['a', 'x'], ['b', 'x'], ['c', 'x'], ['d', 'pd']]);
  const t = greedyCover(new Map([['a', ['p1', 'p2']]]), new Set(['p2']));
  assert.equal(t.get('a'), 'p2');
  assert.ok(coverOk({ obliquityDeg: 20, distM: 30 }) && !coverOk({ obliquityDeg: 35, distM: 10 }) && !coverOk({ obliquityDeg: 5, distM: 50 }));
});

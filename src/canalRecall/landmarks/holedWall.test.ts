import assert from 'node:assert/strict';
import test from 'node:test';
import {holedWall, quadArea, windingNormal, type WallQuad} from './holedWall';

const area = (qs: WallQuad[]) => qs.reduce((s, q) => s + quadArea(q), 0);
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('face area is the wall minus its openings; backs cover the openings', () => {
  const ops = [{t0: 1, t1: 3, y0: 1, y1: 2.5, depth: 0.2}, {t0: 5, t1: 9, y0: 0, y1: 4, depth: 1.2}];
  const w = holedWall(10, 0, 6, ops);
  assert.ok(close(area(w.face), 60 - 3 - 16));
  assert.ok(close(area(w.backs), 3 + 16));
});

test('every quad winds towards its declared normal', () => {
  const w = holedWall(12, 2, 9, [{t0: 0, t1: 4, y0: 2, y1: 5, depth: 0.3}, {t0: 4, t1: 8, y0: 3, y1: 6, depth: 0.15}, {t0: 9, t1: 11, y0: 6, y1: 8, depth: 0.25}]);
  for (const q of [...w.face, ...w.reveals.flat(), ...w.backs]) {
    const n = windingNormal(q);
    assert.ok(n[0] * q.normal[0] + n[1] * q.normal[1] + n[2] * q.normal[2] > 0.999, JSON.stringify(q));
  }
});

test('reveals: four for an opening in solid wall, none along a wall edge, partial against a shallower neighbour', () => {
  const lone = holedWall(10, 0, 6, [{t0: 2, t1: 4, y0: 1, y1: 3, depth: 0.25}]);
  assert.equal(lone.reveals[0].length, 4);
  assert.ok(close(area(lone.reveals[0]), 2 * (2 + 2) * 0.25));
  const edge = holedWall(10, 0, 6, [{t0: 0, t1: 10, y0: 0, y1: 2, depth: 0.25}]);
  assert.equal(edge.reveals[0].length, 1, 'only the head: the opening meets both wall ends and the base');
  const pair = holedWall(10, 0, 6, [{t0: 1, t1: 3, y0: 1, y1: 4, depth: 1}, {t0: 3, t1: 6, y0: 1, y1: 4, depth: 0.2}]);
  const shared = pair.reveals[0].find(q => q.normal[0] === -1)!;
  assert.ok(shared.pts.every(p => p[0] === 3));
  assert.ok(close(Math.min(...shared.pts.map(p => p[2])), -1) && close(Math.max(...shared.pts.map(p => p[2])), -0.2), 'runs from the neighbour back plane to its own');
  assert.ok(!pair.reveals[1].some(q => q.normal[0] === 1), 'the shallow opening has no reveal towards the deeper one');
});

test('openings are clipped to the wall; overlapping openings throw', () => {
  const w = holedWall(4, 0, 3, [{t0: -1, t1: 2, y0: -1, y1: 1, depth: 0.1}]);
  assert.ok(close(area(w.backs), 2));
  assert.throws(() => holedWall(4, 0, 3, [{t0: 0, t1: 2, y0: 0, y1: 2, depth: 0.1}, {t0: 1, t1: 3, y0: 1, y1: 3, depth: 0.1}]));
});

test('a wall without openings is one quad', () => {
  const w = holedWall(7, 1, 4, []);
  assert.equal(w.face.length, 1);
  assert.ok(close(area(w.face), 21));
});

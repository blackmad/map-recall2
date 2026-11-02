import assert from 'node:assert/strict';
import test from 'node:test';
import {archArea, archOpeningWall, archOutline, archRise, headAt, springing, triArea, triNormal, type ArchOpening, type Tri} from './archOpeningWall';

const area = (ts: Tri[]) => ts.reduce((s, t) => s + triArea(t), 0);
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// an aisle row of round-headed lights under a pointed clerestory light that spans two of their columns
const ROW: ArchOpening[] = [
  ...[0, 1, 2].map(i => ({t0: 0.6 + i * 1.2, t1: 1.4 + i * 1.2, y0: 1.0, y1: 2.6, depth: 0.25})),
  {t0: 1.0, t1: 3.0, y0: 3.2, y1: 6.0, depth: 0.3, arch: 1, segments: 5},
];

test('rise: a semicircle rises half the width, the equilateral arch sqrt(3)/2 of it', () => {
  assert.ok(close(archRise(2), 1));
  assert.ok(close(archRise(2, 1), Math.sqrt(3)));
  assert.ok(close(springing({t0: 0, t1: 2, y0: 0, y1: 5, depth: 0.1, arch: 1}), 5 - Math.sqrt(3)));
  const o: ArchOpening = {t0: 1, t1: 3, y0: 0, y1: 4, depth: 0.1, arch: 0.8};
  assert.ok(close(headAt(o, 2), 4), 'apex at mid-width');
  assert.ok(close(headAt(o, 1), springing(o)) && close(headAt(o, 3), springing(o)), 'arc meets the jambs on the springing line');
  assert.ok(close(headAt(o, 1.5), headAt(o, 2.5)), 'symmetric');
});

test('face area is the wall minus its openings; backs cover the openings', () => {
  const w = archOpeningWall(4, 0, 7, ROW);
  const holes = ROW.reduce((s, o) => s + archArea(o), 0);
  assert.ok(close(area(w.face), 4 * 7 - holes, 1e-7), `${area(w.face)} vs ${4 * 7 - holes}`);
  assert.ok(close(area(w.backs.flat()), holes, 1e-7));
  // the sampled outline approaches the true area: rectangle plus semicircle for a round head
  const r = ROW[0], exact = (r.t1 - r.t0) * (springing(r) - r.y0) + Math.PI * 0.4 * 0.4 / 2;
  assert.ok(Math.abs(archArea(r) - exact) / exact < 0.01);
});

test('every triangle winds towards its declared normal', () => {
  const w = archOpeningWall(4, 0, 7, ROW);
  for (const t of [...w.face, ...w.reveals.flat(), ...w.backs.flat()]) assert.ok(dot(triNormal(t), t.normal) > 0.999, JSON.stringify(t));
});

test('reveals run the outline at the opening depth and face into the opening', () => {
  const o = ROW[3], w = archOpeningWall(4, 0, 7, [o]), c = archOutline(o);
  let perimeter = 0;
  for (let i = 0; i < c.length; i++) perimeter += Math.hypot(c[(i + 1) % c.length][0] - c[i][0], c[(i + 1) % c.length][1] - c[i][1]);
  assert.ok(close(area(w.reveals[0]), perimeter * o.depth, 1e-7));
  const cx = (o.t0 + o.t1) / 2, cy = (o.y0 + springing(o)) / 2;
  for (const t of w.reveals[0]) {
    const m = [0, 1].map(k => (t.pts[0][k] + t.pts[1][k] + t.pts[2][k]) / 3);
    assert.ok((cx - m[0]) * t.normal[0] + (cy - m[1]) * t.normal[1] > 0, 'reveal normal points at the opening centre');
  }
  for (const t of w.backs[0]) for (const p of t.pts) assert.equal(p[2], -o.depth);
});

test('a head with no jambs (springing on the sill) and bad input', () => {
  const o: ArchOpening = {t0: 1, t1: 3, y0: 1, y1: 2, depth: 0.2};          // a half disc
  const w = archOpeningWall(4, 0, 3, [o]);
  assert.ok(close(area(w.face), 12 - archArea(o), 1e-7));
  assert.throws(() => archOpeningWall(4, 0, 3, [{t0: 1, t1: 5, y0: 1, y1: 2, depth: 0.2}]), /outside/);
  assert.throws(() => archOpeningWall(4, 0, 3, [{t0: 1, t1: 3, y0: 1.5, y1: 2, depth: 0.2}]), /shape/);   // head taller than the opening
  assert.throws(() => archOpeningWall(4, 0, 3, [{t0: 1, t1: 2, y0: 0, y1: 2, depth: 0.2, arch: 0.3}]), /shape/);
  assert.throws(() => archOpeningWall(8, 0, 3, [{t0: 1, t1: 3, y0: 0.5, y1: 2.5, depth: 0.2}, {t0: 3, t1: 4, y0: 0.5, y1: 2, depth: 0.2}]), /touch/);
});

test('arch 0 is a flat-headed rectangle beside the arches', () => {
  const sq: ArchOpening = {t0: 0.5, t1: 1.5, y0: 1, y1: 2.2, depth: 0.15, arch: 0};
  const w = archOpeningWall(5, 0, 4, [sq, {t0: 2, t1: 3, y0: 1, y1: 3, depth: 0.2}]);
  assert.ok(close(archArea(sq), 1.2));
  assert.equal(archOutline(sq).length, 4);
  assert.ok(close(area(w.reveals[0]), 2 * (1 + 1.2) * 0.15));
  assert.ok(close(area(w.face), 20 - 1.2 - archArea({t0: 2, t1: 3, y0: 1, y1: 3, depth: 0.2}), 1e-7));
  for (const t of [...w.face, ...w.reveals.flat(), ...w.backs.flat()]) assert.ok(dot(triNormal(t), t.normal) > 0.999);
});

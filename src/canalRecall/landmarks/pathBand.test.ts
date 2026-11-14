import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arcStations, bandQuads, frameAtArc, ledgeQuads, offsetPath, segmentFrames, subPath, type XZ} from './pathBand';

/** A quarter circle of radius 4 about the origin, from (4, 0) to (0, 4), counter-clockwise in (x, z). */
const arc: XZ[] = Array.from({length: 9}, (_, k) => { const a = k / 8 * Math.PI / 2; return [4 * Math.cos(a), 4 * Math.sin(a)] as XZ; });
const dist = (p: XZ) => Math.hypot(p[0], p[1]);

test('segment normals follow the street-front convention n = (-tz, tx)', () => {
  const [s] = segmentFrames([[0, 0], [2, 0]]);
  assert.deepEqual(s.n, [-0, 1]);
  assert.equal(s.len, 2);
});

test('offsetPath moves every vertex of an arc by the offset (mitred)', () => {
  // the arc runs counter-clockwise, so (-tz, tx) points to the centre: a positive offset shrinks the radius
  const inner = offsetPath(arc, 0.5);
  for (const p of inner) assert.ok(Math.abs(dist(p) - 3.5) < 0.02, `radius ${dist(p)}`);
  assert.equal(inner.length, arc.length);
});

test('offsetPath caps a hairpin miter', () => {
  const q = offsetPath([[0, 0], [5, 0], [0, 0.01]], 1);
  assert.ok(Math.hypot(q[1][0] - 5, q[1][1]) <= 3.01);
});

test('arc stations, frameAtArc and subPath agree', () => {
  const at = arcStations(arc), total = at[at.length - 1];
  assert.ok(Math.abs(total - 2 * Math.PI) < 0.03, `quarter circle length ${total}`);
  const f = frameAtArc(arc, total / 2, 0);
  assert.ok(Math.abs(dist(f.origin) - 4) < 0.05);
  assert.ok(Math.abs(f.tangent[0] * f.n[0] + f.tangent[1] * f.n[1]) < 1e-9);
  const out = frameAtArc(arc, total / 2, -1);
  assert.ok(dist(out.origin) > dist(f.origin) + 0.9, 'a negative offset goes away from the centre');
  const sp = subPath(arc, 1, 2);
  const len = arcStations(sp).at(-1)!;
  assert.ok(Math.abs(len - 1) < 0.01, `sub-path length ${len}`);
  assert.deepEqual(subPath(arc, 3, 3), []);
});

test('bandQuads: one outward quad per segment, sharing edges', () => {
  const q = bandQuads(arc, 0, 3, -0.2);
  assert.equal(q.length, arc.length - 1);
  for (let i = 0; i + 1 < q.length; i++) assert.deepEqual(q[i].pts[1], q[i + 1].pts[0]);
  for (const b of q) { assert.equal(b.pts[0][1], 0); assert.equal(b.pts[2][1], 3); }
  assert.deepEqual(bandQuads(arc, 2, 2), []);
});

test('ledgeQuads: front, top and soffit per segment plus two end caps', () => {
  const q = ledgeQuads([[0, 0], [3, 0], [3, 3]], 4, 0.3, -0.2, 0.6);
  assert.equal(q.length, 2 * 3 + 2);
  const tops = q.filter(b => b.n[1] === 1);
  assert.equal(tops.length, 2);
  for (const b of tops) for (const p of b.pts) assert.equal(p[1], 4.3);
  assert.deepEqual(ledgeQuads([[0, 0], [3, 0]], 4, 0, 0, 1), []);
});

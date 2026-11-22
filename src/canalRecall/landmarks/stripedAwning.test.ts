import assert from 'node:assert/strict';
import test from 'node:test';
import {lipFromHead, stripedAwning, type TO} from './stripedAwning';

/** A canted bay head: 0.55 m cants at 45 degrees either side of a 1.6 m front. */
const BAY: TO[] = [[0, 0], [0.55, 0.55], [2.15, 0.55], [2.7, 0]];

test('lipFromHead keeps every offset segment proj from its head segment and pushes the ends straight out', () => {
  const lip = lipFromHead(BAY, 0.3);
  assert.deepEqual(lip[0], [0, 0.3]);
  assert.deepEqual(lip[3], [2.7, 0.3]);
  // the front segment's offset is 0.3 m further out
  assert.ok(Math.abs(lip[1][1] - 0.85) < 1e-9 && Math.abs(lip[2][1] - 0.85) < 1e-9);
  // the mitre point is 0.3 m from the left cant's line too
  const [a, b] = BAY, d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dist = Math.abs((lip[1][0] - a[0]) * (b[1] - a[1]) - (lip[1][1] - a[1]) * (b[0] - a[0])) / d;
  assert.ok(Math.abs(dist - 0.3) < 1e-9);
  assert.throws(() => lipFromHead([[0, 0]], 0.3));
});

test('stripes alternate along the whole run, continuous round the bay, each segment a whole number of stripes', () => {
  const r = stripedAwning({head: BAY, lip: lipFromHead(BAY, 0.3), yHead: 8, drop: 0.6, stripe: 0.2});
  // cants 0.78 m -> 4 stripes each, front 1.6 m -> 8 stripes
  assert.equal(r.stripes, 16);
  assert.equal(r.cloth.length, 32, 'every polygon twice');
  const order = r.cloth.filter((_, i) => i % 2 === 0).map(p => p.stripe);
  order.forEach((c, i) => assert.equal(c, i % 2));
  // both windings of one strip share the stripe and the points, reversed
  assert.deepEqual(r.cloth[1].pts, r.cloth[0].pts.slice().reverse());
});

test('the cloth slopes from the head at yHead down to the lip, drop lower and further out', () => {
  const r = stripedAwning({head: [[0, 0], [2, 0]], lip: lipFromHead([[0, 0], [2, 0]], 0.7), yHead: 3, drop: 0.5, stripe: 0.25});
  for (const p of r.cloth) {
    const ys = p.pts.map(q => q[1]), os = p.pts.map(q => q[2]);
    assert.equal(Math.max(...ys), 3);
    assert.equal(Math.min(...ys), 2.5);
    assert.ok(Math.min(...os) === 0 && Math.abs(Math.max(...os) - 0.7) < 1e-9);
  }
  assert.equal(r.valance.length, 0);
  assert.equal(r.cheeks.length, 0);
});

test('a scalloped valance hangs a pointed tongue under every stripe; scallop is capped at the valance', () => {
  const head: TO[] = [[0, 0], [1, 0]];
  const r = stripedAwning({head, lip: lipFromHead(head, 0.4), yHead: 5, drop: 0.4, stripe: 0.25, valance: 0.2, scallop: 0.5});
  assert.equal(r.valance.length, 8);
  const v = r.valance[0].pts;
  assert.equal(v.length, 5);
  assert.ok(Math.abs(Math.min(...v.map(p => p[1])) - 4.4) < 1e-9, 'tongue tip at the hem');
  // the scallop was capped at the 0.2 m valance, so the corners sit at the lip
  assert.ok(Math.abs(v[2][1] - 4.6) < 1e-9);
  const straight = stripedAwning({head, lip: lipFromHead(head, 0.4), yHead: 5, drop: 0.4, stripe: 0.25, valance: 0.2});
  assert.equal(straight.valance[0].pts.length, 4);
});

test('cheeks close both ends from the sloping cloth edge down to the hem, in the plane of the end', () => {
  const head: TO[] = [[0, 0], [2, 0]];
  const r = stripedAwning({head, lip: lipFromHead(head, 0.6), yHead: 3, drop: 0.6, stripe: 0.3, valance: 0.15, cheeks: true});
  assert.equal(r.cheeks.length, 2 * 2 * 2);
  for (const c of r.cheeks) {
    const ts = new Set(c.pts.map(p => p[0]));
    assert.equal(ts.size, 1, 'each cheek stands square to the wall at its end');
    assert.ok(Math.abs(Math.min(...c.pts.map(p => p[1])) - 2.25) < 1e-9);
  }
});

test('cheekHem hangs the cheeks lower against the wall, running up to the valance hem at the lip', () => {
  const head: TO[] = [[0, 0], [2, 0]];
  const r = stripedAwning({head, lip: lipFromHead(head, 0.6), yHead: 3, drop: 0.4, stripe: 0.3, valance: 0.1, cheeks: true, cheekHem: 2.1});
  const pts = r.cheeks.flatMap(c => c.pts);
  const atWall = pts.filter(p => p[2] === 0), atLip = pts.filter(p => Math.abs(p[2] - 0.6) < 1e-9);
  assert.ok(Math.abs(Math.min(...atWall.map(p => p[1])) - 2.1) < 1e-9);
  assert.ok(Math.abs(Math.min(...atLip.map(p => p[1])) - 2.5) < 1e-9);
});

test('one colour: first stripe and option checks', () => {
  const head: TO[] = [[0, 0], [1, 0]];
  const r = stripedAwning({head, lip: lipFromHead(head, 0.3), yHead: 2, drop: 0.3, stripe: 0.5, first: 1});
  assert.equal(r.cloth[0].stripe, 1);
  assert.throws(() => stripedAwning({head, lip: [[0, 0.3]], yHead: 2, drop: 0.3, stripe: 0.5}));
  assert.throws(() => stripedAwning({head, lip: lipFromHead(head, 0.3), yHead: 2, drop: 0, stripe: 0.5}));
});

test('dome: the quarter-round hood leaves the wall level at the head and meets the lip vertical, stripes over the curve', () => {
  const head: TO[] = [[0, 0], [1.2, 0]];
  const r = stripedAwning({head, lip: lipFromHead(head, 0.5), yHead: 7, drop: 0.6, stripe: 0.2, dome: 4, cheeks: true});
  assert.equal(r.stripes, 6);
  assert.equal(r.cloth.length, 6 * 4 * 2, 'four quads per stripe, both windings');
  const pts = r.cloth.flatMap(p => p.pts);
  assert.ok(Math.abs(Math.max(...pts.map(p => p[1])) - 7) < 1e-9 && Math.abs(Math.min(...pts.map(p => p[1])) - 6.4) < 1e-9);
  assert.ok(Math.abs(Math.max(...pts.map(p => p[2])) - 0.5) < 1e-9);
  // first segment: level at the head (rises less than it runs out); last: vertical at the lip (runs out less than it drops)
  const first = r.cloth[0].pts, last = r.cloth[6].pts;
  assert.ok(Math.abs(first[3][1] - first[0][1]) < Math.abs(first[3][2] - first[0][2]));
  assert.ok(Math.abs(last[3][2] - last[0][2]) < Math.abs(last[3][1] - last[0][1]));
  // the stripe colour stays the same over the curve of one stripe
  assert.ok(r.cloth.slice(0, 8).every(p => p.stripe === 0));
  // cheeks: a fan of four alternating triangles per end, all from the centre on the wall at the lip height
  assert.equal(r.cheeks.length, 2 * 4 * 2);
  for (const c of r.cheeks) { assert.equal(c.pts.length, 3); assert.ok(c.pts.some(p => p[2] === 0 && Math.abs(p[1] - 6.4) < 1e-9)); }
  assert.deepEqual(r.cheeks.filter((_, i) => i % 2 === 0).slice(0, 4).map(c => c.stripe), [0, 1, 0, 1]);
});

test('dome 0 or absent draws the straight cloth unchanged', () => {
  const head: TO[] = [[0, 0], [1, 0]];
  const o = {head, lip: lipFromHead(head, 0.4), yHead: 5, drop: 0.4, stripe: 0.25, valance: 0.1, cheeks: true};
  assert.deepEqual(stripedAwning({...o, dome: 0}), stripedAwning(o));
});

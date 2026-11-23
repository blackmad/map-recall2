import assert from 'node:assert/strict';
import test from 'node:test';
import {archAwning} from './archAwning';

const BASE = {t: 2, ySpring: 5, r: 0.75, segs: 8, proj: 0.25, drop: 0.12};

test('the head lies on the arch on the wall, the lip drop inside it and proj out, left springing to right', () => {
  const a = archAwning(BASE);
  assert.equal(a.stripes, 8);
  assert.equal(a.cloth.length, 16, 'every polygon twice');
  const first = a.cloth[0].pts, last = a.cloth[14].pts;
  // first strip starts at the left springing on the wall, the last ends at the right springing
  assert.ok(Math.abs(first[0][0] - 1.25) < 1e-9 && Math.abs(first[0][1] - 5) < 1e-9 && first[0][2] === 0);
  assert.ok(Math.abs(last[1][0] - 2.75) < 1e-9 && Math.abs(last[1][1] - 5) < 1e-9);
  for (const p of a.cloth.flatMap(q => q.pts)) {
    const rad = Math.hypot(p[0] - 2, p[1] - 5);
    if (p[2] === 0) assert.ok(Math.abs(rad - 0.75) < 1e-9, 'head on the arch');
    else { assert.equal(p[2], 0.25); assert.ok(Math.abs(rad - 0.63) < 1e-9, 'lip drop inside'); }
    assert.ok(p[1] >= 5 - 1e-9, 'nothing below the springing without legs');
  }
  assert.deepEqual(a.cloth[1].pts, a.cloth[0].pts.slice().reverse());
});

test('stripes alternate round the arch; one colour when both colours are the same is the caller\'s choice', () => {
  const a = archAwning({...BASE, first: 1});
  a.cloth.filter((_, i) => i % 2 === 0).forEach((p, i) => assert.equal(p.stripe, (i + 1) % 2));
});

test('the scalloped valance hangs inside the lip, tongues pointing at the arch centre', () => {
  const a = archAwning({...BASE, valance: 0.1, scallop: 0.05});
  assert.equal(a.valance.length, 16);
  const v = a.valance[0].pts;
  assert.equal(v.length, 5);
  const rad = (p: number[]) => Math.hypot(p[0] - 2, p[1] - 5);
  assert.ok(Math.abs(rad(v[3]) - 0.53) < 1e-9, 'tongue tip at the hem');
  assert.ok(Math.abs(rad(v[2]) - 0.58) < 1e-9, 'tongue shoulders scallop above the hem');
  // the valance can never cross the arch centre
  const deep = archAwning({...BASE, valance: 5});
  for (const p of deep.valance.flatMap(q => q.pts)) assert.ok(rad(p) >= -1e-9);
});

test('legs continue the cloth down both jambs, coloured as the strips they meet', () => {
  const a = archAwning({...BASE, segs: 7, valance: 0.08, legs: 0.4});
  assert.equal(a.legs.length, 8, 'cloth and valance band per jamb, both windings');
  const ys = a.legs.flatMap(q => q.pts.map(p => p[1]));
  assert.ok(Math.abs(Math.min(...ys) - 4.6) < 1e-9 && Math.abs(Math.max(...ys) - 5) < 1e-9);
  // 7 segments from stripe 0: the last strip is stripe 0 too, so both jambs are stripe 0
  assert.ok(a.legs.every(p => p.stripe === 0));
  assert.equal(archAwning({...BASE, legs: 0}).legs.length, 0);
});

test('bad input throws', () => {
  assert.throws(() => archAwning({...BASE, drop: 0.8}));
  assert.throws(() => archAwning({...BASE, segs: 1}));
  assert.throws(() => archAwning({...BASE, proj: 0}));
});

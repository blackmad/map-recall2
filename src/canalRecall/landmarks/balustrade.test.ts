import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balustrade} from './balustrade';

test('balustrade: muziekschool entrance, five balusters evenly between two posts', () => {
  const b = balustrade({width: 1.64, height: 0.8, post: 0.2, plinth: 0.12, rail: 0.12, baluster: 0.16, pitch: 0.25});
  assert.equal(b.posts.length, 2);
  assert.equal(b.balusters.length, 5);
  const xs = b.balusters.map(x => x.x);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  for (const g of gaps) assert.ok(Math.abs(g - gaps[0]) < 1e-9);
  // symmetric about the centre line, and no baluster touches a post
  assert.ok(Math.abs(xs[0] + xs[xs.length - 1]) < 1e-9);
  const inner = -1.64 / 2 + 0.2;
  assert.ok(xs[0] - b.balusters[0].w / 2 > inner);
  for (const x of b.balusters) { assert.ok(Math.abs(x.y - 0.12) < 1e-9); assert.ok(Math.abs(x.h - 0.56) < 1e-9); }
});

test('balustrade: intermediate posts split the span into equal bays', () => {
  const b = balustrade({width: 6.2, height: 1, post: 0.3, plinth: 0.15, rail: 0.15, baluster: 0.14, pitch: 0.22, bays: 2});
  assert.equal(b.posts.length, 3);
  assert.ok(Math.abs(b.posts[1].x) < 1e-9);
  const left = b.balusters.filter(x => x.x < 0).length, right = b.balusters.filter(x => x.x > 0).length;
  assert.equal(left, right);
  for (const x of b.balusters) for (const p of b.posts) assert.ok(Math.abs(x.x - p.x) >= (x.w + p.w) / 2 - 1e-9);
});

test('balustrade: rejects impossible sizes', () => {
  assert.throws(() => balustrade({width: 0.3, height: 1, post: 0.2, plinth: 0.1, rail: 0.1, baluster: 0.1, pitch: 0.2}));
  assert.throws(() => balustrade({width: 2, height: 0.2, post: 0.2, plinth: 0.1, rail: 0.1, baluster: 0.1, pitch: 0.2}));
  assert.throws(() => balustrade({width: 2, height: 1, post: 0.2, plinth: 0.1, rail: 0.1, baluster: 0.1, pitch: 0.2, bays: 0}));
});

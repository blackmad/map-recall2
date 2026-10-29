import test from 'node:test';
import assert from 'node:assert/strict';
import {spanQuality, stripQuality, STRIP_QUALITY} from './stripQuality.ts';

const fill = (w: number, h: number, px: (x: number, y: number) => [number, number, number]) => {
  const a = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.set(px(x, y), (y * w + x) * 3);
  return a;
};
const box = {x0: 0, x1: 20, y0: 0, y1: 10};

test('a warm brick front is good', () => {
  const q = spanQuality(fill(20, 10, () => [140, 90, 70]), 20, box);
  assert.deepEqual(q.bad, []);
  assert.ok(q.rb > 0.2);
});

test('a cyan-cast front (Kinkerstraat 56-84 2024-11-29) is bad, a green-lit warm front is not', () => {
  assert.match(spanQuality(fill(20, 10, () => [108, 125, 104]), 20, box).bad.join(), /cyan cast/);
  assert.deepEqual(spanQuality(fill(20, 10, () => [170, 130, 80]), 20, box).bad, []);
});

test('blown and dark spans', () => {
  assert.match(spanQuality(fill(20, 10, (x) => x < 10 ? [250, 250, 248] : [140, 90, 70]), 20, box).bad.join(), /blown/);
  assert.deepEqual(spanQuality(fill(20, 10, (x) => x < 4 ? [250, 250, 248] : [140, 90, 70]), 20, box).bad, []);
  assert.match(spanQuality(fill(20, 10, () => [12, 10, 9]), 20, box).bad.join(), /dark/);
});

test('placeholder grey is no evidence, and a face with no usable span is bad', () => {
  const q = spanQuality(fill(20, 10, () => [128, 128, 128]), 20, box);
  assert.equal(q.usable, 0);
  assert.deepEqual(q.bad, []);
  assert.equal(stripQuality([{quality: q, widthPx: 20}]).bad, true);
});

test('the face verdict weighs spans by width', () => {
  const good = spanQuality(fill(20, 10, () => [140, 90, 70]), 20, box), bad = spanQuality(fill(20, 10, () => [108, 125, 104]), 20, box);
  assert.equal(stripQuality([{quality: good, widthPx: 80}, {quality: bad, widthPx: 20}]).bad, false);
  const v = stripQuality([{quality: good, widthPx: 50}, {quality: bad, widthPx: 50}]);
  assert.equal(v.bad, true);
  assert.equal(v.badShare, 0.5);
  assert.ok(v.badShare > STRIP_QUALITY.maxBadShare);
  assert.deepEqual(v.reasons, ['cyan cast gm']);
});

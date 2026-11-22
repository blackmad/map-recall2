import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOSED, counterLabel, keyAction, lightboxReducer, swipeAction, trapFocusIndex, type LightboxState } from './whatsNewLightbox.ts';

const pair = [{ src: 'a.png', caption: 'Before' }, { src: 'b.png', caption: 'After' }, { src: 'c.png' }];
const open = (index = 0): LightboxState => lightboxReducer(CLOSED, { type: 'open', images: pair, index });

test('open clamps the index and drops images without a src', () => {
  assert.equal(open(9).index, 2);
  assert.equal(open(-3).index, 0);
  const s = lightboxReducer(CLOSED, { type: 'open', images: [{ src: '' }, { src: 'x.png' }], index: 1 });
  assert.deepEqual(s.images, [{ src: 'x.png' }]);
  assert.equal(s.index, 0);
  assert.equal(lightboxReducer(CLOSED, { type: 'open', images: [], index: 0 }).open, false);
});

test('next and prev wrap around a note\'s images', () => {
  assert.equal(lightboxReducer(open(2), { type: 'next' }).index, 0);
  assert.equal(lightboxReducer(open(0), { type: 'prev' }).index, 2);
  assert.equal(lightboxReducer(open(1), { type: 'next' }).index, 2);
});

test('a single image ignores next/prev; a closed box ignores everything but open', () => {
  const one = lightboxReducer(CLOSED, { type: 'open', images: [{ src: 'a' }], index: 0 });
  assert.equal(lightboxReducer(one, { type: 'next' }), one);
  const closed = lightboxReducer(open(1), { type: 'close' });
  assert.equal(closed.open, false);
  assert.equal(lightboxReducer(closed, { type: 'next' }), closed);
  assert.equal(lightboxReducer(closed, { type: 'go', index: 0 }), closed);
});

test('keys map to close/prev/next and nothing else', () => {
  assert.deepEqual(keyAction('Escape'), { type: 'close' });
  assert.deepEqual(keyAction('ArrowRight'), { type: 'next' });
  assert.deepEqual(keyAction('ArrowLeft'), { type: 'prev' });
  assert.equal(keyAction('Enter'), null);
  assert.equal(keyAction('Tab'), null);
});

test('swipe needs 40 px and a mostly horizontal stroke; left = next', () => {
  assert.deepEqual(swipeAction(-80, 10), { type: 'next' });
  assert.deepEqual(swipeAction(80, -10), { type: 'prev' });
  assert.equal(swipeAction(-30, 0), null);
  assert.equal(swipeAction(-60, 50), null);
  assert.equal(swipeAction(0, 0), null);
});

test('counter shows only for several images', () => {
  assert.equal(counterLabel(open(1)), '2 of 3');
  assert.equal(counterLabel(lightboxReducer(CLOSED, { type: 'open', images: [{ src: 'a' }], index: 0 })), '');
});

test('focus trap wraps at both ends', () => {
  assert.equal(trapFocusIndex(2, 3, false), 0);
  assert.equal(trapFocusIndex(0, 3, true), 2);
  assert.equal(trapFocusIndex(1, 3, false), null);
  assert.equal(trapFocusIndex(-1, 3, false), 0);
  assert.equal(trapFocusIndex(-1, 3, true), 2);
  assert.equal(trapFocusIndex(0, 0, false), null);
});

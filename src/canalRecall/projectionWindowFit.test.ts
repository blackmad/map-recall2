import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutWindows, fitProjection, MIN_SCALE } from './projectionWindowFit.ts';

// Four bays on a 10 m wall, windows 1.2 m wide: the middle (5 m) is the pier between windows 2 and 3.
const four = [1.25, 3.75, 6.25, 8.75].map(x => ({ x, hw: 0.6 }));

test('uncut: the wanted place and width are returned exactly (byte-identical callers)', () => {
  const three = [1.6, 5, 8.4].map(x => ({ x, hw: 0.6 }));
  assert.deepEqual(fitProjection(5, 1.38, three, 10), { x: 5, scale: 1, how: 'kept' });
  assert.deepEqual(fitProjection(5, 1.38, [], 10), { x: 5, scale: 1, how: 'kept' });
});

test('d99e51: an oriel in the middle of an even bay count moves onto a window axis and cuts nothing', () => {
  assert.equal(cutWindows(5 - 1.38, 5 + 1.38, four).length, 2);
  const fit = fitProjection(5, 1.38, four, 10)!;
  assert.ok(fit);
  assert.ok([3.75, 6.25].includes(fit.x), `on an axis: ${fit.x}`);
  const h = 1.38 * fit.scale;
  assert.equal(cutWindows(fit.x - h, fit.x + h, four).length, 0);
  assert.ok(fit.scale >= MIN_SCALE);
});

test('a mass that cannot fit anywhere is dropped', () => {
  // Windows 2.36 m wide on a 2.4 m pitch (4 cm piers): covering one leaves no clearance to the next.
  const tight = [1.2, 3.6, 6, 8.4].map(x => ({ x, hw: 1.18 }));
  assert.equal(fitProjection(4.8, 1.38, tight, 9.6), null);
});

test('a window covered whole is not a cut', () => {
  assert.equal(cutWindows(3, 4.5, four).length, 0);
  assert.equal(cutWindows(3.4, 4.5, four).length, 1);
});

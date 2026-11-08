import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RevealSurface, revealLightEnabled } from './revealSurface';

const ride = { covered: false, introFlat: 0, detached: false, surfaceReady: true };

test('primes once, on the first uncovered sync', () => {
  const r = new RevealSurface(true);
  assert.equal(r.shouldPrime({ ...ride, covered: true }), false);
  assert.equal(r.shouldPrime({ ...ride, covered: true }), false);
  assert.equal(r.shouldPrime(ride), true);
  assert.equal(r.shouldPrime(ride), false);
  assert.equal(r.shouldPrime(ride), false);
  assert.equal(r.primes, 1);
});

test('primes on the first sync even when no covered sync came first (the page opens covered)', () => {
  const r = new RevealSurface(true);
  assert.equal(r.shouldPrime(ride), true);
});

test('re-arms whenever the world is covered again (the next ride start)', () => {
  const r = new RevealSurface(true);
  assert.equal(r.shouldPrime(ride), true);
  assert.equal(r.shouldPrime(ride), false);
  assert.equal(r.shouldPrime({ ...ride, covered: true }), false);
  assert.equal(r.shouldPrime(ride), true);
  assert.equal(r.primes, 2);
});

test('the intro flight and a panned-off camera keep today\'s ease, and disarm', () => {
  const intro = new RevealSurface(true);
  assert.equal(intro.shouldPrime({ ...ride, introFlat: 1 }), false);
  assert.equal(intro.shouldPrime(ride), false, 'the intro\'s landing is not primed');
  const detached = new RevealSurface(true);
  assert.equal(detached.shouldPrime({ ...ride, detached: true }), false);
  assert.equal(detached.shouldPrime(ride), false);
});

test('a ground not ready at the reveal is not primed later, mid-ride (that would be a one-frame jump)', () => {
  const r = new RevealSurface(true);
  assert.equal(r.shouldPrime({ ...ride, surfaceReady: false }), false);
  assert.equal(r.shouldPrime(ride), false);
  assert.equal(r.primes, 0);
});

test('?revealLight=0 never primes', () => {
  const r = new RevealSurface(false);
  assert.equal(r.shouldPrime({ ...ride, covered: true }), false);
  assert.equal(r.shouldPrime(ride), false);
  assert.equal(r.primes, 0);
});

test('flag parsing', () => {
  for (const v of [undefined, null, true, '1', 'on', '']) assert.equal(revealLightEnabled(v), true, String(v));
  for (const v of [false, '0', 'false', 'off', 'OFF']) assert.equal(revealLightEnabled(v), false, String(v));
});

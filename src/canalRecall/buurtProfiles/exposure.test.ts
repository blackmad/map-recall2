import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyExposure, fitExposure, MIN_PAIRS, type ExposureSample } from './exposure.ts';

// Brick in Lab: L*, then a/b at hue 45 with the given chroma.
const brick = (L: number, C = 8, h = 45): number[] => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
const TARGET = { L: 43, C: 36, h: 42 };

/**
 * A city of two buurten measured by a uniform reference source ("thumb", 20 fronts each) and a source that covers
 * only the dark buurt ("blockface", reading 3 L* lighter than the thumbnails on the same pands).
 */
function city(): ExposureSample[] {
  const out: ExposureSample[] = [];
  for (let i = 0; i < 20; i++) {
    out.push({ pand: `light${i}`, source: 'thumb', lab: brick(40) });
    out.push({ pand: `dark${i}`, source: 'thumb', lab: brick(28) });
  }
  for (let i = 0; i < 40; i++) out.push({ pand: `dark${i}`, source: 'blockface', lab: brick(31) });
  return out;
}

test('a source that covers only dark buurten keeps them dark (shared reference, not its own median)', () => {
  const model = fitExposure(city(), TARGET, { reference: 'thumb' });
  assert.equal(model.sources.blockface.via, 'overlap');
  assert.equal(model.sources.blockface.pairs, 20);
  assert.equal(model.sources.blockface.dL, -3);
  const darkByThumb = applyExposure(model, 'thumb', brick(28))[0], darkByBlockface = applyExposure(model, 'blockface', brick(31))[0];
  assert.ok(Math.abs(darkByThumb - darkByBlockface) < 1e-9, 'both sources put the dark buurt at the same L*');
  // The old per-source median calibration lifted the block faces' own median (31) to the city target (43).
  assert.ok(darkByBlockface < TARGET.L - 5, `dark buurt stays below the city level: ${darkByBlockface}`);
  const lightByThumb = applyExposure(model, 'thumb', brick(40))[0];
  assert.ok(Math.abs((lightByThumb - darkByThumb) - 12) < 1e-9, 'the measured 12 L* between the buurten is kept');
});

test('one city-wide lift for every source; liftShare scales it and 0 keeps the measured L*', () => {
  const full = fitExposure(city(), TARGET, { reference: 'thumb' });
  assert.equal(full.referenceMedian.L, 40); // upper median of the 40 thumbnails
  assert.equal(full.city.lift, 3);
  const none = fitExposure(city(), TARGET, { reference: 'thumb', liftShare: 0 });
  assert.equal(applyExposure(none, 'thumb', brick(28))[0], 28);
  assert.equal(applyExposure(none, 'blockface', brick(31))[0], 28);
});

test('too few shared pands falls back to median-to-median against the reference', () => {
  // Only MIN_PAIRS - 1 block-face houses share a pand with a thumbnail.
  const samples = city().map(s => s.source === 'blockface' && Number(s.pand.slice(4)) >= MIN_PAIRS - 1 ? { ...s, pand: `bf-${s.pand}` } : s);
  const model = fitExposure(samples, TARGET, { reference: 'thumb' });
  assert.equal(model.sources.blockface.via, 'median');
  assert.equal(model.sources.blockface.dL, 9); // thumb median 40 - block-face median 31
});

test('only physically impossible brick is clamped; paint keeps half its tint', () => {
  const model = fitExposure(city(), TARGET, { reference: 'thumb' });
  assert.equal(applyExposure(model, 'thumb', brick(85))[0], 72, 'glare');
  assert.equal(applyExposure(model, 'thumb', brick(5))[0], 14, 'deep shadow');
  const grey = applyExposure(model, 'thumb', brick(30, 1));
  assert.ok(Math.hypot(grey[1], grey[2]) >= 12 - 1e-9, 'a shaded wall keeps brick colour');
  const paint = applyExposure(model, 'thumb', [80, 4, -6], true);
  assert.deepEqual(paint, [83, 2, -3]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {archIntradosAt, relievingArches} from './relievingArches';

const S = {width: 0.3, height: 0.35, peak: 0.08, drop: 0.05};

test('a group of three windows on narrow piers shares springers: three arches on four blocks', () => {
  const r = relievingArches({centres: [1.75, 3.65, 5.55], width: 1.54, springY: 15.2, rise: 0.18, thickness: 0.3, springer: S});
  assert.equal(r.arches.length, 3);
  assert.equal(r.springers.length, 4);
  // the shared blocks sit on the pier centres and are at least as wide as a springer
  assert.ok(Math.abs(r.springers[1].centre - (1.75 + 3.65) / 2) < 1e-9);
  assert.ok(r.springers[1].width >= S.width - 1e-9);
});

test('separate windows each get two springers; arches span between the springers\' inner faces', () => {
  const r = relievingArches({centres: [5, 1], width: 1.2, springY: 3, rise: 0.15, thickness: 0.25, springer: S});
  assert.equal(r.springers.length, 4);
  assert.deepEqual(r.arches.map(a => a.centre), [1, 5]);
  for (const a of r.arches) assert.ok(Math.abs(a.chord - (1.2 + 0)) < 1e-9, 'unshared springers stand just outside the window');
  const [a] = r.arches, [s0, s1] = r.springers;
  assert.ok(Math.abs(a.centre - a.chord / 2 - (s0.centre + s0.width / 2)) < 1e-9);
  assert.ok(Math.abs(a.centre + a.chord / 2 - (s1.centre - s1.width / 2)) < 1e-9);
});

test('springer outline: a pointed pentagon with the given peak, its foot dropped below the springing line', () => {
  const r = relievingArches({centres: [0], width: 1, springY: 2, rise: 0.1, thickness: 0.2, springer: S});
  const s = r.springers[0];
  assert.equal(s.outline.length, 5);
  assert.ok(Math.abs(s.y - 1.95) < 1e-9);
  assert.ok(Math.abs(Math.max(...s.outline.map(p => p[1])) - (S.height + S.peak)) < 1e-9);
  const flat = relievingArches({centres: [0], width: 1, springY: 2, rise: 0.1, thickness: 0.2, springer: {width: 0.3, height: 0.3}}).springers[0];
  assert.equal(flat.outline.length, 4);
});

test('intrados: the rise at the crown, zero at the springing', () => {
  const [a] = relievingArches({centres: [0], width: 1.5, springY: 0, rise: 0.2, thickness: 0.3, springer: S}).arches;
  assert.ok(Math.abs(archIntradosAt(a, a.centre) - 0.2) < 1e-9);
  assert.ok(Math.abs(archIntradosAt(a, a.centre + a.chord / 2)) < 1e-9);
  assert.ok(archIntradosAt(a, a.centre + a.chord / 4) > 0 && archIntradosAt(a, a.centre + a.chord / 4) < 0.2);
});

test('bad input throws', () => {
  assert.throws(() => relievingArches({centres: [0], width: 0, springY: 0, rise: 0.1, thickness: 0.2, springer: S}));
  assert.throws(() => relievingArches({centres: [0], width: 1, springY: 0, rise: 0.6, thickness: 0.2, springer: S}));
  assert.throws(() => relievingArches({centres: [0, 0.5], width: 1, springY: 0, rise: 0.1, thickness: 0.2, springer: S}));
});

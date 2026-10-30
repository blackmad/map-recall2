import test from 'node:test';
import assert from 'node:assert/strict';
import { pitchScore, profileScore, scoreZebra, WINDOW_MIN_ROW_M } from './zebraEvidence';

// A 1 m pitch zebra (0.5 m white, 0.5 m road) painted on [a, b] of a row; grey road with a little deterministic texture.
const profile = (from: number, to: number, a: number, b: number, shade = (_v: number) => 0) => {
  const vs: number[] = [], ls: number[] = [];
  let s = 7;
  for (let v = from; v <= to + 1e-9; v += 0.05) {
    s = (s * 16807) % 2147483647;
    const stripe = v >= a && v <= b && ((v - a) % 1) < 0.5;
    vs.push(v); ls.push((stripe ? 200 : 110) + ((s % 21) - 10) + shade(v));
  }
  return { vs, ls };
};

test('zebra score: a zebra filling a third of a long row is diluted in the whole-row score, not in the windowed one', () => {
  const { vs, ls } = profile(-10, 10, -3, 3);
  const full = profileScore(vs, ls, 'full'), win = profileScore(vs, ls, 'window');
  assert.ok(win > 1.8 * full, `full ${full.toFixed(3)} window ${win.toFixed(3)}`);
});

test('zebra score: plain road and a shadow edge stay low; a row no longer than a window scores as before', () => {
  const plain = profile(-10, 10, 99, 99), shadow = profile(-10, 10, 99, 99, v => (v > 0 ? -70 : 0));
  assert.ok(profileScore(plain.vs, plain.ls, 'window') < 0.03, 'plain');
  assert.ok(profileScore(shadow.vs, shadow.ls, 'window') < 0.07, `shadow ${profileScore(shadow.vs, shadow.ls, 'window')}`);
  const short = profile(-WINDOW_MIN_ROW_M / 2, WINDOW_MIN_ROW_M / 2, -2, 2);
  assert.equal(profileScore(short.vs, short.ls, 'window'), pitchScore(short.vs, short.ls));
});

test('zebra score along the road: the best offset is where the stripes are', () => {
  // Stripes across x (the row along x), painted at y ∈ [2, 5]: r = +y, found near u = 3.5.
  const rgb = (x: number, y: number) => { const w = y >= 2 && y <= 5 && x >= -3 && x <= 3 && ((x + 10) % 1) < 0.5; return w ? [210, 210, 210] : [100, 100, 100]; };
  const s = scoreZebra({ centre: [0, 0], r: [0, 1], from: -8, to: 8 }, rgb, { searchM: 6, mode: 'window' });
  assert.ok(s.best > 0.2 && Math.abs(s.bu - 3.5) <= 1, `best ${s.best} at ${s.bu}`);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {arcGlyphPlacements} from './arcLettering';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('glyphs stand on the circle, spaced by the advance along the arc, centred on the bearing', () => {
  const p = arcGlyphPlacements('ABC', {centre: [2, 3], radius: 5, centreAngle: 0.4, advance: 0.5});
  assert.equal(p.length, 3);
  for (const g of p) assert.ok(close(Math.hypot(g.at[0] - 2, g.at[1] - 3), 5));
  assert.ok(close(p[1].angle, 0.4));
  assert.ok(close((p[0].angle - p[1].angle) * 5, 0.5) && close((p[1].angle - p[2].angle) * 5, 0.5));
});

test('the run reads left to right from outside: each next glyph lies along the previous glyph tangent', () => {
  const p = arcGlyphPlacements('SARPHATI', {centre: [0, 0], radius: 7, centreAngle: -0.2, advance: 0.45});
  for (let i = 1; i < p.length; i++) {
    const d: [number, number] = [p[i].at[0] - p[i - 1].at[0], p[i].at[1] - p[i - 1].at[1]];
    assert.ok(d[0] * p[i - 1].tangent[0] + d[1] * p[i - 1].tangent[1] > 0);
  }
  // outward normal and tangent are unit and perpendicular; the reader's right is tangent = n turned clockwise in (x, z)
  for (const g of p) {
    assert.ok(close(Math.hypot(...g.n), 1) && close(Math.hypot(...g.tangent), 1));
    assert.ok(close(g.n[0] * g.tangent[0] + g.n[1] * g.tangent[1], 0));
    assert.ok(close(g.n[0] * g.tangent[1] - g.n[1] * g.tangent[0], -1));
  }
});

test('a straight-line limit: on a huge radius the run matches a flat run of the same advance', () => {
  const p = arcGlyphPlacements('ABCDE', {centre: [0, -1e6], radius: 1e6, centreAngle: Math.PI / 2, advance: 0.6});
  // outward is +z (south); a reader south of the face looks north, so left to right runs from -x (west) to +x (east)
  assert.ok(Math.abs(p[0].at[0] + 1.2) < 1e-4 && Math.abs(p[4].at[0] - 1.2) < 1e-4);
  assert.ok(Math.abs(p[2].tangent[0] - 1) < 1e-9);
});

test('rejects a non-positive radius', () => {
  assert.throws(() => arcGlyphPlacements('A', {centre: [0, 0], radius: 0, centreAngle: 0, advance: 1}));
});

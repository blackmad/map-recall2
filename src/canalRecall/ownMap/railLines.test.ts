// Lane R3-C (#232): the overview's rail lines with contrast and a screen floor (style.ts RAIL_LINE_STYLE).
// node --import tsx --test src/canalRecall/ownMap/railLines.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_LINE_PX, overviewRailFlag, RAIL_LINE_STYLE, RAIL_STYLE, railLinePx } from './style.ts';
import { RAIL_STRIPE, RAIL_TONES } from '../ownGround/railTracks.ts';

const luma = (hex: string) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const hex = (c: readonly number[]) => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
// The overview's land in the clean theme is the ground palette's beige (~#e9e0d0 at luma ~225).
const LAND_LUMA = 220;

test('heavy rail: core at the style width, halo 1.6x, floors 1.25 px and 2 px at every zoom', () => {
  for (const z of [10, 12, 14, 14.8, 16, 16.7, 18, 20]) {
    const w = railLinePx('rail', z, false);
    assert.equal(w.minCore, 1.25);
    assert.equal(w.minHalo, 2);
    assert.ok(Math.abs((w.halo ?? 0) - w.core * 1.6) < 1e-9);
    assert.ok(Math.max(w.core, w.minCore) >= 1.25, `z${z}`);
    assert.ok(Math.max(w.core, w.minCore) >= MIN_LINE_PX);
  }
  // At z16 the style's 1.8 px still rules above the floor.
  assert.equal(railLinePx('rail', 16, false).core, 1.8);
});

test('service track a step thinner, still above a pixel; trams and metro narrower; trams without a ballast halo', () => {
  assert.equal(railLinePx('rail', 16, true).minCore, 1);
  assert.ok(railLinePx('subway', 16, false).minCore < railLinePx('rail', 16, false).minCore);
  const tram = railLinePx('tram', 16, false);
  assert.equal(tram.halo, null);
  assert.equal(tram.minHalo, null);
  assert.ok(tram.minCore < 1);
});

test('the tones are the far ring band (no seam at the ring edge) and contrast with the land', () => {
  assert.equal(RAIL_LINE_STYLE.halo, hex(RAIL_TONES.ballast));
  assert.equal(RAIL_LINE_STYLE.core, hex(RAIL_STRIPE.tone));
  // The old #a9a6a2 sat ~60 luma under the land; the core sits > 150 under it, > 50 under its halo.
  assert.ok(LAND_LUMA - luma(RAIL_STYLE.rail.fill) < 70);
  assert.ok(LAND_LUMA - luma(RAIL_LINE_STYLE.core) > 150);
  assert.ok(luma(RAIL_LINE_STYLE.halo) - luma(RAIL_LINE_STYLE.core) > 50);
});

test('?overviewRail=0 restores the old lines', () => {
  assert.equal(overviewRailFlag(''), true);
  assert.equal(overviewRailFlag('?overviewRail=0'), false);
  assert.equal(overviewRailFlag('?a=1&overviewRail=0&b'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { canSkipWalk, outsideSlack, viewMove } from './viewSlack.js';
import { withinView, type LngLatBounds } from './worldStreamer.js';

// A skip never decides differently from the walk: whenever canSkipWalk allows it, every model withinView rejected at
// the old view is still rejected at the new one (random Amsterdam views, anchors, footprints and moves).
test('viewSlack: a model outside the view stays outside while the view moves less than half its slack', () => {
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let skips = 0, checked = 0;
  for (let k = 0; k < 2000; k++) {
    const lng = 4.8 + rnd() * 0.2, lat = 52.3 + rnd() * 0.1, w = rnd() * 0.02, h = rnd() * 0.01;
    const view: LngLatBounds = { west: lng - w, east: lng + w, south: lat - h, north: lat + h };
    const models = Array.from({ length: 40 }, () => ({ a: [lng + (rnd() - 0.5) * 0.08, lat + (rnd() - 0.5) * 0.04] as [number, number], r: rnd() < 0.05 ? 400 * rnd() : 30 * rnd() }));
    const outside = models.filter(m => !withinView(view, m.a, m.r));
    for (const m of outside) assert.ok(outsideSlack(view, m.a, m.r) > 0, 'an outside model has a positive slack');
    for (const m of models.filter(m => withinView(view, m.a, m.r))) assert.ok(!(outsideSlack(view, m.a, m.r) > 0), 'an inside model has none');
    const min = Math.min(...outside.map(m => outsideSlack(view, m.a, m.r)));
    for (let j = 0; j < 5; j++) {
      const s = rnd() * min * (j < 3 ? 0.6 : 3), next: LngLatBounds = { west: view.west + (rnd() - 0.5) * 2 * s, east: view.east + (rnd() - 0.5) * 2 * s, south: view.south + (rnd() - 0.5) * 2 * s, north: view.north + (rnd() - 0.5) * 2 * s };
      if (!canSkipWalk(view, next, min)) continue;
      skips++;
      for (const m of outside) { checked++; assert.ok(!withinView(next, m.a, m.r), `view ${k}: a skipped walk would have found a model`); }
    }
  }
  assert.ok(skips > 1000 && checked > 10000, `${skips} skips, ${checked} models checked`);
});

test('viewSlack: no anchor is never in view; a missing view always walks', () => {
  const v = { west: 4.88, east: 4.89, south: 52.37, north: 52.375 };
  assert.equal(outsideSlack(v, null), Infinity);
  assert.equal(outsideSlack(v, [NaN, 52.37]), Infinity);
  assert.equal(viewMove(v, null), Infinity);
  assert.equal(canSkipWalk(null, v, 1), false);
  assert.equal(canSkipWalk(v, v, 0), false);
});

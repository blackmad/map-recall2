import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BASE_MAX_PIXELS, DEFAULT_MAX_WALL_HEIGHT_M, maxPixelsFor, wallHeight, WALL_EXTRA_M} from '../../../scripts/pand-reference/rectify.ts';

// GitHub #114: the crop height cap is configurable; the default keeps every archived crop as it was.
test('default cap: 32 m and the 1.8 Mpx budget, as every archived crop', () => {
  assert.equal(DEFAULT_MAX_WALL_HEIGHT_M, 32);
  assert.equal(wallHeight(12), 12 + WALL_EXTRA_M);
  assert.equal(wallHeight(2), 4 + WALL_EXTRA_M);
  assert.equal(wallHeight(58), 32);
  for (const h of [5, 20, 32]) assert.equal(maxPixelsFor(h), BASE_MAX_PIXELS);
});

test('a raised cap covers a 60 m tower at the ppm a 32 m wall of the same width gets', () => {
  assert.equal(wallHeight(58, 60), 59.5);
  assert.equal(wallHeight(70, 60), 60);
  // rectifyFacade: scale = sqrt(maxPixels / (width x height)) once the crop exceeds maxPixels at the requested ppm
  const scale = (w: number, h: number, ppm = 50) => Math.min(ppm, Math.sqrt(maxPixelsFor(h) / (w * h)));
  for (const w of [10, 22.5, 40, 80]) assert.ok(Math.abs(scale(w, 60) - scale(w, 32)) < 1e-9, `width ${w}`);
  // and a 60 m x 40 m wall still rectifies at a usable resolution (>= 3 px per 10 cm cell)
  assert.ok(scale(40, 60) >= 30);
});

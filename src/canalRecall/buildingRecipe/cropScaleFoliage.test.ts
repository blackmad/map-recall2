import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cropsOfWallsJson} from './cropToPanel.ts';
import {isLeaf} from './measureFacade.ts';
import {foliageFraction} from '../../../scripts/pand-reference/rectify.ts';

// Regression: Apollohal (pand 0363100012134507) w01-231, a 74.03 m wall rectified at a requested 50 px/m. rectifyFacade
// lowers the scale to stay under maxPixels (1.8 MP), so the crop is 3079 px wide = 41.6 px/m; the first archive recorded
// 50 and everything that trusted `ppm` mis-placed the long walls (vertical and horizontal misregistration).
test('cropsOfWallsJson: the scale is the crop width over the wall width, not the requested ppm', () => {
  const row = {tag: 'w01-231', crop: true, wallRD: {a: [0, 0], b: [74.03, 0], normal: [0, -1]}, ppm: 50, widthPx: 3079, heightPx: 1100, wallWidthM: 74.03, wallHeightM: 26.4};
  const [c] = cropsOfWallsJson({walls: [row]});
  assert.ok(Math.abs(c.ppm - 41.59) < 0.01, `ppm ${c.ppm}`);
  // a short wall at the full requested scale is unchanged
  const [s] = cropsOfWallsJson({walls: [{...row, tag: 'w05-321', widthPx: 525, wallWidthM: 10.5}]});
  assert.equal(s.ppm, 50);
});

// Regression: the texture lane measured 0.12 foliage on the Apollohal 2017-04 crop (w01-231), which is mostly spring
// tree; the old green-only test missed the pale yellow-green of new leaves. With the hue band it scores 0.45.
const SPRING: [number, number, number][] = [[178, 190, 96], [150, 165, 80], [200, 210, 140], [120, 150, 60], [160, 160, 90], [55, 70, 35], [96, 112, 54]];
const NOT_LEAF: [number, number, number][] = [[140, 70, 55], [117, 104, 80], [169, 148, 103], [100, 102, 104], [42, 58, 66], [190, 205, 225], [61, 52, 50], [180, 176, 165], [131, 112, 85], [85, 72, 54]];
test('isLeaf: spring yellow-green and summer green leaves; red, yellow and buff brick, grey, glass and sky are not', () => {
  for (const c of SPRING) assert.ok(isLeaf(...c), `leaf ${c}`);
  for (const c of NOT_LEAF) assert.ok(!isLeaf(...c), `not leaf ${c}`);
});

test('foliageFraction: a spring tree over 60 % of a brick wall reads about 0.6; the bare wall 0', () => {
  const W = 100, H = 80, img = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = x < 60 ? SPRING[(x + y) % SPRING.length] : [140, 70, 55];
    img.set([...c, 255], (y * W + x) * 4);
  }
  const f = foliageFraction(img, W, H);
  assert.ok(Math.abs(f - 0.6) < 0.03, `${f}`);
  for (let i = 0; i < W * H; i++) img.set([140, 70, 55, 255], i * 4);
  assert.equal(foliageFraction(img, W, H), 0);
});

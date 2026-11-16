import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandFit } from './sheetFit.ts';

// Round 22 named regression: Stadionweg 0363100012067736 (a 3.6 m block over a 12.4 m pitched row, its render 17 m tall
// in a 15.5 m band) drew its eaves 0.7 m low because the render was squeezed into the band.
test('sheet band: a render taller than the band is cropped, so its eaves stay on the series line', () => {
  const ppm = 40, band = Math.round(15.5 * ppm), eavesM = 12.4;
  // The render stands on the band's bottom at renderH px for topM m; the cut rows come off its top only.
  const eavesFromBottom = (topM: number) => eavesM * ppm * (bandFit(topM, ppm, band).renderH / (topM * ppm));
  const squeezed = (topM: number) => eavesM * ppm * (Math.min(band, Math.round(topM * ppm)) / (topM * ppm));
  for (const topM of [15, 17, 19.5]) {
    const f = bandFit(topM, ppm, band);
    assert.ok(f.h <= band && f.renderH - f.cropTop === f.h);
    // The render is not rescaled: a metre in it is ppm px, so the eaves sit eavesM * ppm over the band's bottom.
    assert.equal(f.renderH, Math.round(topM * ppm));
    assert.ok(Math.abs(eavesFromBottom(topM) / ppm - eavesM) < 0.05);
  }
  assert.ok(Math.abs(squeezed(17) / ppm - eavesM) > 0.5, 'the old squeeze drew the eaves 0.6 m low');
  assert.deepEqual(bandFit(15, ppm, band), { renderH: 600, cropTop: 0, h: 600 }, 'shorter than the band: as before');
  assert.deepEqual(bandFit(17, ppm, band), { renderH: 680, cropTop: 60, h: 620 });
});

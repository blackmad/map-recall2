import {test} from 'node:test';
import assert from 'node:assert/strict';
import {brickReading, drawnLuma, sameWarmMaterial, sunlitSeason, sunlitWallProposal, SUNLIT_WALL, type BrickReading} from './sunlitWall.ts';
import {hexToRgb, rgbToHsl} from '../look/palette.ts';

const pixels = (...cs: [number, number, number, number][]) => {
  const out: number[] = [];
  for (const [r, g, b, n] of cs) for (let i = 0; i < n; i++) out.push(r, g, b);
  return {rgb: out, n: out.length / 3};
};
const reading = (rgb: [number, number, number], luma: number): BrickReading => ({rgb, luma, share: 0.5});

test('brickReading: the median of the warm brick pixels; sky, leaves, white trim and glass are not brick', () => {
  const {rgb, n} = pixels([168, 149, 122, 50], [120, 170, 230, 30], [80, 140, 60, 10], [245, 245, 245, 5], [60, 70, 80, 5]);
  const r = brickReading(rgb, n)!;
  assert.deepEqual(r.rgb, [168, 149, 122]);
  assert.equal(r.share, 0.5);
  const sky = pixels([120, 170, 230, 95], [168, 149, 122, 5]);
  assert.equal(brickReading(sky.rgb, sky.n), null, `under ${SUNLIT_WALL.minShare} brick`);
});

test('sameWarmMaterial: a shaded and a sunlit reading of one brick match; another colour or a grey wall does not', () => {
  // Politiepost IJburg w01-221L in shade (#41322a measured) and w01-221 in sun (brick reading 105/81/67)
  assert.ok(sameWarmMaterial(hexToRgb('#41322a') as [number, number, number], [105, 81, 67]));
  assert.ok(!sameWarmMaterial(hexToRgb('#41322a') as [number, number, number], [168, 160, 150]), 'a pale grey render is not the brick');
  assert.ok(!sameWarmMaterial([92, 92, 96], [200, 200, 205]), 'a grey wall is never judged on chromaticity');
});

test('sunlitWallProposal (issue #73): a shade-read brick is drawn at its sunlit luma, hue kept, under the brick ceiling', () => {
  // Politiepost IJburg g0: measured #41322a from the overcast w01-221L (brick 52); the 2022-05-13 sunlit capture of the same wall reads 85.
  const p = sunlitWallProposal('#41322a', null, reading([64, 49, 41], 52), reading([105, 81, 67], 85));
  assert.ok(!('skip' in p));
  if ('skip' in p) return;
  assert.ok(Math.abs(p.drawnAfter - 85) <= 2, `drawn ${p.drawnAfter}`);
  assert.equal(p.drawnBefore, Math.round(drawnLuma('#41322a')));
  const h0 = rgbToHsl(hexToRgb('#41322a'))[0], h1 = rgbToHsl(hexToRgb(p.hex))[0];
  assert.ok(Math.abs(h0 - h1) < 3, `hue ${h0} -> ${h1}`);
  // a very bright sunlit reading stops at the city's brick lightness ceiling, never salmon or white
  const q = sunlitWallProposal('#5c3d33', null, reading([70, 50, 42], 53), reading([220, 140, 100], 183));
  assert.ok(!('skip' in q));
  if (!('skip' in q)) assert.ok(rgbToHsl(hexToRgb(q.hex))[2] <= SUNLIT_WALL.maxLightness + 0.01 && q.drawnAfter < 183);
});

test('sunlitWallProposal: leaves walls alone without shade evidence, of another material, grey or white', () => {
  const used = reading([64, 49, 41], 52);
  assert.match((sunlitWallProposal('#d0d0cc', null, used, reading([200, 200, 196], 200)) as {skip: string}).skip, /grey or white/);
  assert.match((sunlitWallProposal('#41322a', null, null, reading([105, 81, 67], 85)) as {skip: string}).skip, /no brick reading/);
  assert.match((sunlitWallProposal('#41322a', null, used, null) as {skip: string}).skip, /no sunlit/);
  assert.match((sunlitWallProposal('#41322a', null, used, reading([70, 55, 45], 60)) as {skip: string}).skip, /not in shade/);
  assert.match((sunlitWallProposal('#41322a', null, used, reading([150, 150, 120], 150)) as {skip: string}).skip, /another material/);
  assert.match((sunlitWallProposal('#8a6a58', null, reading([90, 70, 60], 70), reading([130, 100, 85], 104)) as {skip: string}).skip, /already drawn/);
});

test('sunlitSeason: May-September captures only (the SUNLIT_WHITE_LUMA calibration window)', () => {
  assert.ok(sunlitSeason('2018-05-08') && sunlitSeason('2021-06-16') && sunlitSeason('2022-09-02'));
  assert.ok(!sunlitSeason('2024-11-21') && !sunlitSeason('2024-12-20') && !sunlitSeason('2020-04-21') && !sunlitSeason(null));
});

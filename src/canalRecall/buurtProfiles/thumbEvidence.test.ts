import test from 'node:test';
import assert from 'node:assert/strict';
import { materialAgrees, shadowShare, thumbPainted, thumbVerdict, thumbView, THUMB_EVIDENCE } from './thumbEvidence.ts';

const crop = (pixels: [number, number, number][]) => Uint8Array.from(pixels.flat());

test('thumbView reads the pitch, heading and fov from a sample URL', () => {
  assert.deepEqual(thumbView('https://api.data.amsterdam.nl/panorama/thumbnail/recording_2025-06-17_10-48-55_00864/?width=320&aspect=1&fov=36&heading=214&pitch=39'), { fov: 36, heading: 214, pitch: 39 });
  assert.equal(thumbView('https://example/no-view'), null);
});

test('shadowShare counts dark colourless pixels among the measured ones (sky and leaves left out)', () => {
  const s = shadowShare(crop([[40, 42, 44], [40, 42, 44], [150, 80, 60], [150, 80, 60], [120, 160, 230], [60, 120, 40]]), 3);
  assert.equal(s.measured, 4);
  assert.equal(s.shadow, 0.5);
  assert.equal(shadowShare(crop([[150, 80, 60]]), 3).shadow, 0);
});

test('material agreement: render reads as paint, brick and buff as brick, no family agrees with either', () => {
  assert.equal(materialAgrees('render', true), true);
  assert.equal(materialAgrees('render', false), false);
  assert.equal(materialAgrees('brick', false), true);
  assert.equal(materialAgrees('buff', true), false);
  assert.equal(materialAgrees(null, true), true);
});

test('Haarlemmer Houttuinen 0363100012185423 (8.6 m, pitch 39, balcony shade read as a dark grey wall) is rejected', () => {
  // Sample: wall (78,83,83), sampler family render; derive called it brick (not light enough for paint). Shadow 0.60.
  const painted = thumbPainted([78, 83, 83], true);
  assert.equal(painted, false);
  const v = thumbVerdict({ distM: 8.6, pitch: 39, shadow: 0.6, agree: materialAgrees('render', painted) });
  assert.equal(v.pass, false);
  assert.deepEqual(v.reasons, ['shadow 60 % > 25 %', 'sampler family and derive material disagree']);
});

test('a coherent brick read passes; out-of-sampler views are not trusted', () => {
  assert.equal(thumbVerdict({ distM: 12, pitch: 30, shadow: 0.05, agree: true }).pass, true);
  assert.equal(thumbVerdict({ distM: 3, pitch: 30, shadow: 0.05, agree: true }).pass, false);
  assert.equal(thumbVerdict({ distM: 12, pitch: THUMB_EVIDENCE.maxPitchDeg + 1, shadow: 0.05, agree: true }).pass, false);
  assert.equal(thumbVerdict({ distM: 12, pitch: 30, shadow: THUMB_EVIDENCE.maxShadow + 0.01, agree: true }).pass, false);
});

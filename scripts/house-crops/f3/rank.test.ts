import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPick, rankedPick, pixelScore, type Tried } from './rank.ts';
import type { CropFlags } from '../flags.ts';

const ok: CropFlags = { foliage: 0.02, foliagePlain: 0.02, wbApplied: false, washedOut: 0.1, missing: 0.1, voidShare: 0.1, occluderShare: 0.05, obliquity: 12, cameraDistance: 14, rayBlocked: false, wallWidthM: 6, heightCover: 1, edgeDensity: 0.2, seamStep: 5, strip: false, maskedShare: 0.02, trunkShare: 0, vehicleShare: 0 };
const t = (year: number, over: Partial<CropFlags>, x: Partial<Tried> = {}): Tried => { const flags = { ...ok, ...over }; return { year, panoId: `p${year}`, date: `${year}-07-01`, usable: true, reasons: [], method: 'wall', obliquity: flags.obliquity, foliage: flags.foliage, flags, ...x }; };

test('the default pick is the first usable year even when a later one is cleaner', () => {
  const a = t(2023, { maskedShare: 0.2 }), b = t(2021, { maskedShare: 0 });
  assert.equal(defaultPick([a, b])?.year, 2023);
  assert.equal(rankedPick([a, b])?.year, 2021);
});
test('a trunk the foliage test misses lowers the score; leaf-off breaks ties', () => {
  assert.ok(pixelScore(t(2020, { maskedShare: 0.15, trunkShare: 0.15 })) < pixelScore(t(2020, {})));
  assert.ok(pixelScore(t(2020, {}, { leafOff: true })) > pixelScore(t(2020, {})));
});
test('a hard-flag failure never wins, a second bearing can', () => {
  const blocked = t(2024, { rayBlocked: true, maskedShare: 0 }); blocked.reasons = ['blocked'];
  const first = t(2022, { maskedShare: 0.3, foliage: 0.1 }), second = t(2022, { maskedShare: 0.01 }, { second: true });
  assert.equal(rankedPick([blocked, first, second])?.second, true);
  assert.equal(defaultPick([blocked, first, second])?.second, undefined);
});

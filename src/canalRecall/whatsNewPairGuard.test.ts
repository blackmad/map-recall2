import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changedShare, detectPanels, downsample, edgeDensity, engineChecks, meanDiff, pairMetrics, pixelChecks, splitPanels,
  MIN_TARGET_MEAN_DIFF, type Box, type RawImage,
} from './whatsNewPairGuard.ts';

const W = 200, H = 100;
function frame(fill: (x: number, y: number) => [number, number, number], w = W, h = H): RawImage {
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 3);
  return { width: w, height: h, channels: 3, data };
}
const ground: [number, number, number] = [200, 190, 170];
/** Ground with a row of "buildings" (a window grid) in the top half; `lot` box left empty. */
const street = (lot: Box | null, wall: [number, number, number] = [180, 90, 60]) => frame((x, y) => {
  const inLot = lot && x >= lot.x * W && x < (lot.x + lot.w) * W && y >= lot.y * H && y < (lot.y + lot.h) * H;
  if (y >= H / 2 || inLot) return ground;
  return x % 10 < 4 && y % 10 < 5 ? [20, 30, 40] : wall;
});
// The lot leaves the top rows built, as a real frame never has a column that is one flat colour top to bottom.
const target: Box = { x: 0.4, y: 0.1, w: 0.2, h: 0.4 };

test('identical frames: no difference, refused as too similar', () => {
  const a = street(null);
  assert.equal(meanDiff(a, a), 0);
  assert.equal(changedShare(a, a), 0);
  const m = pairMetrics(a, a, target);
  assert.deepEqual(pixelChecks(m).map(r => r.code), ['too-similar']);
});

test('a new building in the target box passes', () => {
  const before = street(target), after = street(null);
  const m = pairMetrics(before, after, target);
  assert.ok(m.targetMeanDiff > MIN_TARGET_MEAN_DIFF, `target diff ${m.targetMeanDiff}`);
  assert.equal(m.contextChanged, 0);
  assert.deepEqual(pixelChecks(m), []);
});

test('a before frame missing the surrounding buildings is refused', () => {
  const empty = frame(() => ground), after = street(null);
  const codes = pixelChecks(pairMetrics(empty, after, target)).map(r => r.code);
  assert.ok(codes.includes('missing-buildings'), codes.join());
  assert.ok(codes.includes('context-changed'), codes.join());
  const msg = pixelChecks(pairMetrics(empty, after, target)).find(r => r.code === 'missing-buildings')!.message;
  assert.match(msg, /before frame/);
});

test('a slight brick shade change is too small to see at gallery size', () => {
  const before = street(null, [180, 90, 60]), after = street(null, [172, 86, 57]);
  assert.deepEqual(pixelChecks(pairMetrics(before, after)).map(r => r.code), ['too-similar']);
  const recoloured = street(null, [70, 70, 75]);
  assert.deepEqual(pixelChecks(pairMetrics(before, recoloured)), []);
});

test('the whole-frame target skips the context checks', () => {
  const m = pairMetrics(street(null), street(null, [70, 70, 75]));
  assert.equal(m.contextChanged, null);
  assert.equal(m.edgeBefore, null);
});

test('edge density: flat ground has none, a window grid has some', () => {
  assert.equal(edgeDensity(frame(() => ground)), 0);
  assert.ok(edgeDensity(street(null), { x: 0, y: 0, w: 1, h: 0.5 }) > 0.1);
});

test('engine checks: unsettled frames and short building counts are refused', () => {
  const ok = { settled: true, pending: [], buildings: 400 };
  assert.deepEqual(engineChecks(ok, ok), []);
  assert.deepEqual(engineChecks({ settled: false, pending: ['facades'], buildings: 400 }, ok).map(r => r.code), ['not-settled']);
  assert.deepEqual(engineChecks({ ...ok, buildings: 120 }, ok).map(r => r.code), ['building-count']);
  assert.deepEqual(engineChecks({ ...ok, buildings: 399 }, ok), [], 'a landmark replacing one building is fine');
  assert.deepEqual(engineChecks({ ...ok, buildings: null }, ok), []);
});

test('downsample box-averages to the gallery width', () => {
  const checker = frame((x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]), 520, 260);
  const d = downsample(checker, 260);
  assert.equal(d.width, 260); assert.equal(d.height, 130);
  assert.ok(Math.abs(d.data[0] - 128) <= 1);
  assert.equal(downsample(checker, 1000), checker);
});

test('panels: equal split and gutter detection agree on a two-up sheet', () => {
  const a = street(null), b = street(target);
  const gutter = 6, sheet = frame((x, y) => {
    if (x < W) return [a.data[(y * W + x) * 3], a.data[(y * W + x) * 3 + 1], a.data[(y * W + x) * 3 + 2]];
    if (x < W + gutter) return [32, 32, 32];
    const bx = x - W - gutter;
    return [b.data[(y * W + bx) * 3], b.data[(y * W + bx) * 3 + 1], b.data[(y * W + bx) * 3 + 2]];
  }, 2 * W + gutter, H);
  for (const panels of [splitPanels(sheet, 2, gutter), detectPanels(sheet)]) {
    assert.equal(panels.length, 2);
    assert.equal(meanDiff(panels[0], a), 0);
    assert.equal(meanDiff(panels[1], b), 0);
  }
});

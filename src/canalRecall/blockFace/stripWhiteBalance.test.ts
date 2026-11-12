/**
 * White balance for the foliage masks (stripWhiteBalance.ts), on half-scale crops of real strips
 * (fixtures/strip-cast, 20 px/m):
 * - Haarlemmerstraat 46-96, 2024-11-21: the green cast reads white frames, trim and glass as leaves;
 * - Haarlemmerdijk 2-58, 2022-12-15: a warm neutral day, which must stay byte-identical;
 * - Brouwersgracht 2-20, 2024-12-03: a cast day with a real green bush in front of no. 4, which must stay foliage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';
import {balancedLeaf, measureWhiteBalance, stripWhiteBalances, NO_BALANCE, type LeafTest} from './stripWhiteBalance.ts';
import {isLeaf} from '../buildingRecipe/measureFacade.ts';
import {spanLikeness} from './stripLikeness.ts';
import {bodyShares} from './stripEvidence.ts';

const DIR = path.join(import.meta.dirname, 'fixtures', 'strip-cast');
async function load(file: string) {
  const {data, info} = await sharp(path.join(DIR, file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return {rgb: new Uint8Array(data), width: info.width, height: info.height};
}
function share(img: {rgb: Uint8Array; width: number}, leaf: LeafTest, x0: number, x1: number, y0: number, y1: number) {
  let n = 0, l = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * img.width + x) * 3; n++; if (leaf(img.rgb[i], img.rgb[i + 1], img.rgb[i + 2])) l++; }
  return l / n;
}

test('Haarlemmerstraat 46-96 (2024-11-21): the green cast is balanced and the body band stops reading as foliage', async () => {
  const img = await load('haarlemmer-46-96--2024-11-21.jpg');
  const wb = measureWhiteBalance(img.rgb, img.width, img.height, [[0, img.width]]);
  assert.ok(wb.applied, wb.reason);
  assert.ok(wb.gains[2] > 1 && wb.gains[1] < 1, `gains ${wb.gains}`);
  const y0 = Math.round(img.height * 0.3), y1 = Math.round(img.height * 0.8);
  const before = share(img, isLeaf, 0, img.width, y0, y1), after = share(img, balancedLeaf(wb), 0, img.width, y0, y1);
  assert.ok(before > 0.15, `cast strip reads ${before} foliage before`);
  assert.ok(after < 0.08, `and ${after} after`);
  // The body-band foliage share the evidence and placement gates read (AUTO_PLACE.maxFoliage 0.3).
  const plain = bodyShares(img.rgb, img.width, img.height, [0, img.width], 20, 10), bal = bodyShares(img.rgb, img.width, img.height, [0, img.width], 20, 10, balancedLeaf(wb));
  assert.ok(bal.foliage < plain.foliage / 2, `${plain.foliage} -> ${bal.foliage}`);
  assert.equal(bal.luma, plain.luma, 'luma and placeholder shares stay on the unbalanced strip');
  assert.equal(bal.placeholder, plain.placeholder);
});

test('Haarlemmerdijk 2-58 (2022-12-15): a warm white is no green cast; the foliage test is isLeaf itself', async () => {
  const img = await load('haarlemmerdijk-2-58--2022-12-15.jpg');
  const wb = measureWhiteBalance(img.rgb, img.width, img.height, [[0, img.width]]);
  assert.equal(wb.applied, false, wb.reason);
  assert.deepEqual(wb.gains, [1, 1, 1]);
  assert.equal(balancedLeaf(wb), isLeaf);
  assert.equal(balancedLeaf(null), isLeaf);
  assert.equal(balancedLeaf(NO_BALANCE), isLeaf);
});

test('Brouwersgracht 2-20 (2024-12-03): the cast trim goes, the real green bush stays foliage', async () => {
  const img = await load('brouwersgracht-2-20--2024-12-03.jpg');
  const wb = measureWhiteBalance(img.rgb, img.width, img.height, [[0, img.width]]);
  assert.ok(wb.applied, wb.reason);
  const leaf = balancedLeaf(wb);
  // the bush in front of Brouwersgracht 4 (pixels 88-125 x 290-385 of the crop)
  assert.ok(share(img, leaf, 88, 125, 290, 385) > 0.45, 'the bush stays foliage');
  // the stucco top storeys of no. 4 (rows 120-200) were cast trim
  assert.ok(share(img, leaf, 0, img.width, 120, 200) < share(img, isLeaf, 0, img.width, 120, 200) / 2);
});

test('stripWhiteBalances: one reference per panorama day; too few pixels gives no balance', () => {
  const W = 40, H = 30, rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, cast = x < 20, l = 60 + ((x * 7 + y * 13) % 140);
    rgb[i] = l; rgb[i + 1] = cast ? Math.min(249, l + 8) : Math.max(0, l - 12); rgb[i + 2] = Math.max(0, l - 25);
  }
  const wbs = stripWhiteBalances(rgb, W, H, [{px: [0, 10], date: 'a'}, {px: [20, 40], date: 'b'}, {px: [10, 20], date: 'a'}, {px: [0, 10], date: 'c'}]);
  assert.equal(wbs[0], wbs[2], 'spans of one day share the reference');
  assert.ok(wbs[0].applied, `day a (G over R): ${wbs[0].reason}`);
  assert.equal(wbs[1].applied, false, `day b (R 12 over G): ${wbs[1].reason}`);
  assert.equal(wbs[3].applied, false, 'day c: 300 pixels < minPixels');
  assert.equal(wbs[3].ref, null);
});

test('spanLikeness: the leaf test only changes the photo mask; absent = as before', async () => {
  const img = await load('haarlemmer-46-96--2024-11-21.jpg');
  const base = {photoRgb: img.rgb, modelRgb: img.rgb, width: img.width, height: img.height, px: [0, 110] as [number, number], eavesM: 12, pixelsPerMetre: 20};
  assert.deepEqual(spanLikeness({...base, leaf: isLeaf}), spanLikeness(base));
  const wb = measureWhiteBalance(img.rgb, img.width, img.height, [[0, img.width]]);
  assert.ok(spanLikeness({...base, leaf: balancedLeaf(wb)}).usable > spanLikeness(base).usable);
});

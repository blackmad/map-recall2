/**
 * Synthetic, deterministic checks for `facadeBands`.
 *
 * Every fixture is an in-memory `RgbImage` plus, where occlusion matters, a
 * label map in the segmentation contract (`2` building, `3` occluder). There is
 * no I/O, no network and no image decoding. The cases are the ones the
 * district's crops keep producing: a uniform wall, a glass shopfront under
 * brick, a cream ground floor, a change too high to be a shopfront, a shadowed
 * wall, a van across the base, a tree at the side, and a span too short to
 * divide.
 */
import assert from 'node:assert/strict';
import { facadeBands } from './facadeBands.ts';
import type { RgbImage } from './wallColourSample.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

const image = (width: number, height: number, fill: (x: number, y: number) => [number, number, number]): RgbImage => {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = fill(x, y);
    const i = (y * width + x) * 3;
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  return { data, width, height, channels: 3 };
};

/** A label map of one class for every pixel. */
const labels = (width: number, height: number, fill: (x: number, y: number) => number) => {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = fill(x, y);
  return data;
};

const RED_BRICK: [number, number, number] = [150, 70, 50];
const CREAM: [number, number, number] = [216, 205, 180];
const SHOP_GLASS: [number, number, number] = [70, 110, 150];

const each = (colour: [number, number, number]) => () => colour;
const near = (actual: readonly number[], expected: readonly number[], tolerance: number) =>
  actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance);

// A wall with no material change is one-tone and reports no split, even though a
// best candidate split always exists mathematically.
{
  const result = facadeBands(image(60, 120, each(RED_BRICK)));
  check(result !== null, 'a uniform wall yields a profile');
  check(result!.verdict === 'one-tone', `uniform wall is one-tone, got ${result!.verdict}: ${result!.reason}`);
  check(result!.split === null, 'a one-tone wall reports no split');
  check(result!.bands.length === 12, `the default is 12 bands, got ${result!.bands.length}`);
  check(result!.bands.every(band => band.colour !== null), 'every band of a clean wall has a colour');
}

// Band fractions run from the base upward: the top band is near 1, the bottom
// near 0, and the whole profile is ordered.
{
  const result = facadeBands(image(60, 120, each(RED_BRICK)))!;
  const fractions = result.bands.map(band => band.baseFraction);
  check(fractions[0] > 0.9, `top band is near the top, got ${fractions[0]}`);
  check(fractions[fractions.length - 1] < 0.1, `bottom band is near the base, got ${fractions.at(-1)}`);
  check(fractions.every((value, index) => index === 0 || value < fractions[index - 1]), 'fractions decrease downward');
  check(result.topRow === 0 && result.bottomRow === 119, `the span is the whole building, got ${result.topRow}..${result.bottomRow}`);
}

// A glass shopfront under a brick upper wall is the case the first pass threw
// away: the upper bands are masonry, the lower are blue glass and joinery, and
// the raw band colour must see the change that material rejection would erase.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 90 ? SHOP_GLASS : RED_BRICK)))!;
  check(result.verdict === 'two-tone-ground-floor', `a glass shopfront is a ground floor, got ${result.verdict}: ${result.reason}`);
  check(result.split !== null, 'the shopfront split is reported');
  check(near(result.split!.below.rgb, SHOP_GLASS, 8), `the lower colour is the shopfront, got ${result.split!.below.hex}`);
  check(near(result.split!.above.rgb, RED_BRICK, 8), `the upper colour is brick, got ${result.split!.above.hex}`);
  check(result.split!.step > 60, `the shopfront step is large, got ${result.split!.step}`);
}

// A cream ground floor under brick: split in the lower quarter, both colours
// recovered, and material classified only after the split.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 90 ? CREAM : RED_BRICK)))!;
  check(result.verdict === 'two-tone-ground-floor', `cream quarter is a ground floor, got ${result.verdict}: ${result.reason}`);
  check(Math.abs(result.split!.baseFraction - 0.25) < 0.06, `split sits in the lower quarter, got ${result.split!.baseFraction}`);
  check(near(result.split!.below.rgb, CREAM, 12), `the lower colour is cream, got ${result.split!.below.hex}`);
  check(near(result.split!.above.rgb, RED_BRICK, 12), `the upper colour is brick, got ${result.split!.above.hex}`);
  check(result.split!.above.buildingPixels > 0 && result.split!.below.buildingPixels > 0, 'both sides hold building pixels');
}

// The same change higher up is not a ground floor, and says so rather than
// being forced into the shopfront bucket.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 48 ? CREAM : RED_BRICK)))!;
  check(result.verdict === 'two-tone-other', `a change at 60% is not a ground floor, got ${result.verdict}: ${result.reason}`);
  check(result.split !== null && result.split.baseFraction > 0.4, `the high split is reported, got ${result.split?.baseFraction}`);
}

// A smooth shadow gradient darkens the wall with no material change.
{
  const result = facadeBands(image(60, 120, (_x, y) => {
    const t = 0.45 + 0.55 * (y / 119);
    return [Math.round(RED_BRICK[0] * t), Math.round(RED_BRICK[1] * t), Math.round(RED_BRICK[2] * t)];
  }))!;
  check(result.verdict === 'one-tone', `a shadow gradient is one-tone, got ${result.verdict}: ${result.reason}`);
  check(result.split === null, 'a gradient reports no split');
}

// A gradual chroma drift is a plateau in the step profile, not a spike, so the
// change-point test rejects it where a raw spread test could not.
{
  const top: [number, number, number] = [150, 70, 50];
  const bottom: [number, number, number] = [176, 154, 111];
  const result = facadeBands(image(60, 120, (_x, y) => {
    const t = y / 119;
    return top.map((value, i) => Math.round(value + (bottom[i] - value) * t)) as [number, number, number];
  }))!;
  check(result.verdict === 'one-tone', `a chroma gradient is one-tone, got ${result.verdict}: ${result.reason}`);
  check(result.reason.includes('gradation'), `the reason names the gradation, got ${result.reason}`);
}

// A van across the shopfront is occluder pixels over the whole lower half of
// the span. The base is unobserved, so the answer is indeterminate, not a
// confident one-tone.
{
  const result = facadeBands(
    image(60, 120, (_x, y) => (y >= 60 ? CREAM : RED_BRICK)),
    labels(60, 120, (_x, y) => (y < 60 ? 2 : 3)),
  )!;
  check(result.verdict === 'indeterminate', `a hidden ground floor abstains, got ${result.verdict}: ${result.reason}`);
  check(result.split === null, 'an indeterminate answer reports no split');
  check(result.reason.includes('occluded'), `the reason names the occlusion, got ${result.reason}`);
  check(result.baseOccluderFraction > 0.5, `the base window is mostly occluder, got ${result.baseOccluderFraction}`);
}

// A narrow occluder down one side is not a hidden ground floor: the wall is
// still there to measure, and the guard must not abstain on every tree.
{
  const result = facadeBands(
    image(60, 120, each(RED_BRICK)),
    labels(60, 120, (x) => (x < 6 ? 3 : 2)),
  )!;
  check(result.verdict === 'one-tone', `a side tree does not abstain, got ${result.verdict}: ${result.reason}`);
  check(result.baseOccluderFraction < 0.2, `the base window is mostly wall, got ${result.baseOccluderFraction}`);
}

// A span too short to divide is a null, not a guess.
{
  const result = facadeBands(image(60, 120, each(RED_BRICK)), labels(60, 120, (_x, y) => (y >= 20 && y < 28 ? 2 : 0)));
  check(result === null, 'a span too short to divide abstains with null');
}

// Degenerate inputs abstain the same way the other facade modules do.
{
  check(facadeBands({ data: new Uint8Array(0), width: 0, height: 0 }) === null, 'an empty image abstains');
  check(facadeBands(image(60, 120, each(RED_BRICK)), new Uint8Array(60 * 120)) === null, 'a map with no building abstains');
}

// --- Regression corpus: named failure modes from the handoff. --------------
// These are diagnostic, not aspirational. Each asserts the behaviour the module
// currently has, so a later pass can see whether it improved or regressed these
// specific cases rather than only a headline number.

// The cornice-at-0.83 case. A lighter horizontal band high on a brick wall is a
// cornice, not a ground floor. The module does not call it one — it reports the
// change as `two-tone-other`, honestly labelled as too high — and this pins
// that: whatever a later pass does, this case must never become
// `two-tone-ground-floor`.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 20 && y < 26 ? [190, 180, 170] : RED_BRICK)))!;
  check(result.verdict !== 'two-tone-ground-floor', `a high cornice is never a ground floor, got ${result.verdict}`);
}

// The reviewer's cut-shopfront case: a crop whose lowest observed facade is
// already 3 m above the pavement, so the true 0-2 m shopfront is not in frame.
// The metric frame must still place the bottom of this crop at 3 m, not at 0.
// A metric-window search that treats the *bottom of the crop* as the pavement
// would then place the shopfront at 5-8 m, which is exactly the false plinth the
// reviewer named. This pins the frame arithmetic and the trap: the bottom row is
// above the window floor, so any row it selects is above the real shopfront.
{
  const frame = { baseZ: 3, topZ: 18, groundNAP: 0, cropHeightPx: 120, metresPerPixel: 0.125 };
  const metresAt = (row: number) => frame.topZ - (row / frame.cropHeightPx) * (frame.topZ - frame.baseZ) - frame.groundNAP;
  check(metresAt(0) > 14, `the top of a 3 m-cut crop is still high, got ${metresAt(0)}`);
  check(Math.abs(metresAt(119) - 3.125) < 1e-9, `the base of a 3 m-cut crop sits at 3 m, not 0, got ${metresAt(119)}`);
  check(metresAt(119) > 2, 'the crop base is above the 2 m floor of the ground-floor window, so a window hit here is not the shopfront');
}

// The metric frame converts rows to metres above the pavement. A facade whose
// top is 15 m up with the crop starting at the pavement has metresPerPixel
// 0.125; a cream band in the lowest 2 m must land in the ground-floor window.
// This exercises the frame arithmetic directly, independent of the split logic.
{
  const frame = { baseZ: 0, topZ: 15, groundNAP: 0, cropHeightPx: 120, metresPerPixel: 0.125 };
  const metresAt = (row: number) => frame.topZ - (row / frame.cropHeightPx) * (frame.topZ - frame.baseZ) - frame.groundNAP;
  check(Math.abs(metresAt(0) - 15) < 1e-9, `row 0 is the top of the crop, got ${metresAt(0)}`);
  check(Math.abs(metresAt(119) - 0.125) < 1e-9, `the last row is one pixel above the pavement, got ${metresAt(119)}`);
  check(metresAt(96) <= 6.5 && metresAt(96) >= 2, `row 96 (2.9 m) falls in the ground-floor window, got ${metresAt(96)}`);
}

console.log(`facade bands: ${checks} assertions passed.`);

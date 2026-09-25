/**
 * Synthetic, deterministic checks for `facadeBands`.
 *
 * Every fixture is an in-memory `RgbImage`; there is no I/O, no network and no
 * image decoding. The cases are the ones the district's real crops keep
 * producing: a uniform wall, a shopfront colour under a brick upper wall, the
 * same change too high to be a shopfront, a shadowed wall with no material
 * change, a ground floor hidden behind a parked van, and a building span too
 * short to divide.
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

const RED_BRICK: [number, number, number] = [150, 70, 50];
const CREAM: [number, number, number] = [216, 205, 180];

const each = (colour: [number, number, number]) => () => colour;
const near = (actual: readonly number[], expected: readonly number[], tolerance: number) =>
  actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance);
const rows = (height: number, predicate: (y: number) => boolean) => {
  const mask = new Uint8Array(60 * height);
  for (let y = 0; y < height; y++) if (predicate(y)) for (let x = 0; x < 60; x++) mask[y * 60 + x] = 1;
  return mask;
};

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

// A cream ground floor under a brick upper wall is the two-tone case the module
// exists for: split in the lower quarter, both colours recovered.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 90 ? CREAM : RED_BRICK)))!;
  check(result.verdict === 'two-tone-ground-floor', `cream quarter is a ground floor, got ${result.verdict}: ${result.reason}`);
  check(result.split !== null, 'a two-tone wall reports its split');
  check(Math.abs(result.split!.baseFraction - 0.25) < 0.06, `split sits in the lower quarter, got ${result.split!.baseFraction}`);
  check(near(result.split!.below.rgb, CREAM, 12), `the lower colour is cream, got ${result.split!.below.hex}`);
  check(near(result.split!.above.rgb, RED_BRICK, 12), `the upper colour is brick, got ${result.split!.above.hex}`);
  check(result.split!.below.usablePixels > 0 && result.split!.above.usablePixels > 0, 'both sides hold usable pixels');
  check(result.split!.distance > 30, `the colours are genuinely apart, distance ${result.split!.distance}`);
}

// The same change higher up is not a ground floor, and says so rather than
// being forced into the shopfront bucket.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 48 ? CREAM : RED_BRICK)))!;
  check(result.verdict === 'two-tone-other', `a change at 60% is not a ground floor, got ${result.verdict}: ${result.reason}`);
  check(result.split !== null && result.split.baseFraction > 0.4, `the high split is reported as a fraction, got ${result.split?.baseFraction}`);
  check(result.split!.below.usablePixels > result.split!.above.usablePixels, 'the larger lower side is below');
}

// A smooth shadow gradient darkens the wall with no material change. The split
// distance it can produce must not be mistaken for a shopfront.
{
  const result = facadeBands(image(60, 120, (_x, y) => {
    const t = 0.45 + 0.55 * (y / 119);
    return [Math.round(RED_BRICK[0] * t), Math.round(RED_BRICK[1] * t), Math.round(RED_BRICK[2] * t)];
  }))!;
  check(result.verdict === 'one-tone', `a shadow gradient is one-tone, got ${result.verdict}: ${result.reason}`);
  check(result.split === null, 'a gradient reports no split');
}

// A gradual chroma drift clears the minimum distance yet is still not a
// material change: each side varies as much as the gap between the sides, so it
// is rejected as a gradation. This is the condition that keeps a weathered or
// refaced wall from being bisected by a made-up floor line.
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

// A van across the shopfront zeroes the whole lower half of the mask. The base
// is unobserved, so the answer is indeterminate, not a confident one-tone.
{
  const result = facadeBands(image(60, 120, (_x, y) => (y >= 60 ? CREAM : RED_BRICK)), rows(120, y => y < 60))!;
  check(result.verdict === 'indeterminate', `a hidden ground floor abstains, got ${result.verdict}: ${result.reason}`);
  check(result.split === null, 'an indeterminate answer reports no split');
  check(result.reason.includes('base'), `the reason names the hidden base, got ${result.reason}`);
}

// A span too short to divide is a null, not a guess.
{
  const result = facadeBands(image(60, 120, each(RED_BRICK)), rows(120, y => y >= 20 && y < 28));
  check(result === null, 'a span too short to divide abstains with null');
}

// Degenerate inputs abstain the same way the other facade modules do.
{
  check(facadeBands({ data: new Uint8Array(0), width: 0, height: 0 }) === null, 'an empty image abstains');
  check(facadeBands(image(60, 120, each(RED_BRICK)), new Uint8Array(60 * 120)) === null, 'an empty mask abstains');
}

console.log(`facade bands: ${checks} assertions passed.`);

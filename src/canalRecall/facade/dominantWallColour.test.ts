/**
 * Synthetic, deterministic checks for `dominantWallColour`.
 *
 * Every fixture is built in memory as an `RgbImage`; there is no I/O and no
 * network. The cases mirror the district's real crops: mostly brick with glass
 * and trim, a crop where the glass outnumbers the brick, a genuinely two-tone
 * facade, a lighting gradient, a caller-supplied mask, and crops with nothing to
 * measure.
 */
import assert from 'node:assert/strict';
import { dominantWallColour } from './dominantWallColour.ts';
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
const YELLOW_BRICK: [number, number, number] = [176, 154, 111];
const BLUE_GLASS: [number, number, number] = [60, 90, 150];
const WHITE_TRIM: [number, number, number] = [238, 238, 238];
const DARK_DOOR: [number, number, number] = [30, 30, 32];

// A typical crop: 60% red brick, 30% blue glass, 10% white trim. The brick must
// win, and the glass and trim must both show up in the rejection counts.
{
  const crop = image(100, 100, (_x, y) => (y < 60 ? RED_BRICK : y < 90 ? BLUE_GLASS : WHITE_TRIM));
  const result = dominantWallColour(crop);
  check(result !== null, 'mixed crop yields a colour');
  check(result!.family === 'brick', `brick facade reads as brick, got ${result!.family}`);
  check(result!.rgb[0] > result!.rgb[2], `brick stays warm, got ${result!.hex}`);
  check(result!.materialDistance < 60, `brick lands near the palette, distance ${result!.materialDistance}`);
  check(result!.rejected.blueGlass === 3000, `glass is rejected as blue, count ${result!.rejected.blueGlass}`);
  check(result!.rejected.trim === 1000, `trim is rejected as near-white, count ${result!.rejected.trim}`);
  check(result!.rejected.dark === 0, 'no pixel is rejected as dark');
  check(result!.pixels === 6000, `brick holds 6000 pixels, got ${result!.pixels}`);
  check(result!.fraction === 0.6, `brick is 60% of usable pixels, got ${result!.fraction}`);
  check(result!.reliable, `a clean brick majority is reliable, review ${result!.review}`);
}

// A dark neutral doorway is a third rejection category, counted separately.
{
  const crop = image(100, 100, (_x, y) => (y < 70 ? RED_BRICK : y < 90 ? DARK_DOOR : WHITE_TRIM));
  const result = dominantWallColour(crop);
  check(result !== null && result.family === 'brick', 'a doorway does not displace the brick');
  check(result!.rejected.dark === 2000, `doorway is rejected as dark, count ${result!.rejected.dark}`);
  check(result!.rejected.trim === 1000, 'the trim above the brick is still counted');
}

// The same crop with the blue occupying 55%: blue-dominant bins are glass or sky
// regardless of how much of the crop they hold, so the brick still wins.
{
  const crop = image(100, 100, (_x, y) => (y < 55 ? BLUE_GLASS : y < 90 ? RED_BRICK : WHITE_TRIM));
  const result = dominantWallColour(crop);
  check(result !== null, 'a glass-majority crop still yields a wall colour');
  check(result!.family === 'brick', `the surviving brick wins at 55% glass, got ${result!.family}`);
  check(result!.rgb[0] > result!.rgb[2], `the answer stays warm, got ${result!.hex}`);
  check(result!.rejected.blueGlass === 5500, `all glass is counted, got ${result!.rejected.blueGlass}`);
  check(result!.fraction === 0.35, `brick is 35% of usable pixels, got ${result!.fraction}`);
  check(result!.reliable, 'a clear surviving majority is still reliable');
}

// A genuinely two-tone facade, 45%/45% two masonry colours, 10% glass, comes back
// unreliable with the runner-up close behind rather than a confident guess.
{
  const crop = image(100, 100, (_x, y) => (y < 45 ? RED_BRICK : y < 90 ? YELLOW_BRICK : BLUE_GLASS));
  const result = dominantWallColour(crop);
  check(result !== null, 'a two-tone facade still yields a colour');
  check(!result!.reliable, 'a two-tone facade is flagged unreliable');
  check(result!.review.includes('runner-up-too-close'), `review names the close runner-up, got ${result!.review}`);
  check(result!.runnerUp !== null, 'the other masonry colour is reported as runner-up');
  check(result!.runnerUp!.fraction > 0.4, `runner-up is nearly as large, got ${result!.runnerUp!.fraction}`);
  check(result!.fraction > 0.4, `the winner is still a large share, got ${result!.fraction}`);
  check(result!.rejected.blueGlass === 1000, 'the small glass patch is still rejected');
}

// Lighting variation: one brick colour stretched across several neighbouring
// lightness bins by a gradient aggregates into one cluster and wins outright.
{
  const crop = image(100, 100, (x) => {
    const t = 0.85 + 0.45 * (x / 99);
    return [Math.round(150 * t), Math.round(70 * t), Math.round(50 * t)];
  });
  const result = dominantWallColour(crop);
  check(result !== null, 'a gradient brick wall yields a colour');
  check(result!.family === 'brick', `the gradient still reads as brick, got ${result!.family}`);
  check(result!.rgb[0] > result!.rgb[2], `the aggregated colour is warm, got ${result!.hex}`);
  check(result!.fraction === 1, `all gradient bins aggregate into one cluster, got ${result!.fraction}`);
  check(result!.rejected.blueGlass + result!.rejected.trim + result!.rejected.dark === 0, 'nothing is rejected');
  check(result!.reliable, 'a single material under a gradient is reliable');
}

// A mask excludes the right half (blue) entirely: it affects neither the
// histogram nor the reported fractions, which are taken over usable pixels only.
{
  const crop = image(40, 20, (x) => (x < 20 ? RED_BRICK : BLUE_GLASS));
  const mask = new Uint8Array(40 * 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) mask[y * 40 + x] = 1;
  const result = dominantWallColour(crop, mask);
  check(result !== null, 'a masked crop yields a colour');
  check(result!.usablePixels === 400, `only masked pixels enter, got ${result!.usablePixels}`);
  check(result!.pixels === 400, `the winner is all usable pixels, got ${result!.pixels}`);
  check(result!.fraction === 1, `fractions use the masked denominator, got ${result!.fraction}`);
  check(result!.rejected.blueGlass === 0, 'excluded glass is not in the rejection counts');
  check(result!.family === 'brick', 'the excluded glass does not change the answer');
}

// A wrong-length mask is ignored rather than throwing, and the whole crop is used.
{
  const crop = image(40, 20, () => RED_BRICK);
  const result = dominantWallColour(crop, new Uint8Array(3));
  check(result !== null && result.usablePixels === 800, `a stale mask is ignored, got ${result?.usablePixels}`);
}

// No usable pixels at all: an all-zero mask, a degenerate image, and a crop that
// is entirely non-masonry all abstain with null instead of guessing or throwing.
{
  check(dominantWallColour(image(20, 20, () => RED_BRICK), new Uint8Array(400)) === null, 'an empty mask abstains');
  check(dominantWallColour({ data: new Uint8Array(0), width: 0, height: 0 }) === null, 'an empty image abstains');
  check(dominantWallColour(image(20, 20, () => BLUE_GLASS)) === null, 'an all-glass crop abstains');
}

console.log(`dominant wall colour: ${checks} assertions passed.`);

import assert from 'node:assert/strict';
import { sampleWallColour, type RgbImage } from './wallColourSample.ts';

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
const WHITE_TRIM: [number, number, number] = [238, 238, 238];

// A red-brick wall with a white-framed window. The window is masked, and the
// near-white joinery is excluded, so the sample stays brick.
{
  const wall = image(100, 100, (x, y) => (x >= 30 && x < 70 && y >= 30 && y < 70 ? WHITE_TRIM : RED_BRICK));
  const sample = sampleWallColour(wall, [{ kind: 'window', bounds: [30, 30, 70, 70] }]);
  assert.ok(sample, 'a wall must sample');
  assert.equal(sample!.family, 'brick');
  assert.ok(sample!.rgb[0] > sample!.rgb[2], `expected a warm wall, got ${sample!.hex}`);
  assert.ok(sample!.materialDistance < 60, `brick should land near the palette, distance ${sample!.materialDistance}`);
}

// A whole-facade white "accent" is a model error: it cannot be masked (coverage
// 1.0) but it must not turn the wall white, because the near-white exclusion
// removes it.
{
  const wall = image(100, 100, () => RED_BRICK);
  const sample = sampleWallColour(wall, [
    { kind: 'material', region: 'upper-wall', bounds: [0, 0, 100, 100] },
    { kind: 'material', region: 'accent', bounds: [0, 0, 100, 100] },
  ]);
  assert.ok(sample, 'a wall must sample despite a whole-facade accent');
  assert.ok(sample!.rgb[0] > 120 && sample!.rgb[1] < 100, `accent must not whiten the wall, got ${sample!.hex}`);
  assert.equal(sample!.family, 'brick');
}

// A localized white band is a real accent and is masked out.
{
  const wall = image(100, 100, (_x, y) => (y >= 10 && y < 20 ? WHITE_TRIM : RED_BRICK));
  const sample = sampleWallColour(wall, [{ kind: 'material', region: 'band', bounds: [0, 10, 100, 20] }]);
  assert.ok(sample && sample.rgb[0] > 120 && sample.rgb[1] < 100, `localized band must be masked, got ${sample?.hex}`);
}

// The top and bottom margins are skipped: sky above and a dark shopfront below
// do not decide the upper-wall colour.
{
  const wall = image(100, 100, (_x, y) => (y < 10 ? [90, 140, 210] : y > 85 ? [25, 25, 25] : RED_BRICK));
  const sample = sampleWallColour(wall, []);
  assert.ok(sample && sample.family === 'brick', `sky/shopfront must not decide the wall, got ${sample?.hex}`);
}

// Everything masked -> abstain, never a guess.
{
  const wall = image(100, 100, () => RED_BRICK);
  assert.equal(sampleWallColour(wall, [{ kind: 'window', bounds: [0, 0, 100, 100] }]), null);
}

// A genuinely grey painted wall resolves to paint, not brick.
{
  const wall = image(100, 100, () => [128, 128, 128]);
  const sample = sampleWallColour(wall, []);
  assert.ok(sample && sample.family === 'paint', `neutral grey must read as paint, got ${sample?.family}`);
}

console.log('wall colour sample: masking, near-white exclusion, margins and abstention passed.');

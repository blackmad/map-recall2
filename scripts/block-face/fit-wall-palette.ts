/**
 * Fit a palette brick to the photo wall as the strip review measures it (blockFace/wallColour.ts, review.ts "wall:"
 * lines): given the authored brick, the model wall the review rendered from it and the photo wall on the same pixels,
 * return the brick whose render lands on the photo. The render is cityWallTint(brick) x a per-channel factor (brick
 * texture, the sheet's light); the factor is read off the current pair and inverted through cityWallTint
 * (look/palette.ts: L' = 0.12 + 0.9 L clamped to the city brick range, S clamped to 0.12-0.5, hue kept).
 *
 *   node --import tsx scripts/block-face/fit-wall-palette.ts <brick> <model> <photo>      e.g. #604e3d #715c48 #5f4937
 *
 * Why (Oud-West kit, #98): the type palettes are strip medians over brick and mortar, so the review passes them while
 * the sheet reads a dull grey-brown where the photo shows red-brown brick (Kinkerstraat 4-20: photo S 0.29, model 0.22).
 */
import {cityWallTint, hexToRgb, rgbToHex} from '../../src/canalRecall/look/palette.ts';
import {rgbToHsl} from '../../src/canalRecall/blockFace/wallColour.ts';

type RGB = [number, number, number];
function hslToRgb([h, s, l]: RGB): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255)) as RGB;
}
export function fitWallBrick(brick: string, model: string, photo: string): {brick: string; predicted: string} {
  const tint = hexToRgb(cityWallTint(brick)), m = hexToRgb(model), ph = hexToRgb(photo);
  const k = [0, 1, 2].map(i => m[i] / Math.max(1, tint[i]));
  const wantTint = [0, 1, 2].map(i => Math.min(255, ph[i] / k[i])) as RGB;
  const [h, s, l] = rgbToHsl(wantTint);
  // Invert cityWallTint: L' = 0.12 + 0.9 L; S and H pass (inside the clamps).
  let best = brick, err = Infinity;
  const l0 = Math.max(0.02, Math.min(0.98, (l - 0.12) / 0.9));
  for (let dl = -0.06; dl <= 0.06; dl += 0.002) for (let ds = -0.06; ds <= 0.06; ds += 0.005) {
    const cand = rgbToHex(hslToRgb([h, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l0 + dl))]));
    const t = hexToRgb(cityWallTint(cand)), e = [0, 1, 2].reduce((a, i) => a + (t[i] * k[i] - ph[i]) ** 2, 0);
    if (e < err) { err = e; best = cand; }
  }
  const t = hexToRgb(cityWallTint(best));
  return {brick: best, predicted: rgbToHex([0, 1, 2].map(i => Math.round(t[i] * k[i])) as RGB)};
}
if (process.argv[1]?.endsWith('fit-wall-palette.ts')) {
  const [brick, model, photo] = process.argv.slice(2);
  const r = fitWallBrick(brick, model, photo);
  console.log(`brick ${brick} (model ${model}, photo ${photo}) -> ${r.brick} (predicted model ${r.predicted})`);
}

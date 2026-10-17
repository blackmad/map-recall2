// node --import tsx --test src/canalRecall/look/brickTone.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brickAlbedo, combineBrickTones, cropLight, labHueChroma, labToRgb, measureBrickTone, otsu01, pixelKind, rgbToLab, type Rgb } from './brickTone.ts';

/** A synthetic crop: `rows` of [colour, share] stripes, 100 x 100 RGB. */
function crop(parts: [Rgb, number][]): Uint8Array {
  const px = new Uint8Array(100 * 100 * 3);
  let i = 0;
  for (const [c, share] of parts) for (let k = 0; k < Math.round(share * 10000); k++, i++) px.set(c, i * 3);
  return px;
}

test('pixel kinds: sky, leaves and burnt-out highlights are dropped, brick and stone kept', () => {
  assert.equal(pixelKind(158, 195, 237), 'sky');
  assert.equal(pixelKind(90, 130, 60), 'leaf');
  assert.equal(pixelKind(255, 255, 254), 'burnt');
  assert.equal(pixelKind(147, 119, 122), 'candidate');
  assert.equal(pixelKind(226, 214, 188), 'candidate');
});

test('otsu splits two clusters between them', () => {
  const t = otsu01([...Array(50).fill(0.1), ...Array(50).fill(0.6)]);
  assert.ok(t > 0.1 && t <= 0.6, String(t));
});

test('brick median ignores glass, stone bands, frames and sky (a whole-crop median would not)', () => {
  const brick: Rgb = [147, 119, 122], glass: Rgb = [38, 40, 42], stone: Rgb = [226, 219, 210], sky: Rgb = [160, 196, 236];
  const t = measureBrickTone(crop([[brick, 0.45], [glass, 0.2], [stone, 0.2], [sky, 0.15]]), 3)!;
  assert.deepEqual(t.brick, brick);
  assert.deepEqual(t.lightTrim, stone);
  assert.equal(t.counts.sky, 1500);
  assert.equal(t.counts.dark, 2000);
  assert.equal(t.counts.bright, 2000);
});

test('brick and joint: a lighter, greyer joint class is split off; a plain wall is not split', () => {
  const brick: Rgb = [150, 100, 85], mortar: Rgb = [140, 135, 128];
  const split = measureBrickTone(crop([[brick, 0.75], [mortar, 0.25]]), 3)!;
  assert.equal(split.split, true);
  assert.deepEqual(split.brick, brick);
  const plain = measureBrickTone(crop([[brick, 1]]), 3)!;
  assert.equal(plain.split, false);
  assert.deepEqual(plain.brick, brick);
});

test('Lab round trip', () => {
  for (const c of [[162, 133, 108], [147, 119, 122], [20, 30, 200]] as Rgb[]) {
    const back = labToRgb(rgbToLab(c));
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - c[i]) <= 1, `${c} -> ${back}`);
  }
});

test('combineBrickTones: one hazy crop does not drag the hue', () => {
  const rose: Rgb = [147, 119, 122], c = combineBrickTones([rose, [140, 115, 116], [150, 122, 124], [150, 140, 100]]);
  assert.ok(Math.abs(labHueChroma(c).hue - labHueChroma(rose).hue) < 10);
});

test('crop light: no trim, a clipped trim or a warm trim is sunlit; a neutral trim is diffuse', () => {
  assert.equal(cropLight({ lightTrim: null }), 'sunlit');
  assert.equal(cropLight({ lightTrim: [255, 246, 224] }), 'sunlit');
  assert.equal(cropLight({ lightTrim: [167, 162, 137] }), 'sunlit');
  assert.equal(cropLight({ lightTrim: [229, 219, 218] }), 'diffuse');
});

// Tropenmuseum (2026-10-17, scripts/landmarks/tropenmuseum-brick-tone.json): the fourth pass's #a2856c was the sunlit
// reading (Lab hue 67). Diffuse crops of four photographers read hue 2-27, the panorama fleet 58; pooled one vote per
// camera system and kept at #a2856c's L*, the albedo is a rose brown.
test('Tropenmuseum: the pooled diffuse albedo is rose brown, not the sunlit tan', () => {
  const trim = (rb: number): Rgb => [Math.round(200 * rb), 200, 200];
  const s = (system: string, brick: Rgb, rb = 1.04) => ({ system, tone: { brick, lightTrim: trim(rb) } });
  const samples = [
    s('panorama', [102, 88, 79], 1.07), s('panorama', [71, 59, 53]), s('panorama', [78, 68, 63], 1.05), s('panorama', [143, 124, 109], 1.13),
    s('c2011', [147, 119, 122], 1.05), s('c2011', [132, 108, 109], 1.05),
    s('c2014', [139, 113, 111], 1.07),
    s('c2020', [142, 126, 123], 1.05), s('c2020', [125, 113, 114], 1.03),
    s('c2024', [137, 128, 130], 1.01),
    { system: 'c2007', tone: { brick: [199, 152, 117] as Rgb, lightTrim: null } },
  ];
  const a = brickAlbedo(samples, '#a2856c')!;
  assert.deepEqual(a.sunlitOnly, ['c2007']);
  assert.equal(a.systems.find(x => x.system === 'panorama')!.crops, 3);
  const L = (hex: string) => rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)))[0];
  assert.ok(Math.abs(L(a.hex) - L('#a2856c')) < 0.6, 'keeps the calibrated lightness');
  assert.ok(a.hue > 10 && a.hue < 35, `hue ${a.hue}`);
  assert.ok(labHueChroma(a.rgb).hue < labHueChroma([162, 133, 108]).hue - 30, 'at least 30 deg rosier than #a2856c');
  assert.equal(brickAlbedo([{ system: 'x', tone: { brick: [1, 2, 3], lightTrim: null } }], '#808080'), null);
});

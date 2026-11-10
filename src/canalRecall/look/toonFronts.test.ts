import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHsl } from './palette';
import { TOON_WALLS, TOON_ACCENTS, TOON_PERIOD_WALLS, TOON_GROUND_PAINTS, toonFrontsActive } from './toonFronts';

test('inactive without the toon look', () => { assert.equal(toonFrontsActive(), false); });

test('every toon front hue is a brick red/orange, buff, cream, green, navy or neutral: no lavender, teal or lemon', () => {
  const all = [...TOON_WALLS, ...TOON_ACCENTS, ...TOON_GROUND_PAINTS, ...Object.values(TOON_PERIOD_WALLS).flat()];
  for (const hex of all) {
    const [h, s] = rgbToHsl(hexToRgb(hex));
    if (s < 0.1) continue;
    const ok = h <= 45 || h >= 345 || (h >= 100 && h <= 170 && s < 0.45) || (h >= 200 && h <= 235 && s < 0.5);
    assert.ok(ok, `${hex} hue ${Math.round(h)} sat ${s.toFixed(2)}`);
  }
});

test('brick reds dominate the wall set', () => {
  const brick = TOON_WALLS.filter(hex => { const [h, s] = rgbToHsl(hexToRgb(hex)); return s > 0.3 && (h < 25 || h > 345); });
  assert.ok(brick.length / TOON_WALLS.length >= 0.5);
});

// LOOK §Palette roof band check: no measured roof slot is drawn outside its luma band.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOF_SLOTS, ROOF_SLOT_TONES, hexToRgb, lumaOf } from './palette.ts';
import { roofSlotHex } from '../roofs/roofSlots.ts';

test('every roof slot base sits inside its own luma band', () => {
  for (const slot of ROOF_SLOTS) {
    const { hex, luma: [lo, hi] } = ROOF_SLOT_TONES[slot], y = lumaOf(hexToRgb(hex));
    assert.ok(lo < hi && y >= lo && y <= hi, `${slot} ${hex} luma ${y.toFixed(1)} outside ${lo}-${hi}`);
  }
});

test('a measured tint never leaves its slot band, whatever the photo says', () => {
  const extremes: Array<[number, number, number]> = [[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0], [0, 0, 255], [40, 60, 90], [220, 200, 160], [128, 128, 128]];
  for (const slot of ROOF_SLOTS) for (const rgb of [...extremes, null]) {
    const hex = roofSlotHex(slot, rgb), y = lumaOf(hexToRgb(hex)), [lo, hi] = ROOF_SLOT_TONES[slot].luma;
    assert.ok(y >= lo && y <= hi, `${slot} from ${rgb} -> ${hex} luma ${y.toFixed(1)} outside ${lo}-${hi}`);
  }
});

test('flat slots never borrow a wall colour band: they stay below brick-red saturation', () => {
  for (const slot of ['gravel', 'bitumen-dark', 'bitumen-light', 'white-membrane'] as const) {
    const [r, g, b] = hexToRgb(roofSlotHex(slot, [200, 90, 60]));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 80, `${slot} took on a brick hue`);
  }
});

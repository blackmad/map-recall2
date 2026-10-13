import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CARTO_LIGHT_PAPER, ROUND_PALETTE, contrastRatio, roundColor} from './roundPalette';

test('eight distinct round colours that read on CARTO light paper', () => {
  assert.equal(new Set(ROUND_PALETTE).size, 8);
  for (const colour of ROUND_PALETTE) {
    assert.ok(contrastRatio(colour, CARTO_LIGHT_PAPER) >= 3, `${colour} is too pale on the basemap`);
  }
});

test('round colours cycle past eight rounds', () => {
  assert.equal(roundColor(0), ROUND_PALETTE[0]);
  assert.equal(roundColor(9), ROUND_PALETTE[1]);
});

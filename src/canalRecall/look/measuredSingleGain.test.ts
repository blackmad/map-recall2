import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measuredSingleGainEnabled, resetMeasuredSingleGain } from './measuredSingleGain.ts';
import { cityMeasuredStoneTint, cityMeasuredWallTint, cityTint } from './palette.ts';

test('flag parsing: default off, query over env', () => {
  assert.equal(measuredSingleGainEnabled(null, null), false);
  assert.equal(measuredSingleGainEnabled('?measuredSingleGain=1', null), true);
  assert.equal(measuredSingleGainEnabled('?x=1', '1'), true);
  assert.equal(measuredSingleGainEnabled('?measuredSingleGain=0', '1'), false);
});

test('off: measured stone and brick keep the cell-mean divide (byte-identical); on: the hex itself', () => {
  delete process.env.MEASURED_SINGLE_GAIN; resetMeasuredSingleGain();
  assert.equal(cityMeasuredStoneTint('#958a78'), '#a79a86');
  const offBrick = cityMeasuredWallTint('#7e4a3e');
  assert.notEqual(offBrick, '#7e4a3e');
  const offGlass = cityTint('glass', '#2a2a2e', 'measured'), offSlate = cityTint('slate', '#3b4047', 'measured');
  process.env.MEASURED_SINGLE_GAIN = '1'; resetMeasuredSingleGain();
  try {
    assert.equal(cityMeasuredStoneTint('#958a78'), '#958a78');
    assert.equal(cityMeasuredWallTint('#7e4a3e'), '#7e4a3e');
    assert.equal(cityTint('stone', '#958a78', 'measured'), '#958a78');
    // Glass and roofs are not the flag's business.
    assert.equal(cityTint('glass', '#2a2a2e', 'measured'), offGlass);
    assert.equal(cityTint('slate', '#3b4047', 'measured'), offSlate);
  } finally { delete process.env.MEASURED_SINGLE_GAIN; resetMeasuredSingleGain(); }
});

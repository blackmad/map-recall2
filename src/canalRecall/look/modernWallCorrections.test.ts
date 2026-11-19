import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctionWalls, modernPandWall } from '../buurtProfiles/modernPandWalls.ts';

// Feedback 174f6f (2026-11-13, "way too dark for our color palette"): Spaarndammerdijk 1-11 (pand 0363100012095236)
// sampled its dark loggias into #2f201c; the correction table draws the red-brown pier brick instead.
test('a corrected per-pand wall wins over the measured row', () => {
  assert.deepEqual(modernPandWall('NL.IMBAG.Pand.0363100012095236'), { hex: '#6e4a42', painted: false });
  assert.deepEqual(modernPandWall('0363100012095236'), { hex: '#6e4a42', painted: false });
});

test('a correction row needs a valid wall code, a reason and a source', () => {
  assert.deepEqual(correctionWalls({ '0363100012095236': { wall: 'b6e4a42', why: 'w', source: 's' } }), { '0363100012095236': 'b6e4a42' });
  assert.throws(() => correctionWalls({ '0363100012095236': { wall: 'x123', why: 'w', source: 's' } }));
  assert.throws(() => correctionWalls({ '0363100012095236': { wall: 'b6e4a42', why: '', source: 's' } }));
});

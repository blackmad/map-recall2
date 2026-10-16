import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flatRoofFromFact} from './measuredRoof.ts';
import type {RoofFact} from '../roofs/roofSlots.ts';

const fact = (over: Partial<RoofFact>): RoofFact => ({slot: 'slate', rgb: [140, 140, 140], confidence: 1, solarShare: 0, terrace: false, furniture: [], ...over});

test('flatRoofFromFact: the city colour of a confident flat-roof reading; nothing for tiles, weak readings or no fact', () => {
  // Kinkerstraat 89-105 (pand 092013, roof-facts 14/8413/5384): the colour the city drew its roof in.
  assert.equal(flatRoofFromFact(fact({}))?.hex, '#87898d');
  assert.equal(flatRoofFromFact(fact({slot: 'white-membrane', rgb: [230, 230, 230], confidence: 0.6}))?.slot, 'white-membrane');
  assert.equal(flatRoofFromFact(fact({slot: 'pantile-red', rgb: [170, 80, 60]})), null);
  assert.equal(flatRoofFromFact(fact({confidence: 0.2})), null);
  assert.equal(flatRoofFromFact(null), null);
});

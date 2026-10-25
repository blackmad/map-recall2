import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flatRoofFromFact, pitchedFitsMaterial, pitchedRoofFromFact} from './measuredRoof.ts';
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

test('pitchedRoofFromFact (issue #73): slate, zinc and pantile readings; nothing for flat-roof slots, weak readings or no fact', () => {
  // Houthavenkade 26 (pand 247232, roof-facts 14/8413/5382): slate 107/115/115.
  assert.equal(pitchedRoofFromFact(fact({rgb: [107, 115, 115], confidence: 0.9}))?.hex, '#6e767a');
  assert.equal(pitchedRoofFromFact(fact({slot: 'pantile-red', rgb: [132, 107, 99], confidence: 0.8}))?.hex, '#906559');
  assert.equal(pitchedRoofFromFact(fact({slot: 'white-membrane', rgb: [230, 230, 230]})), null);
  assert.equal(pitchedRoofFromFact(fact({slot: 'gravel'})), null);
  assert.equal(pitchedRoofFromFact(fact({confidence: 0.2})), null);
  assert.equal(pitchedRoofFromFact(undefined), null);
});

test('pitchedFitsMaterial: a reading recolours a roof, it never turns slate into tile or copper into grey', () => {
  assert.ok(pitchedFitsMaterial('slate', 'slate') && pitchedFitsMaterial('slate', 'bitumen') && pitchedFitsMaterial('zinc', 'zinc') && pitchedFitsMaterial('slate', 'black-tile'));
  assert.ok(pitchedFitsMaterial('pantile-red', 'red-tile') && pitchedFitsMaterial('pantile-dark', 'black-tile'));
  assert.ok(!pitchedFitsMaterial('pantile-dark', 'bitumen') && !pitchedFitsMaterial('pantile-red', 'slate') && !pitchedFitsMaterial('slate', 'copper') && !pitchedFitsMaterial('slate', 'red-tile'));
});

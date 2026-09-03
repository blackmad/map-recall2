import assert from 'node:assert/strict';
import {
  CYCLE_TRACK_ANSWER_MULTIPLIER,
  hasSeparatedCycleTrack,
} from '../src/canalRecall/routing/cycleTrack.ts';

assert.equal(hasSeparatedCycleTrack({}), false);
assert.equal(hasSeparatedCycleTrack({ cycleway: 'lane' }), false, 'painted lanes are not separation');
assert.equal(hasSeparatedCycleTrack({ cycleway: 'shared_lane' }), false);
assert.equal(hasSeparatedCycleTrack({ cycleway: 'track' }), true);
assert.equal(hasSeparatedCycleTrack({ cycleway: 'separate' }), true);
assert.equal(hasSeparatedCycleTrack({ 'cycleway:left': 'track' }), true);
assert.equal(hasSeparatedCycleTrack({ 'cycleway:right': 'track' }), true);
assert.equal(hasSeparatedCycleTrack({ 'cycleway:both': 'track' }), true);
assert.equal(hasSeparatedCycleTrack({ 'cycleway:left': 'lane', 'cycleway:left:segregated': 'yes' }), true);
assert.equal(hasSeparatedCycleTrack({ 'cycleway:left': 'lane' }), false);
assert.ok(CYCLE_TRACK_ANSWER_MULTIPLIER > 1 && CYCLE_TRACK_ANSWER_MULTIPLIER < 1.15,
  'cycle-track bonus stays below the novelty cap');

console.log('cycle track: 11 checks passed');

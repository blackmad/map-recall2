/**
 * Lane H2e (#352): the two fixtures the judgement session named for the houseLine measure profile. Each is a dumped
 * likeness group (`likeness-replay.ts --dump`: the photo mosaic, its box and storey lines, the model's mask and colours)
 * replayed through the same code as the 448-group replay.
 *  - Hotel Arena walls[0] (pand 236788): five mullioned window columns per storey at a 3.8 m pitch. `core` thins the
 *    openings, the half-bay autocorrelation peak then sits 8 % off the half lag on a plateau, the fold read two bays
 *    as one (3 columns, a "square" window) and the replay failed a house whose photo reads tall windows at 3.7 m.
 *  - pand-070306 walls[5]: a glass canopy and bare trees on a wall that does not face the street; houseLine gives NO
 *    EVIDENCE, not a FAIL on columns the model does not draw.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {replayGroup} from '../../../scripts/building-recipes/likeness-replay.ts';
import {MEASURE_PROFILES} from './measureFacade.ts';

const load = (n: string) => ({meta: JSON.parse(fs.readFileSync(new URL(`./fixtures/houseline/${n}.json`, import.meta.url), 'utf8')), bin: zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/houseline/${n}.bin`, import.meta.url)))});
const run = (n: string, profile: keyof typeof MEASURE_PROFILES) => {
  const {meta, bin} = load(n);
  return replayGroup(meta, bin, {openingSplit: MEASURE_PROFILES[profile], houseLine: profile === 'houseLine'});
};

test('Hotel Arena walls[0]: houseLine reads the 3.7 m bay, not two bays as one square window', () => {
  const {photo, likeness: L} = run('hotel-arena-236788.g0', 'houseLine');
  assert.ok(L.photoGrid.pitchM! > 3.4 && L.photoGrid.pitchM! < 4.4, `pitch ${L.photoGrid.pitchM}`);
  assert.equal(L.photoGrid.window?.shape, 'tall');
  assert.ok(L.columns.windows!.photo! >= 5, `photo columns ${L.columns.windows!.photo}`);
  assert.equal(L.shape.pass, true);
  assert.notEqual(L.verdict, 'FAIL', L.reasons.join('; '));
  assert.ok(photo.wall.hex);
});
test('Hotel Arena walls[0]: installGate still reads it as it did (verdict WARN on mask IoU only)', () => {
  const {likeness: L} = run('hotel-arena-236788.g0', 'installGate');
  assert.equal(L.verdict, 'WARN');
});
test('pand-070306 walls[5]: a wall that does not face the street is NO EVIDENCE under houseLine, judged as before under installGate', () => {
  const hl = run('pand-070306.g5', 'houseLine').likeness;
  assert.equal(hl.verdict, 'NO EVIDENCE');
  assert.match(hl.reasons.join(';'), /does not face the street/);
  assert.equal(run('pand-070306.g5', 'installGate').likeness.verdict, 'WARN');
});

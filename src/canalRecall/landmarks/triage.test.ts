import test from 'node:test';
import assert from 'node:assert/strict';
import {LIKENESS} from '../buildingRecipe/likeness.ts';
import {cropAbstains, judgeWall, triageCandidate, wallFacesStreet, type TriageInput, type WallCrop, type WallInput} from './triage.ts';

const crop = (o: Partial<WallCrop> = {}): WallCrop => ({tag: 'w01-0', lengthM: 30, crop: true, capturedAt: '2022-05-01', cameraDistM: 15, obliquityDeg: 5, foliage: 0.05, washedOut: 0.05, missingFraction: 0, usable: 0.9, frontClass: 'punched', ...o});
const wall = (name: string, o: Partial<WallCrop> = {}, street: string | null = 'Teststraat', lengthM = 30): WallInput => ({wall: name, lengthM, street, crops: [crop({tag: `${name}-0`, lengthM, ...o})]});
const base = (walls: WallInput[], o: Partial<TriageInput> = {}): TriageInput => ({inTiles: true, covered: null, builtYear: 1990, heightM: 20, cropCapped: false, walls, ...o});

test('crop abstains on the likeness thresholds, no restated numbers', () => {
  assert.deepEqual(cropAbstains(crop(), 1990), []);
  assert.match(cropAbstains(crop({foliage: LIKENESS.maxFoliage + 0.01}), 1990).join(), /foliage/);
  assert.deepEqual(cropAbstains(crop({foliage: LIKENESS.maxFoliage}), 1990), []);
  assert.match(cropAbstains(crop({washedOut: LIKENESS.maxWashedOut + 0.01}), 1990).join(), /washed out/);
  assert.match(cropAbstains(crop({obliquityDeg: LIKENESS.maxObliquityDeg + 1}), 1990).join(), /obliquity/);
  assert.match(cropAbstains(crop({usable: LIKENESS.minUsable - 0.01}), 1990).join(), /usable/);
  assert.match(cropAbstains(crop({cameraDistM: LIKENESS.minCameraM - 1, lengthM: LIKENESS.wideWallM + 1}), 1990).join(), /camera/);
  assert.deepEqual(cropAbstains(crop({cameraDistM: LIKENESS.minCameraM - 1, lengthM: LIKENESS.wideWallM - 1}), 1990), []);
  assert.match(cropAbstains(crop({capturedAt: '2018-04-01'}), 2019).join(), /predates/);
  assert.deepEqual(cropAbstains(crop({crop: false}), 1990), ['no crop']);
});

test('judgeWall takes the straightest judgeable crop', () => {
  const w: WallInput = {wall: 'w01', lengthM: 30, street: 'A', crops: [crop({tag: 'a', obliquityDeg: 2, foliage: 0.6}), crop({tag: 'b', obliquityDeg: 20, frontClass: 'columns'})]};
  const e = judgeWall(w, 1990);
  assert.equal(e.judgeable, true); assert.equal(e.crop, 'b'); assert.equal(e.frontClass, 'columns');
  const doubt = judgeWall(wall('w02', {frontClass: 'curtain', curtainDoubt: ['not-wall does not read as glass']}), 1990);
  assert.equal(doubt.frontClass, null); assert.match(doubt.reasons.join(), /untrusted/);
});

test('identity verdicts come first', () => {
  assert.equal(triageCandidate(base([], {dropped: ['underground station']})).verdict, 'no-evidence');
  assert.equal(triageCandidate(base([], {inTiles: false})).verdict, 'not-in-tiles');
  assert.equal(triageCandidate(base([], {covered: 'nieuwe-achtergracht-100-253824'})).verdict, 'covered');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02')], {builtYear: 1885})).verdict, 'bespoke');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02')], {rijksmonument: true})).verdict, 'bespoke');
});

test('buildable needs two judgeable street walls in the kit classes', () => {
  const ok = triageCandidate(base([wall('w01'), wall('w02', {frontClass: 'ribbon'}), wall('w03', {crop: false}, null)]));
  assert.equal(ok.verdict, 'buildable', ok.reasons.join());
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {foliage: 0.5})])).verdict, 'no-evidence');
  // a long unjudgeable street wall draws blank: held
  assert.equal(triageCandidate(base([wall('w01'), wall('w02'), wall('w03', {crop: false})])).verdict, 'no-evidence');
  // a short one does not hold it
  assert.equal(triageCandidate(base([wall('w01'), wall('w02'), wall('w03', {crop: false}, 'B', LIKENESS.wideWallM - 1)])).verdict, 'buildable');
});

test('kit gaps: curtain on a wide street wall, the crop cap', () => {
  const c = triageCandidate(base([wall('w01'), wall('w02', {frontClass: 'curtain'})]));
  assert.equal(c.verdict, 'kit-gap'); assert.deepEqual(c.gaps, ['curtain']);
  assert.equal(triageCandidate(base([wall('w01'), wall('w02'), wall('w03', {frontClass: 'curtain'}, 'C', 9)])).verdict, 'buildable');
  const t = triageCandidate(base([wall('w01'), wall('w02')], {heightM: 45, cropCapped: true, cropTopM: 32}));
  assert.equal(t.verdict, 'kit-gap'); assert.deepEqual(t.gaps, ['tower']);
});

test('wallFacesStreet: in front within 30 m only', () => {
  const path: [number, number][] = [[-50, 10], [50, 10]];
  assert.equal(wallFacesStreet([0, 0], [0, 1], path), 10);
  assert.equal(wallFacesStreet([0, 0], [0, -1], path), null);
  assert.equal(wallFacesStreet([0, -40], [0, 1], path), null);
});

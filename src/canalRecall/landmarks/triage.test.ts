import test from 'node:test';
import assert from 'node:assert/strict';
import {LIKENESS} from '../buildingRecipe/likeness.ts';
import {cropAbstains, judgeWall, OPEN_DECK_GLAZING, PAINTED_WALL_M, TOWER_COVER, triageCandidate, wallFacesStreet, type TriageInput, type WallCrop, type WallInput} from './triage.ts';

const crop = (o: Partial<WallCrop> = {}): WallCrop => ({tag: 'w01-0', lengthM: 30, crop: true, capturedAt: '2022-05-01', cameraDistM: 15, obliquityDeg: 5, foliage: 0.05, washedOut: 0.05, missingFraction: 0, usable: 0.9, frontClass: 'punched', basis: 'courses', glazing: 0.25, wallHeightM: 21.5, ...o});
const wall = (name: string, o: Partial<WallCrop> = {}, street: string | null = 'Teststraat', lengthM = 30): WallInput => ({wall: name, lengthM, street, crops: [crop({tag: `${name}-0`, lengthM, ...o})]});
const base = (walls: WallInput[], o: Partial<TriageInput> = {}): TriageInput => ({inTiles: true, covered: null, builtYear: 1990, heightM: 20, walls, ...o});

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

test('kit gaps: curtain on a wide street wall unless the crop shows floor bands', () => {
  const c = triageCandidate(base([wall('w01'), wall('w02', {frontClass: 'curtain'})]));
  assert.equal(c.verdict, 'kit-gap'); assert.deepEqual(c.gaps, ['curtain']);
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {frontClass: 'curtain', floorBands: false})])).verdict, 'kit-gap');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {frontClass: 'curtain', floorBands: true})])).verdict, 'buildable');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02'), wall('w03', {frontClass: 'curtain'}, 'C', 9)])).verdict, 'buildable');
});

test('tower: no judgeable street crop covers TOWER_COVER of the height', () => {
  const t = triageCandidate(base([wall('w01', {wallHeightM: 32}), wall('w02', {wallHeightM: 32})], {heightM: 45}));
  assert.equal(t.verdict, 'kit-gap'); assert.deepEqual(t.gaps, ['tower']);
  // a --max-height crop of one street wall reaching 80 % is evidence enough
  const tall = triageCandidate(base([wall('w01', {wallHeightM: 32}), wall('w02', {wallHeightM: 45 * TOWER_COVER})], {heightM: 45}));
  assert.equal(tall.verdict, 'buildable', tall.reasons.join());
  // the tall crop is the one judged on a wall that has both
  const w: WallInput = {wall: 'w01', lengthM: 30, street: 'A', crops: [crop({tag: 'w01-0', wallHeightM: 32, obliquityDeg: 1}), crop({tag: 'w01-0h70', wallHeightM: 46.5, obliquityDeg: 1})]};
  assert.equal(judgeWall(w, 1990).crop, 'w01-0h70');
  // an unjudgeable tall crop is no evidence
  const foggy = triageCandidate(base([wall('w01', {wallHeightM: 32}), {wall: 'w02', lengthM: 30, street: 'T', crops: [crop({tag: 'a', wallHeightM: 32}), crop({tag: 'b', wallHeightM: 46.5, foliage: 0.6})]}], {heightM: 45}));
  assert.deepEqual(foggy.gaps, ['tower']);
});

test('#119 painted-or-clad: the main front, or half the street wall, unresolved', () => {
  const u = {basis: 'unresolved', family: null};
  const p = triageCandidate(base([wall('w01', u, 'T', 40), wall('w02')]));
  assert.equal(p.verdict, 'kit-gap'); assert.deepEqual(p.gaps, ['painted-or-clad']);
  // half the judgeable street-wall length
  assert.deepEqual(triageCandidate(base([wall('w01', {}, 'T', 30), wall('w02', u, 'T', 15), wall('w03', u, 'T', 15)])).gaps, ['painted-or-clad']);
  // one shaded dark-brick wall of a brick building (Molenwerf 066028 w04): not decisive
  assert.equal(triageCandidate(base([wall('w01', {}, 'T', 33), wall('w02', {}, 'T', 32), wall('w03', u, 'T', 20)])).verdict, 'buildable');
  // the main front must be a wall of PAINTED_WALL_M or more
  assert.equal(triageCandidate(base([wall('w01', u, 'T', PAINTED_WALL_M - 1), wall('w02', u, 'T', PAINTED_WALL_M - 1)])).verdict, 'buildable');
  assert.equal(triageCandidate(base([wall('w01', {basis: 'colour', family: 'paint'}, 'T', 40), wall('w02')])).verdict, 'buildable');
  // an unjudgeable crop's basis is not evidence
  assert.equal(triageCandidate(base([wall('w01'), wall('w02'), wall('w03', {...u, foliage: 0.6}, 'T', 10)])).verdict, 'buildable');
});

test('#119 band: a ribbon over punched windows on another storey of the same crop', () => {
  const band = [{storey: 2, againstStorey: 1, ribbonM: 14}];
  const b = triageCandidate(base([wall('w01'), wall('w02', {bandStoreys: band})]));
  assert.equal(b.verdict, 'kit-gap'); assert.deepEqual(b.gaps, ['band']);
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {bandStoreys: []})])).verdict, 'buildable');
  // a ribbon storey on a grid-class wall: the kit draws windows under it
  assert.deepEqual(triageCandidate(base([wall('w01'), wall('w02', {ribbonStoreys: [2]})])).gaps, ['band']);
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {frontClass: 'ribbon', ribbonStoreys: [1, 2]})])).verdict, 'buildable');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02'), wall('w03', {bandStoreys: band}, 'T', LIKENESS.wideWallM - 1)])).verdict, 'buildable');
});

test('#119 open-deck: no glazing and no courses on a parking pand', () => {
  const deck = {glazing: OPEN_DECK_GLAZING - 0.01, basis: 'colour'};
  const d = triageCandidate(base([wall('w01'), wall('w02', deck)], {use: 'overige gebruiksfunctie'}));
  assert.equal(d.verdict, 'kit-gap'); assert.deepEqual(d.gaps, ['open-deck']);
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', deck)], {use: 'woonfunctie, overige gebruiksfunctie'})).verdict, 'buildable');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', deck)], {use: 'osm parking (parking)'})).verdict, 'kit-gap');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {...deck, basis: 'courses'})], {use: 'overige gebruiksfunctie'})).verdict, 'buildable');
  assert.equal(triageCandidate(base([wall('w01'), wall('w02', {...deck, glazing: OPEN_DECK_GLAZING})], {use: 'overige gebruiksfunctie'})).verdict, 'buildable');
});

test('wallFacesStreet: in front within 30 m only', () => {
  const path: [number, number][] = [[-50, 10], [50, 10]];
  assert.equal(wallFacesStreet([0, 0], [0, 1], path), 10);
  assert.equal(wallFacesStreet([0, 0], [0, -1], path), null);
  assert.equal(wallFacesStreet([0, -40], [0, 1], path), null);
});

test('#146 painted-or-clad with a measured tint: buildable with a note (the kit draws walls[].wallFamily)', () => {
  const paint = {basis: 'unresolved', family: null, wallFamily: 'paint' as const}, u = {basis: 'unresolved', family: null, wallFamily: null};
  const p = triageCandidate(base([wall('w01', paint, 'T', 40), wall('w02')]));
  assert.equal(p.verdict, 'buildable', p.reasons.join(' | '));
  assert.ok(p.reasons.some(r => /measured tint on w01 \(paint\)/.test(r)));
  assert.equal(triageCandidate(base([wall('w01', {...paint, wallFamily: 'metal'}, 'T', 40), wall('w02')])).verdict, 'buildable');
  // no tint measured (null): the gap stays
  assert.deepEqual(triageCandidate(base([wall('w01', u, 'T', 40), wall('w02')])).gaps, ['painted-or-clad']);
  // the share counts only the walls without a tint
  assert.equal(triageCandidate(base([wall('w01', {}, 'T', 30), wall('w02', paint, 'T', 15), wall('w03', u, 'T', 15)])).verdict, 'buildable');
  assert.deepEqual(triageCandidate(base([wall('w01', {}, 'T', 20), wall('w02', u, 'T', 15), wall('w03', u, 'T', 15)])).gaps, ['painted-or-clad']);
});

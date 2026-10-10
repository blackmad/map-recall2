/**
 * Named regressions: gable identification from block-face strips (blockFace/gableFromStrip.ts over facade/gable.ts +
 * facade/gableFit.ts). Profiles in fixtures/gable-profiles.json were measured from the rectified strips (strip sha256
 * recorded) so the test needs no image:
 *  - Marnixstraat 124-138 (174914) and marnix-c (169033): small stepped crown on part of the front. gable.ts alone says
 *    `unknown` (its plateau rule wants runs wider than 8 % of the plot); the stepped-outline refinement reads trapgevel;
 *  - Utrechtsestraat 178875 front b: a tall stepped gable with five steps per side (the intent authors three);
 *  - Oudezijds Achterburgwal 177943a: bell gable; 177916: neck gable (one shoulder level per side, most of the front);
 *  - Oudezijds Achterburgwal 177924: a cornice front with a statue on top is NOT a gable;
 *  - Utrechtsestraat 178876: plain cornice;
 *  - Bilderdijkstraat 161259: a stepped gable seen against its pitched roof; the skyline is the ridge 2.3 m above the
 *    compiled eaves, so the photo abstains (it read a "point" and would have replaced a correct authored step gable).
 *   node --import tsx --test src/canalRecall/blockFace/gableFromStrip.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import type {GableProfileSample} from '../facade/gableFit.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, planFaceGround, type StripScale} from './compile.ts';
import {applyPhotoCrowns, facePhotoPatches, photoCrownPatch, readPhotoGable, stripSkyline, spanProfile, withModelEaves, type PhotoGable} from './gableFromStrip.ts';

const fixtures: {face: string; pand: string; front: string; modelEavesUp: number; profile: GableProfileSample[]}[] = JSON.parse(fs.readFileSync('src/canalRecall/blockFace/fixtures/gable-profiles.json', 'utf8')).profiles;
const read = (pand: string, front = 'front0') => { const f = fixtures.find(x => x.pand.endsWith(pand) && x.front === front)!; return readPhotoGable(f.profile); };

test('Marnixstraat 124-138: small stepped crown on the centre bay reads as a step gable, 2-4 steps, ~3.3 m', () => {
  for (const pand of ['174914', '169033']) {
    const g = read(pand);
    assert.deepEqual(g.abstain, [], pand);
    assert.equal(g.crown.type, 'trapgevel', `${pand}: ${g.crown.reason}`);
    assert.equal(g.intentGable, 'step');
    assert.ok(g.shape.stepsLeft >= 2 && g.shape.stepsLeft <= 4 && g.shape.stepsRight >= 2 && g.shape.stepsRight <= 4, `${pand} steps ${g.shape.stepsLeft}/${g.shape.stepsRight}`);
    assert.ok(g.shape.riseM > 3 && g.shape.riseM < 3.8, `${pand} rise ${g.shape.riseM}`);
    assert.ok(g.shape.span && g.shape.span.to - g.shape.span.from < 0.35, 'a crown on part of the front');
    assert.ok(g.shape.symmetry > 0.9);
  }
});

test('Utrechtsestraat 178875 b: tall stepped gable, five steps per side', () => {
  const g = read('178875', 'b');
  assert.equal(g.crown.type, 'trapgevel');
  assert.equal(g.shape.stepsLeft, 5);
  assert.equal(g.shape.stepsRight, 5);
});

test('Oudezijds Achterburgwal: 177943a bell gable, 177916 neck gable', () => {
  const bell = read('177943', 'a');
  assert.equal(bell.crown.type, 'klokgevel', bell.crown.reason);
  assert.ok(bell.crown.confidence >= 0.9);
  const neck = read('177916');
  assert.equal(neck.crown.type, 'halsgevel', neck.crown.reason);
  assert.equal(neck.intentGable, 'neck');
});

test('cornice fronts: a statue on a cornice is not a gable; a plain cornice is a cornice', () => {
  const statue = read('177924');
  assert.equal(statue.crown.type, 'lijstgevel', statue.crown.reason);
  assert.match(statue.crown.reason, /ornament/);
  const plain = read('178876');
  assert.equal(plain.crown.type, 'lijstgevel');
  assert.equal(plain.shape.span, null);
});

test('Bilderdijkstraat 161259: a stepped gable in front of a pitched roof abstains (the skyline is the roof)', () => {
  const f = fixtures.find(x => x.pand.endsWith('161259'))!;
  const raw = readPhotoGable(f.profile);
  assert.ok(raw.shape.eavesUp - f.modelEavesUp > 2, `skyline ${raw.shape.eavesUp} vs compiled eaves ${f.modelEavesUp}`);
  const g = withModelEaves(raw, f.modelEavesUp);
  assert.match(g.abstain.join(), /roof shows above the cornice/);
  const front = {id: 'front0', street: 'x', gable: 'step', storeys: 4, bays: 3, doorBay: null, basement: 'none', cornice: 'none', windows: 'sash'} as any;
  assert.equal(photoCrownPatch('0363100012161259', front, g, {widthM: 5.7, upperStoreyM: 3, authoredSpan: null, modelEavesUp: f.modelEavesUp}), null);
  // Marnixstraat's parapet sits ~0.5 m over the compiled eaves: still within tolerance.
  const m = fixtures.find(x => x.pand.endsWith('174914'))!;
  assert.deepEqual(withModelEaves(readPhotoGable(m.profile), m.modelEavesUp).abstain, []);
});

test('stripSkyline: a stepped crown under a wire and a tree spike', () => {
  const w = 200, h = 160, ppm = 20, data = new Uint8Array(w * h * 3);
  const top = (x: number) => x < 60 || x >= 140 ? 100 : x < 75 || x >= 125 ? 80 : 60; // eaves row 100, steps at 80 and 60
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 3, wire = y === 40, spike = x === 30 && y > 20, building = y >= top(x);
    const c = building ? [120, 60, 45] : wire || spike ? [40, 40, 40] : [235, 238, 242];
    data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2];
  }
  const sky = stripSkyline({data, width: w, height: h, channels: 3}, 0, w, {pixelsPerMetre: ppm});
  assert.equal(sky[100], 60);
  assert.equal(sky[65], 80);
  assert.equal(sky[10], 100);
  assert.equal(sky[30], null, 'a one-pixel pole is a spike, not roofline');
  const g = readPhotoGable(spanProfile(sky, [0, w], h, ppm));
  assert.equal(g.shape.eavesUp, (h - 100) / ppm);
  assert.equal(g.shape.riseM, 2);
  assert.deepEqual([g.shape.stepsLeft, g.shape.stepsRight], [2, 2]);
});

const DIR = 'scripts/block-face/faces/marnix-124-138';
const face: BlockFaceIntent = validateBlockFace(JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8')));
const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${DIR}/pands/${h.pandId}/facts.json`, 'utf8'))]));
const s = JSON.parse(fs.readFileSync(`${DIR}/strip.json`, 'utf8')), strip: StripScale = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP};
const P = '0363100012174914';

test('crownFromPhoto patch: photo type/steps/rise; authored crownAt kept only when the photo span agrees', () => {
  const intent = houseIntents(face).find(i => i.pandId === P)!, front = intent.fronts[0], g = read('174914');
  // Authored compiled span close to the photo's (within 0.4 m each end): the authored placement stays.
  const patch = photoCrownPatch(P, front, g, {widthM: 13, upperStoreyM: 3, authoredSpan: {from: g.shape.span!.from + 0.02, to: g.shape.span!.to - 0.02}, modelEavesUp: g.shape.eavesUp})!;
  assert.equal(patch.set.gable, 'step');
  assert.equal(patch.set.crownSteps, Math.round((g.shape.stepsLeft + g.shape.stepsRight) / 2));
  assert.equal(patch.set.crownRise, Number((g.shape.riseM / 3).toFixed(2)));
  assert.deepEqual(patch.set.crownAt, front.crownAt, 'authored placement kept');
  const moved = photoCrownPatch(P, front, g, {widthM: 13, upperStoreyM: 3, authoredSpan: {from: 0.6, to: 0.9}})!;
  assert.deepEqual(moved.set.crownAt, {from: g.shape.span!.from, to: g.shape.span!.to});
  // An abstaining reading never patches.
  assert.equal(photoCrownPatch(P, front, {...g, abstain: ['occluded']}, {widthM: 13, upperStoreyM: 3, authoredSpan: null}), null);
  assert.equal(applyPhotoCrowns(houseIntents(face), []).length, face.houses.length);
});

test('validateBlockFace: crownFromPhoto names pands/fronts on the face and needs evidence', () => {
  assert.throws(() => validateBlockFace({...face, continuity: {...face.continuity, crownFromPhoto: [{pand: '0363100012999999', evidence: 'x'}]}}), /not on this face/);
  assert.throws(() => validateBlockFace({...face, continuity: {...face.continuity, crownFromPhoto: [{pand: P, front: 'zz', evidence: 'x'}]}}), /not a front/);
  assert.throws(() => validateBlockFace({...face, continuity: {...face.continuity, crownFromPhoto: [{pand: P, evidence: ''}]}}), /needs evidence/);
});

test('compileBlockFace with crownFromPhoto: the photo crown drives the compiled crown; abstaining fronts keep theirs', async () => {
  const g = read('174914'), readings = new Map<string, PhotoGable>([[`${P}/front0`, g]]);
  const withPhoto: BlockFaceIntent = {...face, continuity: {...face.continuity, crownFromPhoto: [{pand: P, evidence: 'strip: 2-4 short steps, not 5'}, {pand: face.houses[1].pandId, evidence: 'no reading: keeps authored'}]}};
  const ground = planFaceGround(withPhoto, face.houses.map(h => facts.get(h.pandId)!), undefined, strip);
  const {patches, kept} = facePhotoPatches(withPhoto.continuity.crownFromPhoto!, houseIntents(withPhoto), ground.facts, readings, strip.groundNAP);
  assert.equal(patches.length, 1);
  assert.equal(kept.length, 1);
  const result = await compileBlockFace(withPhoto, facts, 'face-marnix-photo-test', {strip, photoGables: readings, inferRears: false});
  assert.equal(result.photoCrowns!.patches[0].set.crownSteps, patches[0].set.crownSteps);
  const pand = result.perPand.find(p => p.pand === P)!;
  assert.ok(pand.triangles > 0);
  await assert.rejects(compileBlockFace(withPhoto, facts, 'x', {strip}), /needs photo gable readings/);
});

/**
 * House types (blockFace/houseType.ts): placement resolves to ordinary house designs; named regressions on
 * Nassaukade 318-300 (318|317 mirrored pair sharing a straddling dormer, 309/306 gable vs spire crowns of one body,
 * 304-301 visual party walls off the BAG lines) and De Clercqstraat (several modules and shops in one pand).
 *   node --import tsx --test src/canalRecall/blockFace/houseType.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {validateIntent, type FrontIntent} from '../buildingRecipe/intent.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {mirrorFront, resolvePlacement, type HouseTypeIntent} from './houseType.ts';

const load = (id: string): BlockFaceIntent => JSON.parse(fs.readFileSync(path.join('scripts/block-face/faces', id, 'intent.json'), 'utf8'));
const members = (id: string): string[] => JSON.parse(fs.readFileSync(path.join('scripts/block-face/faces', id, 'discovery.json'), 'utf8')).members;
const front = (face: BlockFaceIntent, pand: string): FrontIntent => houseIntents(face).find(i => i.pandId.endsWith(pand))!.fronts[0];

test('Nassaukade 318|317: one type, mirrored pair, door and straddling dormer flip to the shared party wall', () => {
  const face = validateBlockFace(load('nassau-162289'), members('nassau-162289'));
  const a = front(face, '165898'), b = front(face, '154241');
  assert.equal(a.doorBay, 2); assert.equal(b.doorBay, 0);
  assert.ok(a.dormerAt![0].to > 0.9 && b.dormerAt![0].from < 0.1, 'half dormers meet at the 318|317 party wall');
  assert.equal(a.souterrain, true);
  const {fronts: [fa]} = {fronts: [mirrorFront(b)]};
  assert.deepEqual({...fa, id: a.id}, a, 'mirroring the right half gives back the left half');
});

test('Nassaukade 309/306 gable vs 310/308 spire: same body, different crown variants', () => {
  const face = validateBlockFace(load('nassau-162289'));
  const spire = front(face, '156556'), gable = front(face, '166290'), mirroredGable = front(face, '156555');
  assert.equal(spire.dormerStyle, 'pointed'); assert.equal(spire.gable, 'cornice');
  assert.equal(gable.gable, 'bell'); assert.equal(gable.dormers, undefined);
  assert.equal(spire.bands, gable.bands); assert.deepEqual(spire.balconies, gable.balconies);
  assert.deepEqual(mirroredGable.crownAt, {from: +(1 - gable.crownAt!.to).toFixed(4), to: +(1 - gable.crownAt!.from).toFixed(4)});
  assert.match(houseIntents(face).find(i => i.pandId.endsWith('156555'))!.notes!.join(' '), /type deviations: archedStoreys/);
});

test('Nassaukade 304-301: visual party walls set the window grid, as seen (not mirrored)', () => {
  const face = validateBlockFace(load('nassau-162289'));
  assert.deepEqual(front(face, '162289').gridAt, {from: 0.118, to: 1.144});
  assert.deepEqual(front(face, '157568').gridAt, {from: 0.105, to: 1.115});
  assert.equal(front(face, '157568').doorBay, 0); assert.equal(front(face, '162289').doorBay, 1);
});

test('placement validation: pairs must pair, variants must exist, crown fields stay out of the body', () => {
  const face = load('nassau-162289');
  const bad = structuredClone(face);
  bad.houses[1].type!.mirror = false;
  assert.throws(() => validateBlockFace(bad), /exactly one of the two is mirrored/);
  const bad2 = structuredClone(face);
  bad2.houses[0].type!.crown = 'nope';
  assert.throws(() => validateBlockFace(bad2), /no crown variant "nope"/);
  const bad3 = structuredClone(face);
  (bad3.types![0].body as any).dormers = 1;
  assert.throws(() => validateBlockFace(bad3), /body.dormers: belongs in a crown/);
});

test('a type resolves to a valid canal-house intent; modules give one front per module with its own shop', () => {
  const t: HouseTypeIntent = {schemaVersion: 1, kind: 'house-type', id: 't', description: 'x', body: {storeys: 4, bays: 3, cornice: 'simple', windows: 'sash', balconies: {storeys: [1, 2, 3], bays: [1]}},
    crowns: {plain: {gable: 'cornice'}, tower: {gable: 'cornice', tower: {bays: {from: 1, to: 1}, rise: 1, cap: 'flat'}}}, palettes: {p: {brick: 'red-brown', frame: 'white', door: 'black'}}, roof: {material: 'slate'}, rhythm: {}, evidence: [{face: 'f', pands: ['1'], citation: 'c'}]};
  const shop = {shopfront: {colour: 'black', fascia: true, sign: {text: 'SHOP', textColour: 'white'}}};
  const r = resolvePlacement(t, {type: 't', modules: [{crown: 'plain', ground: shop, overrides: {balconies: undefined as any}}, {crown: 'tower', ground: shop, mirror: true}]}, 'De Clercqstraat');
  const intent = validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'x', pandId: '0363100012236262', address: 'a', sources: [{id: 's', kind: 'street-panorama', capturedAt: '2021-03-24'}], ...r.design});
  assert.equal(intent.fronts.length, 2); assert.deepEqual(intent.fronts.map(f => f.share), [0.5, 0.5]);
  assert.equal(intent.fronts[1].shopfront?.sign?.text, 'SHOP', 'per-house shops are written as seen, never mirrored');
  assert.ok(r.deviations.some(d => /module 0: balconies/.test(d)));
});

test('faces without types resolve exactly as before (no type fields leak into designs)', () => {
  const face = validateBlockFace(load('marnix-124-138'));
  for (const i of houseIntents(face)) for (const f of i.fronts) { assert.equal(f.gridAt, undefined); assert.equal(f.dormerAt, undefined); assert.equal(f.souterrain, undefined); }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeRecipeMid, gableCode, MID_LENGTH, recipeTileProblems, stableJson, validateRecipeTile, wallCode, type PandRecipe, type RecipeMid, type RecipeTile} from './schema.ts';
import {childrenAt, fromFrame, lngLatOfMercator, mercatorFromTile, mercatorOf, nearBlock, parentAt, tileFrame, tileOf, toFrame} from './tiles.ts';

const BILDER: [number, number] = [4.8712833, 52.3681674];
const mid = (): RecipeMid => [2, 5, 3, 142, 171, 1894, 1, 3, wallCode('brick'), gableCode('cornice'), 1];
const tile16 = tileOf(...BILDER, 16), tile14 = parentAt(tile16, 14);
const pand = (over: Partial<PandRecipe> = {}): PandRecipe => ({kind: 'canal-house', intent: 'face:bilder-081118-155417/0', mid: mid(), covers: ['NL.IMBAG.Pand.0363100012081118'], mesh: [tile16.x, tile16.y], ...over});
const tile = (pands: Record<string, PandRecipe>): RecipeTile => ({version: 1, z: 14, x: tile14.x, y: tile14.y, sources: {faces: 'abc'}, pands});

test('tile arithmetic: Bilderdijkstraat lies in z16 33654/21538 under z14 8413/5384', () => {
  assert.deepEqual(tile16, {z: 16, x: 33654, y: 21538});
  assert.deepEqual(tile14, {z: 14, x: 8413, y: 5384});
  assert.ok(childrenAt(tile14, 16).some(t => t.x === tile16.x && t.y === tile16.y));
  assert.equal(childrenAt(tile14, 16).length, 16);
  const [lng, lat] = lngLatOfMercator(...mercatorOf(...BILDER));
  assert.ok(Math.abs(lng - BILDER[0]) < 1e-9 && Math.abs(lat - BILDER[1]) < 1e-9);
});

test('tile frame: east is +x, south is +z, metres; the Mercator matrix is exact and round-trips', () => {
  const f = tileFrame(tile16);
  const [e, s] = toFrame(f, ...BILDER);
  assert.ok(Math.abs(e) < 200 && Math.abs(s) < 200, 'inside the tile');
  const back = fromFrame(f, e, s);
  assert.ok(Math.abs(back[0] - BILDER[0]) < 1e-10 && Math.abs(back[1] - BILDER[1]) < 1e-10);
  const [e2] = toFrame(f, BILDER[0] + 0.001, BILDER[1]);
  assert.ok(Math.abs(e2 - e - 0.001 * 111319.49 * Math.cos(f.anchor[1] * Math.PI / 180)) < 0.02);
  const [, s2] = toFrame(f, BILDER[0], BILDER[1] + 0.001);
  assert.ok(s2 < s, 'north is -z');
  const m = mercatorFromTile(f), merc = mercatorOf(...BILDER);
  // x' = m0 x + m4 y + m8 z + m12 (column-major), y up maps to Mercator z.
  assert.ok(Math.abs(m[0] * e + m[8] * s + m[12] - merc[0]) < 1e-15);
  assert.ok(Math.abs(m[1] * e + m[9] * s + m[13] - merc[1]) < 1e-15);
  assert.ok(Math.abs(m[6] * 10 - 10 * f.units) < 1e-18, 'height goes to Mercator z');
});

test('near block: 2x2 around the nearest tile corner, held by hysteresis on an edge', () => {
  const f = tileFrame(tile16);
  const tileM = 1 / 2 ** 16 / f.units, at = (e: number, s: number) => fromFrame(f, e * tileM, s * tileM);
  // Just inside the tile's south-east corner: the block is the four tiles around that corner.
  const b = nearBlock(...at(0.45, 0.45));
  assert.equal(b.tiles.length, 4);
  assert.deepEqual([b.x, b.y], [tile16.x, tile16.y]);
  assert.ok(b.tiles.some(t => t.x === tile16.x && t.y === tile16.y), 'contains the tile under the point');
  // Walk east by 0.6 tile: the block changes without hysteresis, holds with the previous one.
  const moved = nearBlock(...at(1.05, 0.45)), held = nearBlock(...at(1.05, 0.45), 16, b);
  assert.notDeepEqual([moved.x, moved.y], [b.x, b.y]);
  assert.deepEqual([held.x, held.y], [b.x, b.y]);
  const far = nearBlock(...at(1.45, 0.45), 16, b);
  assert.notDeepEqual([far.x, far.y], [b.x, b.y], 'beyond the band it moves');
});

test('schema: a valid tile passes; every rule fires on its own', () => {
  const ok = tile({'0363100012081118': pand(), '0363100012155417': pand({intent: undefined, sameAs: '0363100012081118', overrides: {fronts: []}, covers: ['NL.IMBAG.Pand.0363100012155417']})});
  assert.deepEqual(recipeTileProblems(ok), []);
  assert.doesNotThrow(() => validateRecipeTile(ok));
  const bad = (p: Partial<PandRecipe>, key = '0363100012081118') => recipeTileProblems(tile({[key]: pand(p)}));
  assert.match(bad({kind: 'house' as any}).join(), /kind house/);
  assert.match(bad({sameAs: '0363100012155417'}).join(), /exactly one of intent and sameAs/);
  assert.match(bad({intent: 'faces/bilder'}).join(), /not a reference/);
  assert.match(bad({intent: 'type:nw-x', kind: 'canal-house'}).join(), /cannot carry kind/);
  assert.match(bad({mid: [1, 2, 3] as any}).join(), new RegExp(`mid must be ${MID_LENGTH}`));
  assert.match(bad({covers: []}).join(), /covers itself/);
  assert.match(bad({mesh: [0, 0]}).join(), /inside this z14 tile/);
  assert.match(bad({}, 'NL.IMBAG.Pand.1').join(), /key must be/);
  assert.deepEqual(bad({kind: 'glb', intent: 'model:national-monument-on-the-dam', covers: ['w123']}, 'm:national-monument-on-the-dam'), []);
  assert.match(recipeTileProblems(tile({'0363100012081118': pand()}), {strict: true}).join(), /fitted missing/);
  assert.deepEqual(recipeTileProblems(tile({'0363100012081118': pand({fitted: {eavesM: 14.2}})}), {strict: true}), []);
  assert.match(recipeTileProblems(tile({'0363100012081118': pand({intent: undefined, sameAs: '0363100012155417'}), '0363100012155417': pand({intent: undefined, sameAs: '0363100012081118', covers: ['NL.IMBAG.Pand.0363100012155417']})})).join(), /one hop only/);
  assert.throws(() => validateRecipeTile({version: 2}), /invalid recipe tile/);
});

test('mid descriptor: the sidecar seven plus bays, wall, gable, shop; decodes back', () => {
  const d = decodeRecipeMid(mid());
  assert.equal(d.archetype, 'c19-terrace');
  assert.equal(d.eavesM, 14.2);
  assert.equal(d.wall, 'brick');
  assert.equal(d.gable, 'cornice');
  assert.equal(d.shop, true);
  assert.equal(decodeRecipeMid([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]).gable, null);
  assert.ok(JSON.stringify(mid()).length <= 40, 'about 40 bytes');
});

test('stable JSON sorts keys at every level', () => {
  assert.equal(stableJson({b: 1, a: {d: [2, {f: 1, e: 0}], c: 3}}), '{"a":{"c":3,"d":[2,{"e":0,"f":1}]},"b":1}');
});

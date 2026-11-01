/**
 * RoofIntent.rakeClear (2026-11-01, #152): a saddle pitched to a point gable's rake ran 3 cm plumb (2.1 cm square at
 * 45 degrees) under the crown wall's raking top face, a 0.5-0.8 m2 brick/roof-tile coplanar overlap per gable that the
 * GLB audit fails as zfight-tight (Retiefstraat 69C-73A, Pretoriusstraat 79-87, Paardekraalstraat 13-15,
 * Transvaalstraat 42-46). With the flag the roof stays RAKE_CLEAR_M under the rake, square to the slope; without it the
 * fit is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {RAKE_CLEAR_M, saddleUnderProfile} from './recipeRoof.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';

// Transvaalstraat 42 (071217): a 6.2 m front, cornice 13.4 m, point gable to 16.6 m (rake about 45.6 degrees).
const W = 6.2, E = 13.4, TOP = 16.6, point: [number, number][] = [[0, E], [W / 2, TOP], [W, E]];

test('rakeClear: absent keeps the 3 cm plumb margin, byte-identical', () => {
  const a = saddleUnderProfile(point, W, E)!, b = saddleUnderProfile(point, W, E, {})!;
  assert.deepEqual(a, b);
  assert.equal(a.ridgeM, +(TOP - 0.03).toFixed(3));
});

test('rakeClear: the saddle under a point gable keeps its pitch and drops to RAKE_CLEAR_M square to the rake', () => {
  const a = saddleUnderProfile(point, W, E)!, b = saddleUnderProfile(point, W, E, {clearM: RAKE_CLEAR_M})!;
  assert.equal(b.pitchDeg, a.pitchDeg, 'the pitch follows the rake either way');
  const tan = Math.tan(a.pitchDeg * Math.PI / 180), square = (m: number) => m / Math.sqrt(1 + tan * tan);
  // Plumb gap under the rake = TOP - ridge; square to the slope it is that times cos(pitch).
  assert.ok(square(TOP - a.ridgeM) < 0.03, `the old fit sits inside the 2-3 cm zfight-tight band (${square(TOP - a.ridgeM).toFixed(3)} m)`);
  assert.ok(square(TOP - b.ridgeM) >= RAKE_CLEAR_M - 0.001, `square gap ${square(TOP - b.ridgeM).toFixed(3)} m`);
  assert.ok(b.sideEavesM < a.sideEavesM && b.sideEavesM > E - 1, 'the side eaves drop a few cm, never past the 1 m limit');
});

test('rakeClear: a clearance already under the plumb margin changes nothing', () => {
  assert.deepEqual(saddleUnderProfile(point, W, E, {clearM: 0.01}), saddleUnderProfile(point, W, E));
});

test('rakeClear: the intent takes true or nothing', () => {
  const base = {schemaVersion: 1, kind: 'canal-house', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-01-02'}], id: 'rake-test', pandId: '0363100012071217', fronts: [{id: 'front0', street: 'Transvaalstraat', basement: 'none', cornice: 'simple', hoist: false, gable: 'point', storeys: 4, bays: 3, doorBay: 0, windows: 't-window'}], palette: {brick: '#6a4a3e', frame: 'white', door: '#3a2a24', stone: 'cream'}};
  assert.doesNotThrow(() => validateIntent({...base, roof: {material: 'red-tile', rakeClear: true}}));
  assert.throws(() => validateIntent({...base, roof: {material: 'red-tile', rakeClear: 1}}), /rakeClear/);
});

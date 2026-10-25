/**
 * Reviewer palette pins (reviewPalettes.ts): Eerste Helmersstraat 55's hazy greenish wall and 122's painted-black front.
 *   node --import tsx --test src/canalRecall/blockFace/reviewPalettes.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyPalettePins, palettePinProblems, type PalettePin} from './reviewPalettes.ts';
import type {Decision} from './autoPlace.ts';

const T = 'helmers-1911-balcony-axis', P = '0363100012122183', Q = '0363100012142705';
const placed = (pandId: string, typeId = T): Decision => ({kind: 'placed', pandId, typeId, score: 1, notes: [],
  house: {pandId, slug: `helmers-${pandId.slice(-6)}`, address: 'Eerste Helmersstraat', type: {type: typeId, measuredPalette: {brick: '#666865', evidence: 'strip'}}} as never});

test('problems: a pand id, a reason, a known type, house-palette fields only, one pin per pand', () => {
  const ok: PalettePin = {pandId: P, type: T, palette: {brick: '#6f4e3f'}, reason: 'strip'};
  assert.deepEqual(palettePinProblems([ok], [{id: T}]), []);
  assert.match(palettePinProblems([{...ok, pandId: '22183'}], [{id: T}])[0], /16-digit/);
  assert.match(palettePinProblems([{...ok, reason: ''}], [{id: T}])[0], /reason required/);
  assert.match(palettePinProblems([{...ok, type: 'x'}], [{id: T}])[0], /unknown type/);
  assert.match(palettePinProblems([{...ok, palette: {roof: '#000'} as never}], [{id: T}])[0], /not a house-palette field/);
  assert.match(palettePinProblems([{...ok, palette: {}}], [{id: T}])[0], /palette must be/);
  assert.match(palettePinProblems([ok, ok], [{id: T}])[0], /pinned twice/);
});

test('a pin becomes the placement paletteOverrides, only for its type; other pands untouched', () => {
  const ds = [placed(P), placed(Q), placed('0363100012154337', 'other')];
  const pins: PalettePin[] = [
    {pandId: P, type: T, palette: {brick: '#6f4e3f'}, reason: 'levels-stretched strip'},
    {pandId: '0363100012154337', type: T, palette: {brick: '#2e2d2b', wallMaterial: 'painted-brick'}, reason: 'black'},
  ];
  assert.deepEqual(applyPalettePins(ds, pins), [P]);
  const [a, b, c] = ds as Extract<Decision, {kind: 'placed'}>[];
  assert.deepEqual(a.house.type!.paletteOverrides, {brick: '#6f4e3f'});
  assert.equal(a.house.type!.measuredPalette!.brick, '#666865', 'the measurement stays as provenance');
  assert.ok(a.notes.some(n => /^palette pinned: levels-stretched/.test(n)));
  assert.equal(b.house.type!.paletteOverrides, undefined);
  assert.equal(c.house.type!.paletteOverrides, undefined);
});

test('the Helmersbuurt palette pin files are valid', () => {
  const types = fs.readdirSync('scripts/block-face/types/helmersbuurt').filter(f => f.endsWith('.json')).map(f => ({id: f.replace(/\.json$/, '')}));
  for (const buurt of ['helmersbuurt-oost', 'cremerbuurt-oost']) {
    const pins = JSON.parse(fs.readFileSync(`scripts/block-face/buurten/${buurt}-review-palettes.json`, 'utf8')).pins as PalettePin[];
    assert.deepEqual(palettePinProblems(pins, types), [], buurt);
  }
});

test('accept pins: bounded floor under the gate, per pand and type, with a reason', async () => {
  const {acceptPinProblems, acceptFloorFor, ACCEPT_FLOOR} = await import('./reviewPalettes.ts');
  const {placementGate} = await import('./autoPlace.ts');
  const ok = {pandId: P, type: T, minNcc: 0.1, reason: 'sheet'};
  assert.deepEqual(acceptPinProblems([ok], [{id: T}]), []);
  assert.match(acceptPinProblems([{...ok, minNcc: 0.05}], [{id: T}])[0], /minNcc/);
  assert.match(acceptPinProblems([{...ok, minNcc: 0.15}], [{id: T}])[0], /minNcc/);
  assert.match(acceptPinProblems([{...ok, reason: ''}], [{id: T}])[0], /reason/);
  assert.equal(ACCEPT_FLOOR, 0.08);
  assert.equal(acceptFloorFor(P, T, [ok]), 0.1);
  assert.equal(acceptFloorFor(P, 'other', [ok]), undefined);
  assert.equal(acceptFloorFor(Q, T, [ok]), undefined);
  assert.equal(placementGate({ncc: 0.12, abstain: null}, acceptFloorFor(P, T, [ok])).gate, 'pass');
  assert.equal(placementGate({ncc: 0.12, abstain: null}, acceptFloorFor(Q, T, [ok])).gate, 'hold');
});

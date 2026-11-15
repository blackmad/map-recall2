// The district brick draw (centrum-looks round 2): named regressions Westerkade 174838 (173518-173521, 174936, 173525) and
// Rozengracht 168914 (168914, 168906, 169815, 169814, 169812, 169813), both judged "too dark and uniform" in round 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRowWalls, type WallDrawConfig } from './wallDraw.ts';
import { lchOf } from '../houseSpec/judgedColour.ts';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('./districts/jordaan.json', import.meta.url), 'utf8')).wallDraw as WallDrawConfig;
const WESTERKADE = ['0363100012173518', '0363100012173519', '0363100012173520', '0363100012173521', '0363100012174936', '0363100012173525'];
const ROZENGRACHT = ['0363100012168914', '0363100012168906', '0363100012169815', '0363100012169814', '0363100012169812', '0363100012169813'];

for (const [name, ids, year] of [['Westerkade 174838', WESTERKADE, 1880], ['Rozengracht 168914', ROZENGRACHT, 1890]] as const) {
  test(`${name}: free fronts draw lighter, varied walls (never one dark tone)`, () => {
    const out = drawRowWalls(ids.map(pandId => ({ pandId, year, free: true })), cfg);
    const hexes = out.map(w => w!.hex);
    assert.equal(new Set(hexes).size, ids.length, 'one tone per house');
    for (const h of hexes) assert.ok(lchOf(h).L > 0.36, `${h} lighter than the round-1 dark grey (#4b4644, L ~0.40 drawn ~0.36)`);
    assert.ok(new Set(out.map(w => w!.family)).size >= 2, 'more than one family along the row');
    // the judges saw brick on both rows (Rozengracht red-orange; Westerkade brown): the draw never paints a front
    for (const w of out) assert.equal(w!.material, 'brick');
    assert.deepEqual(drawRowWalls(ids.map(pandId => ({ pandId, year, free: true })), cfg), out, 'deterministic');
  });
}

test('a front with a stated colour is left alone; an own brick read never draws paint', () => {
  const out = drawRowWalls(ROZENGRACHT.map((pandId, i) => ({ pandId, year: 1700, free: i !== 0, brickOnly: true })), cfg);
  assert.equal(out[0], null);
  for (const w of out.slice(1)) assert.equal(w!.material, 'brick');
});

test('samples speak relative to their neighbours, never absolutely', () => {
  // a dark street (all underexposed): the middle one is no darker than its neighbours, so it is not purple-brown
  const dark = ['#3a3533', '#3c3634', '#3b3634', '#3d3735', '#3a3532'];
  const out = drawRowWalls(dark.map((sample, i) => ({ pandId: WESTERKADE[i], year: 1700, free: true, sample })), cfg);
  for (const w of out) { assert.equal(w!.by, 'sample'); assert.notEqual(w!.family, 'dark-grey-brick'); }
});

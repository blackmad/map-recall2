/**
 * De Baarsjes rows on Jan Evertsenstraat (lane de-baarsjes-faces-20261016): the kit keys the rows needed and the named
 * regressions of the authored faces.
 *  - 105 (155048, evertsen-91-135): box frame 1.10-1.93 m touching its flat neighbour, half of the party-wall window at
 *    4.56-6.00 m (ruler crop, 120 px/m); 107 (078348) mirrors it so the two halves meet across the party wall;
 *  - 93 (114417): no box frame and no lisene (`null` overrides remove the type's fields);
 *  - 129 (102496): the wide four-light window beside its box (`axisWindows`);
 *  - 101-119: one coping line for the row (`measuredEaves`, one strip row);
 *  - the measured glass-block band: joints read with the band, deeper steps only when measured.
 *   node --import tsx --test src/canalRecall/blockFace/deBaarsjesRows.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {WINDOWS, validateIntent, type FrontIntent} from '../buildingRecipe/intent.ts';
import {WINDOW_KINDS} from '../buildingRecipe/deBaarsjesIntent.ts';
import {GLASS_BLOCK, glassBlockBand, measuredMortar} from '../buildingRecipe/amsterdamSchool.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {mirrorFront} from './houseType.ts';
import {mergeCoplanar} from './recipeRoof.ts';

const DIR = 'scripts/block-face/faces/evertsen-91-135';
const raw = JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const members: string[] = JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8')).members;
const face: BlockFaceIntent = validateBlockFace(raw, members);
const intents = houseIntents(face);
const intentOf = (pand: string) => intents.find(i => i.pandId.endsWith(pand))!;
const factsOf = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`${DIR}/pands/0363100012${pand}/facts.json`, 'utf8'));
const storey2 = (pand: string) => {
  const {recipe, report} = fitIntent(intentOf(pand), factsOf(pand));
  const el = recipe.elevations[0];
  return {width: report.fronts[0].widthM, erker: report.fronts[0].erker, windows: el.openings.value.filter(o => /^s2-/.test(o.id)).sort((a, b) => a.leftM - b.leftM)};
};

test('WINDOW_KINDS (axisWindows validation) lists exactly the intent WINDOWS', () => {
  assert.deepEqual([...WINDOW_KINDS], [...WINDOWS]);
});

test('bayFill and axisWindows validate; misuse is rejected', () => {
  const i = intentOf('155048');
  const patch = (p: Partial<FrontIntent> & Record<string, unknown>) => { const x = structuredClone(i) as any; Object.assign(x.fronts[0], p); return x; };
  validateIntent(patch({}));
  assert.throws(() => validateIntent(patch({bayFill: [0.5, 0.98]})), /bayFill: 5 window shares/);
  assert.throws(() => validateIntent(patch({bayFill: [0.5, 0.98, 0.98, 0.2, 0.97]})), /each 0\.3\.\.1/);
  assert.throws(() => validateIntent(patch({bayWidths: undefined})), /bayFill: needs bayWidths/);
  assert.throws(() => validateIntent(patch({axisWindows: {'7': 'casement-pair'}})), /axisWindows\.7: an axis 0\.\.4/);
  assert.throws(() => validateIntent(patch({axisWindows: {'1': 'porthole'} as any})), /axisWindows\.1: one of/);
});

test('mirrorFront reverses bayFill and flips the axisWindows keys', () => {
  const f = intentOf('155048').fronts[0];
  const m = mirrorFront({...f, axisWindows: {'1': 'casement-pair'}});
  assert.deepEqual(m.bayFill, [...f.bayFill!].reverse());
  assert.deepEqual(m.axisWindows, {'3': 'casement-pair'});
});

test('105: the box frame touches its flat neighbour; the far window is half of one straddling the party wall', () => {
  const {width, erker, windows} = storey2('155048');
  assert.ok(erker && Math.abs(erker.leftM - 1.10) < 0.03 && Math.abs(erker.widthM - 0.83) < 0.03, `box 1.10-1.93 m (${erker?.leftM} + ${erker?.widthM})`);
  const flat = windows.find(w => w.leftM > erker!.leftM + 0.1 && w.leftM < 2.5)!, half = windows[windows.length - 1];
  assert.ok(flat.leftM - (erker!.leftM + erker!.widthM) < 0.03, 'the flat window touches the box (one pier)');
  assert.ok(Math.abs(half.leftM - 4.56) < 0.05 && width - (half.leftM + half.widthM) < 0.03, `half window 4.56-6.00 m (${half.leftM} + ${half.widthM})`);
  // 107 is the mirror: its half window starts at its left party wall, so the two halves read as one window.
  const n = storey2('078348').windows[0];
  assert.ok(n.leftM < 0.03 && Math.abs(n.widthM - half.widthM) < 0.01, `107 starts with the other half (${n.leftM} + ${n.widthM})`);
});

test('93: null overrides remove the type\'s box frames and lisene', () => {
  const f = intentOf('114417').fronts[0];
  assert.equal(f.bayWindows, undefined);
  assert.equal(f.lisenes, undefined);
  assert.equal(storey2('114417').erker, undefined);
});

test('129: the wide window takes its axis kind (four lights), the others the type\'s', () => {
  const {windows} = storey2('102496');
  const wide = windows.find(w => w.widthM > 2.5)!;
  assert.deepEqual(wide.verticalBars, [0.25, 0.5, 0.75]);
  assert.ok(windows.filter(w => w !== wide).every(w => (w.verticalBars ?? []).length <= 1));
});

test('101-119: one coping line for the row', () => {
  const rows = new Set(['147193', '113053', '155048', '078348', '065988', '062999', '099114', '151042', '142949', '096804'].map(p => face.continuity.measuredEaves!.find(m => m.pand.endsWith(p))!.stripRow));
  assert.equal(rows.size, 1);
});

test('measured glass-block band: joints from the band colour, deeper steps only when measured', () => {
  assert.equal(measuredMortar('#4c4d3d'), '#63644f');
  const zMax = (v: number[]) => Math.max(...v.filter((_, k) => k % 3 === 2));
  const b = {leftM: 0, widthM: 6, bottomM: 3.1, topM: 4.7, cellM: 0.2};
  const plain = glassBlockBand(b), measured = glassBlockBand({...b, colour: '#4c4d3d'});
  assert.equal(zMax(plain.glass), GLASS_BLOCK.proudM);
  assert.equal(zMax(plain.grid), GLASS_BLOCK.gridProudM);
  assert.ok(zMax(measured.grid) - zMax(measured.glass) >= 0.03 && zMax(measured.glass) >= 0.03, 'steps clear of the 3 cm z-fight tolerance');
});

test('mergeCoplanar: the memoised merge gives the restart-from-scratch result (hash recorded from the old algorithm)', () => {
  // 30 seeded unit-grid layouts (squares, some split into triangles), corners on (x + y) % 3 = 0. The hash was recorded
  // with the O(n^3) "first mergeable pair, then start over" loop that this lane replaced (121-125 compiled for hours).
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: unknown[] = [];
  for (let c = 0; c < 30; c++) {
    const pieces: number[][][] = [];
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) if (rnd() < 0.7) {
      if (rnd() < 0.3) pieces.push([[x, y], [x + 1, y], [x + 1, y + 1]], [[x, y], [x + 1, y + 1], [x, y + 1]]);
      else pieces.push([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]);
    }
    out.push(mergeCoplanar(pieces, (p: number[]) => (p[0] + p[1]) % 3 === 0));
  }
  assert.equal(out.reduce((n: number, r) => n + (r as unknown[]).length, 0), 151);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0, 16), 'bb1a64b41f2c3eb3');
});

/**
 * Kit components of lane kit-batch-2005b-20261122: window hoods and Juliet rails (`windowHeads`, `julietRails`,
 * bayWindows `rail`; Rode Kruisstraat 2, crop w03-262 2024-08-29) and the straight glazed box window (`tiltedBays.out`;
 * Klaprozenweg 35-37, crop w03-33 2024-10-22): schema, the system rows, the drawn boxes, byte-identical when absent, and
 * the compiled houses within their gates.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import {largeSystem, TILT_FRAME, type SystemFit} from '../blockBuilding/systems.ts';
import {drawWindowTrim, julietRailsProblems, mapRowWindows, windowHeadsProblems, WINDOW_TRIM} from '../blockBuilding/windowTrim.ts';
import type {Row, WinParams} from '../blockBuilding/spec.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const RK = 'rode-kruisstraat-2-251336', KL = 'klaprozenweg-35-37-253708';
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};
const fit: SystemFit = {pitchM: 3, lines: [0, 3.2, 6.2, 9.2, 11], ground: 'system', slots, bays: 4, shape: {w: 0.6, h: 0.6, sillM: 0.6}};

test('window trim schema: colours, bounds, unknown fields, rails need julietRails and not on doors', () => {
  assert.deepEqual(windowHeadsProblems({colour: '#9fa3a0', drop: 0.3, storeys: [1, 2]}, 'h'), []);
  assert.ok(windowHeadsProblems({colour: 'grey'}, 'h').length);
  assert.ok(windowHeadsProblems({colour: '#9fa3a0', drop: 2}, 'h').length);
  assert.ok(windowHeadsProblems({colour: '#9fa3a0', hood: true}, 'h').length);
  assert.deepEqual(julietRailsProblems({colour: '#c4c8c4', h: 0.85}, 'j'), []);
  assert.ok(julietRailsProblems({colour: '#c4c8c4', h: 3}, 'j').length);
  const base = raw(RK);
  assert.ok(validateLargeIntent(base));
  const g0 = base.walls[0];
  const withWall = (extra: object) => ({...base, walls: [{...g0, ...extra}, ...base.walls.slice(1)]});
  assert.throws(() => validateLargeIntent(withWall({julietRails: undefined})), /rail needs the group's julietRails/);
  const noRails = {...g0, bayWindows: g0.bayWindows.map((e: any) => ({...e, pattern: e.pattern.map(({rail: _r, ...b}: any) => b)}))};
  assert.throws(() => validateLargeIntent({...base, walls: [noRails, ...base.walls.slice(1)]}), /give storeys or mark bayWindows entries rail/);
  assert.ok(validateLargeIntent({...base, walls: [{...noRails, julietRails: {colour: '#c4c8c4', storeys: [1]}}, ...base.walls.slice(1)]}));
  assert.throws(() => validateLargeIntent(withWall({system: 'ribbon-windows', bayWindows: undefined, julietRails: undefined})), /windowHeads: brick-bay-grid/);
});

test('window trim rows: absent = unchanged; hoods on every punched window of the listed storeys; rails on marked bay windows', () => {
  const plain = largeSystem('brick-bay-grid', fit);
  for (const k of ['headDrop', 'juliet', 'headSlot']) assert.equal(JSON.stringify(plain).includes(k), false, k);
  const heads = largeSystem('brick-bay-grid', {...fit, windowHeads: {slot: 'stone@wh0', drop: 0.3}});
  for (const st of ['1', '2', '3']) assert.deepEqual({...heads.rowOverrides![st].win, headSlot: undefined, headDrop: undefined}, {...plain.typical.win, headSlot: undefined, headDrop: undefined});
  assert.equal(heads.rowOverrides!['2'].win!.headSlot, 'stone@wh0');
  assert.equal(heads.ground.win?.headSlot, 'stone@wh0');
  const only = largeSystem('brick-bay-grid', {...fit, windowHeads: {slot: 'h', drop: 0, storeys: [2]}});
  assert.equal(only.rowOverrides!['2'].win!.headSlot, 'h');
  assert.equal(only.rowOverrides!['2'].win!.headDrop, undefined, 'drop 0: a flat head');
  assert.equal(only.rowOverrides!['1'].win!.headSlot, undefined);
  const rails = {slot: 'frame@jr0', h: 0.85};
  const bw = largeSystem('brick-bay-grid', {...fit, julietRails: rails, bayWindows: [{storeys: [1], pattern: [{w: 0.5}, {w: 0.9, rail: true}, {w: 0}]}]});
  const cyc = bw.rowOverrides!['1'].cycle!;
  const win = (r: Row) => r.items![0][0].win!;
  assert.equal(win(cyc[0]).juliet, undefined);
  assert.deepEqual(win(cyc[1]).juliet, rails);
  const every = largeSystem('brick-bay-grid', {...fit, julietRails: {...rails, storeys: [2]}});
  assert.deepEqual(every.rowOverrides!['2'].win!.juliet, rails);
  assert.equal(every.rowOverrides!['1'].win!.juliet, undefined);
  // loggias and arched openings are left alone
  const lg: Row = {kind: 'punched', win: {w: 0.5, loggia: {depth: 1}}};
  assert.deepEqual(mapRowWindows(lg, w => ({...w, headSlot: 'x'})), lg);
});

test('drawWindowTrim: two legs under the head, bars and two rails across the foot, nothing without the fields', () => {
  const boxes: number[][] = [];
  const box = (_s: string, ...r: number[]) => { boxes.push(r); };
  const w: WinParams = {headSlot: 'h', headDrop: 0.3, juliet: {h: 0.85, slot: 'j'}};
  const n = drawWindowTrim(box, 0, 1.4, 0.2, 2.4, w);
  const bars = Math.round(1.4 / WINDOW_TRIM.barPitchM) - 1;
  assert.equal(n, 2 + bars + 2);
  assert.equal(boxes.length, n);
  assert.ok(boxes.slice(2).every(b => b[2] >= 0.2 - 1e-9 && b[3] <= 0.2 + 0.85 + 1e-9 && b[4] > 0), 'the rail stands in front of the wall over the foot');
  assert.equal(drawWindowTrim(box, 0, 1.4, 0.2, 2.4, {headSlot: 'h'}), 0);
  assert.equal(drawWindowTrim(box, 0, 0.3, 0.2, 2.4, {juliet: {h: 0.85, slot: 'j'}}), 0, 'too narrow for a rail');
});

test('straight box windows: out sets a level frame and a front glass; absent = the tilted hotel box', () => {
  const tb = {bays: [1], storeys: [2]};
  const tilted = largeSystem('brick-bay-grid', {...fit, tilted: tb});
  assert.deepEqual(tilted.rowOverrides!['2'].cycle![1].win!.tilt, {slot: 'stone', ...TILT_FRAME});
  const box = largeSystem('brick-bay-grid', {...fit, tilted: {...tb, out: 0.9, slot: 'stone@tb0'}});
  const t = box.rowOverrides!['2'].cycle![1].win!.tilt!;
  assert.deepEqual([t.slot, t.outTop, t.outBottom, t.front], ['stone@tb0', 0.9, 0.9, {slot: 'glass', d: 0.87}]);
  const base = raw(KL);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], tiltedBays: [{...base.walls[0].tiltedBays[0], out: 3}, base.walls[0].tiltedBays[1]]}, ...base.walls.slice(1)]}), /tiltedBays.out/);
});

const glbTris = async (id: string, built: ReturnType<typeof compileBuilding>) =>
  decodeTriangles((await canalhouseGroupToGlb(id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000})).bytes);

for (const id of [RK, KL]) test(`${id} compile: its trim or box slots are in the palette and gates pass in budget`, async () => {
  const intent = validateLargeIntent(raw(id)), f = facts(id);
  const {recipe} = fitLarge(intent, f);
  const want = id === RK ? /stone@wh\d+|frame@jr\d+/g : /stone@tb\d+/g;
  assert.ok((JSON.stringify(recipe.spec).match(want) ?? []).length >= 2);
  const built = compileBuilding(intent, f);
  const tris = await glbTris(intent.id, built as any);
  assert.ok(tris.length <= (intent.budgetTriangles ?? LARGE_BUDGET_TRIANGLES), `${tris.length}`);
  assert.deepEqual(evaluateLargeGates(tris, built as any).gates.filter(x => !x.pass).map(x => x.id), []);
});

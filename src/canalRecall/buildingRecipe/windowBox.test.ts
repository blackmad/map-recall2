/**
 * Kit addition from the Stadsloket Zuidoost refit (2026-10-25, issue #59): a projecting glazed window box across a span
 * of bays on one storey (blockBuilding/windowBox.ts).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import {WINDOW_BOX, fitWindowBox, windowBoxRect} from '../blockBuilding/windowBox.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'stadsloket-zuidoost';
const raw = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));

test('windowBox schema: fractions only, an upper storey under the storey count, a bay span within baysPerStorey', () => {
  const base = raw(), w0 = base.walls[0];
  const withBox = (b: object | undefined, extra: object = {}) => ({...base, walls: [{...w0, windowBox: b, ...extra}, ...base.walls.slice(1)]});
  assert.ok(validateLargeIntent(withBox({storey: 2, bays: [8, 17], sill: 0.5, h: 0.4, proud: 0.25, lights: 12})));
  assert.throws(() => validateLargeIntent(withBox({storey: 2, bays: [8, 17], depth: 0.4})), /unknown field|coordinate\/metric/);
  assert.throws(() => validateLargeIntent(withBox({storey: 0, bays: [8, 17]})), /storey/);
  assert.throws(() => validateLargeIntent(withBox({storey: 5, bays: [8, 17]})), /under storeys/);
  assert.throws(() => validateLargeIntent(withBox({storey: 2, bays: [8, 24]})), /last bay/);
  assert.throws(() => validateLargeIntent(withBox({storey: 2, bays: [8, 17], sill: 0.7, h: 0.5})), /within the storey/);
  assert.throws(() => validateLargeIntent(withBox({storey: 2, bays: [8, 17]}, {system: 'curtain-wall'})), /windowBox: on a wall with a face/);
});

test('windowBox rect: the bay span of an even division, sill and height of the storey', () => {
  const fit = fitWindowBox({storey: 1, bays: [2, 3]}, {frame: 'frame', glass: 'glass'});
  assert.deepEqual({sill: fit.sill, h: fit.h, proud: fit.proud, transom: fit.transom}, {sill: WINDOW_BOX.sill, h: WINDOW_BOX.h, proud: WINDOW_BOX.proud, transom: true});
  assert.deepEqual(windowBoxRect(0, 10, [0, 4, 8], fit, 5), [4, 8, 4 + 0.25 * 4, 4 + 0.7 * 4]);
  assert.equal(windowBoxRect(0, 10, [0, 4], {...fit, storey: 1}, 5), null);
});

test('Stadsloket Zuidoost: one window box on walls[0] within the gates; absent = byte-identical to no box', async () => {
  const f = facts(), intent = validateLargeIntent(raw());
  assert.deepEqual(fitLarge(intent, f).recipe.groups.map(g => g.windowBox?.bays ?? null), [[8, 17], null, null, null]);
  const a = compileBuilding(intent, f);
  assert.equal(a.components.windowBoxes, 1);
  const glb = await canalhouseGroupToGlb(intent.id, a.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  assert.deepEqual(evaluateLargeGates(await decodeTriangles(glb.bytes), a).gates.filter(g => !g.pass && !g.advisory).map(g => g.id), []);
  const stripped = raw();
  delete stripped.walls[0].windowBox;
  const b = compileBuilding(validateLargeIntent(stripped), f);
  assert.equal(b.components.windowBoxes, undefined);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
});

test('openBays on the ground storey (0): listed bays keep the ground row, the rest plain wall; absent = unchanged; not with a hoist', async () => {
  const {largeSystem} = await import('../blockBuilding/systems.ts');
  const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};
  const fit = {pitchM: 2.4, lines: [0, 3.6, 7.2, 10.8], ground: 'system' as const, slots, bays: 4};
  const plain = largeSystem('brick-bay-grid', fit);
  const s = largeSystem('brick-bay-grid', {...fit, openBays: [{storeys: [0], bays: [0, 1, 3]}]});
  assert.deepEqual(s.ground!.cycle!.map(r => r.kind), [plain.ground!.kind, plain.ground!.kind, 'wall', plain.ground!.kind]);
  assert.deepEqual(s.typical, plain.typical);
  assert.deepEqual(largeSystem('brick-bay-grid', {...fit, openBays: [{storeys: [1], bays: [0]}]}).ground, plain.ground);
  const base = raw(), w5 = {...base.walls[1], openBays: [{storeys: [0], bays: [0]}]};
  assert.throws(() => validateLargeIntent({...base, walls: [base.walls[0], {...w5, hoist: {every: 2}}, ...base.walls.slice(2)]}), /ground storey \(0\)/);
});

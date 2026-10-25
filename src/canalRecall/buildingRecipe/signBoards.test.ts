/**
 * Kit addition from the Haarlemmerweg 337 shop hall (2026-10-25, issue #83): flat sign boards on a sheet front and a
 * false front that hides a sawtooth roof's gable ends (blockBuilding/signBoards.ts).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {signBoardsProblems} from '../blockBuilding/signBoards.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'haarlemmerweg-337-118325';
const raw = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));

test('signBoards schema: fractions only, 1..12 boards, known fields, not on a curtain wall', () => {
  assert.deepEqual(signBoardsProblems([{along: [0.1, 0.5], up: [0.4, 0.6], colour: '#445662'}], 'b'), []);
  assert.match(signBoardsProblems([], 'b').join(), /1\.\.12/);
  assert.match(signBoardsProblems([{along: [0.1, 0.11], up: [0.4, 0.6]}], 'b').join(), /along/);
  assert.match(signBoardsProblems([{along: [0.1, 0.5], up: [0.4, 1.2]}], 'b').join(), /up/);
  assert.match(signBoardsProblems([{along: [0.1, 0.5], up: [0.4, 0.6], widthM: 3}], 'b').join(), /unknown field/);
  const base = raw(), w0 = base.walls[0];
  const withW = (extra: object) => ({...base, walls: [{...w0, ...extra}, ...base.walls.slice(1)]});
  assert.throws(() => validateLargeIntent(withW({signBoards: [{along: [0.1, 0.5], up: [0.4, 0.6]}], system: 'curtain-wall'})), /signBoards/);
  assert.throws(() => validateLargeIntent(withW({falseFront: 'yes'})), /falseFront/);
});

test('Haarlemmerweg 337: boards and the false front are drawn; absent = byte-identical to no boards', () => {
  const f = facts(), intent = validateLargeIntent(raw());
  assert.deepEqual(fitLarge(intent, f).recipe.groups.map(g => g.signBoards?.length ?? 0), [3, 3]);
  const a = compileBuilding(intent, f);
  assert.equal(a.components.signBoards, 6);
  assert.ok((a.components.falseFronts ?? 0) >= 1);
  const stripped = raw();
  for (const w of stripped.walls) { delete w.signBoards; delete w.falseFront; }
  const b = compileBuilding(validateLargeIntent(stripped), f), c = compileBuilding(validateLargeIntent(structuredClone(stripped)), f);
  assert.equal(b.components.signBoards, undefined);
  assert.equal(b.components.falseFronts, undefined);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
  assert.equal(meshHashOf(b.group), meshHashOf(c.group));
});

test('signage.along (wall mount): lettering over a span of the panel, between the ground heads and first-storey sills; wall mount only', () => {
  const id = 'nieuwpoortkade-2-090791', base = JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
  const f: BuildingFacts = JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8')), w0 = base.walls[0];
  const withSign = (s: object) => ({...base, walls: [{...w0, signage: s}, ...base.walls.slice(1)]});
  assert.throws(() => validateLargeIntent(withSign({text: 'da vinci', mount: 'fascia', along: [0.1, 0.5]})), /only with mount "wall"/);
  assert.throws(() => validateLargeIntent(withSign({text: 'da vinci', mount: 'wall', along: [0.1, 0.15]})), /signage.along/);
  const intent = validateLargeIntent(base);
  assert.deepEqual(fitLarge(intent, f).recipe.groups[0].signage?.along, [0.035, 0.46]);
  assert.ok(compileBuilding(intent, f).components.letters > 0);
  const centred = validateLargeIntent(withSign({text: 'da vinci creatieve ruimtes', colour: '#d8d4cc', mount: 'wall'}));
  assert.equal(fitLarge(centred, f).recipe.groups[0].signage?.along, undefined);
});

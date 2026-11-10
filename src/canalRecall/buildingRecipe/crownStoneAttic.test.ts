/**
 * Burgwallen strip verdict (2026-11-10): a white stone raised centre (Oudezijds Achterburgwal 175, `crownSurface`) and
 * measured gable-light widths (Spui 11's 1.3 m two-light window, Kalverstraat 206's 1.6 m neck window, `atticLightWidth`).
 * Fronts that do not opt in compile exactly as before.
 *   node --import tsx --test src/canalRecall/buildingRecipe/crownStoneAttic.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';

const H = 'scripts/building-recipes/houses/bilder-087959';
const base = JSON.parse(fs.readFileSync(`${H}/intent.json`, 'utf8'));
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${H}/facts.json`, 'utf8'));
const front = {id: 'front0', street: base.fronts[0].street, gable: 'step', storeys: 3, bays: 2, doorBay: 0, basement: 'none', cornice: 'none', windows: 'casement-toplight', hoist: false, atticWindows: 1};
const variant = (f: Record<string, unknown> = {}): CanalHouseIntent => validateIntent({...base, fronts: [{...front, ...f}]});
const elevation = (b: ReturnType<typeof compileBuilding>) => b.recipe.elevations[0];
const attic = (b: ReturnType<typeof compileBuilding>) => elevation(b).openings.value.filter(o => o.id.startsWith('attic-'));

test('absent: the crown is wall and the attic light keeps its default width (byte-identical recipe)', () => {
  const a = compileBuilding(variant(), facts);
  assert.equal(elevation(a).crown!.value.surface, 'wall');
  const w = attic(a)[0].widthM;
  assert.ok(w >= 0.5 && w <= 0.9, `default light ${w}`);
  assert.deepEqual(compileBuilding(variant(), facts).recipe, a.recipe);
});

test('crownSurface stone draws the crown in the stone colour and nothing else', () => {
  const a = compileBuilding(variant(), facts), b = compileBuilding(variant({crownSurface: 'stone'}), facts);
  assert.equal(elevation(b).crown!.value.surface, 'stone');
  assert.deepEqual({...elevation(b).crown!.value, surface: 'wall'}, elevation(a).crown!.value);
});

test('atticLightWidth sets the measured light width (Spui 11: 1.3 m)', () => {
  const b = compileBuilding(variant({atticLightWidth: 1.3}), facts);
  const l = attic(b);
  assert.equal(l.length, 1);
  assert.ok(l[0].widthM > 0.95 && l[0].widthM <= 1.3 + 1e-9, `light ${l[0].widthM}`);
});

test('validation: crownSurface only "stone"; atticLightWidth 0.4..2.2 m and needs attic windows', () => {
  const problems = (f: Record<string, unknown>): string[] => { try { validateIntent({...base, fronts: [{...front, ...f}]}); return []; } catch (e) { return String((e as Error).message).split('\n'); } };
  assert.ok(problems({crownSurface: 'brick'}).some(p => p.includes('crownSurface')));
  assert.ok(problems({atticLightWidth: 3}).some(p => p.includes('atticLightWidth')));
  assert.ok(problems({atticLightWidth: 1, atticWindows: 0}).some(p => p.includes('atticLightWidth')));
  assert.equal(problems({crownSurface: 'stone', atticLightWidth: 1.2}).filter(p => /crownSurface|atticLightWidth/.test(p)).length, 0);
});

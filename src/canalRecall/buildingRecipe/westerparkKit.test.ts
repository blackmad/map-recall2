/**
 * Kit additions from the Westerpark south-edge lane (2026-10-25, issue #65): the window box as an enclosed access
 * gallery (`windowBox.spread` over every panel of the group, `windowBox.frame` colour, a `windowBox.deck` slab, a box
 * rising into the storey above) on Haarlemmerweg 217-283, and `mainSurface` (the group's main panel named by a 3DBAG
 * surface) on Haarlemmerweg 285-303, `gateways.keepRow` (a passage beside ground windows and a hall door) on
 * Haarlemmerweg 315-321. Every addition is opt-in: absent, the mesh is unchanged.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {WINDOW_BOX, fitWindowBox, windowBoxProblems, windowBoxRect} from '../blockBuilding/windowBox.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const GWL = 'haarlemmerweg-217-101656', CORNER = 'haarlemmerweg-285-097137';

test('windowBox gallery schema: spread boolean, frame and deck colours, deck fractions, a box over 0.95 rises into a storey that exists', () => {
  assert.deepEqual(windowBoxProblems({storey: 4, bays: [0, 14], sill: 0.44, h: 1.13, spread: true, frame: '#3c4044', deck: {h: 0.12, out: 0.5, colour: '#b4b2ac'}}, 'wb', 20, 9), []);
  assert.ok(windowBoxProblems({storey: 4, bays: [0, 14], spread: 'yes'}, 'wb', 20, 9).some(p => /spread/.test(p)));
  assert.ok(windowBoxProblems({storey: 4, bays: [0, 14], frame: 'rgb(1,2,3)'}, 'wb', 20, 9).some(p => /frame/.test(p)));
  assert.ok(windowBoxProblems({storey: 4, bays: [0, 14], deck: {h: 0.9}}, 'wb', 20, 9).some(p => /deck\.h/.test(p)));
  assert.ok(windowBoxProblems({storey: 4, bays: [0, 14], deck: {h: 0.1, depth: 2}}, 'wb', 20, 9).some(p => /deck\.depth/.test(p)));
  // up to two storeys tall, never past the top storey; within one storey the old limit stands
  assert.ok(windowBoxProblems({storey: 4, bays: [0, 14], sill: 0.9, h: 1.2}, 'wb', 20, 9).some(p => /<= 2/.test(p)));
  assert.ok(windowBoxProblems({storey: 8, bays: [0, 14], sill: 0.1, h: 1.2}, 'wb', 20, 9).some(p => /top one/.test(p)));
  assert.ok(windowBoxProblems({storey: 4, bays: [0, 14], sill: 0.6, h: 0.5}, 'wb', 20, 9).some(p => /within the storey/.test(p)));
});

test('windowBox fit and rect: spread carries the main panel light pitch; full panels span their whole width; the deck takes its slot', () => {
  const fit = fitWindowBox({storey: 1, bays: [0, 4], lights: 5, spread: true, deck: {h: 0.1}}, {frame: 'frame@wb0', glass: 'glass', deck: 'stone'}, 20, 10);
  assert.equal(fit.lightM, 2); // 5 bays of 2 m in 5 lights
  assert.deepEqual(fit.deck, {h: 0.1, out: WINDOW_BOX.deckOut, slot: 'stone'});
  assert.equal(fit.frame, 'frame@wb0');
  assert.deepEqual(windowBoxRect(3, 9, [0, 3, 6], fit, 10, true), [3, 9, 3 + WINDOW_BOX.sill * 3, 3 + (WINDOW_BOX.sill + WINDOW_BOX.h) * 3]);
  const plain = fitWindowBox({storey: 1, bays: [0, 4]}, {frame: 'frame', glass: 'glass'});
  assert.deepEqual(Object.keys(plain).sort(), ['bays', 'frame', 'glass', 'h', 'proud', 'sill', 'storey', 'transom']);
});

test('Haarlemmerweg 217-283: the gallery spreads over every north panel in its own frame and deck slots; without the gallery fields one box', () => {
  const intent = validateLargeIntent(raw(GWL)), f = facts(GWL);
  const {recipe} = fitLarge(intent, f);
  const box = recipe.groups[0].windowBox!;
  assert.equal(box.spread, true);
  assert.equal(box.frame, 'frame@wb0');
  assert.equal(box.deck?.slot, 'slab@wb0');
  assert.equal(recipe.spec.palette['frame@wb0'], '#3c4044');
  const a = compileBuilding(intent, f);
  assert.ok((a.components.windowBoxes ?? 0) > 3, `boxes ${a.components.windowBoxes}`);
  const stripped = raw(GWL), wb = stripped.walls[0].windowBox;
  delete wb.spread; delete wb.frame; delete wb.deck; wb.h = 0.5; wb.sill = 0.4;
  const b = compileBuilding(validateLargeIntent(stripped), f);
  assert.equal(b.components.windowBoxes, 1);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
});

test('mainSurface: names the main panel (Haarlemmerweg 285-303 west wing); must be one of the group surfaces; absent = the widest panel', () => {
  const base = raw(CORNER), f = facts(CORNER);
  const withMain = fitLarge(validateLargeIntent(base), f).recipe.groups[2];
  const without = raw(CORNER); delete without.walls[2].mainSurface;
  const widest = fitLarge(validateLargeIntent(without), f).recipe.groups[2];
  assert.notEqual(withMain.mainPanel, widest.mainPanel);
  assert.ok(withMain.widthM < widest.widthM, `${withMain.widthM} vs ${widest.widthM}`);
  const bad = raw(CORNER); bad.walls[2].mainSurface = 999;
  assert.throws(() => validateLargeIntent(bad), /mainSurface/);
});

test('gateways.keepRow: the other ground bays keep the ground row and hall doors may join', () => {
  const base = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/haarlemmerweg-315-135676/intent.json', 'utf8'));
  assert.doesNotThrow(() => validateLargeIntent(base));
  const noKeep = structuredClone(base); delete noKeep.walls[0].gateways.keepRow;
  assert.throws(() => validateLargeIntent(noKeep), /hallDoors: not with hoist, entrance or gateways/);
  const clash = structuredClone(base); clash.walls[0].hallDoors.bays = [8];
  assert.throws(() => validateLargeIntent(clash), /hallDoors.bays: not a gateway bay/);
});

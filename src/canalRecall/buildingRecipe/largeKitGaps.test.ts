/**
 * Large-kit gaps from the kit-vs-hand test (lane large-kit-gaps-20261121, Valkenburgerstraat 69-165): per-house
 * components in a row split, render and accent panels, the loggia look (lining, door-and-window back), and the
 * residential ground. Each: schema, the compose rows or rectangles, the compiled mesh, and byte-identical when absent.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import {fitLarge} from './fitLarge.ts';
import {houseAsWall, houseSystemFit} from './houseComponents.ts';
import {largeSystem, type SystemFit} from '../blockBuilding/systems.ts';
import {LOGGIA_DOOR_WINDOW, loggiaBackItems, loggiaLookProblems, rectMinusRects} from '../blockBuilding/loggia.ts';
import {FACE_PANEL_RELIEF_M, facePanelRects, facePanelsProblems, fitFacePanels} from '../blockBuilding/facePanels.ts';
import {RESIDENTIAL_GROUND, residentialGroundProblems, residentialGroundRow} from '../blockBuilding/residentialGround.ts';
import type {Cell} from '../blockBuilding/compose.ts';
import type {LargeBuildingIntent} from './intent.ts';

const HOUSE = 'scripts/building-recipes/houses/valkenburgerstraat-69-kit2-185504';
const kit2 = () => JSON.parse(fs.readFileSync(`${HOUSE}/intent.json`, 'utf8')) as LargeBuildingIntent;
const facts = () => JSON.parse(fs.readFileSync(`${HOUSE}/facts.json`, 'utf8'));
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};
const fit = (extra: Partial<SystemFit> = {}): SystemFit => ({pitchM: 3, lines: [0, 3.5, 6.5, 9.5, 12], ground: 'system', slots, bays: 6, ...extra});
const area = (rs: [number, number, number, number][]) => rs.reduce((a, r) => a + (r[1] - r[0]) * (r[3] - r[2]), 0);

test('rectMinusRects: the rectangle minus its holes, exact area, no overlaps, strips merged upward', () => {
  const rs = rectMinusRects(0, 10, 0, 6, [[1, 3, 1, 5], [6, 8, 0.5, 2], [6, 8, 3, 5.5]]);
  assert.ok(Math.abs(area(rs) - (60 - 8 - 3 - 5)) < 1e-9);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j], ov = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[2], b[2]));
    assert.equal(ov, 0, `pieces ${i} and ${j} overlap`);
  }
  // runs that repeat strip to strip are merged: left of the first hole one piece runs its full height
  assert.ok(rs.some(r => r[0] === 0 && r[1] === 1 && r[2] === 1 && r[3] === 5));
  assert.equal(rs.length, 10);
  assert.deepEqual(rectMinusRects(0, 2, 0, 2, []), [[0, 2, 0, 2]]);
});

test('loggia look: schema, back items, and compose loggia params; absent = the old loggia row', () => {
  assert.deepEqual(loggiaLookProblems({lining: '#7a4636', back: 'door-window'}, 'x', true), []);
  assert.match(loggiaLookProblems({lining: 'brown'}, 'x', true)[0], /lining/);
  assert.match(loggiaLookProblems({back: 'arch'}, 'x', true)[0], /back/);
  assert.equal(loggiaBackItems(undefined), undefined);
  assert.deepEqual(loggiaBackItems('door-window'), LOGGIA_DOOR_WINDOW);
  const L = {storeys: [2], w: 0.78, h: 0.8, sill: 0.03, deep: 0.5, rail: 'bars' as const, lights: 2, railSlot: 'rail@g0'};
  const plain = largeSystem('brick-bay-grid', fit({loggias: L}));
  const lined = largeSystem('brick-bay-grid', fit({loggias: {...L, lining: 'wall@lg0', items: LOGGIA_DOOR_WINDOW}}));
  assert.deepEqual(Object.keys(plain.rowOverrides!['2'].win!.loggia!).sort(), ['depth', 'rail']);
  assert.equal(lined.rowOverrides!['2'].win!.loggia!.lining, 'wall@lg0');
  assert.equal(lined.rowOverrides!['2'].win!.loggia!.items!.length, 2);
  assert.deepEqual({...lined.rowOverrides!['2'].win!.loggia, lining: undefined, items: undefined}, {...plain.rowOverrides!['2'].win!.loggia, lining: undefined, items: undefined});
});

test('residential ground: schema, the per-bay cycle of doors, storage and windows, door colour; other grounds unchanged', () => {
  assert.deepEqual(residentialGroundProblems({pattern: ['window', 'door'], doors: '#a8282a'}, 'r'), []);
  assert.ok(residentialGroundProblems({pattern: ['shop']}, 'r').length);
  assert.ok(residentialGroundProblems({pattern: ['door'], doors: 'red'}, 'r').length);
  const s = largeSystem('brick-bay-grid', fit({ground: 'residential'}));
  assert.equal(s.ground.cycle!.length, RESIDENTIAL_GROUND.pattern.length);
  assert.deepEqual(s.ground.cycle!.map(r => r.win?.glass ?? r.kind), ['glass', 'glass', 'glass', 'door']);
  assert.equal(s.ground.cycle![1].win!.w, RESIDENTIAL_GROUND.door.w);
  assert.deepEqual(s.ground.cycle![0], s.typical);
  const painted = residentialGroundRow(s.typical, slots, {pattern: ['door', 'storage', 'wall'], doorSlot: 'door@rg2'});
  assert.deepEqual(painted.cycle!.map(r => r.win?.glass ?? r.kind), ['door@rg2', 'door@rg2', 'wall']);
  // the other grounds are untouched by the new option
  assert.deepEqual(largeSystem('brick-bay-grid', fit({residential: {pattern: ['door']}})), largeSystem('brick-bay-grid', fit()));
});

test('face panels: schema, defaults per key, span and per-cell rectangles from the cells', () => {
  assert.deepEqual(facePanelsProblems([{bays: [0, 1], storeys: [1, 4], colour: '#ecebe6'}], 'p', 2), []);
  assert.match(facePanelsProblems([{bays: [0, 2], storeys: [1, 4], colour: '#ecebe6'}], 'p', 2).join(), /bays/);
  assert.match(facePanelsProblems([{bays: [0, 1], storeys: [1, 1], colour: '#ecebe6', up: [0.5, 0.52]}], 'p', 2).join(), /up/);
  assert.match(facePanelsProblems([{bays: [0, 1], storeys: [1, 4], colour: '#ecebe6', relief: 'huge'}], 'p', 2).join(), /relief/);
  const pal: Record<string, string> = {};
  const [render] = fitFacePanels([{bays: [0, 1], storeys: [1, 2], colour: '#ECEBE6'}], 'renderPanels', 3, pal);
  const [accent] = fitFacePanels([{bays: [0, 1], storeys: [1, 2], colour: '#b9b8b2', up: [0, 0.25]}], 'accentPanels', 3, pal);
  assert.equal(render.slot, 'render@fp3k0'); assert.equal(render.outM, FACE_PANEL_RELIEF_M.proud); assert.equal(render.each, false);
  assert.equal(accent.slot, 'clad@ap3k0'); assert.equal(accent.outM, FACE_PANEL_RELIEF_M.flush); assert.equal(accent.each, true);
  assert.deepEqual(pal, {'render@fp3k0': '#ecebe6', 'clad@ap3k0': '#b9b8b2'});
  const cells: Cell[] = [];
  for (let f = 0; f < 4; f++) for (let b = 0; b < 3; b++) cells.push({u0: b * 3, u1: b * 3 + 3, v0: f * 3, v1: f * 3 + 3, bay: b, floor: f, bays: 3});
  assert.deepEqual(facePanelRects(cells, render), [[0, 6, 3, 9]]);
  assert.deepEqual(facePanelRects(cells, {...render, along: [0.1, 0.9], up: [0.2, 0.8]}), [[0.3, 5.7, 3.6, 8.4]]);
  assert.deepEqual(facePanelRects(cells, accent), [[0, 3, 3, 3.75], [3, 6, 3, 3.75], [0, 3, 6, 6.75], [3, 6, 6, 6.75]]);
  // a bay the panel does not have: nothing
  assert.deepEqual(facePanelRects(cells, {...render, bays: [4, 5]}), []);
});

test('per-house components: validated with the group rules, scoped to the house, slots of their own', () => {
  const intent = kit2(), w = intent.walls[0];
  assert.ok(validateLargeIntent(intent));
  const stand = houseAsWall(w, w.houses![0]);
  assert.deepEqual(stand.ribbonStoreys, w.houses![0].ribbonStoreys);
  assert.equal(stand.baysPerStorey, 5);
  const bad = structuredClone(intent);
  bad.walls[0].houses![0].ribbonStoreys = [{storeys: [1], sill: 0.5, h: 0.6, lights: 2}];
  assert.throws(() => validateLargeIntent(bad), /walls\[0\]\.houses\[0\]\.ribbonStoreys\[0\]: sill \+ h/);
  const bad2 = structuredClone(intent);
  (bad2.walls[0].houses![1] as unknown as Record<string, unknown>).ground = 'arcade';
  assert.throws(() => validateLargeIntent(bad2), /houses\[1\]\.ground/);
  const pal: Record<string, string> = {};
  const own = houseSystemFit({w: 1, ribbonStoreys: [{storeys: [1, 9], sill: 0.3, h: 0.5, lights: 2, frame: '#e4e2dc', spandrel: {h: 0.2, colour: '#555555'}}], windows: 'cross', ground: 'residential', residential: {pattern: ['door'], doors: '#a8282a'}},
    {group: 0, house: 2, heights: [3, 3, 3], frameSlot: 'frame', palette: pal, swatch: c => c});
  assert.deepEqual(own.ribbonStoreys![0].storeys, [1]);
  assert.equal(own.ribbonStoreys![0].frame, 'frame@rs0h2k0');
  assert.equal(own.residential!.doorSlot, 'door@rg0h2');
  assert.deepEqual(Object.keys(pal).sort(), ['door@rg0h2', 'frame@rs0h2k0', 'spandrel@rs0h2k0']);
  assert.deepEqual(houseSystemFit({w: 1}, {group: 0, house: 0, heights: [3], frameSlot: 'frame', palette: {}, swatch: c => c}), {});
});

test('Valkenburgerstraat kit A2 compiles every new component; stripping them gives the old kit fit', () => {
  const intent = validateLargeIntent(kit2()), built = compileLargeBuilding(intent, facts(), {budget: 1e9});
  const g = built.recipe.groups, sys = built.recipe.spec.systems;
  // house 0's ribbons and house 1's ribbons in their own systems; the mauve houses keep punched rows
  assert.equal(sys[`${g[0].specSystem}h0`].rowOverrides!['1'].kind, 'ribbon');
  assert.equal(sys[`${g[0].specSystem}h1`].rowOverrides!['1'].kind, 'ribbon');
  assert.equal(sys[`${g[0].specSystem}h3`].rowOverrides?.['1']?.kind ?? sys[`${g[0].specSystem}h3`].typical.kind, 'punched');
  assert.equal(built.recipe.slotMaterial?.['wall@g0h1'], 'stucco');
  assert.ok((built.components.facePanels ?? 0) >= 20, `face panels ${built.components.facePanels}`);
  assert.equal(built.recipe.spec.palette['wall@lg2b0'], '#7a4636');
  assert.equal(sys[g[2].specSystem].ground.cycle!.length, 10);
  const slotsUsed = new Set<string>();
  built.group.traverse(o => { const s = (o.userData as {materialSlot?: string}).materialSlot; if (s) slotsUsed.add(s); });
  assert.ok(slotsUsed.has('stucco'));
  // the same intent without the new fields fits as the old kit route A did (1005bc1e27): same groups, bays and storeys
  const old = structuredClone(kit2());
  for (const w of old.walls) { delete w.renderPanels; delete w.accentPanels; delete w.residential; for (const b of w.loggiaBands ?? []) delete b.lining; for (const h of w.houses ?? []) { delete h.ribbonStoreys; delete h.blankStoreys; delete h.wallMaterial; } }
  const a = fitLarge(validateLargeIntent(old), facts()).recipe, b = fitLarge(intent, facts()).recipe;
  assert.deepEqual(a.groups.map(x => [x.bays, x.storeys]), b.groups.map(x => [x.bays, x.storeys]));
});

test('factory draft of a housing pand: every group on the residential ground; other uses unchanged', async () => {
  const {draftLargeIntent} = await import('./draftLarge.ts');
  const f = facts(), plain = draftLargeIntent(f, {id: 'kit2-draft', pandId: f.pandId}).intent;
  const housing = draftLargeIntent(f, {id: 'kit2-draft', pandId: f.pandId, use: 'housing'}).intent;
  assert.ok(housing.walls.length > 0 && housing.walls.every(w => w.ground === 'residential'));
  assert.deepEqual(housing.walls.map(w => ({...w, ground: undefined})), plain.walls.map(w => ({...w, ground: undefined})));
  assert.ok(plain.walls.every(w => w.ground === undefined));
});

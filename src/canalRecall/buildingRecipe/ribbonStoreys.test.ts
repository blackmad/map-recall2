/**
 * Ribbon storeys (kit gap "ribbon under punched", city-coverage C3, 2026-11-10): schema, the compose rows (continuous
 * band, own lights, transoms, spandrel panel, frame slot), the expansion on chosen storeys and bays only, and the
 * byte-identical system without them.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {largeSystem, type SystemFit} from '../blockBuilding/systems.ts';
import {RIBBON_STOREY, ribbonStoreyRow} from '../blockBuilding/ribbonStoreys.ts';

const raw = (id: string) => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/intent.json`, 'utf8'));
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};
const fit = (extra: Partial<SystemFit> = {}): SystemFit => ({pitchM: 3, lines: [0, 3.5, 6.5, 9.5, 12], ground: 'system', slots, bays: 6, ...extra});

test('ribbonStoreys schema: bounded fractions, hex colours, no clashing storeys or systems', () => {
  const base = raw('politie-van-leijenberghlaan'), w0 = {...base.walls[0], baysPerStorey: 6};
  delete w0.entrance;
  const withWall = (w: object) => ({...base, walls: [{...w0, ...w}, ...base.walls.slice(1)]});
  const ok = {storeys: [1], sill: 0.25, h: 0.6, lights: 3, rows: [0.7], spandrel: {h: 0.3, colour: '#55595c'}, frame: '#f2f0ea'};
  assert.ok(validateLargeIntent(withWall({ribbonStoreys: [ok]})));
  assert.ok(validateLargeIntent(withWall({system: 'blank', windowShape: undefined, ribbonStoreys: [{storeys: [1], sill: 0.1, h: 0.5, lights: 2, bays: [0, 1, 2]}]})));
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, sill: 0.4, h: 0.6}]})), /sill \+ h/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, lights: 0}]})), /lights/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, rows: [0.6, 0.3]}]})), /ascending/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, spandrel: {h: 0.3, colour: 'grey'}}]})), /spandrel\.colour/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, frame: 'white'}]})), /frame/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, depth: 1}]})), /unknown field|coordinate\/metric/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [ok], blankStoreys: [1]})), /also a blank/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [ok, {...ok}]})), /two ribbon entries/);
  assert.throws(() => validateLargeIntent(withWall({system: 'curtain-wall', ribbonStoreys: [ok]})), /ribbonStoreys: needs/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, storeys: [0]}], ground: 'glazed'})), /ground ribbon/);
});

test('ribbonStoreyRow: one continuous band per bay, own lights and transoms, the frame slot', () => {
  const r = ribbonStoreyRow({storeys: [1], sill: 0.2, h: 0.7, lights: 4, rows: [0.75], frame: 'frame@rs0k0'}, 3, {glass: 'glass'});
  assert.equal(r.kind, 'ribbon');
  assert.equal(r.pier, RIBBON_STOREY.postM);
  assert.deepEqual(r.win, {h: 0.7, sill: 0.6, mullAt: [0.25, 0.5, 0.75], rowsAt: [0.75], frame: 'frame@rs0k0', glass: 'glass', sillSlot: null, frameW: RIBBON_STOREY.frameW});
});

test('ribbonStoreyRow with a spandrel: the panel under the glass, both in the band, panel slot as its glazing', () => {
  const r = ribbonStoreyRow({storeys: [1], sill: 0.1, h: 0.8, lights: 2, spandrel: {h: 0.25, slot: 'spandrel@rs0k0'}, frame: 'frame'}, 4, {glass: 'glass', deepBars: true});
  assert.equal(r.kind, 'stack');
  const [panel, glass] = r.stack!;
  assert.deepEqual([panel.v0, panel.v1, glass.v0, glass.v1], [0, 4, 0, 4]);
  assert.equal(panel.row.win!.glass, 'spandrel@rs0k0');
  assert.equal(panel.row.win!.sill, 0.4);
  assert.equal(panel.row.win!.h, 0.2);
  assert.equal(glass.row.win!.sill, 1.2);           // (0.1 + 0.8 x 0.25) x 4 m
  assert.equal(glass.row.win!.h, 0.6);
  assert.equal(glass.row.win!.barD, 0.035);
  assert.deepEqual(glass.row.win!.mullAt, [0.5]);
});

test('largeSystem: ribbon storeys replace only their storeys (and bays); absent, the system is unchanged', () => {
  const plain = largeSystem('brick-bay-grid', fit());
  assert.deepEqual(largeSystem('brick-bay-grid', fit({ribbonStoreys: undefined})), plain);
  const R = {storeys: [1], sill: 0.15, h: 0.75, lights: 3, frame: 'frame'};
  const s = largeSystem('brick-bay-grid', fit({ribbonStoreys: [R]}));
  assert.deepEqual(s.ground, plain.ground);
  assert.deepEqual(s.typical, plain.typical);
  assert.deepEqual(Object.keys(s.rowOverrides ?? {}), ['1']);
  assert.equal(s.rowOverrides!['1'].kind, 'ribbon');
  assert.equal(s.rowOverrides!['1'].win!.sill, +(0.15 * 3).toFixed(3));
  // listed bays: a per-bay cycle, the other bays keep the storey's punched row
  const b = largeSystem('blank', fit({ribbonStoreys: [{...R, bays: [0, 1]}]})).rowOverrides!['1'];
  assert.equal(b.cycle!.length, 6);
  assert.deepEqual(b.cycle!.map(x => x.kind), ['ribbon', 'ribbon', 'wall', 'wall', 'wall', 'wall']);
  // the ground storey
  const g = largeSystem('brick-bay-grid', fit({ribbonStoreys: [{...R, storeys: [0]}]}));
  assert.equal(g.ground.kind, 'ribbon');
  assert.equal(g.ground.win!.sill, +(0.15 * 3.5).toFixed(3));
});

test('ribbonStoreyRow with a head panel: glass, then the fascia lights at the top of the band', () => {
  const r = ribbonStoreyRow({storeys: [0], sill: 0.01, h: 0.95, lights: 1, head: {h: 0.25, slot: 'spandrel@rh1k0'}, frame: 'frame'}, 3.5, {glass: 'glass'});
  assert.equal(r.kind, 'stack');
  const [glass, head] = r.stack!;
  assert.equal(glass.row.win!.glass, 'glass');
  assert.equal(head.row.win!.glass, 'spandrel@rh1k0');
  assert.equal(glass.row.win!.sill, 0.035);
  assert.equal(glass.row.win!.h, 0.7125);
  assert.equal(head.row.win!.sill, +((0.01 + 0.7125) * 3.5).toFixed(3));
  assert.equal(head.row.win!.h, 0.2375);
  assert.equal(glass.row.win!.mullAt, undefined);
});

test('ribbonStoreys schema: head panel bounds', () => {
  const base = raw('politie-van-leijenberghlaan'), w0 = {...base.walls[0], baysPerStorey: 6};
  delete w0.entrance;
  const withWall = (w: object) => ({...base, walls: [{...w0, ...w}, ...base.walls.slice(1)]});
  const ok = {storeys: [1], sill: 0.05, h: 0.9, lights: 1, head: {h: 0.25, colour: '#3a7fc4'}};
  assert.ok(validateLargeIntent(withWall({ribbonStoreys: [ok]})));
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, head: {h: 0.5, colour: '#3a7fc4'}, spandrel: {h: 0.5, colour: '#333333'}}]})), /must leave glass/);
  assert.throws(() => validateLargeIntent(withWall({ribbonStoreys: [{...ok, head: {h: 0.25}}]})), /head\.colour/);
});

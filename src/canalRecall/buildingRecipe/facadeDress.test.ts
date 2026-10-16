/**
 * Facade dressing for the large tier (Tropenmuseum fourth pass, 2026-10-16): pane-split glazing (`glazing: "panes"`), stone
 * courses at the windows' sill and head lines (`courses`), a souterrain ground storey (`souterrain`) and an arch band of stone
 * blocks on a brick head (`arches.band: "blocks"`). Schema, the system expansion, the compiled geometry, and that a group
 * without them expands exactly as before.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import type {BuildingFacts} from './facts.ts';
import {archFor, COURSE, largeSystem, SOUTERRAIN, type SystemFit} from '../blockBuilding/systems.ts';
import {PANE_OUT_M, paneRects} from '../blockBuilding/compose.ts';
import {clipConvexRect, polyArea} from '../blockBuilding/arch.ts';

const HOUSES = 'scripts/building-recipes/houses';
const ID = 'beursplein-5-165051';
const raw = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));
const fit = (extra: Partial<SystemFit> = {}): SystemFit => ({pitchM: 3, lines: [0, 3, 7.5, 12], ground: 'system', windows: 'cross', slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame', wall: 'wall'}, ...extra});

test('paneRects: a cross window is four panes inside the ring, split by bars of the given width', () => {
  const r = paneRects(0, 1, 0, 2, 0.07, 0.07, [0.5], [0.7]);
  assert.equal(r.length, 4);
  for (const [a, b, lo, hi] of r) assert.ok(a >= 0.07 - 1e-9 && b <= 0.93 + 1e-9 && lo >= 0.07 - 1e-9 && hi <= 1.93 + 1e-9);
  const xs = [...new Set(r.map(p => +p[1].toFixed(3)))].sort();
  assert.deepEqual(xs, [0.465, 0.93]);
  // a bar that would leave a sliver is dropped
  assert.equal(paneRects(0, 1, 0, 1, 0.07, 0.07, [0.05], []).length, 1);
});

test('clipConvexRect: a round head clipped to a column keeps the area inside both', () => {
  const half: [number, number][] = [[0, 0], [2, 0], ...Array.from({length: 9}, (_, i) => [1 + Math.cos(Math.PI * i / 8), 1 + Math.sin(Math.PI * i / 8)] as [number, number])];
  const left = clipConvexRect(half, 0, 1, 1, 3);
  assert.ok(left.length >= 3);
  assert.ok(Math.abs(polyArea(left)) > 0.6 && Math.abs(polyArea(left)) < Math.PI / 4 + 1e-6);
  assert.deepEqual(clipConvexRect(half, 3, 4, 0, 1), []);
});

test('expansion: no new field, no change (no pane split, lift fraction or souterrain items in the system)', () => {
  const s = JSON.stringify(largeSystem('brick-bay-grid', fit()));
  for (const k of ['paneSplit', 'liftFrac', 'minRun', '"items"', '"ring"']) assert.equal(s.includes(k), false, k);
});

test('courses: sill and head bands at the typical window lines, the per-window sills give way', () => {
  const s = largeSystem('brick-bay-grid', fit({courses: ['sill', 'head'], shape: {w: 0.6, h: 0.5, sillM: 0.8}}));
  assert.equal(s.typical.win?.sillSlot, null);
  const [sill, head] = s.bands!;
  assert.deepEqual([sill.lift, sill.liftFrac, sill.h, sill.minRun], [+(0.8 - COURSE.h / 2).toFixed(3), undefined, COURSE.h, COURSE.minRun]);
  assert.deepEqual([head.lift, head.liftFrac], [+(0.8 + COURSE.h / 2).toFixed(3), 0.5]);
});

test('souterrain: a pair of small lights per bay (one with "single"), arched with arches.ground, no sills', () => {
  const s = largeSystem('brick-bay-grid', fit({souterrain: true, arches: {ground: 'round', band: 'brick'}}));
  const items = s.ground.items![0];
  assert.equal(items.length, 2);
  const S = SOUTERRAIN, gh = 3;
  assert.deepEqual(items[0].v, [+(S.sill * gh).toFixed(3), +((S.sill + S.h) * gh).toFixed(3)]);
  assert.ok(Math.abs((items[0].u[1] - items[0].u[0]) - S.w * 3) < 1e-9 && Math.abs(items[1].u[0] - items[0].u[1] - S.gap * 3) < 1e-9);
  assert.equal(items[0].win?.arch?.kind, 'round');
  assert.equal(items[0].win?.arch?.band, undefined);
  assert.equal(items[0].win?.sillSlot, null);
  assert.equal(items[0].win?.mull, undefined);
  assert.equal(largeSystem('brick-bay-grid', fit({souterrain: 'single'})).ground.items![0].length, 1);
});

test('arch band "blocks": springers and keystone, no ring', () => {
  const a = archFor('round', fit({arches: {windows: 'round', band: 'blocks'}})).arch!;
  assert.equal(a.band?.ring, false);
  assert.equal(a.band?.imposts, 'stone');
  assert.equal(a.band?.keystone, 'stone');
});

test('schema: glazing, courses and souterrain', () => {
  const base = raw(), w0 = base.walls[0];
  const withWall = (w: object) => ({...base, walls: [{...w0, ...w}, ...base.walls.slice(1)]});
  assert.equal(validateLargeIntent(withWall({glazing: 'panes', courses: ['sill', 'head'], souterrain: 'single'})).walls[0].glazing, 'panes');
  assert.throws(() => validateLargeIntent(withWall({glazing: 'panes', frames: false})), /glazing/);
  assert.throws(() => validateLargeIntent(withWall({glazing: 'leaded'})), /glazing/);
  assert.throws(() => validateLargeIntent(withWall({courses: ['sill', 'sill']})), /each line once/);
  assert.throws(() => validateLargeIntent(withWall({courses: ['floor']})), /courses/);
  assert.throws(() => validateLargeIntent(withWall({souterrain: 'double'})), /souterrain/);
  assert.throws(() => validateLargeIntent(withWall({souterrain: true, entrance: true})), /souterrain/);
});

test('fit and compile: a souterrain group has a low ground storey; pane split draws a frame sheet and panes, no bar boxes', () => {
  const base = raw(), f = facts();
  const plain = fitLarge(validateLargeIntent(base), f).recipe.groups[0];
  const dressed = validateLargeIntent({...base, walls: [{...base.walls[0], souterrain: true, glazing: 'panes', windows: 'cross', courses: ['sill']}, ...base.walls.slice(1)]});
  const g = fitLarge(dressed, f).recipe.groups[0];
  const [g0, g1] = g.storeyHeightsM;
  assert.ok(Math.abs(g0 / g1 - SOUTERRAIN.factor) < 0.01, `${g0} / ${g1}`);
  assert.ok(g0 < plain.storeyHeightsM[0]);
  const built = compileLargeBuilding(dressed, f), sys = built.recipe.spec.systems[g.specSystem];
  assert.equal(sys.typical.win?.paneSplit, true);
  assert.equal(sys.ground.items![0][0].win?.paneSplit, true);
  assert.ok(PANE_OUT_M > 0.03, 'panes clear the audit tight z-fight band');
});

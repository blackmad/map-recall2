/**
 * Ground `arcade` (Mercatorplein, 2026-10-14): a recessed shop arcade of chamfered openings between piers, the walk
 * cut `arcade.depth` deep with the shopfronts at the back, a rendered lintel band following the openings' shoulders and
 * pier facings below it. Schema, fit defaults, the compiled geometry (opening depth, facing, closed parts) and that a
 * house without it is unchanged (fit-golden covers every recipe; this checks the system expansion directly).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import type {BuildingFacts} from './facts.ts';
import {archHead, archOutline, polyArea} from '../blockBuilding/arch.ts';
import {ARCADE_PROPORTIONS, largeSystem} from '../blockBuilding/systems.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const ID = 'beursplein-5-165051';

test('chamfered head: flat top, straight shoulders, trapezoid area', () => {
  const w = 4.8, h = 4.2, a = {kind: 'chamfered' as const, rise: 0.16, chamfer: 0.2};
  const head = archHead(0, w, 0, h, a);
  assert.deepEqual(head.map(p => p.map(v => +v.toFixed(6))), [[w, +(h - 0.16 * w).toFixed(6)], [+(w - 0.96).toFixed(6), h], [0.96, h], [0, +(h - 0.16 * w).toFixed(6)]]);
  const o = archOutline(0, w, 0, h, a), s = h - 0.16 * w;
  assert.ok(Math.abs(polyArea(o) - (w * s + 0.16 * w * (w - 0.2 * w))) < 1e-9);
});

test('arcade schema: needs ground "arcade", bounded measures, no unknown keys', () => {
  const base = raw(ID), w0 = base.walls[0];
  const withWall = (w: object) => ({...base, walls: [{...w0, ...w}, ...base.walls.slice(1)]});
  assert.equal(validateLargeIntent(withWall({ground: 'arcade'})).walls[0].ground, 'arcade');
  assert.throws(() => validateLargeIntent(withWall({arcade: {walk: 0.4}})), /needs ground "arcade"/);
  assert.throws(() => validateLargeIntent(withWall({ground: 'arcade', arcade: {walk: 3}})), /arcade\.walk/);
  assert.throws(() => validateLargeIntent(withWall({ground: 'arcade', arcade: {depth: 2}})), /coordinate\/metric/);
  assert.throws(() => validateLargeIntent(withWall({ground: 'arcade', arcade: {gallery: true}})), /arcade\.gallery/);
});

test('arcade fit: kit defaults, intent overrides, a taller ground storey; other grounds expand as before', () => {
  const base = raw(ID), f = facts(ID);
  const plain = fitLarge(validateLargeIntent(base), f).recipe;
  const intent = validateLargeIntent({...base, walls: [{...base.walls[0], ground: 'arcade', arcade: {walk: 0.4, pier: 0.25}}, ...base.walls.slice(1)]});
  const {recipe} = fitLarge(intent, f), g = recipe.groups[0], P = ARCADE_PROPORTIONS;
  assert.equal(g.arcade!.pierM, +(0.25 * g.pitchM).toFixed(3));
  assert.equal(g.arcade!.depthM, +(0.4 * g.storeyHeightsM[0]).toFixed(3));
  assert.deepEqual([g.arcade!.head, g.arcade!.rise, g.arcade!.chamfer, g.arcade!.facing], [P.head, P.rise, P.chamfer, true]);
  const ground = recipe.spec.systems[g.specSystem].ground!;
  assert.equal(ground.kind, 'punched');
  assert.equal(ground.win?.arch?.kind, 'chamfered');
  assert.equal(ground.win?.arch?.depth, g.arcade!.depthM);
  assert.equal(ground.win?.arch?.revealSlot, g.slots.stone);
  assert.ok(Math.abs(ground.win!.w! - (1 - g.arcade!.pierM / g.pitchM)) < 1e-3, `${ground.win!.w} vs ${1 - g.arcade!.pierM / g.pitchM}`);
  // the arcade storey is taller than the plain recipe's ground storey (storeyFactor 1.6)
  assert.ok(g.storeyHeightsM[0] > plain.groups[0].storeyHeightsM[0], `${g.storeyHeightsM[0]} vs ${plain.groups[0].storeyHeightsM[0]}`);
  // without the arcade the expansion is the one the kit always produced (no arcade field reaches the system)
  const s = largeSystem('brick-bay-grid', {pitchM: 3, lines: [0, 4, 7], ground: 'system', slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}});
  assert.equal(JSON.stringify(s).includes('chamfered'), false);
});

test('arcade compile: openings cut deep with shopfronts at the back, lintel band and pier facings drawn', () => {
  const base = raw(ID), f = facts(ID);
  const intent = validateLargeIntent({...base, walls: [{...base.walls[0], ground: 'arcade'}, ...base.walls.slice(1)]});
  const built = compileLargeBuilding(intent, f, {budget: 40000}), walk = built.recipe.groups[0].arcade!.depthM;
  assert.ok((built.components.arcades ?? 0) >= 1, JSON.stringify(built.components));
  const g = built.recipe.groups[0], main = built.panels.find(p => p.index === g.mainPanel)!;
  // glass of the ground storey of the main panel lies `walk` behind its plane (the shopfronts at the back of the walk)
  let deep = 0;
  for (const m of built.group.children as import('three').Mesh[]) {
    if (m.userData.materialSlot !== 'glass') continue;
    const a = m.geometry.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const p = [a.getX(i) - main.o[0], a.getY(i) - main.o[1], a.getZ(i) - main.o[2]], d = p[0] * main.n[0] + p[1] * main.n[1] + p[2] * main.n[2];
      const u = p[0] * main.r[0] + p[1] * main.r[1] + p[2] * main.r[2];
      if (a.getY(i) < g.lines[1] && u > main.uMin && u < main.uMax && Math.abs(d + walk) < 0.1) deep++;
    }
  }
  assert.ok(deep > 20, `glass vertices at the back of the walk: ${deep}`);
  // the facing turns the render band and the dark piers on: stone and door slots both used in the ground storey
  const slots = new Set((built.group.children as import('three').Mesh[]).map(m => m.userData.materialSlot as string));
  assert.ok(slots.has('stone') && slots.has('door'), [...slots].join(','));
  // facing: false leaves them off
  const bare = compileLargeBuilding(validateLargeIntent({...base, walls: [{...base.walls[0], ground: 'arcade', arcade: {facing: false}}, ...base.walls.slice(1)]}), f, {budget: 40000});
  assert.equal(bare.components.arcades ?? 0, 0);
});

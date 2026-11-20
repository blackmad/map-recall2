/**
 * Open void storey and cantilever lip on loggia bands (lane large-buildings-20261120, the Weesperflat's open storey under
 * its upper block): `loggiaBands[].open` draws an unglazed dark void with posts in the recess, `loggiaBands[].lip` a
 * slab proud of the wall over the band. Schema bounds, the byte-identical system without them, post placement, and the
 * compiled Weesperflat (no glass in the void, the lip proud of the face, gates pass in budget).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {Mesh} from 'three';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import {largeSystem, openPostsAt, type SystemFit} from '../blockBuilding/systems.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses', WF = 'weesperflat-169740';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'};

test('open void and lip: schema bounds', () => {
  const base = raw(WF);
  const withBand = (extra: Record<string, unknown>) => {
    const j = structuredClone(base);
    j.walls[0].loggiaBands = [{...j.walls[0].loggiaBands[0], ...extra}];
    for (const k of Object.keys(extra)) if (extra[k] === undefined) delete j.walls[0].loggiaBands[0][k];
    return j;
  };
  assert.ok(validateLargeIntent(withBand({open: {}, lip: undefined})));
  assert.ok(validateLargeIntent(withBand({open: {posts: 2, postW: 0.05}})));
  assert.throws(() => validateLargeIntent(withBand({open: {posts: 5}})), /open\.posts/);
  assert.throws(() => validateLargeIntent(withBand({open: {posts: 1, postW: 0.5}})), /postW/);
  assert.throws(() => validateLargeIntent(withBand({open: {posts: 2, every: 3}})), /only with posts 1/);
  assert.throws(() => validateLargeIntent(withBand({open: {posts: 1, glass: true}})), /open\.glass: unknown/);
  assert.throws(() => validateLargeIntent(withBand({open: {}, back: [{sill: 0, h: 0.5, every: 2, w: 0.8}]})), /not with back/);
  assert.throws(() => validateLargeIntent(withBand({lip: {h: 0.7, out: 0.3}})), /lip\.h/);
  assert.throws(() => validateLargeIntent(withBand({lip: {h: 0.1}})), /lip\.out/);
});

test('open void and lip: posts on bay joints, the system unchanged without them', () => {
  assert.deepEqual(openPostsAt(4, 1), [0.25, 0.5, 0.75]);
  assert.deepEqual(openPostsAt(6, 1, 3), [0.5]);
  assert.deepEqual(openPostsAt(2, 2), [0.1667, 0.3333, 0.6667, 0.8333]);
  const fit: SystemFit = {pitchM: 4, lines: [0, 3.6, 7, 10.4, 13], ground: 'system', slots, bays: 4, shape: {w: 0.8, h: 0.55, sillM: 0.7}};
  const band = {storeys: [1, 1] as [number, number], bays: [0, 3] as [number, number], sillM: 0, headM: 3, deepM: 1.7, lights: 4, rail: 'none' as const, railSlot: 'rail@lb0k0'};
  const glazed = largeSystem('brick-bay-grid', {...fit, loggiaBands: [band]}).recessBands![0];
  for (const k of ['open', 'lip']) assert.equal(JSON.stringify(glazed).includes(`"${k}"`), false, k);
  const open = largeSystem('brick-bay-grid', {...fit, loggiaBands: [{...band, open: {posts: 1, postW: 0.4, every: 2}, lip: {h: 0.4, out: 1}}]}).recessBands![0];
  assert.deepEqual(open.win.loggia!.open, {slot: 'rail@lb0k0', posts: {at: [0.5], w: 0.4}});
  assert.deepEqual(open.lip, {h: 0.4, out: 1});
  assert.deepEqual({...open, lip: undefined, win: {...open.win, loggia: {...open.win.loggia, open: undefined}}}, {...glazed, lip: undefined, win: {...glazed.win, loggia: {...glazed.win.loggia, open: undefined}}});
  const bare = largeSystem('brick-bay-grid', {...fit, loggiaBands: [{...band, open: {posts: 0, postW: 0.4}}]}).recessBands![0];
  assert.deepEqual(bare.win.loggia!.open, {slot: 'rail@lb0k0'});
});

test('open void and lip: the Weesperflat void has no glass, the lip stands proud, gates pass in budget', async () => {
  const intent = validateLargeIntent(raw(WF)), f = facts(WF);
  const {recipe} = fitLarge(intent, f), g = recipe.groups[0];
  const built = compileBuilding(intent, f), main = built.panels.find(p => p.index === g.mainPanel)!;
  const lo = g.lines[4], hi = g.lines[5];
  let glassInVoid = 0, proud = 0;
  for (const m of built.group.children as Mesh[]) {
    const a = m.geometry.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const y = a.getY(i), d = (a.getX(i) - main.o[0]) * main.n[0] + (a.getY(i) - main.o[1]) * main.n[1] + (a.getZ(i) - main.o[2]) * main.n[2];
      if (m.userData.materialSlot === 'glass' && y > lo + 0.2 && y < hi - 0.6 && d < -0.5) glassInVoid++;
      if (y > lo + 0.5 && y < hi + 0.6 && d > 0.6) proud++;
    }
  }
  assert.equal(glassInVoid, 0, 'no glazing in the open storey');
  assert.ok(proud >= 8, `lip vertices more than 0.6 m proud of the face: ${proud}`);
  const tris = await decodeTriangles((await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000})).bytes);
  assert.ok(tris.length <= (intent.budgetTriangles ?? LARGE_BUDGET_TRIANGLES), `${tris.length}`);
  assert.deepEqual(evaluateLargeGates(tris, built).gates.filter(x => !x.pass).map(x => x.id), []);
});

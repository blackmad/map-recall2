// Per-house balconies/loggias in a large-kit row and brick balcony slabs (lane houthavens-memel-wiborg-20261120):
// Wiborgeiland 1-72's quay houses each with their own balcony column, Revaleiland 437's red brick balconies.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';

const HOUSES = 'scripts/building-recipes/houses';
const ID = 'stadhouderskade-111-137448';
const raw = (): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));
const withHouse = (k: number, extra: Record<string, unknown>, group: Record<string, unknown> = {}) => {
  const base = raw();
  return {...base, walls: base.walls.map((w, i) => (i === 0 ? {...w, ...group, houses: w.houses!.map((h, j) => (j === k ? {...h, bays: h.bays ?? 3, ...extra} : h))} : w))};
};
type Row = {kind: string; cycle?: Row[]; balcony?: {slab: {slot: string}; rail: {slot: string}}; loggia?: unknown};
const rowsOf = (sys: unknown): Record<string, Row> => (sys as {rowOverrides?: Record<string, Row>}).rowOverrides ?? {};
const kinds = (r: Row | undefined) => (r?.cycle ?? (r ? [r] : [])).map(x => x.kind);

test('houses[].balconies/loggias: validated within the house', () => {
  assert.doesNotThrow(() => validateLargeIntent(withHouse(0, {balconies: {storeys: [1, 2], bays: [1], rail: 'glass'}})));
  assert.doesNotThrow(() => validateLargeIntent(withHouse(0, {loggias: {storeys: [1], bays: [0, 2], rail: 'bars'}})));
  assert.throws(() => validateLargeIntent(withHouse(0, {balconies: {storeys: [1], bays: [70]}})), /bay indices within the house/);
  assert.throws(() => validateLargeIntent(withHouse(0, {balconies: {storeys: [0]}})), /balconies.storeys/);
  assert.throws(() => validateLargeIntent(withHouse(0, {loggias: {storeys: [1], tilt: 2}})), /loggias.tilt/);
  assert.throws(() => validateLargeIntent(withHouse(0, {}, {balconies: {storeys: [1], brick: 'yes'}})), /balconies.brick/);
});

test('houses[].balconies: only that house gets them, on its listed bays; other houses unchanged', () => {
  const plain = fitLarge(validateLargeIntent(withHouse(0, {})), facts()).recipe;
  const with1 = fitLarge(validateLargeIntent(withHouse(0, {balconies: {storeys: [2], bays: [1], rail: 'glass'}})), facts()).recipe;
  const segs = plain.groups[0].houses!.segs;
  for (let k = 1; k < segs.length; k++) assert.deepEqual(with1.spec.systems[segs[k].system], plain.spec.systems[segs[k].system]);
  const row = rowsOf(with1.spec.systems[segs[0].system])['2'];
  assert.equal(kinds(row)[1], 'balcony');
  assert.equal(kinds(row).filter(k => k === 'balcony').length, 1, 'one balcony bay in the house');
  assert.equal(rowsOf(plain.spec.systems[segs[0].system])['2'], undefined, 'absent: no balcony row');
});

test('balconies.brick: the slab is the wall slot; absent keeps the stone slab', () => {
  const stone = fitLarge(validateLargeIntent(withHouse(0, {balconies: {storeys: [2]}})), facts()).recipe;
  const brick = fitLarge(validateLargeIntent(withHouse(0, {balconies: {storeys: [2], rail: 'solid'}}, {balconies: {storeys: [3], brick: true, rail: 'solid'}})), facts()).recipe;
  const s0 = stone.groups[0].houses!.segs[0].system, b0 = brick.groups[0].houses!.segs[0].system;
  const sb = rowsOf(stone.spec.systems[s0])['2'], bb = rowsOf(brick.spec.systems[b0])['2'];
  assert.match(sb.balcony!.slab.slot, /^stone/);
  assert.match(bb.balcony!.slab.slot, /^wall/);
  assert.match(bb.balcony!.rail.slot, /^wall/, 'a solid rail is the brick parapet');
  assert.match((bb.balcony!.rail as unknown as {top: string}).top, /^wall/, 'with a brick coping, no pale line over it');
});

test('balconies.edge / pane / posts: own slots on the balcony row; validated; absent keeps the stone slab and rail infill', async () => {
  assert.throws(() => validateLargeIntent(withHouse(0, {}, {balconies: {storeys: [3], edge: 'not-a-colour'}})), /balconies.edge/);
  assert.throws(() => validateLargeIntent(withHouse(0, {}, {balconies: {storeys: [3], posts: {colour: '#c8c4bc', w: 0.9}}})), /posts.w/);
  const fit = fitLarge(validateLargeIntent(withHouse(0, {balconies: {storeys: [2], rail: 'glass'}}, {balconies: {storeys: [3], rail: 'glass', edge: '#d8d6d0', pane: '#a8bcc0', posts: {colour: '#c8c4bc', w: 0.1}}})), facts()).recipe;
  const b = rowsOf(fit.spec.systems[fit.groups[0].houses!.segs[0].system])['2'];
  const bal = (kinds(b).includes('balcony') ? (b.cycle ?? [b]).find(x => x.kind === 'balcony')! : b).balcony as unknown as {slab: {slot: string}; rail: {pane?: string}; posts?: {slot: string; w: number}};
  assert.match(bal.slab.slot, /^edge@bg0/);
  assert.match(bal.rail.pane!, /^pane@bg0/);
  assert.match(bal.posts!.slot, /^post@bg0/);
  const plain = fitLarge(validateLargeIntent(withHouse(0, {balconies: {storeys: [2], rail: 'glass'}})), facts()).recipe;
  const pb = rowsOf(plain.spec.systems[plain.groups[0].houses!.segs[0].system])['2'];
  const pbal = (pb.cycle ?? [pb]).find(x => x.kind === 'balcony')!.balcony as unknown as {slab: {slot: string}; rail: {pane?: string}; posts?: unknown};
  assert.match(pbal.slab.slot, /^stone/); assert.equal(pbal.rail.pane, undefined); assert.equal(pbal.posts, undefined);
});

test('balconies.posts: the fins add geometry in their own slot', () => {
  const posts = compileLargeBuilding(validateLargeIntent(withHouse(0, {}, {balconies: {storeys: [3], rail: 'glass', posts: {colour: '#c8c4bc'}}})), facts(), {budget: 1e9});
  let n = 0; posts.group.traverse(o => { const m = o as T.Mesh; if (m.isMesh && /post@bg0/.test(m.name)) n++; });
  assert.ok(n > 0, 'a mesh in the post slot');
});

test('houses[].balconies.edge / pane: the house balcony in its own slots', () => {
  const fit = fitLarge(validateLargeIntent(withHouse(0, {balconies: {storeys: [2], rail: 'glass', edge: '#d8d6d0', pane: '#a8bcc0'}})), facts()).recipe;
  const b = rowsOf(fit.spec.systems[fit.groups[0].houses!.segs[0].system])['2'];
  const bal = (b.cycle ?? [b]).find(x => x.kind === 'balcony')!.balcony as unknown as {slab: {slot: string}; rail: {pane?: string}};
  assert.equal(bal.slab.slot, 'edge@g0h0'); assert.equal(bal.rail.pane, 'pane@g0h0');
  assert.throws(() => validateLargeIntent(withHouse(0, {balconies: {storeys: [2], edge: 'not-a-colour'}})), /balconies.edge/);
});

/** Measured-facade schema (2026-10-14): `palette.glass`, `windowShape`, `hand`, `measured`, source-data images. Opt-in, default fit unchanged. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge, KIT_GLASS} from './fitLarge.ts';
import type {BuildingFacts} from './facts.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'politie-van-leijenberghlaan';
const raw = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));

test('measured schema: fractions only, known keys, source-data images need a sha256', () => {
  const base = raw(), w0 = base.walls[0];
  const ok = {...base, palette: {...base.palette, glass: '#3c4448'}, measured: {date: '2026-10-14', groups: [0]},
    walls: [{...w0, palette: {...w0.palette, glass: '#404850'}, windowShape: {w: 0.55, h: 0.7, sill: 0.15}, hand: ['baysPerStorey', 'palette.frame']}, ...base.walls.slice(1)]};
  assert.equal(validateLargeIntent(ok).id, ID);
  const bad = (patch: object, re: RegExp) => assert.throws(() => validateLargeIntent({...base, walls: [{...w0, ...patch}, ...base.walls.slice(1)]}), re);
  bad({windowShape: {w: 1.4, h: 0.7, sill: 0.1}}, /windowShape.w/);
  bad({windowShape: {w: 0.5, h: 0.8, sill: 0.3}}, /leave a head/);
  bad({windowShape: {w: 0.5, h: 0.6, sill: 0.1, widthM: 2}}, /widthM/);
  bad({hand: ['nonsense']}, /hand/);
  assert.throws(() => validateLargeIntent({...base, sources: [{...base.sources[0], image: 'source-data://pand-reference-walls/x/w01-1.jpg'}]}), /sha256/);
  assert.throws(() => validateLargeIntent({...base, measured: {date: '2026-10-14', groups: [99]}}), /measured.groups/);
});

test('measured schema: palette.glass gets its own slot, windowShape sizes the windows, absent fields leave the fit unchanged', () => {
  const base = validateLargeIntent(raw()), f = facts();
  const plain = fitLarge(base, f).recipe;
  assert.equal(plain.spec.palette.glass, KIT_GLASS);
  const w0 = base.walls[0];
  const intent = validateLargeIntent({...base, palette: {...base.palette, glass: '#3c4448'}, walls: [{...w0, palette: {...w0.palette, glass: '#405060'}, windowShape: {w: 0.55, h: 0.7, sill: 0.15}}, ...base.walls.slice(1)]});
  const r = fitLarge(intent, f).recipe, g = r.groups[0];
  assert.equal(r.spec.palette.glass, '#3c4448');
  assert.equal(g.slots.glass, 'glass@g0');
  assert.equal(r.spec.palette['glass@g0'], '#405060');
  const win = r.spec.systems[g.specSystem].typical.win!;
  assert.equal(win.w, 0.55); assert.equal(win.h, 0.7);
  assert.ok(Math.abs(win.sill! - 0.15 * g.storeyHeightsM[1]) < 0.002, `sill ${win.sill}`);
  assert.equal(r.groups[1].slots.glass, 'glass');
  assert.deepEqual(r.spec.systems[r.groups[1].specSystem], plain.spec.systems[plain.groups[1].specSystem]);
});

// Houthavenkade 26 g0: yellow-brown and dark brick on one 3DBAG plane, split at ~42 % of the main panel (measure.ts).
test('wallSplit: validated; the main panel wall right of a bay boundary gets the second colour; absent leaves the mesh unchanged', async () => {
  const {compileLargeBuilding} = await import('./largeCompile.ts');
  const {splitAtBay} = await import('./fitLarge.ts');
  const base = validateLargeIntent(raw()), f = facts(), w0 = base.walls[0];
  const bad = (patch: object, re: RegExp) => assert.throws(() => validateLargeIntent({...base, walls: [{...w0, ...patch}, ...base.walls.slice(1)]}), re);
  bad({wallSplit: {at: 0.95, brick: '#514a49'}}, /wallSplit.at/);
  bad({wallSplit: {at: 0.5, brick: 'mauve-ish'}}, /wallSplit.brick/);
  bad({wallSplit: {at: 0.5, brick: '#514a49', u: 3}}, /wallSplit.u/);
  assert.equal(splitAtBay(0, 30, 3, 0.42), 12);
  assert.equal(splitAtBay(0, 30, 3, 0.02), 3, 'never the panel end');
  const plain = compileLargeBuilding(base, f);
  const split = compileLargeBuilding(validateLargeIntent({...base, walls: [{...w0, palette: {...w0.palette, brick: '#796a55'}, wallSplit: {at: 0.5, brick: '#514a49'}}, ...base.walls.slice(1)]}), f);
  const g = split.recipe.groups[0], slot = `${g.slots.wall}/r`;
  assert.equal(g.split?.slot, slot);
  assert.equal(split.recipe.spec.palette[slot], '#514a49');
  const names = (c: typeof plain) => c.group.children.map(m => m.name);
  assert.ok(names(split).includes(`wall/${slot}`), names(split).join(','));
  assert.ok(!names(plain).some(n => n.endsWith('/r')));
  // the same surface (straddling triangles are clipped, not dropped), and the right slot lies right of the split
  const area = (c: typeof plain) => c.group.children.reduce((n, m) => {
    const q = (m as any).geometry.attributes.position.array as Float32Array; let s = 0;
    for (let i = 0; i < q.length; i += 9) { const e1 = [q[i + 3] - q[i], q[i + 4] - q[i + 1], q[i + 5] - q[i + 2]], e2 = [q[i + 6] - q[i], q[i + 7] - q[i + 1], q[i + 8] - q[i + 2]]; s += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2; }
    return n + s;
  }, 0);
  assert.ok(Math.abs(area(split) - area(plain)) < 0.05, `${area(split)} vs ${area(plain)}`);
  const p = split.panels.find(q => q.index === g.split!.panel)!, right = split.group.children.find(m => m.name === `wall/${slot}`) as any;
  const q = right.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < q.length; i += 3) assert.ok((q[i] - p.o[0]) * p.r[0] + (q[i + 1] - p.o[1]) * p.r[1] + (q[i + 2] - p.o[2]) * p.r[2] >= g.split!.uM - 0.01);
});

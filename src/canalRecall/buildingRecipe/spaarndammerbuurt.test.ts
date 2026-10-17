/**
 * Amsterdam School kit components on the Spaarndammerbuurt types: horizontal brick stripes (`brickStripes`,
 * brickStripes.ts), lisenes on bay edges inside the front (`lisenes.at`), and the round-arched portiek door
 * (`doorArch`). Validation, geometry against the fit, mirroring; without the keys the output is unchanged.
 *   node --import tsx --test src/canalRecall/buildingRecipe/spaarndammerbuurt.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {fitIntent} from './fit.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {brickStripeBlocks, mirrorStripeZone} from './brickStripes.ts';
import {mirrorFront, resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const HEMBRUG = '0363100012110068', POLANEN = '0363100012087668';
const factsOf = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const box = (m: T.Mesh) => new T.Box3().setFromBufferAttribute(m.geometry.getAttribute('position') as T.BufferAttribute);

function house(typeId: string, pand: string, street: string, strip: (f: FrontIntent) => void = () => {}, mirror = false): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...(mirror ? {mirror: true} : {})}, street).design;
  design.fronts.forEach(strip);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `${typeId}-${pand.slice(-6)}`, pandId: pand, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2022-12-14'}], ...design} as CanalHouseIntent);
}
const hembrug = (strip?: (f: FrontIntent) => void, mirror = false) => house('hembrug-1925-white-attic', HEMBRUG, 'Hembrugstraat', strip, mirror);

test('validation: stripe zones, inner lisenes and the arched door', () => {
  const base = hembrug();
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.throws(front({brickStripes: [{rise: [2.4, 2.5], pitch: 0.24, stripe: 0.1}]}), /brickStripes\[0\].rise/);
  assert.throws(front({brickStripes: [{rise: [2.4, 3.6], pitch: 0.24, stripe: 0.23}]}), /brickStripes\[0\].stripe/);
  assert.throws(front({brickStripes: [{rise: [2.4, 3.6], pitch: 0.24, stripe: 0.1, span: [0.6, 0.4]}]}), /brickStripes\[0\].span/);
  assert.throws(front({brickStripes: [{bottom: 2.4, top: 3.6, pitch: 0.24, stripe: 0.1}]}), /brickStripes/);
  assert.throws(front({lisenes: {at: [0]}}), /lisenes.at/);
  assert.throws(front({lisenes: {at: [3, 2]}}), /lisenes.at/);
  assert.throws(front({lisenes: {at: [2], breadth: 1.2}}), /lisenes.breadth/);
  assert.throws(front({lisenes: {leftEnd: 'half', breadth: 0.3}}), /lisenes.breadth: only with at/);
  assert.throws(front({lisenes: {at: [2], stopStorey: 9}}), /lisenes.stopStorey/);
  assert.throws(front({doorArch: {span: 3, apex: 3}}), /doorArch/);
  assert.throws(front({doorArch: {span: 1.6, apex: 1.9}}), /doorArch/);
  assert.throws(front({doorBay: null, doorArch: {span: 1, apex: 2.5}}), /doorArch: needs a doorBay/);
  const noBand = hembrug();
  noBand.palette = {...noBand.palette};
  delete noBand.palette.band;
  assert.throws(() => validateIntent(noBand), /brickStripes: needs palette.band/);
});

test('brickStripeBlocks: stripes inside the rise, on the span, mirrored onto the other side', () => {
  const zone = {rise: [2.45, 3.6] as [number, number], pitch: 0.24, stripe: 0.1, span: [0.2, 0.4] as [number, number]};
  const blocks = brickStripeBlocks([zone], 10, (x) => x);
  assert.equal(blocks.length, 5);
  assert.deepEqual(blocks.map(b => b.bottomM), [2.45, 2.69, 2.93, 3.17, 3.41]);
  assert.ok(blocks.every(b => b.leftM === 2 && Math.abs(b.widthM - 2) < 1e-3 && b.surface === 'accent'));
  assert.deepEqual(mirrorStripeZone(zone).span, [0.6, 0.8]);
  assert.equal(mirrorStripeZone({...zone, span: undefined}).span, undefined);
});

test('Hembrugstraat 132: lisenes either side of the staircase axis stop under the white attic; stripes over the door', async () => {
  const intent = hembrug(), fit = fitIntent(intent, factsOf('hembrug-44-154', HEMBRUG)).report.fronts[0];
  assert.equal(fit.lisenes?.length, 2);
  const [a, b] = fit.lisenes!;
  const floor4 = fit.storeyHeightsM.slice(0, 4).reduce((s, h) => s + h, 0);
  for (const l of fit.lisenes!) { assert.equal(l.widthM, 0.3); assert.ok(Math.abs(l.topM - (floor4 - 0.05)) < 1e-2, `top ${l.topM} vs ${floor4}`); assert.ok(Math.abs(l.bottomM - fit.storeyHeightsM[0]) < 1e-2); }
  // Centred on the staircase bay's edges (2.5 + 2.0 and + 3.35 of 12.35 relative widths), symmetric about the front's middle.
  assert.ok(Math.abs((a.leftM + b.leftM + 0.3) / 2 - fit.widthM / 2) < 0.02, 'symmetric about the staircase axis');
  const built = await compileBuilding(intent, factsOf('hembrug-44-154', HEMBRUG));
  assert.equal(meshes(built.group, /^lisenes\//).length, 1);
  const stripes = meshes(built.group, /bands\/stripe-z0-\d+\/piece-\d+$/);
  assert.ok(stripes.length >= 5, `stripe pieces ${stripes.length}`);
  for (const m of stripes) { const bb = box(m); assert.ok(bb.min.y >= 2.44 && bb.max.y <= 3.61, `stripe ${bb.min.y}..${bb.max.y}`); }
});

test('mirrored: inner lisenes move to the mirrored edges, the stripe span flips', () => {
  const front = hembrug().fronts[0];
  const m = mirrorFront({...front, lisenes: {at: [1], breadth: 0.3}, brickStripes: [{rise: [1, 2], pitch: 0.3, stripe: 0.1, span: [0.1, 0.3]}]});
  assert.deepEqual(m.lisenes?.at, [4]);
  assert.equal(m.lisenes?.breadth, 0.3);
  assert.deepEqual(m.brickStripes?.[0].span, [0.7, 0.9]);
});

test('Polanenstraat 237: a round-arched 0.9 m door at the party wall, no transom', async () => {
  const intent = house('polanen-1935-white-attic', POLANEN, 'Polanenstraat');
  const {recipe} = fitIntent(intent, factsOf('polanen-181-331', POLANEN));
  const openings = recipe.elevations[0].openings.value, door = openings.find(o => o.id === 'door')!;
  assert.equal(door.widthM, 0.9);
  assert.equal(door.head, 'segmental');
  assert.equal(door.headRiseM, 0.45);
  assert.ok(Math.abs(door.bottomM + door.heightM - 2.6) < 0.05, `apex ${door.bottomM + door.heightM}`);
  assert.ok(!openings.some(o => o.id === 'door-transom'));
  assert.ok(door.leftM < 0.1, `at the party wall: ${door.leftM}`);
  // casement-sidelights-toplight: side lights at 0.14/0.86 under one top light; bars 3.5 cm (5 cm bars on 1.45 m
  // segments sit over the zfight-tight patch floor).
  const wide = openings.find(o => o.id === 's1-b1')! as unknown as {verticalBars?: number[]; horizontalBars?: number[]; mullionWidthM?: number};
  assert.deepEqual(wide.verticalBars, [0.14, 0.86]);
  assert.deepEqual(wide.horizontalBars, [0.86]);
  assert.equal(wide.mullionWidthM, 0.035);
  await compileBuilding(intent, factsOf('polanen-181-331', POLANEN));
});

test('without the keys: the fit is unchanged', () => {
  const plain = (f: FrontIntent) => { delete f.brickStripes; delete f.lisenes; };
  const a = fitIntent(hembrug(plain), factsOf('hembrug-44-154', HEMBRUG));
  assert.equal(a.report.fronts[0].lisenes, undefined);
  assert.ok(!a.recipe.elevations[0].bands!.value.some(b => b.id.startsWith('stripe-')));
  const pol = house('polanen-1935-white-attic', POLANEN, 'Polanenstraat', f => { delete f.doorArch; });
  const door = fitIntent(pol, factsOf('polanen-181-331', POLANEN)).recipe.elevations[0].openings.value.find(o => o.id === 'door')!;
  assert.equal(door.head, undefined);
});

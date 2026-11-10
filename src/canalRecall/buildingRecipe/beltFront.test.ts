/**
 * Canal-belt front details (beltFront.ts; Keizersgracht 608-616A, docs/reports/gg-zuid-strip-verdict-20261110.md):
 * white window frames and eared surrounds, the street-level door in the base, the door surround, stoop rails, the
 * attic light width, the wing depth of a neck gable, the entablature's dentil row and the sash-1-over-1 window.
 * Fixtures: the installed keizersgracht-596-648 r1/r2 faces. Every field is opt-in, and the same houses without them fit as before.
 *   node --import tsx --test src/canalRecall/buildingRecipe/beltFront.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateIntent, WINDOWS, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {fitIntent} from './fit.ts';
import {BELT_FRONT, beltFrontProblems, earedFrame, earedStoreys} from './beltFront.ts';
import {ENTABLATURE, entablatureCornice, entablatureProblems} from './entablature.ts';
import {crownLandmarks, gableOrnaments} from './gableOrnament.ts';
import {houseIntents} from '../blockFace/intent.ts';
import {mirrorFront} from '../blockFace/houseType.ts';
import type {BuildingFacts} from './facts.ts';

const F = 'scripts/block-face/faces';
const face = (id: string) => JSON.parse(fs.readFileSync(`${F}/${id}/intent.json`, 'utf8'));
const facts = (id: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`${F}/${id}/pands/${pand}/facts.json`, 'utf8'));
const R1 = 'keizersgracht-596-648-r1', R2 = 'keizersgracht-596-648-r2';
const P616A = '0363100012175655', P614 = '0363100012175654', P610 = '0363100012167896', P608 = '0363100012176066';
const intentOf = (run: string, pand: string) => houseIntents(face(run)).find(i => i.pandId === pand)!;
const fit = (i: CanalHouseIntent, run: string) => fitIntent(i, facts(run, i.pandId));
const without = (i: CanalHouseIntent, keys: (keyof FrontIntent)[], extra: Partial<FrontIntent> = {}) => {
  const front = {...i.fronts[0], ...extra} as Record<string, unknown>;
  for (const k of keys) delete front[k];
  return validateIntent({...i, fronts: [front as unknown as FrontIntent]});
};

test('validator: the belt fields are typed and checked', () => {
  const base = {storeys: 4, bays: 3, doorBay: null, basement: 'windows', souterrain: true};
  assert.deepEqual(beltFrontProblems({...base, windowFrames: {frame: 0.12, eared: {upper: 2}}, basementDoor: 0}, 'f'), []);
  assert.equal(beltFrontProblems({...base, windowFrames: {frame: 0.3}}, 'f').length, 1);
  assert.equal(beltFrontProblems({...base, windowFrames: {frame: 0.12, eared: {upper: 5}}}, 'f').length, 1);
  assert.equal(beltFrontProblems({...base, windowFrames: {width: 0.12}}, 'f').length, 1);
  assert.equal(beltFrontProblems({...base, basementDoor: 3}, 'f').length, 1);
  assert.match(beltFrontProblems({...base, doorBay: 0, basementDoor: 0}, 'f').join(), /doorBay null/);
  assert.match(beltFrontProblems({...base, basement: 'stoop-and-windows', basementDoor: 0}, 'f').join(), /souterrain/);
  assert.match(beltFrontProblems({...base, stoopRails: {rail: 0.9}}, 'f').join(), /needs a stoop/);
  assert.equal(beltFrontProblems({...base, basement: 'stoop', doorBay: 0, stoopRails: {rail: 2}}, 'f').length, 1);
  assert.match(beltFrontProblems({...base, doorSurround: {pilaster: 0.2, cap: 0.3}}, 'f').join(), /needs a door/);
  assert.equal(beltFrontProblems({...base, atticWindowWidth: 3}, 'f').length, 1);
  assert.ok((WINDOWS as readonly string[]).includes('sash-1-over-1'));
});

test('616A: the street door in the base on the left bay, no stoop door; white frames; eared surrounds on the top two storeys only', () => {
  const i = intentOf(R1, P616A), f = i.fronts[0];
  assert.equal(f.basementDoor, 0); assert.equal(f.doorBay, null);
  const {recipe} = fit(i, R1), el = recipe.elevations[0], ops = el.openings!.value;
  const door = ops.find(o => o.id === 'basement-door')!;
  assert.ok(door && door.kind === 'door' && door.bottomM === BELT_FRONT.baseDoorBottomM && door.trimWidthM === BELT_FRONT.baseDoorFrameM);
  assert.ok(!ops.some(o => o.id === 'door'), 'no bel-etage door');
  assert.ok(!el.entrance, 'no stoop');
  assert.ok(!ops.some(o => o.id === 'basement-b0'), 'the door replaces the left basement light');
  assert.ok(ops.filter(o => /^s\d+-b\d+$/.test(o.id)).every(o => o.trimWidthM === 0.12), 'white frames 0.12 m');
  const eared = el.dressings!.value.filter(d => d.id.startsWith('eared-head-')).map(d => d.id.replace('eared-head-', ''));
  assert.deepEqual([...new Set(eared.map(id => id.split('-')[0]))].sort(), ['s2', 's3']);
  assert.deepEqual(earedStoreys(f.windowFrames!, 4), [2, 3]);
  // Without the belt fields the same front fits with the stoop-less default frames and no eared dressing.
  const plain = fit(without(i, ['windowFrames', 'basementDoor']), R1).recipe.elevations[0];
  assert.ok(plain.openings!.value.filter(o => /^s\d+-b\d+$/.test(o.id)).every(o => o.trimWidthM === 0.07));
  assert.ok(!(plain.dressings?.value ?? []).some(d => d.id.startsWith('eared-')));
});

test('614 is mirrored: the base door moves to the right bay', () => {
  const i = intentOf(R1, P614);
  assert.equal(i.fronts[0].basementDoor, 1);
  assert.equal(mirrorFront({...i.fronts[0], basementDoor: 0}).basementDoor, 1);
});

test('610: pilasters and a cap round the stoop door and fanlight, clear of the door frame; rails on the stoop', () => {
  const i = intentOf(R2, P610), {recipe} = fit(i, R2), el = recipe.elevations[0];
  const ops = el.openings!.value, door = ops.find(o => o.id === 'door')!, fan = ops.find(o => o.id === 'door-transom')!;
  const ds = el.dressings!.value.filter(d => d.id.startsWith('door-')) as {id: string; leftM: number; widthM: number; bottomM: number; heightM: number; depthM: number}[];
  const l = ds.find(d => d.id === 'door-pilaster-l')!, r = ds.find(d => d.id === 'door-pilaster-r')!, cap = ds.find(d => d.id === 'door-cap')!;
  assert.ok(Math.abs(door.leftM - (l.leftM + l.widthM) - BELT_FRONT.jointM) < 0.002);
  assert.ok(Math.abs(r.leftM - (door.leftM + door.widthM) - BELT_FRONT.jointM) < 0.002);
  assert.ok(Math.abs(cap.bottomM - (fan.bottomM + fan.heightM)) < 0.002, 'the cap stands on the fanlight');
  assert.ok(ds.every(d => d.depthM <= 0.12), 'the library takes dressings up to 0.12 m deep');
  assert.deepEqual(el.entrance!.value.rails, {heightM: 0.9, widthM: BELT_FRONT.railWidthM, sides: ['left', 'right']});
  const plain = fit(without(i, ['doorSurround', 'stoopRails']), R2).recipe.elevations[0];
  assert.ok(!(plain.dressings?.value ?? []).some(d => d.id.startsWith('door-')));
  assert.equal(plain.entrance!.value.rails, undefined);
});

test('608: the neck light at the measured width; wing pieces at the measured depth', () => {
  const i = intentOf(R2, P608), {recipe} = fit(i, R2);
  const attic = recipe.elevations[0].openings!.value.filter(o => /attic/.test(o.id));
  assert.ok(attic.length >= 1 && attic.every(o => o.widthM === 1.4));
  // 608's fitted neck outline (crown-local metres).
  const profile: [number, number][] = [[0, 15.64], [0.42, 15.68], [0.83, 15.78], [1.2, 15.95], [1.52, 16.19], [1.79, 16.47], [1.99, 16.8], [2.12, 17.15], [2.16, 17.51], [2.16, 19.39], [3.72, 19.81], [5.28, 19.39], [5.28, 17.51], [5.32, 17.15], [5.44, 16.8], [5.64, 16.47], [5.91, 16.19], [6.24, 15.95], [6.61, 15.78], [7.02, 15.68], [7.44, 15.64]];
  assert.ok(crownLandmarks(profile));
  const wingArea = (wingDepth?: number) => {
    const o = gableOrnaments({ornament: {wings: 'scrolls', ...(wingDepth ? {wingDepth} : {})}, profile, eavesM: 15.64, widthM: 7.44, idPrefix: ''}).ornaments.find(x => x.id === 'wing-l')!;
    return Math.abs(o.profile.reduce((t, p, k) => { const q = o.profile[(k + 1) % o.profile.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  };
  assert.ok(wingArea(1.8) > 1.3 * wingArea(), 'a 1.8 m wing fills the shoulder down to the eaves');
  
});

test('entablature: a dentil row under the cap, kept off the party walls; none = the same cornice', () => {
  const base = {rise: 2.4, cap: 0.5, frieze: 'trim' as const, architrave: 0.15};
  assert.deepEqual(entablatureProblems({cornice: 'frieze', entablature: {...base, dentils: {pitch: 0.45, block: 0.15, rise: 0.3}}} as unknown as FrontIntent, 'f'), []);
  assert.equal(entablatureProblems({cornice: 'frieze', entablature: {...base, dentils: {pitch: 0.45, block: 0.5, rise: 0.3}}} as unknown as FrontIntent, 'f').length, 1);
  const c = entablatureCornice({...base, dentils: {pitch: 0.45, block: 0.15, rise: 0.3}}, 19.3, 7.5), d = c.accents!;
  assert.ok(d.length >= 10 && d.every(a => Math.abs(a.bottomM + a.heightM - (19.3 - 0.5)) < 0.002));
  assert.ok(d[0].leftM >= ENTABLATURE.dentilInsetM - 0.001 && d.at(-1)!.leftM + d.at(-1)!.widthM <= 7.5 - ENTABLATURE.dentilInsetM + 0.001);
  const {accents, ...rest} = entablatureCornice({...base, dentils: {pitch: 0.45, block: 0.15, rise: 0.3}}, 19.3, 7.5);
  assert.ok(accents);
  assert.deepEqual(entablatureCornice(base, 19.3, 7.5), rest);
});

test('eared frame: jambs, a head running past them and two ears, all painted (trim)', () => {
  const out = earedFrame({leftM: 1, bottomM: 10, widthM: 1.2, heightM: 2}, 's2-b0', 7.5, {upper: 2});
  assert.deepEqual(out.map(d => d.id.replace('-s2-b0', '')), ['eared-head', 'eared-jamb-l', 'eared-jamb-r', 'eared-ear-l', 'eared-ear-r']);
  assert.ok(out.every(d => d.surface === 'trim' && d.depthM <= 0.12));
  const head = out[0];
  assert.ok(Math.abs(head.leftM - (1 - BELT_FRONT.bandM - BELT_FRONT.earM)) < 0.002 && Math.abs(head.bottomM - 12) < 0.002);
});

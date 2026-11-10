import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {houseIntents} from '../blockFace/intent.ts';
import type {CanalhouseOpening} from '../canalhouseRecipes.ts';
import {fitIntent} from './fit.ts';
import {validateIntent} from './intent.ts';
import {ROSETTE, rosetteOrnaments, rosettesInPlaceOfWindows} from './rosettes.ts';

const win = (id: string, leftM: number, bottomM: number): CanalhouseOpening => ({id, kind: 'window', leftM, bottomM, widthM: 0.9, heightM: 1.6, trimWidthM: 0.07});

test('rosettes take their windows out and stand at the window centres', () => {
  const openings = [win('s1-b0', 0.5, 5), win('s1-b1', 2.3, 5), win('s2-b1', 2.3, 8), win('s0-b1', 2.3, 1), {...win('d', 2.3, 0), kind: 'door' as const}];
  const cut = rosettesInPlaceOfWindows(openings, [{bays: [1], storeys: [1, 2, 3]}]);
  assert.deepEqual(cut.openings.map(o => o.id), ['s1-b0', 's0-b1', 'd']);
  assert.deepEqual(cut.discs.map(d => [d.id, d.cx, d.cy]), [['rosette-s1-b1', 2.75, 5.8], ['rosette-s2-b1', 2.75, 8.8]]);
  assert.equal(cut.discs[0].d, ROSETTE.defaultDiameterM);
  assert.deepEqual(cut.missing, ['storey 3 axis 1: no window there']);
  const parts = rosetteOrnaments(cut.discs[0], 'nassaukade-');
  assert.deepEqual(parts.map(p => [p.id, p.fill]), [['nassaukade-rosette-s1-b1-ring-a', 'stone'], ['nassaukade-rosette-s1-b1-ring-b', 'stone'], ['nassaukade-rosette-s1-b1-boss', 'stone']]);
  assert.ok(parts.every(p => p.depthM >= 0.085), 'every part stands past the audit\'s 2-8 cm near-z-fight band');
  // No overlap: the ring's points lie between the field and outer radii, the boss inside the field (the wall shows between).
  const r = cut.discs[0].d / 2, dist = (q: readonly number[]) => Math.hypot(q[0] - cut.discs[0].cx, q[1] - cut.discs[0].cy);
  for (const p of parts.slice(0, 2)) assert.ok(p.profile.every(q => dist(q) >= r * ROSETTE.fieldShare - 1e-3 && dist(q) <= r + 1e-3));
  assert.ok(parts[2].profile.every(q => dist(q) <= r * ROSETTE.bossShare + 1e-3) && ROSETTE.bossShare < ROSETTE.fieldShare);
  assert.equal(parts[2].profile.length, ROSETTE.segments);
});

test('no rosettes: openings untouched (byte-identical)', () => {
  const openings = [win('s1-b0', 0.5, 5), win('s1-b1', 2.3, 5)];
  const cut = rosettesInPlaceOfWindows(openings, []);
  assert.deepEqual(cut.openings, openings); assert.equal(cut.discs.length, 0);
});

const face = JSON.parse(fs.readFileSync('scripts/block-face/faces/clercq-236681/intent.json', 'utf8'));
const corner = () => structuredClone(houseIntents(face).find(i => i.pandId.endsWith('116526'))!);
const facts = JSON.parse(fs.readFileSync('scripts/block-face/faces/clercq-236681/pands/0363100012116526/facts.json', 'utf8'));

test('Nassaukade 151-152: three rosettes up axis 1 and two stone towers on the cornice (#354)', () => {
  const fit = fitIntent(corner(), facts), el = fit.recipe.elevations.find(e => e.id === 'nassaukade')!;
  const ids = el.openings.value.map(o => o.id);
  for (const s of [1, 2, 3]) assert.ok(!ids.includes(`nassaukade-s${s}-b1`), `window s${s}-b1 replaced`);
  assert.equal(el.ornaments!.value.filter(o => /rosette/.test(o.id)).length, 9);
  const towers = fit.report.fronts.find(f => f.id === 'nassaukade')!.towers!;
  assert.equal(towers.length, 2);
  assert.ok(towers.every(t => t.finish === 'stone' && t.cap === 'flat'));
  const facings = el.bands!.value.filter(b => /towers\d-facing/.test(b.id) && b.surface === 'stone');
  assert.equal(ids.filter(i => /towers\d-/.test(i)).length, 2, 'one light per tower');
  assert.equal(facings.length, 8, 'per tower: two piers, a panel below and a panel above its light');
  assert.ok(facings.every(b => b.depthM >= 0.085), 'past the audit\'s 2-8 cm near-z-fight band');
  const lights = el.openings.value.filter(o => /towers\d-/.test(o.id)), overlap = (a: {leftM: number; widthM: number; bottomM: number; heightM: number}, b: typeof a) =>
    Math.min(a.leftM + a.widthM, b.leftM + b.widthM) - Math.max(a.leftM, b.leftM) > 1e-3 && Math.min(a.bottomM + a.heightM, b.bottomM + b.heightM) - Math.max(a.bottomM, b.bottomM) > 1e-3;
  const withTrim = lights.map(l => ({leftM: l.leftM - l.trimWidthM, widthM: l.widthM + 2 * l.trimWidthM, bottomM: l.bottomM - l.trimWidthM, heightM: l.heightM + 2 * l.trimWidthM}));
  assert.ok(facings.every(f => withTrim.every(l => !overlap(f, l))), 'no facing covers a tower light or its frame trim');
  const crown = el.crown!.value.profile, top = Math.max(...crown.map(p => p[1]));
  assert.equal(crown.filter(p => p[1] === top).length, 4, 'the wall rises over both towers');
});

test('the same front without rosettes and towers: no rosette, no tower (absent = untouched)', () => {
  const i = corner(), f = i.fronts.find(x => x.id === 'nassaukade')!;
  delete f.rosettes; delete f.towers;
  const fit = fitIntent(i, facts), el = fit.recipe.elevations.find(e => e.id === 'nassaukade')!;
  assert.ok(!(el.ornaments?.value ?? []).some(o => /rosette/.test(o.id)));
  assert.equal(fit.report.fronts.find(x => x.id === 'nassaukade')!.towers, undefined);
  assert.ok(el.openings.value.some(o => o.id === 'nassaukade-s1-b1'));
});

test('validation: rosettes and towers', () => {
  const bad = (edit: (f: Record<string, unknown>) => void, re: RegExp) => {
    const i = corner() as unknown as {fronts: Record<string, unknown>[]}; edit(i.fronts.find(x => x.id === 'nassaukade')!);
    assert.throws(() => validateIntent(i), re);
  };
  bad(f => { f.rosettes = [{bays: [9], storeys: [1]}]; }, /rosettes\[0\]\.bays/);
  bad(f => { f.rosettes = [{bays: [1], storeys: [0]}]; }, /rosettes\[0\]\.storeys/);
  bad(f => { f.rosettes = [{bays: [1], storeys: [1], diameter: 3}]; }, /rosettes\[0\]\.diameter/);
  bad(f => { f.towers = [{bays: {from: 2, to: 2}, rise: 0.85, cap: 'merlons'}]; }, /towers\[0\]\.cap/);
  bad(f => { f.towers = [{bays: {from: 2, to: 2}, rise: 0.85, cap: 'flat', finish: 'brick'}]; }, /towers\[0\]\.finish/);
  assert.doesNotThrow(() => validateIntent(corner()));
});

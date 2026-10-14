/**
 * Kinkerstraat type-library components (2026-10-14): white tympana under segmental/round heads (`windowHead.tympanum`)
 * and brick roof boxes (`dormerStyle: "box"`). Fitted on bilder-153622 (as the canal-window tests do), plus the two
 * Kinkerstraat proof faces' typed intents as named regressions.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileBuilding, resolveIntent} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {validateIntent} from './intent.ts';
import {archSegment} from './fit.ts';
import {houseIntents, type BlockFaceIntent} from '../blockFace/intent.ts';

const raw = (id: string) => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
const canal = (patch: Record<string, unknown>) => { const i = raw('bilder-153622'); Object.assign(i.fronts[0], patch); return i; };
const fitCanal = (patch: Record<string, unknown>) => compileBuilding(resolveIntent(canal(patch), raw), facts('bilder-153622'));

test('tympanum: schema', () => {
  validateIntent(canal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', style: 'blocks', keystone: true}, tympanum: 'stone'}}));
  validateIntent(canal({windowHead: {kind: 'round', storeys: [3], tympanum: 'band'}, palette: {band: '#4a3628'}}));
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'flat', tympanum: 'stone'}})), /tympanum/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'segmental', tympanum: 'gold'}})), /tympanum/);
});

test('tympanum: the glass stops square at the springing line, the arch segment is a stone fill, the keystone stays at the crown', () => {
  const head = {kind: 'segmental', archRing: {colour: 'stone', style: 'blocks', keystone: true}};
  const plain = fitCanal({windowHead: head}).recipe.elevations[0], filled = fitCanal({windowHead: {...head, tympanum: 'stone'}}).recipe.elevations[0];
  const before = plain.openings.value.filter(o => o.head === 'segmental');
  assert.ok(before.length > 0);
  for (const o of before) {
    const after = filled.openings.value.find(x => x.id === o.id)!;
    assert.ok(!after.head && !after.headRiseM, `${o.id}: square-headed glass`);
    assert.ok(Math.abs(after.bottomM + after.heightM - (o.bottomM + o.heightM - o.headRiseM!)) < 0.002, `${o.id}: glass top on the springing line`);
    const fill = filled.ornaments!.value.find(r => r.id === `tympanum-${o.id}`)!;
    assert.ok(fill && fill.fill === 'stone' && fill.depthM === 0.02);
    const ys = fill.profile.map(p => p[1]), xs = fill.profile.map(p => p[0]);
    assert.ok(Math.abs(Math.max(...ys) - (o.bottomM + o.heightM)) < 0.002 && Math.abs(Math.min(...ys) - (after.bottomM + after.heightM)) < 0.002, 'fill spans springing line to crown');
    assert.ok(Math.abs(Math.min(...xs) - o.leftM) < 0.002 && Math.abs(Math.max(...xs) - (o.leftM + o.widthM)) < 0.002, 'fill spans the window width');
    const key = filled.dressings!.value.find(d => d.id === `keystone-${o.id}`)!, key0 = plain.dressings!.value.find(d => d.id === `keystone-${o.id}`)!;
    assert.deepEqual(key, key0, 'keystone unchanged (at the arch crown)');
    // the ring blocks are the same as without a tympanum
    assert.deepEqual(filled.ornaments!.value.filter(r => r.id.startsWith(`arch-${o.id}-`)), plain.ornaments!.value.filter(r => r.id.startsWith(`arch-${o.id}-`)));
  }
  const seg = archSegment(1, 3, 1.2, 0.1);
  assert.deepEqual(seg[0], [1, 2.9]); assert.deepEqual(seg.at(-1), [2.2, 2.9]);
  assert.ok(Math.abs(Math.max(...seg.map(p => p[1])) - 3) < 1e-4);
});

test('dormerStyle box: flat brick roof box, 0.75 m high, 5 cm behind the facade', () => {
  validateIntent(canal({dormers: 2, dormerStyle: 'box'}));
  const base = fitCanal({dormers: 2}).recipe.elevations[0].dormers!.value, box = fitCanal({dormers: 2, dormerStyle: 'box'}).recipe.elevations[0].dormers!.value;
  assert.equal(box.length, 2);
  for (const [k, d] of box.entries()) {
    assert.equal(d.roofRiseM, 0); assert.equal(d.wallSurface, 'wall'); assert.equal(d.heightM, 0.75); assert.equal(d.setbackM, 0.05);
    assert.equal(d.leftM, base[k].leftM); assert.equal(d.widthM, base[k].widthM);
  }
  assert.ok(base.every(d => d.wallSurface === 'trim' && d.heightM === 1.45), 'plain dormers unchanged');
});

test('Kinkerstraat proof faces (named regressions): 109-161 places the infill type with brick roof boxes, 2-30 the 1890 types', () => {
  const load = (id: string) => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${id}/intent.json`, 'utf8')) as BlockFaceIntent;
  const infill = houseIntents(load('kinker-109-161'));
  assert.equal(infill.length, 13);
  const vanHaren = infill.find(i => i.pandId.endsWith('141675'))!;
  assert.equal(vanHaren.fronts[0].dormerStyle, 'box');
  assert.equal(vanHaren.fronts[0].shopfront!.storeys, 2, 'arcade + gallery as one double-height shop');
  assert.equal(infill.find(i => i.pandId.endsWith('072076'))!.fronts.length, 4, '25 m pand = four ~6 m modules');
  const row = houseIntents(load('kinker-2-30'));
  const k8 = row.find(i => i.pandId.endsWith('162482'))!.fronts[0];
  assert.equal(k8.windows, 't-window');
  assert.deepEqual(k8.windowHead?.archRing, {colour: 'stone', style: 'blocks', keystone: true}, 'Kinkerstraat 8: white blocked arch with keystone');
  assert.equal(row.find(i => i.pandId.endsWith('236471'))!.fronts[0].windowHead?.kind, 'flat', 'Kinkerstraat 28: flat heads under keystones');
  // Oud-West 1900 keys wired after the Nassaukade merge: the 18-4 row's white sill and transom courses, 28's paint.
  assert.equal(k8.bands, 'painted', 'Kinkerstraat 8: painted sill and transom courses');
  assert.deepEqual(k8.bandLines, ['sill', 'transom']);
  assert.deepEqual(k8.bandHeights, {sill: 0.1, transom: 0.12}, 'measured band rows, 0.10-0.13 m');
  const k28 = row.find(i => i.pandId.endsWith('236471'))!;
  assert.equal(k28.fronts[0].palette?.wallMaterial ?? k28.palette.wallMaterial, 'painted-brick', 'Kinkerstraat 28: black-painted brick');
});

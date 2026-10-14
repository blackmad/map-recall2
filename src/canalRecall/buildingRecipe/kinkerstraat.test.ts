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
import {archSegment, SPRINGER} from './fit.ts';
import {cityFrameTint, cityTint, STONE_CELL_MEAN} from '../look/palette.ts';
import {paintFromFrames} from '../blockFace/stripPalette.ts';
import {groupToBuckets, recipeSlotFor} from '../streetChunks/soup.ts';
import {planFaceGround} from '../blockFace/compile.ts';
import {validateBlockFace} from '../blockFace/intent.ts';
import * as T from 'three';
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
  assert.deepEqual(k8.windowHead?.archRing, {colour: 'stone', style: 'springers', keystone: true, springerSize: [0.32, 0.28]}, 'Kinkerstraat 8: white springers (the dotted impost row) and keystone');
  assert.equal(row.find(i => i.pandId.endsWith('236471'))!.fronts[0].windowHead?.kind, 'flat', 'Kinkerstraat 28: flat heads under keystones');
  // Oud-West 1900 keys wired after the Nassaukade merge: the 18-4 row's white sill and transom courses, 28's paint.
  assert.equal(k8.bands, 'painted', 'Kinkerstraat 8: painted sill and transom courses');
  assert.deepEqual(k8.bandLines, ['sill', 'transom']);
  assert.deepEqual(k8.bandHeights, {sill: 0.1, transom: 0.08}, 'measured band rows: sill 0.10-0.12 m, the thin transom course 0.05-0.11 m');
  assert.equal(k8.bandTransomAt, 0.63, 'the transom course at 0.63 of the window (6.43 / 9.28 / 12.11 m on 162482)');
  const k28 = row.find(i => i.pandId.endsWith('236471'))!;
  assert.equal(k28.fronts[0].palette?.wallMaterial ?? k28.palette.wallMaterial, 'painted-brick', 'Kinkerstraat 28: black-painted brick');
});

/** Kinkerstraat 2-30 compiled on its face ground plan (as the block-face compile does). */
function kinkerRow() {
  const DIR = 'scripts/block-face/faces/kinker-2-30';
  const face = validateBlockFace(JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8')), JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8')).members);
  const fs0: BuildingFacts[] = face.houses.map(h => JSON.parse(fs.readFileSync(`${DIR}/pands/${h.pandId}/facts.json`, 'utf8')));
  const s = JSON.parse(fs.readFileSync(`${DIR}/strip.json`, 'utf8'));
  const plan = planFaceGround(face, fs0, 0.8, {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP});
  const intents = houseIntents(face);
  return (pand: string) => { const i = intents.findIndex(x => x.pandId.endsWith(pand)); return {intent: intents[i], b: compileBuilding(intents[i], plan.facts[i])}; };
}

test('archRing springers: schema (springerSize only with style springers, shape and springGap only on relieving arches)', () => {
  validateIntent(canal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', style: 'springers', keystone: true, springerSize: [0.3, 0.25]}}}));
  validateIntent(canal({windowHead: {kind: 'relieving', storeys: [3], archRing: {colour: 'stone', style: 'springers', keystone: true, shape: 'round', springGap: 0.2}, tympanum: 'dark'}}));
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', style: 'blocks', springerSize: [0.3, 0.25]}}})), /springerSize/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', style: 'springers', springerSize: [0.9, 0.25]}}})), /springerSize/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', shape: 'round'}}})), /shape: only on a relieving arch/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'segmental', archRing: {colour: 'stone', springGap: 0.2}}})), /springGap/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'relieving', archRing: {colour: 'stone'}, tympanum: 'stone'}})), /tympanum/);
  assert.throws(() => validateIntent(canal({windowHead: {kind: 'flat', tympanum: 'dark'}})), /tympanum/);
});

test('headLines and bandTransomAt: schema', () => {
  const i = raw('bilder-153622'), n = i.fronts[0].storeys, shares = Array(n).fill(0.6);
  validateIntent(canal({windowHeights: shares, headLines: Array(n).fill(0.8)}));
  assert.throws(() => validateIntent(canal({headLines: Array(n).fill(0.8)})), /headLines: needs a windowHeights list/);
  assert.throws(() => validateIntent(canal({windowHeights: shares, headLines: Array(n).fill(0.62)})), /at least 0.04/);
  assert.throws(() => validateIntent(canal({windowHeights: shares, headLines: [0.8]})), /one share/);
  assert.throws(() => validateIntent(canal({bandTransomAt: 0.6})), /bandTransomAt: only with bands "painted"/);
  const front = canal({}); front.fronts[0].palette = {...(front.fronts[0].palette ?? {}), stoneMaterial: 'painted'};
  assert.throws(() => validateIntent(front), /palette.stoneMaterial: set the stone material on the house palette/);
  const bad = canal({}); bad.palette.stoneMaterial = 'gilded';
  assert.throws(() => validateIntent(bad), /stoneMaterial/);
});

test('headLines: the window head sits on the measured share of its storey, the sill follows the window height', () => {
  const n = raw('bilder-153622').fronts[0].storeys, shares = Array.from({length: n}, () => 0.55), lines = Array.from({length: n}, () => 0.75);
  const moved = lines.map((v, s) => s === 2 ? v + 0.1 : v);
  const a = fitCanal({windowHeights: shares, headLines: lines}), b = fitCanal({windowHeights: shares, headLines: moved}), h = a.fit.fronts[0].storeyHeightsM;
  const win = (x: typeof a) => x.recipe.elevations[0].openings.value.filter(o => /^s[1-9]-b\d$/.test(o.id));
  const offset = h.length - n;
  for (const [i, o] of win(a).entries()) {
    const p = win(b)[i], s = Number(/^s(\d)/.exec(o.id)![1]);
    assert.ok(Math.abs(o.heightM - h[s + offset] * shares[s]) < 0.01, `${o.id} height is its share`);
    const dy = p.bottomM - o.bottomM;
    assert.ok(Math.abs(dy - (s === 2 ? 0.1 * h[s + offset] : 0)) < 0.002, `${o.id}: head line moved ${dy.toFixed(3)}`);
  }
});

test('Kinkerstraat 8-10 (162482): white springers on the springing line at the measured impost rows, heads and courses where the photo has them', () => {
  const house = kinkerRow(), {b} = house('162482'), e = b.recipe.elevations[0], f = b.fit.fronts[0];
  const floors = f.storeyHeightsM.reduce((acc: number[], h) => [...acc, acc.at(-1)! + h], [0]);
  const dress = e.dressings!.value, bands = e.bands!.value;
  // Strip runs on 162482 (palette-from-strip.ts): sill courses 5.2 / 8.0 / 10.85, impost (springer) rows 7.15 / 9.97 / 12.75, transom courses 6.43 / 9.28 / 12.11 m.
  const impost = [7.15, 9.97, 12.75], sills = [5.2, 8.03, 10.88], transom = [6.43, 9.28, 12.11];
  for (const s of [1, 2, 3]) {
    const win = e.openings.value.filter(o => new RegExp(`^s${s}-b\\d$`).test(o.id));
    assert.equal(win.length, 2);
    for (const o of win) {
      const springing = o.bottomM + o.heightM - o.headRiseM!;
      const sp = dress.filter(d => d.id === `springer-l-${o.id}` || d.id === `springer-r-${o.id}`);
      assert.equal(sp.length, 2, `${o.id}: two springers`);
      for (const d of sp) { assert.ok(d.kind === 'slab' && Math.abs(d.bottomM - springing) < 0.006 && Math.abs(d.heightM - 0.28) < 0.006 && d.surface === 'stone'); assert.ok(d.widthM <= 0.32 + 1e-6); }
      assert.ok(Math.abs(springing - impost[s - 1]) < 0.12, `${o.id}: springing ${springing.toFixed(2)} vs the photo's impost row ${impost[s - 1]}`);
      assert.ok(Math.abs(o.bottomM - sills[s - 1]) < 0.12, `${o.id}: sill ${o.bottomM.toFixed(2)} vs ${sills[s - 1]}`);
      assert.equal(dress.filter(d => d.id === `keystone-${o.id}`).length, 1);
    }
    // No ring blocks: the springers are the white dressing at the springing.
    assert.ok(!(e.ornaments?.value ?? []).some(o => o.id.startsWith('arch-')));
    // The two springers over the pier between the windows almost meet (the photo's 0.09 m gap with an anchor between).
    const [a, c] = win.sort((p, q) => p.leftM - q.leftM), r = dress.find(d => d.id === `springer-r-${a.id}`)!, l = dress.find(d => d.id === `springer-l-${c.id}`)!;
    const gap = l.leftM - (r.leftM + r.widthM);
    assert.ok(gap > 0 && gap < 0.4, `pier gap ${gap.toFixed(2)} between the springers`);
    const tb = bands.find(x => x.id === `painted-transom-s${s}`)!;
    assert.ok(Math.abs(tb.bottomM + tb.heightM / 2 - transom[s - 1]) < 0.1, `s${s}: transom course ${(tb.bottomM + tb.heightM / 2).toFixed(2)} vs ${transom[s - 1]}`);
    void floors;
  }
});

test('painted stone: the white dressings export a measured tint that the look keeps; absent, nothing changes', () => {
  const house = kinkerRow();
  for (const [pand, painted] of [['162482', true], ['236471', true], ['157476', false]] as const) {
    const {intent, b} = house(pand), buckets = groupToBuckets(b.group, new T.Matrix4(), recipeSlotFor(intent));
    const stone = [...buckets.values()].filter(x => x.slot === 'stone');
    assert.ok(stone.length, pand);
    for (const x of stone) assert.equal(x.tintSource === 'measured', painted, `${pand} ${x.key}`);
  }
  // The look: measured stone lands on the paint (cell x tint), unmeasured stone is mixed into the city's sandstone.
  const paint = '#eae7dc', tint = cityTint('stone', paint, 'measured'), cell = (v: string, k: number) => Math.round(parseInt(tint.slice(1 + 2 * k, 3 + 2 * k), 16) * STONE_CELL_MEAN) - parseInt(v.slice(1 + 2 * k, 3 + 2 * k), 16);
  for (const k of [0, 1, 2]) assert.ok(Math.abs(cell(paint, k)) <= 6, `channel ${k}: cell x tint within 6 of the paint (capped at white)`);
  assert.notEqual(cityTint('stone', paint), tint);
});

test('paintFromFrames: the band is the frames\' paint, drawn as white as the model\'s frames times the photo\'s band-to-frame ratio', () => {
  // Kinkerstraat 8-10 (162482) on the overcast strip: band #b2b3a8, frame #a8aca0; the model's frames drawn through the city frame tint.
  const drawn = cityFrameTint('#a8aca0'), {paint, ratio} = paintFromFrames('#b2b3a8', '#a8aca0', drawn);
  assert.ok(ratio > 1.03 && ratio < 1.06, `${ratio}`);
  assert.equal(paint, '#eae7dc');
  assert.equal(paintFromFrames('#a0a0a0', '#a0a0a0', '#e0e0e0').paint, '#e0e0e0', 'ratio 1: the drawn frame colour');
  assert.equal(paintFromFrames('#ffffff', '#808080', '#f0f0f0').paint, '#ffffff', 'capped at white');
});

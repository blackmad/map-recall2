/**
 * The 1900 Oud-West row kit (buildingRecipe/oudWest.ts + fit.ts), on the face `nassau-145-152` (Nassaukade 152-145, the
 * row opposite houseboat berth Nassaukade 506). Named regressions:
 *  - painted bands at the sill and transom lines, eared heads with keystone blocks, console sills: 157426 (Nassaukade 148);
 *  - timber balconies with turned balusters on storeys 1-2: 161422 (149) and 159694 (145);
 *  - timber platform with an iron grille on storey 1 under a library balconette on storey 3 (`styleStoreys`): 157426 (148);
 *  - one full-width balcony on storey 1 under centre ones (`storeyBays`): 160273 (147);
 *  - painted timber erker with a flat cap over axes 1-2 of storey 1: 160704 (146);
 *  - painted brick (measured tint through the chunk buckets): 164843 (150), 161422 (149), 160273 (147); not 157426;
 *  - round blind relieving arches with a dark tympanum, white springers and a keystone on storey 3: 164843 (150), 160273 (147);
 *  - window heads on the measured head lines: 157426 (148), 161422 (149), 160273 (147), 164843 (150);
 *  - painted white stone dressings as a measured tint: 157426, 161422, 160273, 116526; not 164843 (granite plinth).
 *   node --import tsx --test src/canalRecall/blockFace/oudWest.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding, type CompiledBuilding} from '../buildingRecipe/compile.ts';
import {PAINTED, TIMBER_BALCONY} from '../buildingRecipe/fit.ts';
import {timberBalconyGeometry} from '../buildingRecipe/oudWest.ts';
import {validateIntent, DARK_TYMPANUM_K, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {groupToBuckets, recipeSlotFor} from '../streetChunks/soup.ts';
import {houseIntents, validateBlockFace} from './intent.ts';
import {planFaceGround} from './compile.ts';

const DIR = 'scripts/block-face/faces/nassau-145-152';
const face = validateBlockFace(JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8')), JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8')).members);
const facts: BuildingFacts[] = face.houses.map(h => JSON.parse(fs.readFileSync(`${DIR}/pands/${h.pandId}/facts.json`, 'utf8')));
const s = JSON.parse(fs.readFileSync(`${DIR}/strip.json`, 'utf8'));
const plan = planFaceGround(face, facts, 0.8, {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP});
const intents = houseIntents(face);
const built = new Map<string, {intent: CanalHouseIntent; b: CompiledBuilding}>();
const house = (pand: string) => {
  if (!built.has(pand)) { const i = intents.findIndex(x => x.pandId.endsWith(pand)); built.set(pand, {intent: intents[i], b: compileBuilding(intents[i], plan.facts[i])}); }
  return built.get(pand)!;
};
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

test('validation: the Oud-West keys are checked and need their partners', () => {
  const base = JSON.parse(JSON.stringify(house('157426').intent)) as CanalHouseIntent;
  validateIntent(base);
  const bad = (edit: (f: any) => void, re: RegExp) => { const x = JSON.parse(JSON.stringify(base)); edit(x.fronts[0]); assert.throws(() => validateIntent(x), re); };
  bad(f => { f.bands = 'both'; }, /bandLines: only with bands "painted"/);
  bad(f => { f.bandHeights = {sill: 0.5}; }, /bandHeights/);
  bad(f => { f.bandLines = ['sill', 'sill']; }, /bandLines/);
  bad(f => { f.windowSills = 'plain'; }, /windowSills/);
  bad(f => { f.balconies = {storeys: [1], bays: [1], rail: 'iron'}; }, /only a timber-bracketed balcony has a rail/);
  bad(f => { f.balconies = {storeys: [1], bays: [1], style: 'timber-bracketed', styleStoreys: [2]}; }, /styleStoreys/);
  bad(f => { f.balconies = {storeys: [1], bays: [1], storeyBays: {'2': [0]}}; }, /storeyBays\.2/);
  bad(f => { f.bayWindows = {bay: 1, storeys: [1], finish: 'painted'}; }, /finish/);
  const big = JSON.parse(JSON.stringify(base)); big.palette.wallMaterial = 'painted-brick'; validateIntent(big);
});

test('Nassaukade 148: painted bands on the sill and transom lines, eared heads with keystones, sills on consoles', () => {
  const {b} = house('157426'), e = b.recipe.elevations[0], bands = e.bands!.value, dress = e.dressings!.value;
  const win = e.openings.value.filter(o => /^s2-b\d$/.test(o.id));
  assert.equal(win.length, 3);
  const sill = Math.min(...win.map(o => o.bottomM)), head = Math.max(...win.map(o => o.bottomM + o.heightM));
  const sb = bands.find(x => x.id === 'painted-sill-s2')!, tb = bands.find(x => x.id === 'painted-transom-s2')!;
  assert.ok(sb && tb && sb.surface === 'stone' && tb.surface === 'stone');
  assert.ok(Math.abs(sb.bottomM + sb.heightM - sill) < 0.005, 'sill band top on the sills');
  assert.ok(Math.abs(tb.bottomM + tb.heightM / 2 - (sill + (head - sill) * 0.65)) < 0.005, 'transom band centred at the measured 0.65 of the window (bandTransomAt)');
  assert.ok(Math.abs(tb.bottomM + tb.heightM / 2 - 9.67) < 0.1, `148 storey 2: band ${(tb.bottomM + tb.heightM / 2).toFixed(2)} vs the photo's 9.67 m`);
  assert.notEqual(PAINTED.transomK, 0.65, 'the default stays 0.78 for fronts without bandTransomAt');
  assert.ok(!bands.some(x => x.id.startsWith('painted-head')), 'no head band: bandLines sill + transom');
  for (const o of win) {
    const mine = dress.filter(d => d.id.endsWith(`-${o.id}`)), keys = Math.max(1, Math.round(o.widthM / PAINTED.keyPitchM) - 1);
    assert.equal(mine.filter(d => d.id.startsWith('head-')).length, 1);
    assert.equal(mine.filter(d => /^ear-[lr]-/.test(d.id)).length, 2);
    assert.equal(mine.filter(d => d.id.startsWith('key-')).length, keys);
    assert.equal(mine.filter(d => d.id.startsWith('sill-')).length, 1);
    assert.equal(mine.filter(d => d.id.startsWith('console-')).length, 2);
    const h = mine.find(d => d.id.startsWith('head-'))!;
    assert.ok(h.kind === 'slab' && h.leftM < o.leftM - 0.1 && h.leftM + h.widthM > o.leftM + o.widthM + 0.1, 'head band runs past both jambs (ears)');
  }
});

test('Nassaukade 150 and 147: round blind relieving arches on storey 3: dark tympanum, two white springers and a keystone', () => {
  // Measured on the 2024-11-21 strip: 147 springs on its 0.20 m head band (13.93 m), crown ~14.7 m; 150 springs 0.55 m over its heads at 14.12 m.
  for (const [pand, gap, springing] of [['164843', 0.55, 14.12], ['160273', 0.2, 13.93]] as const) {
    const {intent, b} = house(pand), f = intent.fronts[0], e = b.recipe.elevations[0];
    assert.equal(f.windows, 't-window');
    assert.equal(f.windowHead?.kind, 'relieving');
    assert.deepEqual(f.windowHead?.storeys, [3]);
    assert.equal(f.windowHead?.archRing?.style, 'springers');
    assert.equal(f.windowHead?.archRing?.shape, 'round');
    assert.equal(f.windowHead?.tympanum, 'dark');
    assert.ok(!(e.ornaments?.value ?? []).some(o => o.id.startsWith('arch-')), `${pand}: no voussoir ring`);
    const win = e.openings.value.filter(o => /^s3-b\d$/.test(o.id)), dress = e.dressings!.value;
    assert.equal(win.length, 3);
    for (const o of win) {
      const head = o.bottomM + o.heightM, span = o.widthM + 0.12, rise = Math.floor(span / 2 * 1000) / 1000;
      const t = e.ornaments!.value.find(x => x.id === `tympanum-${o.id}`)!;
      assert.ok(t && t.fill === 'accent', `${pand} ${o.id}: dark tympanum`);
      const ys = t.profile.map(p => p[1]), xs = t.profile.map(p => p[0]);
      assert.ok(Math.abs(Math.min(...ys) - (head + gap)) < 0.005 && Math.abs(Math.max(...ys) - (head + gap + rise)) < 0.005, `${pand} ${o.id}: a semicircle springing ${gap} m over the head`);
      assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - span) < 0.005);
      assert.ok(Math.abs(head + gap - springing) < 0.12, `${pand} ${o.id}: springing ${(head + gap).toFixed(2)} vs the photo's ${springing}`);
      const sp = dress.filter(d => d.id === `springer-l-${o.id}` || d.id === `springer-r-${o.id}`);
      assert.equal(sp.length, 2);
      for (const d of sp) assert.ok(d.kind === 'slab' && Math.abs(d.bottomM - (head + gap)) < 0.006 && d.surface === (pand === '164843' ? 'trim' : 'stone'), `${pand} ${d.id}`);
      assert.equal(dress.filter(d => d.id === `keystone-${o.id}`).length, 1, `${pand} ${o.id}: keystone`);
    }
    assert.ok(!dress.some(d => /^(head|ear-[lr])-.*s3-b/.test(d.id)), `${pand}: no eared heads under the arches`);
    // The tympanum is the painted wall in shadow, a measured tint like the wall.
    const accent = b.recipe.palette.value.accent!, wall = b.recipe.palette.value.wall;
    for (const k of [1, 3, 5]) assert.ok(Math.abs(parseInt(accent.slice(k, k + 2), 16) - Math.round(parseInt(wall.slice(k, k + 2), 16) * DARK_TYMPANUM_K)) <= 1);
    const buckets = groupToBuckets(b.group, new T.Matrix4(), recipeSlotFor(intent));
    const acc = [...buckets.values()].filter(x => x.slot === 'accent');
    assert.ok(acc.length && acc.every(x => x.tintSource === 'measured'), `${pand}: measured tympanum`);
  }
});

test('heads land on the measured head lines: 148 (three-axis), 149 (two-axis), 147 and 150', () => {
  // Window heads (top of the frame) read on the 2024-11-21 strip crops, metres over the pavement.
  const heads: Record<string, number[]> = {'157426': [7.1, 10.4, 13.55], '161422': [7.15, 10.35, 13.55], '160273': [7.2, 10.5, 13.73], '164843': [7.7, 10.7, 13.57]};
  for (const [pand, want] of Object.entries(heads)) {
    const {b} = house(pand), e = b.recipe.elevations[0];
    for (const [k, y] of want.entries()) {
      const s = k + 1, win = e.openings.value.filter(o => new RegExp(`^s${s}-b\\d$`).test(o.id) && o.kind === 'window');
      assert.ok(win.length, `${pand} s${s}`);
      const top = Math.max(...win.map(o => o.bottomM + o.heightM)) + (b.fit.fronts[0].storeyHeightsM.length > 4 && pand === '164843' ? 0 : 0);
      assert.ok(Math.abs(top - y) < 0.12, `${pand} s${s}: head ${top.toFixed(2)} vs the photo's ${y}`);
    }
  }
  assert.deepEqual(house('157426').intent.fronts[0].headLines, [0.86, 0.744, 0.733, 0.716], '148: measured head lines instead of the common 0.86');
});

test('painted stone: the white dressings of the Oud-West types export a measured tint; 150 keeps its granite stone unmeasured', () => {
  for (const [pand, painted] of [['157426', true], ['161422', true], ['160273', true], ['116526', true], ['164843', false]] as const) {
    const {intent, b} = house(pand), buckets = groupToBuckets(b.group, new T.Matrix4(), recipeSlotFor(intent));
    const stone = [...buckets.values()].filter(x => x.slot === 'stone');
    assert.ok(stone.length, pand);
    for (const x of stone) assert.equal(x.tintSource === 'measured', painted, `${pand} ${x.key}`);
  }
});

test('Nassaukade 149 and 145: timber balconies with turned balusters on storeys 1-2 of the wide axis', () => {
  for (const pand of ['161422', '159694']) {
    const {b} = house(pand), f = b.fit.fronts[0], tb = f.timberBalconies!;
    assert.deepEqual(tb.map(x => x.id), ['timber-s1', 'timber-s2']);
    const width = f.widthM;
    for (const x of tb) { assert.equal(x.rail, 'turned'); assert.ok(x.leftM >= TIMBER_BALCONY.endInsetM - 1e-6 && x.leftM + x.widthM <= width - TIMBER_BALCONY.endInsetM + 1e-6); assert.ok(x.widthM > 1.8, `${pand} ${x.id} ${x.widthM}`); }
    // Platform top at the storey floor: the French window stands on it.
    const floors = f.storeyHeightsM.reduce((acc: number[], h) => [...acc, acc.at(-1)! + h], [0]);
    for (const [k, x] of tb.entries()) assert.ok(Math.abs(x.floorM - floors[k + 1]) < 0.02, `${pand} floor ${x.floorM} vs ${floors[k + 1]}`);
    assert.equal(meshes(b.group, /^timber-balcony\/timber-s1\/(platform|guard)$/).length, 2);
    assert.ok(!b.recipe.elevations[0].balconies, 'no library rails on the timber storeys');
    for (const m of meshes(b.group, /^timber-balcony\//)) assert.equal(m.userData.surface, 'trim');
  }
});

test('Nassaukade 148 and 147: iron grille on a bracketed platform under library balconettes; storeyBays', () => {
  const a = house('157426').b, fa = a.fit.fronts[0];
  assert.deepEqual(fa.timberBalconies!.map(x => [x.id, x.rail]), [['timber-s1', 'iron']]);
  assert.deepEqual(a.recipe.elevations[0].balconies!.value.map(r => r.id), ['rail-s3-b1']);
  assert.equal(meshes(a.group, /timber-s1\/guard$/)[0].userData.surface, 'door');
  const c = house('160273').b, fc = c.fit.fronts[0];
  assert.deepEqual(fc.timberBalconies!.map(x => x.id), ['timber-s1', 'timber-s2']);
  const s1 = c.recipe.elevations[0].openings.value.filter(o => /^s1-b\d$/.test(o.id)), t1 = fc.timberBalconies![0];
  assert.ok(t1.leftM < Math.min(...s1.map(o => o.leftM)) && t1.leftM + t1.widthM > Math.max(...s1.map(o => o.leftM + o.widthM)), 'storey 1 runs past all three bays');
  assert.ok(fc.timberBalconies![1].widthM < 2.2, 'storey 2 is the centre bay');
  assert.equal(c.recipe.elevations[0].openings.value.filter(o => /^s1-b\d$/.test(o.id) && o.bottomM < fc.storeyHeightsM[0] + 0.1).length, 3, 'three French windows on storey 1');
});

test('Nassaukade 146: the painted erker over axes 1-2 of storey 1, flat white cap', () => {
  const {b} = house('160704'), e = b.fit.fronts[0].erker!;
  assert.equal(e.finish, 'painted'); assert.equal(e.cap, 'flat');
  const panels = meshes(b.group, /erker-s1\/.*wall\//);
  assert.ok(panels.length >= 4);
  const trim = b.recipe.palette.value.trim.toLowerCase();
  for (const m of panels) { assert.equal(m.userData.surface, 'trim'); assert.equal('#' + (m.material as T.MeshStandardMaterial).color.getHexString(), trim); }
  assert.equal(meshes(b.group, /^erker-cap\//)[0].userData.surface, 'trim');
});

test('painted brick: the wall exports a measured tint (chunk buckets), plain brick does not', () => {
  for (const [pand, painted] of [['164843', true], ['161422', true], ['160273', true], ['157426', false]] as const) {
    const {intent, b} = house(pand), buckets = groupToBuckets(b.group, new T.Matrix4(), recipeSlotFor(intent));
    const walls = [...buckets.values()].filter(x => x.slot === 'brick' && x.surface === 'wall');
    assert.ok(walls.length, pand);
    for (const w of walls) { assert.equal(w.tintSource === 'measured', painted, `${pand} ${w.key}`); assert.equal(w.key.endsWith('_measured'), painted); }
  }
});

test('timber balcony geometry stays cheap: a 2 m turned balcony is under 330 triangles', () => {
  const g = timberBalconyGeometry({id: 't', leftM: 1, widthM: 2, floorM: 5, projectM: TIMBER_BALCONY.projectM, slabM: TIMBER_BALCONY.slabM, guardM: TIMBER_BALCONY.guardM, rail: 'turned'});
  const tris = (g.platform.length + g.guard.length) / 9;
  assert.ok(tris < 330, `${tris} triangles`);
  assert.ok(g.balusters >= 15, `${g.balusters} balusters`);
  // Everything stands in front of the wall plane and on/under the platform top + guard.
  const zs = [...g.platform, ...g.guard].filter((_, i) => i % 3 === 2), ys = [...g.platform, ...g.guard].filter((_, i) => i % 3 === 1);
  assert.ok(Math.min(...zs) >= -0.006 && Math.max(...zs) <= TIMBER_BALCONY.projectM + 1e-6);
  assert.ok(Math.max(...ys) <= 5 + TIMBER_BALCONY.guardM + 1e-6);
});

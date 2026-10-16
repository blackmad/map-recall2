/**
 * De Baarsjes type library (Jan Evertsenstraat, docs/de-baarsjes-types-20261014.md) and its kit keys, on the proof face
 * `evertsen-7-41`. Named regressions:
 *  - 9-33 (lintel-band): parapet storey top 22 courses under the coping, painted sill/head bands with two-tone piers,
 *    casement-triple windows, the canopy dropped onto the measured wall band (23 courses), one canopy group;
 *  - 35 (147692): the corner-tower crown (a flat raised mass over the corner-group parapet);
 *  - every De Baarsjes type compiles on a 6 m pand of the face (081449, Jan Evertsenstraat 23) with its keys:
 *    box frames with hoods, slab-hood balconettes, glass-block rows in their measured material, gridded top lights,
 *    the white attic band.
 *   node --import tsx --test src/canalRecall/blockFace/deBaarsjes.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {DE_BAARSJES, fitIntent} from '../buildingRecipe/fit.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const DIR = 'scripts/block-face/faces/evertsen-7-41';
const raw = JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const members: string[] = JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8')).members;
const face: BlockFaceIntent = validateBlockFace(raw, members);
const intents = houseIntents(face);
const intentOf = (pand: string) => intents.find(i => i.pandId.endsWith(pand))!;
const factsOf = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`${DIR}/pands/0363100012${pand}/facts.json`, 'utf8'));
const COURSE = 0.055;
const TYPES = ['evertsen-1926-lintel-band', 'evertsen-1926-hood-lisene', 'evertsen-1926-balcony-slot', 'evertsen-1926-ladder-plain', 'evertsen-1927-white-attic-tile-roof'];
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const bbox = (m: T.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!; };

/** One of the library types placed on 23 (081449, 6.0 m) with a rigid canopy, as a validated house intent. */
function typed(type: string, crown?: string, awning: Record<string, unknown> = {}): CanalHouseIntent {
  const t = defaultTypeLoader(type)!;
  const shop = {colour: 'black', fascia: false, entrance: 'none', stallriser: 'low', awning: {style: 'rigid', colour: '#b8bdba', ...awning}};
  const ground = t.grounds ? undefined : {shopfront: shop};
  const design = resolvePlacement(t, {type, ...(crown ? {crown} : {}), ...(ground ? {ground} : {ground: Object.keys(t.grounds!)[0]})} as any, 'Jan Evertsenstraat').design;
  const base = intentOf('081449');
  return validateIntent({...base, ...design, notes: []});
}

test('library: the five De Baarsjes types load and every crown resolves', () => {
  for (const id of TYPES) {
    const t = defaultTypeLoader(id);
    assert.ok(t, id);
    assert.equal((t as unknown as {district: string}).district, 'de-baarsjes');
    for (const [crown, c] of Object.entries(t!.crowns)) {
      const place = () => typed(id, crown, t!.id === 'evertsen-1927-white-attic-tile-roof' ? {} : {wallCourses: 16});
      // A corner-tower crown stands on a two-front corner pand; on the one-front test pand it is refused, not misbuilt.
      if (c.tower?.corner) assert.throws(place, /a corner tower needs a pand with two fronts/); else place();
    }
    assert.ok(t!.evidence.length >= 2, `${id}: measured evidence`);
  }
});

test('intent schema: the De Baarsjes keys validate, misuse is rejected', () => {
  const i = intentOf('081449');
  const patch = (p: Record<string, unknown>, sf?: Record<string, unknown>) => {
    const x = structuredClone(i) as any; Object.assign(x.fronts[0], p);
    if (sf) x.fronts[0].shopfront = {...x.fronts[0].shopfront, awning: {...x.fronts[0].shopfront.awning, ...sf}};
    return x;
  };
  assert.throws(() => validateIntent(patch({parapet: {courses: 2}})), /parapet: \{courses: 4\.\.90/);
  assert.throws(() => validateIntent(patch({parapet: {courses: 22}, cornice: 'simple'})), /a plain parapet has no cornice/);
  assert.throws(() => validateIntent(patch({bands: 'courses', courseStoreys: undefined})), /bandPiers: only with bands "painted"/);
  assert.throws(() => validateIntent(patch({bayWindows: {bay: 1, storeys: [1], hood: true}})), /a box frame spans axes/);
  assert.throws(() => validateIntent(patch({bayWindows: {bays: {from: 0, to: 0}, storeys: [1], hood: true, cap: 'flat'}})), /drop cap\/finish/);
  assert.throws(() => validateIntent(patch({balconies: {storeys: [1], bays: [0], style: 'slab-hood', projecting: true}})), /slab-hood already projects/);
  assert.throws(() => validateIntent(patch({}, {glassBlocks: {rows: 40}})), /glassBlocks: true, and only over a rigid canopy \(or \{rows: 2\.\.12\}/);
  assert.throws(() => validateIntent(patch({}, {wallCourses: 2.5})), /wallCourses: integer 0\.\.40/);
  // Counted keys only: a metric name is still refused by the intent contract.
  assert.throws(() => validateIntent(patch({parapet: {heightM: 1.2}})), /coordinate\/metric field/);
});

test('9-33 lintel-band: parapet, painted bands over two-tone piers, triple casements, canopy on the measured wall band', () => {
  const i = intentOf('081449'), f = i.fronts[0];
  assert.equal(f.windows, 'casement-triple');
  const {recipe, report} = fitIntent(i, factsOf('081449'));
  const fr = report.fronts[0], top = fr.storeyHeightsM.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(fr.eavesM - top - 22 * COURSE) < 0.02, `storeys end 22 courses under the eaves (${fr.eavesM} - ${top})`);
  const el = recipe.elevations[0];
  assert.equal(el.cornice?.value.heightM, DE_BAARSJES.copingM, 'the coping is the only cornice');
  const blocks = el.bands?.value ?? [];
  for (const s of [1, 2, 3]) {
    const sill = blocks.find(b => b.id === `painted-sill-s${s}`)!, head = blocks.find(b => b.id === `painted-head-s${s}`)!, piers = blocks.find(b => b.id === `band-piers-s${s}`)!;
    assert.ok(sill && head && piers, `storey ${s}: sill, head and pier blocks`);
    assert.equal(piers.surface, 'accent');
    assert.ok(piers.depthM < sill.depthM, 'the bands stand in front of the piers');
    assert.ok(Math.abs(piers.bottomM - (sill.bottomM + sill.heightM)) < 0.01 && Math.abs(piers.bottomM + piers.heightM - head.bottomM) < 0.01, 'piers fill the window zone between the bands');
  }
  const sills = el.openings.value.filter(o => /^s1-b\d$/.test(o.id)).map(o => o.bottomM), c = fr.canopy!;
  assert.ok(Math.abs(Math.min(...sills) - (c.bottomM + c.thicknessM) - 23 * COURSE) < 0.02, 'canopy top 23 courses under the first-storey sills');
  // The whole row shares one canopy line and one coping line.
  validateBlockFace(raw, members);
  assert.equal(face.continuity.canopy?.[0].pands.length, 12);
});

test('35 corner tower: a flat raised mass over the corner-group parapet', () => {
  const {report} = fitIntent(intentOf('147692'), factsOf('147692'));
  const t = report.fronts[0].towers?.[0];
  assert.ok(t && t.cap === 'flat' && t.topM > report.fronts[0].eavesM + 1, JSON.stringify(t));
});

test('hood-lisene: a box frame per storey with a hood, lisene from the glass-block band, band in its measured material', () => {
  const i = typed('evertsen-1926-hood-lisene', 'parapet', {glassBlocks: {rows: 8}, wallCourses: 8});
  const b = compileBuilding(i, factsOf('081449')), fr = b.fit.fronts[0];
  assert.equal(fr.erker?.hoods?.length, 3);
  assert.equal(fr.erker?.finish, 'painted');
  const boxes = (b.recipe.elevations[0].glazedBays?.value ?? []).filter(g => /^erker-s\d$/.test(g.id));
  assert.equal(boxes.length, 3);
  for (const g of boxes) { assert.equal(g.depthM, DE_BAARSJES.boxDepthM); assert.equal(g.frontWidthM, g.widthM, 'square box'); }
  const hoods = meshes(b.group, /^box-hoods\//);
  assert.equal(hoods.length, 1);
  assert.equal((hoods[0].material as T.MeshStandardMaterial).color.getHexString(), '3d3827');
  const g = fr.canopy!.glassBlocks!;
  assert.ok(Math.abs(g.topM - g.bottomM - 8 * DE_BAARSJES.glassBlockM) < 0.01, '8 rows');
  assert.equal(g.colour, '#4f503f');
  const glass = meshes(b.group, /glass-blocks$/)[0];
  assert.equal((glass.material as T.Material).userData.tintSource, 'measured');
  assert.ok(Math.abs(fr.lisenes![0].bottomM - g.topM) < 0.01, 'lisene stands on the band');
});

test('balcony-slot: stacked balconettes and one hood slab per top door', () => {
  const i = typed('evertsen-1926-balcony-slot', 'parapet', {glassBlocks: {rows: 7}, wallCourses: 16});
  const b = compileBuilding(i, factsOf('081449')), el = b.recipe.elevations[0];
  const rails = el.balconies?.value ?? [];
  assert.equal(rails.length, 3);
  for (const r of rails) { assert.equal(r.depthM, DE_BAARSJES.balconyDepthM); assert.equal(r.projection?.slabThicknessM, DE_BAARSJES.balconySlabM); }
  assert.equal(b.fit.fronts[0].balconyHoods?.length, 1);
  const top = el.openings.value.find(o => o.id === 's3-b0')!, hood = b.fit.fronts[0].balconyHoods![0];
  assert.ok(hood.bottomM > top.bottomM + top.heightM && hood.bottomM < top.bottomM + top.heightM + 0.1, 'hood just over the top door');
  assert.equal(meshes(b.group, /^balcony-hoods\//).length, 1);
});

test('ladder-plain and white-attic: gridded top lights; the white band storey', () => {
  const l = compileBuilding(typed('evertsen-1926-ladder-plain', 'parapet', {glassBlocks: {rows: 6}, wallCourses: 16}), factsOf('081449'));
  const w = l.recipe.elevations[0].openings.value.find(o => o.id === 's2-b1')!;
  assert.deepEqual(w.horizontalBars, [0.8]);
  assert.equal(w.diagonalBars?.length, 2, 'two bars in the top light');
  const a = compileBuilding(typed('evertsen-1927-white-attic-tile-roof', 'tile-roof'), factsOf('081449'));
  const bands = a.recipe.elevations[0].bands?.value ?? [];
  assert.ok(bands.some(b => b.id === 'band-piers-s3') && !bands.some(b => b.id === 'band-piers-s1'), 'only the top storey is the white band');
  assert.equal(a.recipe.elevations[0].openings.value.filter(o => /^s3-b\d$/.test(o.id)).length, 5);
});

test('absent keys leave a house untouched: no De Baarsjes meshes or report fields', () => {
  const i = structuredClone(intentOf('159654'));
  const b = compileBuilding(i, factsOf('159654'));
  assert.equal(meshes(b.group, /^(box-hoods|balcony-hoods)\//).length, 0);
  assert.equal(b.fit.fronts[0].balconyHoods, undefined);
  assert.equal(b.fit.fronts[0].erker, undefined);
});

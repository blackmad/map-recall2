/**
 * Named regressions: Bilderdijkstraat 133 (164549) and 145/147/153 (162572, 237294, 167243). LoD2.2 carries a mansard's
 * flat top (or a dormer merged into the roof) out to the facade, so 3DBAG's eaves sit 2.5-3.5 m above the photo cornice,
 * more than a photo-trusted cornice group may bridge (2.5 m). `continuity.measuredEaves[].frontRoof` measures the cornice
 * on the strip and re-pitches the front strip of the roof down to it.
 *   node --import tsx --test src/canalRecall/blockFace/frontRoof.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, planFaceGround, repitchFrontRoof, type StripScale} from './compile.ts';

const load = (id: string) => {
  const dir = `scripts/block-face/faces/${id}`, raw = JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8'));
  const face: BlockFaceIntent = validateBlockFace(raw, JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${dir}/pands/${h.pandId}/facts.json`, 'utf8'))]));
  const s = JSON.parse(fs.readFileSync(`${dir}/strip.json`, 'utf8')), strip: StripScale = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP};
  return {raw, face, facts, strip};
};

test('repitchFrontRoof: the front strip rises from the eaves at 72 degrees, the rest of the roof and its area are kept', () => {
  const f: BuildingFacts = JSON.parse(fs.readFileSync('scripts/block-face/faces/bilder-236022-167243/pands/0363100012162572/facts.json', 'utf8'));
  const g = f.attributes.b3_h_maaiveld, eaves = g + 13.7, out = repitchFrontRoof(f, eaves);
  const area = (r: BuildingFacts['roofsRD']) => r.reduce((s, x) => s + x.areaM2, 0);
  assert.ok(Math.abs(area(out.roofsRD) - area(f.roofsRD)) < 0.05, `roof area kept: ${area(out.roofsRD)} vs ${area(f.roofsRD)}`);
  const front = out.roofsRD.filter(r => /:f\d+$/.test(r.surfaceId));
  assert.ok(front.length, 'front strip pieces');
  const zs = front.flatMap(r => r.vertices.map(v => v[2] - g)), depth = (17.3 - 13.7) / Math.tan(72 * Math.PI / 180);
  assert.ok(Math.abs(Math.min(...zs) - 13.7) < 0.01 && Math.max(...zs) > 17, `front strip 13.7 -> ~17.3 m: ${zs.map(z => z.toFixed(2))}`);
  assert.ok(Math.abs(out.heights.roofMinM - 13.7) < 0.01, 'the shell top falls to the eaves');
  assert.ok(depth > 1 && depth < 1.3);
  // A cap (topRow) lowers a dormer that 3DBAG merged into the roof before the re-pitch.
  const capped = repitchFrontRoof(f, eaves, {topNap: g + 16});
  assert.ok(Math.max(...capped.roofsRD.filter(r => /:f\d+$/.test(r.surfaceId)).flatMap(r => r.vertices.map(v => v[2] - g))) <= 16.001);
});

test('validator: frontRoof topRow above the eaves row, pitch 30-80', () => {
  const {raw} = load('bilder-157757-164549');
  const bad = structuredClone(raw); bad.continuity.measuredEaves[0].frontRoof = {topRow: 400};
  assert.throws(() => validateBlockFace(bad), /frontRoof.topRow/);
  const pitch = structuredClone(raw); pitch.continuity.measuredEaves[0].frontRoof = {pitchDeg: 89};
  assert.throws(() => validateBlockFace(pitch), /pitchDeg/);
});

test('Bilderdijkstraat 145/147/153: eaves on the strip cornice, the face passes without a photo-trusted group', async () => {
  const {face, facts, strip} = load('bilder-236022-167243');
  const plan = planFaceGround(face, face.houses.map(h => facts.get(h.pandId)!), undefined, strip);
  for (const p of ['162572', '237294', '167243']) {
    const i = face.houses.findIndex(h => h.pandId.endsWith(p));
    assert.ok(plan.eavesBefore[i] - plan.eavesAfter[i] > 2.4, `${p}: 3DBAG ${plan.eavesBefore[i]} vs strip ${plan.eavesAfter[i]}`);
    assert.ok(plan.facts[i].heights.roofMinM <= plan.eavesAfter[i] + 0.01, `${p}: shell stops at the cornice`);
  }
  const r = await compileBlockFace(face, facts, 'face-frontroof-test', {strip});
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  assert.ok(r.interference.every(i => i.pass));
});

test('Bilderdijkstraat 133: the dormer 3DBAG read as eaves (17.0 m) is a tower on a cornice at 14.2 m', async () => {
  const {face, facts, strip} = load('bilder-157757-164549');
  const r = await compileBlockFace(face, facts, 'face-133-test', {strip});
  const eaves = r.gates.find(g => g.pand === '164549' && g.id === 'eaves-vs-3dbag')!;
  assert.ok(eaves.pass && Math.abs((eaves.value as any).modelM - 14.23) < 0.05, JSON.stringify(eaves.value));
  assert.ok(r.gates.find(g => g.pand === '164549' && g.id === 'height-vs-3dbag')!.pass);
});

test('Bilderdijkstraat 135|137|139 (one pand): fronts are cut at the drainpipes, not snapped to a dormer-ring vertex 1.2 m away', async () => {
  const {splitChain} = await import('../buildingRecipe/fit.ts');
  const f: BuildingFacts = JSON.parse(fs.readFileSync('scripts/block-face/faces/bilder-236022-167243/pands/0363100012236022/facts.json', 'utf8'));
  const cut = splitChain(f.fronts[0], [0.328, 0.329, 0.343]);
  const w = cut.pairs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  assert.ok(Math.abs(w[0] - 0.328 * f.fronts[0].widthM) < 0.25 && cut.inserted.length >= 1, `widths ${w.map(x => x.toFixed(2))}`);
});

test('Bilderdijkstraat 113: a mansard 3DBAG already pitches (57 deg) keeps its faces, only the foot moves; a non-convex flat top is cut without spikes', async () => {
  const {face, facts, strip} = load('bilder-161281-157756');
  const f = facts.get('0363100012161281')!, g = f.attributes.b3_h_maaiveld, out = repitchFrontRoof(f, g + 13.6);
  const steep = out.roofsRD.filter(r => r.slopeDeg >= 30 && !/:[fr]\d+$/.test(r.surfaceId));
  assert.ok(steep.length >= 2 && steep.every(r => r.vertices.length === f.roofsRD.find(x => x.surfaceId === r.surfaceId)!.vertices.length), 'steep faces kept whole');
  const r = await compileBlockFace(face, facts, 'face-113-test', {strip});
  assert.deepEqual(r.gates.filter(x => !x.pass).map(x => `${x.pand}/${x.id}`), []);
  const e = Object.fromEntries(r.perPand.map(p => [p.pand.slice(-6), p.eavesM]));
  assert.ok(e['161281'] - e['157756'] > 1.2, `115 sits ~1.6 m below 113 on both capture dates: ${JSON.stringify(e)}`);
});

test('Bilderdijkstraat 158-162 (one pand, four fronts): frontRoof re-pitches only its own stretch; the tower bays keep the survey roof', () => {
  const {face, facts, strip} = load('bilder-233580-162444');
  const plan = planFaceGround(face, face.houses.map(h => facts.get(h.pandId)!), undefined, strip);
  const i = face.houses.findIndex(h => h.pandId.endsWith('162443')), f = plan.facts[i], g = f.attributes.b3_h_maaiveld;
  const [a, b] = f.fronts[0].endpointsRD, n = f.fronts[0].outwardNormalRD, w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const along = (v: number[]) => ((v[0] - a[0]) * (b[0] - a[0]) + (v[1] - a[1]) * (b[1] - a[1])) / w, depth = (v: number[]) => -((v[0] - a[0]) * n[0] + (v[1] - a[1]) * n[1]);
  const m = plan.measured!['0363100012162443'];
  const pitched = f.roofsRD.filter(r => /:f\d+$/.test(r.surfaceId)).flatMap(r => r.vertices).filter(v => depth(v) < 0.02 && along(v) > 6.2);
  assert.ok(pitched.length >= 2 && pitched.every(v => Math.abs(v[2] - g - m.m) < 0.02 && along(v) > 7.4 && along(v) < 16.1), `middle stretch at its cornice ${m.m}`);
  const towers = f.roofsRD.filter(r => !/:f\d+$/.test(r.surfaceId)).flatMap(r => r.vertices).filter(v => depth(v) < 0.02 && along(v) > 6.2);
  assert.ok(towers.length >= 2 && towers.every(v => v[2] - g > 15.5), 'tower bays keep the survey roof');
});

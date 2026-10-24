/**
 * Named regressions: Zaanhof (H.J.M. Walenkamp 1919), faces zaanhof-125-134 and zaanhof-1-20 (user, 2026-10-24: "are
 * these zaanhof houses correct, they look ... weirdly irregular?"). The white pointed gables stood as thin sheets 1.2 m
 * over a 30-degree attic (ridge 10.5 m, gable apex 11.7 m) and showed beyond the back slope; the flat dormers over the
 * door axes are missing (a kit dormer at the gutter of this roof fails the GLB audit); Zaanhof 7 (087177) stood 0.5 m above
 * its row (zaanhof-1-20 and zaanhof-23-34 now carry one cornice group each).
 * 3DBAG over all 30 pands: a long saddle (front 56 deg to an 11.7 m ridge, back 38 deg) with a cross roof behind every
 * gable (53-58 deg up to 10.5 m) and flat dormer tops at 9.2-9.4 m. `RoofIntent.rise/rearPitchDeg/crossGables`.
 *   node --import tsx --test src/canalRecall/blockFace/zaanhofCrossGables.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roofHeightAt, type BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {validateBlockFace, houseIntents, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, crossGablesOf, prepareFaceFacts, type StripScale} from './compile.ts';
import {atticProfile} from './recipeRoof.ts';

const load = (id: string) => {
  const dir = `scripts/block-face/faces/${id}`, raw = JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8'));
  const face: BlockFaceIntent = validateBlockFace(raw, JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members);
  const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${dir}/pands/${h.pandId}/facts.json`, 'utf8'))]));
  const s = JSON.parse(fs.readFileSync(`${dir}/strip.json`, 'utf8')), strip: StripScale = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP};
  return {face, facts, strip};
};

test('atticProfile: a rear pitch moves only the rear knot; absent = the symmetric profile', () => {
  assert.deepEqual(atticProfile(7.5, 10, 9, 56, 0.4), atticProfile(7.5, 10, 9, 56, 0.4, undefined));
  const sym = atticProfile(7.5, 10, 9, 56, 0.4), rear = atticProfile(7.5, 10, 9, 56, 0.4, 34);
  assert.deepEqual(rear.slice(0, 3), sym.slice(0, 3));
  assert.ok(Math.abs(rear[3][0] - (9 - 2.5 / Math.tan(34 * Math.PI / 180))) < 1e-9);
});

test('validator: roof.rise 0.2-2.5 storeys, rearPitchDeg 15-80, crossGables true only', () => {
  const t = JSON.parse(fs.readFileSync('scripts/block-face/types/spaarndammerbuurt/zaanhof-1919-white-gable.json', 'utf8'));
  assert.equal(t.roof.crossGables, true);
  const {face} = load('zaanhof-125-134'), intent = houseIntents(face)[0];
  assert.doesNotThrow(() => validateIntent(intent));
  for (const [k, v, re] of [['rise', 3, /roof.rise/], ['rearPitchDeg', 90, /rearPitchDeg/], ['crossGables', false, /crossGables/]] as const)
    assert.throws(() => validateIntent({...intent, roof: {...intent.roof, [k]: v}}), re);
});

for (const id of ['zaanhof-125-134', 'zaanhof-1-20']) {
  test(`${id}: every white gable is the end of a cross roof under the main ridge, one eaves line, mirrored pairs`, () => {
    const {face, facts, strip} = load(id);
    const prep = prepareFaceFacts(face, facts, {strip});
    // Mirrored in pairs: doors meet at every second party wall, gables at the others.
    face.houses.forEach((h, i) => i && assert.notEqual(!!h.type?.mirror, !!face.houses[i - 1].type?.mirror, `${h.address}: alternates with its neighbour`));
    const eaves = prep.recipeRoofs!.map(r => r.eavesM);
    assert.ok(Math.max(...eaves) - Math.min(...eaves) < 0.1, `one gutter line: ${eaves}`);
    let gables = 0;
    prep.intents.forEach((intent, i) => {
      const f = prep.ground.facts[i], g0 = f.heights.groundNAP, n = f.fronts[0].outwardNormalRD, nl = Math.hypot(n[0], n[1]);
      const cross = Object.values(crossGablesOf(intent, fitIntent(intent, f))).flat();
      assert.equal(cross.length, 1, `${intent.pandId}: one pointed crown`);
      const ridge = Math.max(...f.roofsRD.flatMap(r => r.vertices.map(v => v[2] - g0)));
      for (const g of cross) {
        gables++;
        assert.ok(g.apexM - 0.03 <= ridge + 1e-6, `${intent.pandId}: apex ${g.apexM} under the ridge ${ridge}`);
        // Half a metre behind the apex the roof stands at the cross ridge (3 cm under the crown; the crown refitted on the
        // roofed facts moves a few cm), not 1-3 m lower as the bare attic did.
        // 2 cm off the cross ridge line itself (the seam between its two planes).
        const p = [g.apexRD[0] - n[0] / nl * 0.5 + n[1] / nl * 0.02, g.apexRD[1] - n[1] / nl * 0.5 - n[0] / nl * 0.02], h = roofHeightAt(f.roofsRD, p, g0);
        assert.ok(h !== null && h >= g.apexM - 0.15, `${intent.pandId}: roof ${h} m half a metre behind the apex ${g.apexM} m (${p})`);
      }
    });
    assert.equal(gables, face.houses.length);
  });
}

test('zaanhof-125-134 compiles with every gate and party line passing', async () => {
  const {face, facts, strip} = load('zaanhof-125-134');
  const r = await compileBlockFace(face, facts, 'face-zaanhof-test', {strip});
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  assert.ok(r.interference.every(i => i.pass));
});

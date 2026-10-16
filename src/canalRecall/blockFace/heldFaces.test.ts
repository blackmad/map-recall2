/**
 * Three installed faces held from the 2026-10-16 roof-rule re-install, pinned:
 *   - clercq-236681 153066 (De Clercqstraat 22) and nassau-162289 (seven Nassaukade pands): the front's outward normal
 *     (from the BAG facade edge) leans off the frontage chord, so an attic face measured along the normal climbed along
 *     the facade line over the crown outline (1.39 m; 0.05-0.21 m). The attic is now square to the chord.
 *   - wallen-oza-41-57 177943 b (Oudezijds Achterburgwal 55): a dormered cornice front 4.2 m over the bell gable beside it
 *     was taken for a tower bay and given its neighbour's attic, so its dormer hovered (24.1 m2, 0.14 m). 177915
 *     (Oudezijds Achterburgwal 43): a zero-area ear dropped on the eaves line left a 1.45 m T-junction (an open loop off
 *     the party wall, 54 m).
 *   node --import tsx --test src/canalRecall/blockFace/heldFaces.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {loadGoldenFace} from '../../../scripts/block-face/roof-golden.ts';
import {roofAboveCrown} from './compile.ts';
import {splitAtDroppedSlivers} from './recipeRoof.ts';

const area = (t: number[][]) => Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2;

test('splitAtDroppedSlivers: the triangle over a dropped collinear ear is split at its middle vertex', () => {
  const a = [0, 0], b = [2.6, 0], c = [4, 0], apex = [2, 3], d = [4, -0.02];
  const out = splitAtDroppedSlivers([[a, b, c], [c, b, d], [a, c, apex]]);
  assert.equal(out.length, 4);
  assert.ok(out.some(t => t.includes(a) && t.includes(b) && t.includes(apex)) && out.some(t => t.includes(b) && t.includes(c) && t.includes(apex)));
  assert.ok(Math.abs(out.slice(1).reduce((s, t) => s + area(t), 0) - (area([c, b, d]) + area([a, c, apex]))) < 1e-9, 'area kept');
  // A short span (under 0.5 m) and a span off the `where` line stay as they were.
  assert.equal(splitAtDroppedSlivers([[a, [0.2, 0], [0.4, 0]], [a, [0.4, 0], apex]]).length, 2);
  assert.equal(splitAtDroppedSlivers([[a, b, c], [a, c, apex]], p => p[0] > 1).length, 2);
});

const underCrown = (faceId: string, pands: string[]) => {
  const {prepared} = loadGoldenFace(faceId);
  const report = new Map((prepared.recipeRoofs ?? []).map(r => [r.pandId.slice(-6), r]));
  for (const pand of pands) {
    const i = prepared.intents.findIndex(x => x.pandId.endsWith(pand)), f = prepared.ground.facts[i];
    assert.equal(f.roofSource?.kind, 'front', `${pand}: front roof`);
    assert.ok(report.get(pand)!.notes.some(n => n.startsWith('attic square to the frontage chord')), `${pand}: squared`);
    const above = roofAboveCrown(prepared.intents[i], fitIntent(prepared.intents[i], f), f);
    assert.ok(above <= 0.03, `${faceId} ${pand}: roof ${above.toFixed(3)} m above the crown outline`);
  }
};

test('De Clercqstraat 22 (153066): the attic stays under the parapet line along the facade', () => underCrown('clercq-236681', ['153066']));

test('Nassaukade: the seven leaning fronts keep their attics under the cornice line', () =>
  underCrown('nassau-162289', ['165898', '154241', '161701', '162089', '159934', '157131', '166694']));

test('Oudezijds Achterburgwal 55 (177943 b) is a house front with its own attic, not a tower bay', () => {
  const {prepared} = loadGoldenFace('wallen-oza-41-57');
  const r = (prepared.recipeRoofs ?? []).find(x => x.pandId.endsWith('177943'))!;
  const b = r.bands!.find(x => x.id === 'b')!;
  assert.equal(b.form, 'attic');
  assert.ok(Math.abs(b.eavesM - 14.4) < 0.05, `b eaves ${b.eavesM}`);
  assert.ok(b.ridgeM > b.eavesM + 1, `b ridge ${b.ridgeM} over its eaves ${b.eavesM}: the dormer stands on it`);
  assert.ok(!r.notes.some(n => n.includes('tower bay')));
});

test('Oudezijds Achterburgwal 43 (177915): no T-junction along the eaves line', () => {
  const {prepared} = loadGoldenFace('wallen-oza-41-57');
  const f = prepared.ground.facts[prepared.intents.findIndex(x => x.pandId.endsWith('177915'))];
  const fr = f.fronts[0], [e0, e1] = fr.endpointsRD, l = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
  const off = (p: number[]) => Math.abs((p[0] - e0[0]) * (e1[1] - e0[1]) - (p[1] - e0[1]) * (e1[0] - e0[0])) / l;
  const verts = f.roofsRD.flatMap(s => s.vertices);
  for (const s of f.roofsRD) for (let k = 0; k < s.vertices.length; k++) {
    const p = s.vertices[k], q = s.vertices[(k + 1) % s.vertices.length];
    if (off(p) > 0.05 || off(q) > 0.05) continue;
    const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy;
    if (l2 < 0.25) continue;
    for (const v of verts) {
      const t = ((v[0] - p[0]) * dx + (v[1] - p[1]) * dy) / l2, d = Math.abs((v[0] - p[0]) * dy - (v[1] - p[1]) * dx) / Math.sqrt(l2);
      assert.ok(!(t > 0.01 && t < 0.99 && d < 1e-4), `vertex ${v.slice(0, 2).map(x => x.toFixed(2))} inside eaves edge ${s.surfaceId}`);
    }
  }
});

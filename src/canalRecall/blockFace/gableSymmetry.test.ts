/**
 * Gables are symmetric and roofs follow the front (user, 2026-10-16: "stepped gables are almost universally symmetric,
 * you keep making this mistake"; "don't give so much credence to 3DBAG roofs"). The crown outline the kit draws was
 * always mirror-symmetric; the lopsided step gables on Kinkerstraat 56-84 were LoD2.2 roof planes showing above the
 * outline through `crownVerges`. Now a gabled front gets a saddle under its outline (`saddleUnderProfile`), the step
 * count is one number for both flanks (`stepsFromFlanks`), and the `roof-under-crown` gate samples the roof along the
 * facade line.
 *   node --import tsx --test src/canalRecall/blockFace/gableSymmetry.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {canalhouseCrownProfile, type CanalhousePoint} from '../canalhouseRecipes.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {roofHeightAt} from '../buildingRecipe/facts.ts';
import {loadGoldenFace} from '../../../scripts/block-face/roof-golden.ts';
import {compileBlockFace, roofAboveCrown} from './compile.ts';
import {stepsFromFlanks} from './gableFromStrip.ts';
import {saddleUnderProfile} from './recipeRoof.ts';

const SIX = ['kinker-56-84', 'kinker-315-359', 'kinker-65-87', 'kinker-206-242', 'bilder-081118-155417', 'bilder-236022-167243'];

/** Every raised vertex (above the eaves line) has its mirror about the raised part's centre: a crown over part of a front mirrors about its own centre. */
function mirrorError(profile: CanalhousePoint[]): number {
  const eaves = Math.min(...profile.map(p => p[1])), raised = profile.filter(p => p[1] > eaves + 1e-9);
  if (!raised.length) return 0;
  const xs = raised.map(p => p[0]), c = (Math.min(...xs) + Math.max(...xs)) / 2;
  let worst = 0;
  for (const [x, y] of raised) {
    const mx = 2 * c - x;
    worst = Math.max(worst, Math.min(...raised.map(([px, py]) => Math.hypot(px - mx, py - y))));
  }
  return worst;
}

test('library crown outlines mirror within 1e-6 for every gable type, step count, cap and shoulder', () => {
  const w = 6, e = 12, top = 15;
  const cases: CanalhousePoint[][] = [
    canalhouseCrownProfile('punt', w, e, top, 0, e, 0),
    canalhouseCrownProfile('tuit', w, e, top, w * 0.34, top - 0.4, 0),
    ...[1, 2, 3, 4, 5, 6].map(steps => canalhouseCrownProfile('trap', w, e, top, w * 0.3, e, steps)),
    ...(['pediment', 'flat', 'rounded'] as const).map(cap => canalhouseCrownProfile('hals', w, e, top, w * 0.5, e + 1.2, 0, {cap, capRiseM: cap === 'flat' ? 0 : 0.3, crestWidthM: w * 0.5, shoulderCurve: 0.6})),
    canalhouseCrownProfile('klok', w, e, top, w * 0.46, e + 1.6, 0, {cap: 'rounded', capRiseM: 0.4, crestWidthM: w * 0.46}),
  ];
  for (const p of cases) assert.ok(mirrorError(p) <= 1e-6, `outline mirror error ${mirrorError(p)}`);
});

test('stepsFromFlanks: one count for both flanks; a poorly read flank defers to the other', () => {
  assert.equal(stepsFromFlanks(4, 4), 4);
  assert.equal(stepsFromFlanks(4, 3), 4);
  assert.equal(stepsFromFlanks(3, 4), 4);
  assert.equal(stepsFromFlanks(2, 5), 4);
  assert.equal(stepsFromFlanks(2, 5, [0.9, 0.95]), 4);
  assert.equal(stepsFromFlanks(2, 5, [0.3, 0.95]), 5);
  assert.equal(stepsFromFlanks(5, 2, [0.95, 0.3]), 5);
  assert.equal(stepsFromFlanks(2, 5, [0.3, 0.4]), 4);
});

test('saddleUnderProfile: the ridge sits at the centre and the roof stays under every outline vertex', () => {
  const w = 6, e = 12;
  for (const p of [canalhouseCrownProfile('punt', w, e, 15, 0, e, 0), canalhouseCrownProfile('trap', w, e, 15, w * 0.3, e, 4), canalhouseCrownProfile('klok', w, e, 15, w * 0.46, e + 1.6, 0, {cap: 'rounded', capRiseM: 0.4, crestWidthM: w * 0.46}), canalhouseCrownProfile('hals', w, e, 15, w * 0.5, e + 1.2, 0, {cap: 'pediment', capRiseM: 0.3, crestWidthM: w * 0.5, shoulderCurve: 0.6})]) {
    const s = saddleUnderProfile(p, w, e);
    assert.ok(s, 'a saddle fits under a full-width crown');
    assert.equal(s!.centreM, w / 2);
    assert.ok(s!.ridgeM > e && s!.ridgeM <= 15 - 0.03 + 1e-9);
    const tan = Math.tan(s!.pitchDeg * Math.PI / 180);
    for (const [x, y] of p) assert.ok(s!.ridgeM - tan * Math.abs(x - w / 2) <= y - 0.03 + 1e-3, `under the outline at x=${x}`);
    assert.ok(s!.sideEavesM >= e - 1);
  }
  // A narrow crown on a wide front (a step gable over one bay of a 12 m front) would drop the side eaves too far.
  const narrow = canalhouseCrownProfile('trap', 4, 12, 15, 1.2, 12, 3).map(([x, y]) => [x + 4, y] as CanalhousePoint);
  assert.equal(saddleUnderProfile([[0, 12], ...narrow, [12, 12]], 12, 12), null);
});

test('six faces: every compiled gable outline is mirror-symmetric (a cornice cap over part of a front is not a gable)', () => {
  let n = 0;
  for (const id of SIX) {
    const {prepared} = loadGoldenFace(id);
    prepared.intents.forEach((intent, i) => {
      const fit = fitIntent(intent, prepared.ground.facts[i]);
      for (const el of fit.recipe.elevations) {
        const fr = intent.fronts.find(f => f.id === el.id);
        if (!el.crown || !fr || ['cornice', 'flat'].includes(fr.gable)) continue;
        assert.ok(mirrorError(el.crown.value.profile) <= 1e-6, `${id} ${intent.pandId.slice(-6)} ${el.id} (${fr.gable}): crown outline mirror error ${mirrorError(el.crown.value.profile)}`);
        n++;
      }
    });
  }
  assert.ok(n >= 20, `${n} gabled fronts checked`);
});

test('Kinkerstraat 56-84: step and point gables carry saddles, the roof is symmetric about each gable and under its outline', async () => {
  const {face, facts, options, prepared} = loadGoldenFace('kinker-56-84');
  const report = new Map((prepared.recipeRoofs ?? []).map(r => [r.pandId.slice(-6), r]));
  for (const [pand, front] of [['236325', 'm0'], ['236325', 'm1'], ['236441', 'm2'], ['161359', 'm0']]) {
    const r = report.get(pand);
    assert.ok(r?.bands, `${pand}: a front roof`);
    assert.equal(r!.bands!.find(b => b.id === front)?.form, 'saddle', `${pand} ${front}`);
  }
  prepared.intents.forEach((intent, i) => {
    const f = prepared.ground.facts[i];
    if (f.roofSource?.kind !== 'front') { assert.equal(prepared.roofClasses[i], 'survey'); assert.equal(f.rowClamp, undefined); return; }
    const fit = fitIntent(intent, f), r = report.get(intent.pandId.slice(-6))!;
    const n = f.fronts[0].outwardNormalRD, nl = Math.hypot(n[0], n[1]), inward = [-n[0] / nl, -n[1] / nl];
    for (const band of r.bands!.filter(b => b.form === 'saddle')) {
      const el = fit.recipe.elevations.find(x => x.id === band.id)!, ring = fit.recipe.footprint.value[el.polygonIndex].outer;
      const a = ring[el.edgeIndex], b = ring[el.endEdgeIndex ?? (el.edgeIndex + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const at = (x: number) => { const lx = a[0] + (b[0] - a[0]) * x / len, lz = a[1] + (b[1] - a[1]) * x / len; return roofHeightAt(f.roofsRD, [fit.anchorRD[0] + lx + inward[0] * 0.3, fit.anchorRD[1] - lz + inward[1] * 0.3], f.heights.groundNAP); };
      for (const t of [0.5, 1, 1.5, 2].filter(t => t <= len / 2 - 0.3)) {
        const l = at(len / 2 - t), rr = at(len / 2 + t);
        assert.ok(l !== null && rr !== null, `${intent.pandId.slice(-6)} ${band.id}: roof sampled at c±${t}`);
        assert.ok(Math.abs(l! - rr!) <= 0.02, `${intent.pandId.slice(-6)} ${band.id}: roof ${l} vs ${rr} at c±${t}`);
      }
    }
    assert.ok(roofAboveCrown(intent, fit, f) <= 0.03, `${intent.pandId.slice(-6)}: roof under the crown outline`);
  });
  // Kinkerstraat 76-84 (152566, the flat infill) keeps its LoD2.2 roof: the survey planes, untouched by any rule.
  const i0 = face.houses.findIndex(h => h.pandId.endsWith('152566')), before = facts.get(face.houses[i0].pandId)!, after = prepared.ground.facts[i0];
  assert.equal(prepared.roofClasses[i0], 'survey');
  assert.equal(after.roofSource, undefined);
  assert.equal(after.rowClamp, undefined);
  assert.equal(after.measuredEavesM, undefined);
  assert.equal(after.roofsRD.length, before.roofsRD.length);
  // Compiled: gates pass and no roof z-fight at the party lines.
  const r = await compileBlockFace(face, facts, 'face-gable-symmetry-test', {...options, inferRears: false});
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand.slice(-6)}/${g.id}`), []);
  for (const x of r.interference) assert.ok(x.roofZFightM2 <= 0.05, `${x.left.slice(-6)}|${x.right.slice(-6)}: roof z-fight ${x.roofZFightM2} m2`);
});

/**
 * Neck and bell flank curvature (user, 2026-10-16, on the wallen-oza-41-57 sheet: "weird that the kit inverts the curve
 * of the roof from concave to convex"). The kit drew every neck flank as f^0.6 and every bell flank as a quarter sine,
 * both bulging out, where the claw pieces and bell flares on the photos sweep in: flat at the foot, rising steeply into
 * the neck. The flank curve is now a kit property (`crownShoulder`, default concave), read off the strip skyline by
 * `flankCurvature`, and the roof behind a full-front gable crown is held under the crown in a front view
 * (`roofAboveCrownFrontView`: the facade-line check passed a 70 degree attic standing 1.5-2.8 m over concave shoulders).
 * Named locations: Oudezijds Achterburgwal 45-47 (177920) and 57 (177946), neck gables; 53 (177943 a), a bell.
 *   node --import tsx --test src/canalRecall/blockFace/gableCurvature.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {canalhouseCrownProfile, crownShoulderCurve, type CanalhousePoint} from '../canalhouseRecipes.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {loadGoldenFace} from '../../../scripts/block-face/roof-golden.ts';
import {crownShape, flankCurvature} from './gableFromStrip.ts';
import {roofAboveCrown, roofAboveCrownFrontView} from './compile.ts';
import type {GableProfileSample} from '../facade/gableFit.ts';

/** Mean of h - f over a flank curve (negative: under the chord). */
const deviation = (c: [number, number][]) => c.reduce((s, [f, h]) => s + h - f, 0) / c.length;

test('crownShoulderCurve: concave under the chord, convex over it, ogee an S, straight on it', () => {
  assert.ok(deviation(crownShoulderCurve('concave')) < -0.2);
  assert.ok(deviation(crownShoulderCurve('convex')) > 0.1);
  assert.ok(Math.abs(deviation(crownShoulderCurve('straight'))) < 1e-9);
  const ogee = crownShoulderCurve('ogee');
  assert.ok(ogee.filter(([f]) => f > 0 && f < 0.5).every(([f, h]) => h < f) && ogee.filter(([f]) => f > 0.5 && f < 1).every(([f, h]) => h > f));
  for (const s of ['concave', 'ogee', 'straight', 'convex'] as const) { const c = crownShoulderCurve(s); assert.deepEqual(c[0], [0, 0]); assert.ok(Math.abs(c.at(-1)![0] - 1) < 1e-12 && Math.abs(c.at(-1)![1] - 1) < 1e-12); }
});

test('canalhouseCrownProfile: a named shoulder shapes both flanks of a neck and a bell, mirrored; legacy calls unchanged', () => {
  for (const type of ['hals', 'klok'] as const) {
    const p = canalhouseCrownProfile(type, 5, 10, 13.4, 2.5, 11.5, 0, {cap: 'rounded', capRiseM: 0.4, crestWidthM: 2.5, shoulder: 'concave'});
    const left = p.filter(([x]) => x <= 1.25 + 1e-9), right = p.filter(([x]) => x >= 3.75 - 1e-9);
    // Mid-flank: a concave flank is under its chord (eaves at the foot, the shoulder at the neck).
    const mid = left.find(([x]) => Math.abs(x - 1.25 * Math.sin(Math.PI / 4)) < 1e-9)!;
    assert.ok(mid[1] < 10 + 1.5 * (mid[0] / 1.25), `${type}: mid-flank ${mid[1]} under the chord`);
    assert.deepEqual(left.map(([x, y]) => [+(5 - x).toFixed(9), +y.toFixed(9)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), right.map(([x, y]) => [+x.toFixed(9), +y.toFixed(9)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), `${type}: symmetric`);
  }
  // Without a shoulder the clock keeps its sine and the neck its power (landmark builders call these directly).
  const legacy: CanalhousePoint[] = canalhouseCrownProfile('klok', 5, 10, 13.4, 2.5, 11.5, 0);
  assert.ok(Math.abs(legacy[4][1] - (10 + 1.5 * Math.sin(Math.PI / 4))) < 1e-12);
  assert.throws(() => canalhouseCrownProfile('klok', 5, 10, 13.4, 2.5, 11.5, 0, {shoulder: 'bulgy' as never}));
});

/** A synthetic 6 m front (0.1 m samples): eaves 10 m, a 2 m neck rising 3 m, flanks by `flank(t)` (t 0 foot, 1 neck). */
function front(flank: (t: number) => number): GableProfileSample[] {
  const out: GableProfileSample[] = [];
  for (let k = 0; k < 60; k++) {
    const x = k * 0.1 + 0.05, d = Math.min(x, 6 - x);
    out.push([x, d >= 2 ? 13 : 10 + 2 * flank(d / 2)]);
  }
  return out;
}

test('flankCurvature: claw pieces read concave, a bulge convex, an S ogee, a slant straight', () => {
  const read = (f: (t: number) => number) => { const p = front(f); return flankCurvature(p, crownShape(p)); };
  assert.equal(read(t => 1 - Math.sqrt(1 - t * t)).shoulder, 'concave');
  assert.equal(read(t => Math.sin(t * Math.PI / 2)).shoulder, 'convex');
  assert.equal(read(t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2).shoulder, 'ogee');
  assert.equal(read(t => t).shoulder, 'straight');
  // A flat front has no crown to read.
  const flat: GableProfileSample[] = Array.from({length: 60}, (_, k) => [k * 0.1 + 0.05, 10]);
  assert.equal(flankCurvature(flat, crownShape(flat)).shoulder, null);
});

test('crownShoulder is validated: only neck and bell crowns have curved flanks', () => {
  const base = {pandId: '0363100000000001', id: 't', sources: [], fronts: [{id: 'f', street: 'S', gable: 'step', crownShoulder: 'concave', storeys: 3, bays: 3, doorBay: 1, basement: 'none', cornice: 'none', windows: 'sash', hoist: false, tallGround: false}]} as never;
  assert.throws(() => validateIntent(base), /crownShoulder/);
});

test('Oudezijds Achterburgwal 177920, 177946 (neck) and 177943 a (bell): concave flanks, the saddle under them in a front view', () => {
  const {prepared} = loadGoldenFace('wallen-oza-41-57');
  const roofs = new Map((prepared.recipeRoofs ?? []).map(r => [r.pandId.slice(-6), r]));
  for (const pand of ['177920', '177946', '177943']) {
    const i = prepared.intents.findIndex(x => x.pandId.endsWith(pand)), f = prepared.ground.facts[i], fit = fitIntent(prepared.intents[i], f);
    const el = fit.recipe.elevations.find(e => e.crown)!, profile = el.crown!.value.profile, rf = fit.report.fronts.find(x => x.id === el.id)!;
    // Mid-flank (a quarter of the front in from the left party wall) the outline is under the line from the foot to
    // the outline's height at the neck (half-way in): concave.
    const at = (x: number) => Math.max(...profile.filter((p, k) => k > 0 && x >= Math.min(p[0], profile[k - 1][0]) && x <= Math.max(p[0], profile[k - 1][0])).map((p, k) => p[1]), -Infinity);
    const w = rf.widthM, neckX = profile.find(p => p[1] >= profile[0][1] + 0.3 && p[0] > 0.1)![0];
    assert.ok(neckX > 0.3 && neckX < w / 2, `${pand}: flank ends at the neck`);
    assert.ok(at(neckX / 2) < profile[0][1] + 0.35 * (at(neckX) - profile[0][1]), `${pand}: flank is concave`);
    assert.equal(roofs.get(pand)!.bands!.find(b => b.id === el.id)!.form, 'saddle', `${pand}: a saddle under the crown, not an attic face`);
    assert.ok(roofAboveCrownFrontView(prepared.intents[i], fit, f) <= 0.1, `${pand}: no roof over the crown in a front view`);
  }
});

test('the front-view check catches an attic face over concave neck shoulders that the facade-line check passes', () => {
  const {prepared} = loadGoldenFace('wallen-oza-41-57', raw => {
    const h = (raw as any).houses.find((x: any) => x.pandId.endsWith('177920'));
    h.design.roof = {...(h.design.roof ?? {}), form: 'attic'};
  });
  const i = prepared.intents.findIndex(x => x.pandId.endsWith('177920')), f = prepared.ground.facts[i], fit = fitIntent(prepared.intents[i], f);
  assert.ok(roofAboveCrown(prepared.intents[i], fit, f) <= 0.03, 'facade line: passes');
  assert.ok(roofAboveCrownFrontView(prepared.intents[i], fit, f) > 1, 'front view: the attic stands over the shoulders');
});

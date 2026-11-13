import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOF_ROW_MIN, SOUTERRAIN_FACTOR, STOREY_PITCH_RANGE, storeyDraw, storeyGuardEnabled, storeyPlan } from './storeyPlan.ts';
import { SOUTERRAIN } from '../blockBuilding/systems.ts';
import { specStoreyFit } from '../streetFacadeRendering.ts';
import { STYLE_DIMS } from '../facadeCells.ts';
import { specView } from './view.ts';
import { drawableDesign, specProblems, type HouseSpec } from './spec.ts';

test('the souterrain is the block-face kit\'s', () => assert.equal(SOUTERRAIN_FACTOR, SOUTERRAIN.factor));

// Weteringschans 0363100012171218 (1877, c19): D1 read a souterrain, three storeys and a slate mansard; 3DBAG eaves 13.4 m
// (bag-facts 8414/5385, no ridge). Before lane WG the count drew 3 rows at 5.31 m.
const W171218 = { storeys: 3, souterrain: true, roofStorey: 'mansard' as const, eavesM: 13.4, period: 'c19' };

test('171218: storeys 3 + souterrain + roof storey fit at 3.3 m +-15 %, for the wall the mesher has', () => {
  for (const wallM of [13.4, 13.9, 14.24]) {
    const plan = storeyPlan({ ...W171218, wallM })!;
    assert.ok(plan.ok, `wall ${wallM}: pitch ${plan.pitchM}`);
    assert.ok(Math.abs(plan.pitchM / 3.3 - 1) <= 0.15, `pitch ${plan.pitchM.toFixed(2)} within 15 % of 3.3 m`);
    assert.equal(plan.lineFrom, 'eaves');
    assert.equal(plan.roofRow, false, 'the mansard is above 3DBAG eaves: roof, not wall');
    const draw = storeyDraw(plan, 3, true);
    assert.ok(draw && draw !== 'reject');
    assert.equal(draw.storeys, 4, 'the souterrain ground cell and three window rows');
    assert.ok(Math.abs(draw.groundM! - 0.58 * plan.pitchM) < 0.01);
  }
});

test('171218 without the souterrain read: 3 rows under 13.4 m eaves are 4.47 m, outside c19 (<= 4.09): rejected', () => {
  const plan = storeyPlan({ storeys: 3, eavesM: 13.4, period: 'c19', wallM: 13.9 })!;
  assert.ok(Math.abs(plan.pitchM - 4.467) < 0.01);
  assert.equal(plan.ok, false);
  assert.equal(storeyDraw(plan, 3, true), 'reject');
  assert.equal(storeyDraw(plan, 3, false), null, 'guard off: the count is drawn as before');
});

test('a roof storey inside the wall draws as one more window row', () => {
  // eaves 12 m on a 15.5 m wall: 3.5 m of wall over the eaves line holds the mansard row
  const plan = storeyPlan({ storeys: 3, roofStorey: 'attic', eavesM: 12, wallM: 15.5, period: 'c19' })!;
  assert.equal(plan.roofRow, true); assert.ok(plan.ok);
  assert.deepEqual(storeyDraw(plan, 3, true), { storeys: 4 });
  // no eaves: the period pitch decides (3 x 3.41 = 10.2 m, 1.6 m over it is less than ROOF_ROW_MIN of a storey on 11.8 m)
  assert.equal(storeyPlan({ storeys: 3, roofStorey: 'mansard', wallM: 10.23 + ROOF_ROW_MIN * 3.41 - 0.05, period: 'c19' })!.roofRow, false);
  const noEaves = storeyPlan({ storeys: 3, roofStorey: 'mansard', wallM: 13.5, period: 'c19' })!;
  assert.equal(noEaves.roofRow, true); assert.ok(Math.abs(noEaves.pitchM - 13.5 / 4) < 1e-9);
  // `none` and absent are the same
  assert.deepEqual(storeyPlan({ storeys: 3, roofStorey: 'none', wallM: 11, period: 'c19' }), storeyPlan({ storeys: 3, wallM: 11, period: 'c19' }));
});

test('no souterrain and no roof row: the stated count is drawn as before (null), unless the guard rejects it', () => {
  const plan = storeyPlan({ storeys: 4, wallM: 13, period: 'c19' })!;
  assert.ok(plan.ok); assert.equal(storeyDraw(plan, 4, true), null);
  assert.equal(storeyDraw(storeyPlan({ storeys: 2, wallM: 6, period: 'school' })!, 2, true), null, '3.0 m: within school');
  assert.equal(storeyDraw(storeyPlan({ storeys: 6, wallM: 12, period: 'canal' })!, 6, true), 'reject', '2.0 m: under canal p5');
  // an eaves line far over the wall is another mass: the wall top is the line
  assert.equal(storeyPlan({ storeys: 4, wallM: 13, eavesM: 20, period: 'c19' })!.lineFrom, 'wall');
  assert.equal(storeyPlan({ storeys: 0, wallM: 13 }), null);
});

test('ranges are ordered and within the integrator\'s 2.3..4.5 m band', () => {
  for (const r of Object.values(STOREY_PITCH_RANGE)) { assert.ok(r.min < r.median && r.median < r.max); assert.ok(r.min >= 2.3 && r.max <= 4.5); }
});

test('flag: default on, ?storeyGuard=0 / STOREY_GUARD=0 off, query wins', () => {
  assert.equal(storeyGuardEnabled(null, null), true);
  assert.equal(storeyGuardEnabled('?storeyGuard=0', null), false);
  assert.equal(storeyGuardEnabled(null, '0'), false);
  assert.equal(storeyGuardEnabled('?storeyGuard=1', '0'), true);
});

test('171218 drawn through specStoreyFit: souterrain ground cell, three rows to the eaves, the wall over them a plain band', () => {
  // ah07-probe.json (D1): c19, the street run's exposed wall 14.32 m, today 5 x 2.66 m over a 3.70 m ground
  for (const style of ['canal', 'c19'] as const) for (const wallM of [13.4, 14.32]) {
    const plan = storeyPlan({ ...W171218, wallM })!, draw = storeyDraw(plan, 3, true, wallM) as { storeys: number; groundM: number; bandM?: number };
    assert.equal(draw.bandM ?? 0, wallM === 13.4 ? 0 : +(wallM - 13.4).toFixed(3));
    const rowsWall = wallM - (draw.bandM ?? 0);
    const fit = specStoreyFit(style, rowsWall, draw.storeys, 1, { fit: 'nearest', groundM: draw.groundM })!;
    const groundM = STYLE_DIMS[style].ground * fit.ground, storeyM = STYLE_DIMS[style].storey * fit.storey;
    assert.ok(Math.abs((rowsWall - groundM) / storeyM - 3) < 1e-6, 'layoutWall rounds to three upper rows');
    assert.ok(Math.abs(storeyM / 3.3 - 1) <= 0.15, `${style} ${wallM}: drawn row ${storeyM.toFixed(2)} m`);
    assert.ok(groundM < 2.6, `${style}: souterrain cell ${groundM.toFixed(2)} m`);
  }
});

const spec = (front: Record<string, unknown>, prov: Record<string, { source: string; confidence: number }>): HouseSpec => ({
  schemaVersion: 1, pandId: '0363100012171218', design: { fronts: [front as never] },
  provenance: Object.fromEntries(Object.entries(prov).map(([k, v]) => [k, { ...v, ref: 'x', at: null }])) as HouseSpec['provenance'],
});

test('view: souterrain and roof storey only from a front-reading or register source at confidence >= 0.5, only with storeys', () => {
  const vj = { source: 'vision-judge', confidence: 0.7 };
  const v = specView(spec({ storeys: 3, souterrain: true, roofStorey: 'mansard' }, { 'fronts/0/storeys': vj, 'fronts/0/souterrain': vj, 'fronts/0/roofStorey': vj }));
  assert.equal(v.souterrain, true); assert.equal(v.roofStorey, 'mansard'); assert.equal(v.src.souterrain, 'vision-judge');
  const weak = specView(spec({ storeys: 3, souterrain: true, roofStorey: 'attic' }, { 'fronts/0/storeys': vj, 'fronts/0/souterrain': { source: 'vision-judge', confidence: 0.4 }, 'fronts/0/roofStorey': { source: '3dbag', confidence: 0.9 } }));
  assert.equal(weak.souterrain, undefined); assert.equal(weak.roofStorey, undefined);
  const none = specView(spec({ storeys: 3, roofStorey: 'none' }, { 'fronts/0/storeys': vj, 'fronts/0/roofStorey': vj }));
  assert.equal('roofStorey' in none, false);
  const noCount = specView(spec({ souterrain: true }, { 'fronts/0/souterrain': vj }));
  assert.equal('souterrain' in noCount, false);
});

test('spec: roofStorey validates, and the recipe route drops it (the intent has no key)', () => {
  const s = spec({ storeys: 3, roofStorey: 'mansard' }, { 'fronts/0/storeys': { source: 'vision-judge', confidence: 0.7 }, 'fronts/0/roofStorey': { source: 'vision-judge', confidence: 0.7 } });
  assert.deepEqual(specProblems(s), []);
  assert.ok(specProblems(spec({ roofStorey: 'loft' }, { 'fronts/0/roofStorey': { source: 'vision-judge', confidence: 0.7 } }))[0].includes('roofStorey'));
  const d = drawableDesign(s.design);
  assert.equal((d.design.fronts![0] as Record<string, unknown>).roofStorey, undefined);
  assert.deepEqual(d.ignored, [{ path: 'fronts/0/roofStorey', value: 'mansard', drawnAs: null }]);
  assert.equal(drawableDesign({ fronts: [{ storeys: 3 }] }).ignored.length, 0);
});

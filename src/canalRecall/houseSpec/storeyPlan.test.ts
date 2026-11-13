import test from 'node:test';
import assert from 'node:assert/strict';
import { TALL_GROUND_RATIO, ROOF_ROW_MIN, SOUTERRAIN_FACTOR, STOREY_PITCH_RANGE, frontEavesM, storeyDraw, storeyGuardEnabled, storeyPlan, storeyPlanDraws } from './storeyPlan.ts';
import { decodeDescriptor } from '../bagTiles.ts';
import { SOUTERRAIN } from '../blockBuilding/systems.ts';
import { specStoreyFit, SPEC_GROUND_SCALE, SPEC_SOUTERRAIN_GROUND_MIN } from '../streetFacadeRendering.ts';
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

test('171218 without the souterrain read: 3 rows under 13.4 m eaves are 4.47 m, over c19 (<= 4.09); the tall-ground retry takes it', () => {
  const plan = storeyPlan({ storeys: 3, eavesM: 13.4, period: 'c19', wallM: 13.9 })!;
  assert.ok(Math.abs(plan.pitchM - 13.4 / (2 + TALL_GROUND_RATIO)) < 0.01, 'upper rows 4.07 m');
  assert.ok(plan.ok && plan.tallGround);
  // without the retry window the plain pitch (4.47 m) is what the guard would reject
  assert.ok(13.4 / 3 > STOREY_PITCH_RANGE.c19.max);
  assert.equal(storeyDraw(storeyPlan({ storeys: 3, period: 'c19', wallM: 16.6 })!, 3, true), 'reject');
  assert.equal(storeyDraw(storeyPlan({ storeys: 3, period: 'c19', wallM: 16.6 })!, 3, false), null, 'guard off: the count is drawn as before');
});

test('only a stated attic storey draws one more window row; a mansard is roof', () => {
  // eaves 12 m on a 15.5 m wall: 3.5 m of wall over the eaves line holds the attic row
  const plan = storeyPlan({ storeys: 3, roofStorey: 'attic', eavesM: 12, wallM: 15.5, period: 'c19' })!;
  assert.equal(plan.roofRow, true); assert.ok(plan.ok);
  assert.deepEqual(storeyDraw(plan, 3, true, 15.5), { storeys: 4 });
  // the same wall with a mansard: three rows to the eaves, the mansard face a plain band
  const mansard = storeyPlan({ storeys: 3, roofStorey: 'mansard', eavesM: 12, wallM: 15.5, period: 'c19' })!;
  assert.equal(mansard.roofRow, false);
  assert.deepEqual(storeyDraw(mansard, 3, true, 15.5), { storeys: 3, bandM: 3.5 });
  // no eaves: the period pitch decides whether the wall holds the attic (3 x 3.41 = 10.2 m)
  assert.equal(storeyPlan({ storeys: 3, roofStorey: 'attic', wallM: 10.23 + ROOF_ROW_MIN * 3.41 - 0.05, period: 'c19' })!.roofRow, false);
  const noEaves = storeyPlan({ storeys: 3, roofStorey: 'attic', wallM: 13.5, period: 'c19' })!;
  assert.equal(noEaves.roofRow, true); assert.ok(Math.abs(noEaves.pitchM - 13.5 / 4) < 1e-9);
  // a mansard without eaves never adds a row
  assert.equal(storeyPlan({ storeys: 3, roofStorey: 'mansard', wallM: 13.5, period: 'c19' })!.roofRow, false);
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
  // an eaves line far under the wall top is a rear annex's roof (AH07 0363100012165003: 3.1 m under an 18.2 m front)
  assert.equal(storeyPlan({ storeys: 6, wallM: 18.18, eavesM: 3.1, period: 'school' })!.lineFrom, 'wall');
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
    const plan = storeyPlan({ ...W171218, wallM })!, draw = storeyDraw(plan, 3, true, wallM) as { storeys: number; groundM: number; souterrain?: true; bandM?: number };
    assert.equal(draw.bandM ?? 0, wallM === 13.4 ? 0 : +(wallM - 13.4).toFixed(3));
    const rowsWall = wallM - (draw.bandM ?? 0);
    const fit = specStoreyFit(style, rowsWall, draw.storeys, 1, { fit: 'nearest', groundM: draw.groundM, groundMin: SPEC_SOUTERRAIN_GROUND_MIN })!;
    const groundM = STYLE_DIMS[style].ground * fit.ground, storeyM = STYLE_DIMS[style].storey * fit.storey;
    assert.ok(Math.abs((rowsWall - groundM) / storeyM - 3) < 1e-6, 'layoutWall rounds to three upper rows');
    assert.ok(Math.abs(storeyM / 3.3 - 1) <= 0.15, `${style} ${wallM}: drawn row ${storeyM.toFixed(2)} m`);
    assert.ok(Math.abs(groundM - draw.groundM) < 0.01, `${style}: souterrain cell ${groundM.toFixed(2)} m drawn as fitted (not clamped to SPEC_GROUND_SCALE.min)`);
    assert.equal(draw.souterrain, true);
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
  assert.equal(specView(spec({ storeys: 3, gable: 'cornice' }, { 'fronts/0/storeys': vj, 'fronts/0/gable': vj })).corniceCrown, true);
  assert.equal(specView(spec({ storeys: 3, gable: 'cornice' }, { 'fronts/0/storeys': vj, 'fronts/0/gable': { source: 'osm', confidence: 0.9 } })).corniceCrown, undefined);
  assert.equal(specView(spec({ gable: 'cornice' }, { 'fronts/0/gable': vj })).corniceCrown, undefined, 'only with storeys');
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

test('a too-tall pitch retries with a tall ground row before rejecting (cause b)', () => {
  // 3 rows on 13.9 m eaves = 4.63 m; with the ground at 1.29 upper pitches: 13.9 / 3.29 = 4.22 m (canal max 4.26)
  const plan = storeyPlan({ storeys: 3, eavesM: 13.9, wallM: 14.3, period: 'canal' })!;
  assert.equal(plan.ok, true); assert.ok(plan.tallGround);
  assert.ok(Math.abs(plan.pitchM - 13.9 / (2 + TALL_GROUND_RATIO)) < 1e-9);
  const draw = storeyDraw(plan, 3, true, 14.3) as { storeys: number; groundM: number; bandM?: number };
  assert.equal(draw.storeys, 3); assert.ok(Math.abs(draw.groundM - TALL_GROUND_RATIO * plan.pitchM) < 0.01); assert.equal(draw.bandM, 0.4);
  // still too tall with the tall ground: rejected, no rescue
  const far = storeyPlan({ storeys: 3, wallM: 16.6, period: 'c19' })!;
  assert.equal(far.ok, false); assert.equal(far.tallGround, undefined);
  // too short never retries
  assert.equal(storeyPlan({ storeys: 6, wallM: 12, period: 'canal' })!.tallGround, undefined);
});

test('the eaves window records an ignored eaves (cause c)', () => {
  assert.equal(storeyPlan({ storeys: 4, wallM: 18, eavesM: 3.1, period: 'c19' })!.eavesIgnored, true);
  assert.equal(storeyPlan({ storeys: 4, wallM: 14, eavesM: 13.4, period: 'c19' })!.eavesIgnored, false);
  assert.equal(storeyPlan({ storeys: 4, wallM: 14, period: 'c19' })!.eavesIgnored, false);
});

test('the souterrain floor applies only when asked: no groundMin is the H11 clamp', () => {
  assert.deepEqual(specStoreyFit('c19', 13, 4, 1, { fit: 'nearest', groundM: 1.9 }), specStoreyFit('c19', 13, 4, 1, { fit: 'nearest', groundM: 3.6 * SPEC_GROUND_SCALE.min }));
  assert.ok(Math.abs(specStoreyFit('c19', 13, 4, 1, { fit: 'nearest', groundM: 1.9, groundMin: SPEC_SOUTERRAIN_GROUND_MIN })!.ground * 3.6 - 1.9) < 1e-9);
});

test('a wall over 3DBAG eaves is a plain band, read or not: no window row above the rows (BK, 168043)', () => {
  // 3 rows, eaves 11.4 m, wall 12.54 m: rows to the eaves, a plain band
  const small = storeyPlan({ storeys: 3, eavesM: 11.4, wallM: 12.54, period: 'c19' })!;
  assert.equal(small.roofRow, false);
  assert.deepEqual(storeyDraw(small, 3, true, 12.54), { storeys: 3, bandM: 1.14 });
  // eaves at the wall top: nothing changes
  assert.equal(storeyDraw(storeyPlan({ storeys: 4, eavesM: 13.1, wallM: 13.2, period: 'c19' })!, 4, true, 13.2), null);
  // a wall well over the eaves no longer grows a row (lane WG drew 168043 as 4 rows from its annex eaves)
  const over = storeyPlan({ storeys: 3, eavesM: 12, wallM: 14.5, period: 'c19' })!;
  assert.equal(over.roofRow, false);
  assert.deepEqual(storeyDraw(over, 3, true, 14.5), { storeys: 3, bandM: 2.5 });
});

// BK's bake-off (2026-11-13): Weteringschans fronts read as 3 storeys under a cornice or mansard drew 4-5 rows. The
// published building tiles' `height` (3DBAG 70p) and bag-facts 8414/5385 rows, verbatim; 3DBAG LoD2.2 (api.3dbag.nl,
// fetched 2026-11-13) puts each street-facing roof plane's foot at 14.1-16.9 m and a rear roof at 5.6-10.0 m.
const BAG_ROWS: Record<string, { row: number[]; heightM: number; front: number | null }> = {
  '0363100012168042': { row: [2, 4, 3, 63, 0, 1870, 1], heightM: 16.43, front: null }, // rear lean-to 6.1-6.5 m; street mansard 14.2-16.4
  '0363100012171192': { row: [2, 2, 3, 63, 0, 1896, 1], heightM: 16.83, front: null }, // rear 5.8-6.6 m; flat roof 16.7-16.9
  '0363100012185507': { row: [2, 4, 3, 63, 0, 1870, 1], heightM: 16.49, front: null }, // rear 5.6-17.0 m slope; flat 16.2-17.0
  '0363100012168043': { row: [2, 4, 3, 100, 0, 1870, 1], heightM: 16.52, front: null }, // flat rear roof 9.9-10.0 m
  '0363100012168096': { row: [2, 3, 3, 98, 0, 1870, 1], heightM: 16.59, front: null }, // flat rear roof 9.8-10.0 m
  '0363100012171218': { row: [2, 5, 3, 134, 0, 1877, 1], heightM: 16.65, front: 13.4 }, // flat at 13.4 behind a mansard to 16.6
};

test('bag-facts eaves is the pand\'s lowest roof point: a rear annex is not the front\'s eaves (168042, 171192, 185507)', () => {
  for (const [id, { row, heightM, front }] of Object.entries(BAG_ROWS)) {
    const d = decodeDescriptor(row);
    assert.equal(frontEavesM({ eavesM: d.eavesM, ridgeM: d.ridgeM, heightM }), front, id);
  }
  // under a ridge the 70th percentile sits part way up the roof: a canal gable 8 m tall keeps its eaves
  assert.equal(frontEavesM({ eavesM: 9, ridgeM: 17, heightM: 14.6 }), 9);
  assert.equal(frontEavesM({ eavesM: 6.3, ridgeM: 17, heightM: 16.4 }), null);
  assert.equal(frontEavesM({ eavesM: 6.3, ridgeM: null, heightM: null }), 6.3, 'no height: kept, the plan\'s own window decides');
  assert.equal(frontEavesM({ eavesM: null, ridgeM: null, heightM: 16 }), null);
});

test('a cornice or mansard front whose rows overfill the wall: rows at the top pitch, the rest a plain band (168042, 168096)', () => {
  // 168042 (AH07 probe): 3 storeys read under a cornice, wall 14.17 m, no front eaves: 4.72 m rows, 4.31 m with a tall ground
  const plain = storeyPlan({ storeys: 3, wallM: 14.17, period: 'c19' })!;
  assert.equal(plain.ok, false, 'without the crown it stays a reject (a second read)');
  const cornice = storeyPlan({ storeys: 3, wallM: 14.17, period: 'c19', crown: 'cornice' })!;
  assert.ok(cornice.ok && cornice.capped);
  const draw = storeyDraw(cornice, 3, true, 14.17) as { storeys: number; groundM: number; bandM: number };
  assert.equal(draw.storeys, 3, 'three rows, none above the cornice');
  assert.ok(Math.abs(draw.groundM - TALL_GROUND_RATIO * STOREY_PITCH_RANGE.c19.max) < 0.01);
  assert.ok(Math.abs(draw.bandM - (14.17 - (2 + TALL_GROUND_RATIO) * 4.09)) < 0.01, `band ${draw.bandM}`);
  // 168096: wall 16.59 m; 3.13 m over the capped rows is within one c19 storey (3.41)
  assert.equal(storeyPlan({ storeys: 3, wallM: 16.59, period: 'c19', crown: 'cornice' })!.ok, true);
  // a mansard read does the same
  assert.equal(storeyPlan({ storeys: 3, wallM: 16.59, period: 'c19', roofStorey: 'mansard' })!.capped, true);
  // more than one storey of wall left over is a missed storey: still rejected
  assert.equal(storeyPlan({ storeys: 3, wallM: 17.5, period: 'c19', crown: 'cornice' })!.ok, false);
  // an attic front is not capped: its top row is wall
  assert.equal(storeyPlan({ storeys: 3, wallM: 16.59, period: 'c19', roofStorey: 'attic' })!.capped, undefined);
});
// Weteringschans 0363100012168043 (1870, c19), the reviewer's second pin (2026-11-13): a souterrain (cellar grilles at the
// pavement), three rows and a mansard dormer. bag-facts eaves 10.0 m is a flat rear roof (frontEavesM drops it), so the
// line is the mesher's 13.92 m wall: about 2.1 m + 3 x 3.7 m, the mansard roof, not a fourth wall row.
const W168043 = { storeys: 3, souterrain: true, roofStorey: 'mansard' as const, period: 'c19' };

test('168043: souterrain + 3 rows under a mansard fit about 2.1 m + 3 x 3.7 m; no fourth wall row', () => {
  assert.equal(frontEavesM({ eavesM: 10, ridgeM: null, heightM: 16.52 }), null, 'the 10 m rear roof is not the front eaves');
  for (const wallM of [13.9, 13.92]) {
    const plan = storeyPlan({ ...W168043, wallM })!;
    assert.ok(plan.ok); assert.equal(plan.roofRow, false, 'a mansard is roof');
    assert.ok(Math.abs(plan.pitchM / 3.7 - 1) <= 0.15, `row ${plan.pitchM.toFixed(2)} m within 15 % of 3.7`);
    assert.ok(Math.abs(plan.souterrainM - 2.1) <= 0.3, `souterrain ${plan.souterrainM.toFixed(2)} m about 2.1`);
    const draw = storeyDraw(plan, 3, true, wallM) as { storeys: number; groundM: number; souterrain?: true; bandM?: number };
    assert.deepEqual({ storeys: draw.storeys, souterrain: draw.souterrain, band: draw.bandM }, { storeys: 4, souterrain: true, band: undefined }, 'souterrain cell + 3 window rows');
    const fit = specStoreyFit('c19', wallM, draw.storeys, 1, { fit: 'nearest', groundM: draw.groundM, groundMin: SPEC_SOUTERRAIN_GROUND_MIN })!;
    const groundM = STYLE_DIMS.c19.ground * fit.ground, storeyM = STYLE_DIMS.c19.storey * fit.storey;
    assert.ok(Math.abs((wallM - groundM) / storeyM - 3) < 1e-6, 'layoutWall rounds to three upper rows');
  }
  // the same front with the souterrain dropped (the cut read before D1 29b2236b5) is A+fit's stretch: capped only under a crown
  assert.equal(storeyPlan({ storeys: 3, wallM: 13.92, period: 'c19' })!.ok, false);
});

// Step 1b: the guard may not veto a person's count. Reject, refit, eaves band, souterrain, tall ground and capping apply
// only to a describer (vision-judge) read; author, reviewed and street-level counts draw as stated and the plan is advisory.
test('only a describer read lets the storey plan change the draw', () => {
  assert.equal(storeyPlanDraws('vision-judge'), true);
  for (const src of ['author', 'reviewed', 'streetlevel-measured', 'monument-text', 'template:x', null, undefined]) assert.equal(storeyPlanDraws(src), false, String(src));
});

// Published pands (round 127), plan inputs as the mesher sees them (storey-guard probe, house-specs pub127).
const PUBLISHED_PINS = [
  { id: '0363100012182309', src: 'author', storeys: 3, eavesM: 7.4, wallM: 7.81, period: 'canal', ok: false },
  { id: '0363100012176346', src: 'reviewed', storeys: 3, eavesM: 15.5, wallM: 15.12, period: 'c19', ok: false },
  { id: '0363100012171023', src: 'author', storeys: 4, eavesM: 13, wallM: 13.88, period: 'canal', ok: true },
  { id: '0363100012180181', src: 'reviewed', storeys: 4, eavesM: 12.3, wallM: 14.2, period: 'canal', ok: true },
] as const;

test('published author/reviewed pins: the verdict is advisory and the draw equals guard-off', () => {
  for (const p of PUBLISHED_PINS) {
    const plan = storeyPlan({ storeys: p.storeys, eavesM: p.eavesM, wallM: p.wallM, period: p.period })!;
    assert.equal(plan.ok, p.ok, p.id);
    assert.equal(storeyPlanDraws(p.src), false, p.id);
    // The mesher calls storeyDraw only when storeyPlanDraws(src); an advisory plan leaves the stated count untouched.
    const drawn = storeyPlanDraws(p.src) ? storeyDraw(plan, p.storeys, true, p.wallM) : null;
    assert.equal(drawn, null, p.id);
    if (!p.ok) assert.equal(storeyDraw(plan, p.storeys, true, p.wallM), 'reject', `${p.id} would be rejected as a describer read`);
  }
});

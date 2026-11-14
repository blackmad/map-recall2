import assert from 'node:assert/strict';
import test from 'node:test';
import { alongMeasuredRidge, planBuildingRoof, roofPiecesForOutline, roofPlanForFeature, type Rect, type RoofPlan } from './roofMesh.ts';
import { axisGapDeg, ridgeAxisOf } from './roofs/ridgeAxis.ts';
import { applyRidgeAxes } from './roofs/ridgeFacts.ts';
import { turnRidgeToAxis } from './streetRidge.ts';

/** A CityJSON building with two roof planes falling to +y and -y (a ridge along x), at 45 degrees. */
const saddle = (rotDeg = 0) => {
  const c = Math.cos(rotDeg * Math.PI / 180), s = Math.sin(rotDeg * Math.PI / 180);
  const r = (x: number, y: number) => [x * c - y * s, x * s + y * c];
  const pts = [[0, -3, 0], [10, -3, 0], [10, 0, 3], [0, 0, 3], [0, 3, 0], [10, 3, 0]].map(([x, y, z]) => [...r(x, y), z]);
  return {
    transform: { scale: [1, 1, 1] as [number, number, number], translate: [0, 0, 0] as [number, number, number] }, vertices: pts,
    CityObjects: { B: { type: 'Building', children: ['B-1'] }, 'B-1': { type: 'BuildingPart', geometry: [{ type: 'Solid', lod: '2.2',
      boundaries: [[[[0, 1, 2, 3]], [[3, 2, 5, 4]]]], semantics: { surfaces: [{ type: 'RoofSurface' }], values: [[0, 0]] } }] } },
  };
};

test('ridgeAxisOf: a saddle falling across y has its ridge along x, in any rotation', () => {
  for (const rot of [0, 20, 90, 135]) {
    const r = ridgeAxisOf(saddle(rot) as any, 'B')!;
    assert.ok(axisGapDeg(r.angleDeg, rot) < 1, `rot ${rot}: ${r.angleDeg}`);
    assert.ok(r.coherence > 0.99 && r.slopeDeg > 40 && r.slopeDeg < 50);
  }
  const flat = saddle(); flat.vertices = flat.vertices.map(v => [v[0], v[1], 0]);
  assert.equal(ridgeAxisOf(flat as any, 'B'), null, 'a flat roof has no ridge');
});

test('axisGapDeg folds opposite directions together', () => {
  assert.equal(axisGapDeg(10, 190), 0);
  assert.equal(axisGapDeg(0, 90), 90);
  assert.equal(axisGapDeg(170, 10), 20);
});

// A 6.2 m wide, 11.1 m deep c19 house on a street running along x (Jan Hanzenstraat, 1913): the box's long axis runs
// across the street, 3DBAG measured the ridge along it.
const lng = 4.863, lat = 52.367, kx = 111_320 * Math.cos(lat * Math.PI / 180), KY = 110_540;
const outer = (w: number, d: number) => [[0, 0], [w, 0], [w, d], [0, d], [0, 0]].map(([x, y]) => [lng + x / kx, lat + y / KY]);
const local = (w: number, d: number): Array<[number, number]> => [[0, 0], [w, 0], [w, d], [0, d], [0, 0]];
const planFor = (ridgeDeg: number | null, w = 6.2, d = 11.1) => {
  for (let i = 0; i < 400; i++) {
    const guess = planBuildingRoof(`h${i}`, 'c19', 15, 0, local(w, d), undefined, 1913);
    if (guess?.kind !== 'pitched') continue;
    return { id: `h${i}`, guess, plan: planBuildingRoof(`h${i}`, 'c19', 15, 0, local(w, d), undefined, 1913, null, ridgeDeg)! };
  }
  throw new Error('no pitched plan');
};
const origin = { lng, lat };
const ridgeAlongX = (p: { rect: Rect }) => Math.abs(p.rect.ux) > 0.95;

test('no measurement, or one the box already agrees with: the same plan as before', () => {
  const { guess, plan } = planFor(null);
  assert.deepEqual(plan, guess);
  const agree = planFor(90); // the box runs its ridge along y (across the street): 3DBAG agrees
  assert.equal(agree.plan.riseM, agree.guess.riseM);
  assert.equal(agree.plan.ridgeDeg, 90);
});

test('a measured ridge along the street turns the box and sizes the rise to the new span', () => {
  const { plan, guess } = planFor(0);
  assert.equal(plan.ridgeDeg, 0);
  const pieces = roofPiecesForOutline(outer(6.2, 11.1), origin, plan, kx);
  assert.equal(pieces.length, 1);
  assert.ok(ridgeAlongX(pieces[0]), 'ridge along x');
  assert.ok(plan.riseM > guess.riseM, `span 11.1 m rises more than span 6.2 m (${plan.riseM} vs ${guess.riseM})`);
  assert.ok(15 - plan.riseM >= 4.5);
});

test('a measured ridge is not turned back by the street guess; a crown with no street end becomes a plain pitched roof', () => {
  const { plan } = planFor(0);
  // a street along the front (y = -8): the long sides see it, the ridge ends (x = 0, 6.2) do not.
  const facing = (w: { nx: number; ny: number }) => (w.ny < -0.9 ? 8 : Infinity);
  const pieces = roofPiecesForOutline(outer(6.2, 11.1), origin, plan, kx, facing);
  assert.ok(ridgeAlongX(pieces[0]));
  const crowned: RoofPlan = { ...plan, kind: 'gable', gable: 'step' };
  const alongStreet = roofPiecesForOutline(outer(6.2, 11.1), origin, crowned, kx, facing);
  assert.equal(alongStreet[0].plan.kind, 'pitched', 'a step gable over a ridge along the street has no street end');
});

test('a wide front measured across the street splits into bays, each along the measured axis', () => {
  const rect: Rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 20, wid: 8, coverage: 1, maxDev: 0 };
  const plan: RoofPlan = { kind: 'pitched', gable: 'step', riseM: 3, dormers: false, material: 'tile', tone: 0.5, seed: 'x' };
  assert.equal(turnRidgeToAxis(rect, plan, 0), null, 'already along');
  const bays = turnRidgeToAxis(rect, plan, 90)!;
  assert.equal(bays.length, 3);
  assert.ok(bays.every(b => Math.abs(b.rect.uy) > 0.99 && b.plan.kind === 'pitched' && b.plan.riseM === 3));
  assert.equal(alongMeasuredRidge(rect, { ...plan, kind: 'hipped' }, 15, 90), null, 'a hip has no single ridge');
  assert.equal(alongMeasuredRidge(rect, plan, 15, undefined), null);
});

test('the stamped property reaches the plan; a register gable keeps its own direction', () => {
  const feature = (extra: Record<string, unknown>) => ({ type: 'Feature' as const, properties: { id: 'NL.IMBAG.Pand.0363100012114483', height: 15, minHeight: 0, constructionYear: 1913, facadeStyle: 'c19', ...extra }, geometry: { type: 'Polygon', coordinates: [outer(6.2, 11.1)] } });
  const props = feature({}).properties as Record<string, unknown>;
  applyRidgeAxes([{ properties: props }], { '0363100012114483': 22 });
  assert.equal(props.roofRidgeDeg, 22);
  const plain = roofPlanForFeature(feature({}) as any), stamped = roofPlanForFeature(feature({ roofRidgeDeg: 22 }) as any);
  if (plain && stamped) assert.equal(stamped.ridgeDeg, 22);
  const register = roofPlanForFeature(feature({ roofRidgeDeg: 22, monumentGable: 'neck' }) as any);
  assert.equal(register?.ridgeDeg, undefined);
});

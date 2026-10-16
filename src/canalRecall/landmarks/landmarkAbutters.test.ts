import test from 'node:test';
import assert from 'node:assert/strict';
import {ringsFootprint, type LngLat, type Ring} from './osmUnderModels';
import {abutterGeometry, convexHull, footprintHull, gate, localFrame, MIN_SHARED_WALL_M, scoreAbutter, sharedWallM} from './landmarkAbutters';

const O: LngLat = [4.886, 52.3796];
const f = localFrame(O);
/** Axis-aligned rectangle in metres east/north of O. */
const rect = (x0: number, y0: number, x1: number, y1: number): Ring => [f.toLngLat(x0, y0), f.toLngLat(x1, y0), f.toLngLat(x1, y1), f.toLngLat(x0, y1)];
/** A Greek cross 30 x 30 m with 10 m arms: four square angles (10 x 10) at the corners. */
const cross: Ring = [[10, 0], [20, 0], [20, 10], [30, 10], [30, 20], [20, 20], [20, 30], [10, 30], [10, 20], [0, 20], [0, 10], [10, 10]].map(([x, y]) => f.toLngLat(x, y));
const model = ringsFootprint([cross]);
const hull = footprintHull(model);

test('convex hull of a square with an interior point drops the interior point', () => {
  const h = convexHull([[0, 0], [4, 0], [4, 4], [0, 4], [2, 2]]);
  assert.equal(h.length, 4);
});

test('the hull of a Greek cross covers its four angles', () => {
  const angle = rect(5, 5, 9.8, 9.8); // the inner half of an angle (the hull cuts each angle on its diagonal)
  const g = abutterGeometry([angle], model, hull);
  assert.ok(g.inHull > 0.6, `inHull ${g.inHull}`);
  assert.ok(g.categories.includes('notch'));
});

test('a corner house filling an angle shares two walls with the cross', () => {
  const house = rect(0, 0, 10, 10); // bottom-left angle, its north and east sides are the arms
  const wall = sharedWallM(house, model);
  assert.ok(wall > 17 && wall < 23, `wall ${wall}`);
  const g = abutterGeometry([house], model, hull);
  assert.deepEqual(g.categories.includes('wall'), true);
  assert.ok(g.sharedShare > 0.4, `share ${g.sharedShare}`);
  assert.equal(g.sides, 2);
});

test('a building touching only at a corner is not a wall', () => {
  const touching = rect(30, 20, 40, 30); // touches the east arm's NE corner only
  assert.ok(sharedWallM(touching, model) < MIN_SHARED_WALL_M);
  assert.equal(abutterGeometry([touching], model, hull).categories.includes('wall'), false);
});

test('a terraced neighbour along the street: one party wall, outside the hull', () => {
  const block = ringsFootprint([rect(0, 0, 10, 12)]);
  const neighbour = rect(10, 0, 18, 12);
  const g = abutterGeometry([neighbour], block, footprintHull(block));
  assert.ok(g.categories.includes('wall'));
  assert.equal(g.categories.includes('notch'), false);
  assert.equal(g.sides, 1);
  const s = scoreAbutter(g, {year: 1890, landmarkYear: 1650});
  const corner = abutterGeometry([rect(0, 0, 10, 10)], model, hull);
  const c = scoreAbutter(corner, {year: 1623, landmarkYear: 1622, sharedMonuments: ['gm:3923']});
  assert.ok(s.terms.some(t => t.signal === 'terrace'));
  assert.ok(c.score > s.score + 8, `${c.score} vs ${s.score}`);
});

test('partial overlap below 50% is "partial"; at or above it is left to osm-under-models', () => {
  const half = rect(15, -6, 25, 4); // 4 of 10 m inside the south arm (x 10..20 below y 10)
  const g = abutterGeometry([half], model, hull);
  assert.ok(g.categories.includes('partial'), JSON.stringify(g));
  const deep = rect(11, 1, 19, 9);
  assert.equal(abutterGeometry([deep], model, hull).categories.length, 0);
});

test('a slanted 3DBAG roof only counts against an OSM tile feature with no roof shape', () => {
  const g = abutterGeometry([rect(0, 0, 10, 10)], model, hull);
  assert.ok(scoreAbutter(g, {bagRoof: 'slanted', tileIsOsm: true}).terms.some(t => t.signal === 'roof'));
  assert.equal(scoreAbutter(g, {bagRoof: 'slanted', tileIsOsm: false}).terms.some(t => t.signal === 'roof'), false);
});

test('gate: unreviewed notch above threshold fails, reviewed fold-in is pending, fine passes, low scores and wall-only ignored', () => {
  const hits = [
    {model: 'k', id: 'a', score: 12, categories: ['wall', 'notch'] as const},
    {model: 'k', id: 'b', score: 12, categories: ['notch'] as const},
    {model: 'k', id: 'c', score: 12, categories: ['notch'] as const},
    {model: 'k', id: 'd', score: 3, categories: ['notch'] as const},
    {model: 'k', id: 'e', score: 15, categories: ['wall'] as const},
  ].map(h => ({...h, categories: [...h.categories]}));
  const {fail, pending} = gate(hits, {k: {b: {verdict: 'fold-in', reason: 'corner house'}, c: {verdict: 'fine', reason: 'neighbour'}}}, 8);
  assert.deepEqual(fail.map(h => h.id), ['a']);
  assert.deepEqual(pending.map(h => h.id), ['b']);
});

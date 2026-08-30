// The city overview's framing maths. A map whose projection is wrong is worse
// than no map — it teaches a shape that is not the city's.

import assert from 'node:assert/strict';

import {
  boundsOf,
  buildOverview,
  fitProjection,
  project,
  simplifyForScale,
  unionBounds,
  type Bounds,
  type Rect,
} from '../src/canalRecall/game/cityOverview';
import type { WorldPoint } from '../src/canalRecall/game/worldTypes';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

const RECT: Rect = { x: 15, y: 505, width: 260, height: 200 };

check('boundsOf ignores non-finite points and reports nothing for nothing', () => {
  assert.equal(boundsOf([]), null);
  assert.equal(boundsOf([[]]), null, 'empty groups are not a zero-size box');
  assert.deepEqual(boundsOf([[{ x: 1, y: 2 }, { x: 5, y: -3 }]]), { minX: 1, minY: -3, maxX: 5, maxY: 2 });
  assert.deepEqual(
    boundsOf([[{ x: 1, y: 2 }, { x: NaN, y: 0 }, { x: 5, y: -3 }]]),
    { minX: 1, minY: -3, maxX: 5, maxY: 2 },
    'one bad vertex must not swallow the whole framing');
  assert.equal(boundsOf([[{ x: NaN, y: NaN }]]), null);
});

check('unionBounds tolerates either side being absent', () => {
  const a: Bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  const b: Bounds = { minX: -5, minY: 4, maxX: 6, maxY: 20 };
  assert.deepEqual(unionBounds(a, null), a);
  assert.deepEqual(unionBounds(null, b), b);
  assert.equal(unionBounds(null, null), null);
  assert.deepEqual(unionBounds(a, b), { minX: -5, minY: 0, maxX: 10, maxY: 20 });
});

check('the city keeps its shape: one uniform scale, centred', () => {
  // A wide, short city in a taller box: height must not be stretched to fill.
  const bounds: Bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 250 };
  const projection = fitProjection(bounds, RECT, 6);
  const topLeft = project(projection, { x: 0, y: 0 });
  const bottomRight = project(projection, { x: 1000, y: 250 });

  const drawnWidth = bottomRight.x - topLeft.x;
  const drawnHeight = bottomRight.y - topLeft.y;
  assert.ok(Math.abs(drawnWidth / drawnHeight - 1000 / 250) < 1e-9,
    'aspect ratio is preserved; a stretched Amsterdam is not Amsterdam');
  assert.ok(drawnWidth <= RECT.width - 12 + 1e-9, 'fits the padded box horizontally');
  assert.ok(drawnHeight <= RECT.height - 12 + 1e-9, 'and vertically');

  const centre = project(projection, { x: 500, y: 125 });
  assert.ok(Math.abs(centre.x - (RECT.x + RECT.width / 2)) < 1e-9, 'centred horizontally');
  assert.ok(Math.abs(centre.y - (RECT.y + RECT.height / 2)) < 1e-9, 'and vertically');
});

check('every point of the city lands inside the box', () => {
  const bounds: Bounds = { minX: -4000, minY: -1200, maxX: 3000, maxY: 5000 };
  const projection = fitProjection(bounds, RECT, 6);
  for (const point of [
    { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }, { x: bounds.maxX, y: bounds.minY },
  ]) {
    const at = project(projection, point);
    assert.ok(at.x >= RECT.x && at.x <= RECT.x + RECT.width, `x escaped the box: ${at.x}`);
    assert.ok(at.y >= RECT.y && at.y <= RECT.y + RECT.height, `y escaped the box: ${at.y}`);
  }
});

check('a degenerate city does not project to NaN', () => {
  // One landmark, or a route that is a perfectly straight north-south line.
  const single = fitProjection({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, RECT);
  const at = project(single, { x: 5, y: 5 });
  assert.ok(Number.isFinite(at.x) && Number.isFinite(at.y), `projected to ${at.x},${at.y}`);
  assert.ok(Math.abs(at.x - (RECT.x + RECT.width / 2)) < 1e-9, 'a single point sits in the middle');

  const line = fitProjection({ minX: 5, minY: 0, maxX: 5, maxY: 100 }, RECT);
  const end = project(line, { x: 5, y: 100 });
  assert.ok(Number.isFinite(end.x) && Number.isFinite(end.y));
  assert.ok(end.y <= RECT.y + RECT.height, 'a zero-width city is scaled by its height alone');
});

check('simplifyForScale drops sub-pixel detail but keeps the ends', () => {
  const dense: WorldPoint[] = [];
  for (let i = 0; i <= 1000; i++) dense.push({ x: i, y: 0 });
  const thinned = simplifyForScale(dense, 0.02); // 1 px = 50 world units
  assert.ok(thinned.length < 30, `expected heavy thinning, kept ${thinned.length}`);
  assert.deepEqual(thinned[0], dense[0], 'the first vertex survives');
  assert.deepEqual(thinned[thinned.length - 1], dense[dense.length - 1], 'and the last');

  assert.deepEqual(simplifyForScale([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0.02),
    [{ x: 0, y: 0 }, { x: 1, y: 1 }], 'a two-point segment is left alone');
});

check('framing follows the city, so a place keeps its spot between routes', () => {
  const areaRings = [[
    { x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }, { x: 0, y: 0 },
  ]];
  const shortTrip = buildOverview({
    areaRings, networkSegments: [], route: [{ x: 900, y: 900 }, { x: 1100, y: 1100 }],
    start: { x: 900, y: 900 }, finish: { x: 1100, y: 1100 },
  }, RECT);
  const longTrip = buildOverview({
    areaRings, networkSegments: [], route: [{ x: 100, y: 100 }, { x: 1900, y: 1900 }],
    start: { x: 100, y: 100 }, finish: { x: 1900, y: 1900 },
  }, RECT);
  assert.ok(shortTrip && longTrip);
  assert.deepEqual(shortTrip.projection, longTrip.projection,
    'the same city frames identically whatever the trip, so the map becomes learnable');
});

check('a route running past the mapped areas is still framed', () => {
  const areaRings = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]];
  const built = buildOverview({
    areaRings, networkSegments: [], route: [{ x: 0, y: 0 }, { x: 5000, y: 5000 }],
    start: { x: 0, y: 0 }, finish: { x: 5000, y: 5000 },
  }, RECT);
  assert.ok(built);
  const finish = project(built.projection, { x: 5000, y: 5000 });
  assert.ok(finish.x <= RECT.x + RECT.width && finish.y <= RECT.y + RECT.height,
    'the destination cannot fall off the edge of its own map');
});

check('an empty world produces no overview rather than a broken one', () => {
  assert.equal(buildOverview({
    areaRings: [], networkSegments: [], route: [], start: null, finish: null,
  }, RECT), null);
});

check('degenerate network segments are dropped, not drawn', () => {
  const built = buildOverview({
    areaRings: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]],
    networkSegments: [[{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 50, y: 50 }]],
    route: [], start: null, finish: null,
  }, RECT);
  assert.ok(built);
  assert.equal(built.layers.network.length, 1, 'a one-vertex way is not a line');
});

console.log(`City overview OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);

import assert from 'node:assert/strict';
import {
  compileSilhouette,
  simplifyContour,
  type SourcePlane,
} from './silhouetteCompiler.ts';

type Point = [number, number];

let checks = 0;
const isClose = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

function assertVertices(actual: Point[], expected: Point[], label: string) {
  checks++;
  assert.equal(actual.length, expected.length, `${label}: expected ${expected.length} vertices, got ${actual.length}: ${JSON.stringify(actual)}`);
  expected.forEach((point, index) => {
    assert.ok(
      isClose(actual[index][0], point[0]) && isClose(actual[index][1], point[1]),
      `${label}: vertex ${index} expected [${point}], got [${actual[index]}]`,
    );
  });
}

// A symmetric trapgevel (Dutch stair-step gable) in wall metres, spanning
// 0..10 m of wall and 0..10 m of height. Pixel space is 100 x 50.
const PLANE: SourcePlane = { start: { x: 1000, y: 2000 }, end: { x: 1010, y: 2000 }, baseZ: 0, topZ: 10 };
const SOURCE = { width: 100, height: 50 };
const METRIC_CORNERS: Point[] = [
  [0, 0], [1, 0], [1, 2], [2, 2], [2, 4], [3, 4], [3, 6],
  [7, 6], [7, 4], [8, 4], [8, 2], [9, 2], [9, 0], [10, 0],
];
const metricToPixel = ([along, height]: Point): Point => [along * 10, (10 - height) * 5];
const densify = (points: Point[]): Point[] =>
  points.flatMap((point, index) =>
    index === 0 ? [point] : [[(points[index - 1][0] + point[0]) / 2, (points[index - 1][1] + point[1]) / 2], point],
  );
const STAIR_PIXELS = densify(METRIC_CORNERS.map(metricToPixel));
const STAIR_CONTOUR: Point[] = densify(METRIC_CORNERS).map(metricToPixel);

// 1. The densified stair-step trace simplifies back to exactly the corners.
{
  const compiled = compileSilhouette(STAIR_PIXELS, SOURCE, PLANE);
  assertVertices(compiled.vertices, METRIC_CORNERS, 'stair-step gable');
  checks++;
  assert.equal(compiled.vertexCount, METRIC_CORNERS.length, 'stair-step: vertexCount matches');
  assert.ok(isClose(compiled.wallWidthM, 10), 'stair-step: wall width');
  assert.ok(isClose(compiled.wallHeightM, 10), 'stair-step: wall height');
  assert.equal(compiled.sourceWidthPx, 100, 'stair-step: source width px');
  assert.equal(compiled.sourceHeightPx, 50, 'stair-step: source height px');
}

// 2. RDP collapses a straight line to its two endpoints.
{
  const straight = simplifyContour([[0, 0], [10, 10], [20, 20], [30, 30], [40, 40]], { toleranceM: 0.01 });
  assertVertices(straight, [[0, 0], [40, 40]], 'straight line');
}

// 2b. A collinear interior point is dropped; a real 1 m shoulder is kept.
{
  const shoulder = simplifyContour([[0, 0], [5, 0], [10, 0], [10, 1]], { toleranceM: 0.1 });
  assertVertices(shoulder, [[0, 0], [10, 0], [10, 1]], 'shoulder');
}

// 2c. Closed rings keep their shape and drop the duplicated closing vertex.
{
  // A 10 x 10 square in pixels with a redundant midpoint on every edge.
  const square: Point[] = [
    [0, 0], [5, 0], [10, 0], [15, 0], [20, 0],
    [20, 5], [20, 10], [15, 10], [10, 10], [5, 10], [0, 10],
    [0, 5],
  ];
  const ring = simplifyContour(square, { toleranceM: 0.5, closed: true });
  assertVertices(ring, [[0, 0], [20, 0], [20, 10], [0, 10]], 'closed square');
}

// 3. Pixel -> wall mapping matches the documented formula on hand-checked points.
{
  const plane: SourcePlane = { start: { x: 1000, y: 2000 }, end: { x: 1010, y: 2000 }, baseZ: 1, topZ: 11 };
  const compiled = compileSilhouette([[0, 50], [50, 0], [100, 50]], SOURCE, plane);
  // wallWidthM = 10, wallHeightM = 10; alongM = x/100*10, heightM = 11 - y/50*10.
  assertVertices(compiled.vertices, [[0, 1], [5, 11], [10, 1]], 'pixel->metre triangle');
}

// 4. maxVertices is respected by doubling the tolerance.
{
  const compiled = compileSilhouette(STAIR_CONTOUR, SOURCE, PLANE, { maxVertices: 4 });
  checks++;
  assert.ok(compiled.vertexCount <= 4, `maxVertices: expected <= 4, got ${compiled.vertexCount}`);
  assert.ok(compiled.vertexCount >= 2, 'maxVertices: endpoints preserved');
}

// 5. A contour that does not span the facade throws.
{
  assert.throws(
    () => compileSilhouette([[10, 10], [50, 0], [90, 10]], SOURCE, PLANE),
    /must span the facade/,
    'short contour should throw',
  );
  checks++;
  assert.throws(
    () => compileSilhouette([[5, 10], [50, 0], [100, 10]], SOURCE, PLANE),
    /must span the facade/,
    'left-gap contour should throw',
  );
  checks++;
}

// 6. Degenerate inputs throw clearly.
{
  assert.throws(() => compileSilhouette([[0, 0]], SOURCE, PLANE), /at least two points/, 'single point');
  checks++;
  assert.throws(
    () => compileSilhouette(STAIR_CONTOUR, SOURCE, { start: { x: 5, y: 5 }, end: { x: 5, y: 5 }, baseZ: 0, topZ: 10 }),
    /zero wall width/,
    'degenerate plane',
  );
  checks++;
  assert.throws(() => simplifyContour([[0, 0]]), /at least two points/, 'simplify too short');
  checks++;
}

console.log(`silhouette compiler: ${checks} assertions passed (stair-step reduction, RDP straight/shoulder/closed, pixel->metre mapping, maxVertices, span and degenerate guards).`);

import assert from 'node:assert/strict';
import {
  STREET_OVERLAY_LAYER_IDS, streetOverlayLayers, stitchOverlayPaths, collapseParallelFragments,
} from '../src/canalRecall/streetOverlayStyle';

const layers = streetOverlayLayers();
assert.deepEqual(layers.map(layer => layer.id), [...STREET_OVERLAY_LAYER_IDS]);
assert.equal(layers.filter(layer => layer.type === 'line').length, 1);
assert.equal(layers.some(layer => layer.type === 'symbol'), false,
  'Street names have one owner: the canvas renderer that can hide the active quiz and rider area.');

// Grimburgwal is one waterway stored as three OSM ways laid end to end. Before
// stitching, each was drawn as its own round-capped line, so the canal read as
// three segments with seams between them. Coordinates are the real ones from
// public/data/extracts/amsterdam/water.json, scaled to world units.
const grimburgwal = [
  [{ x: 0, y: 0 }, { x: 20, y: 4 }, { x: 60, y: 9 }, { x: 140, y: 14 }, { x: 200, y: 18 }, { x: 244, y: 22 }],
  [{ x: -25, y: -3 }, { x: 0, y: 0 }],
  [{ x: -51, y: -7 }, { x: -25, y: -3 }],
];
const stitched = stitchOverlayPaths(grimburgwal);
assert.equal(stitched.length, 1, 'three touching fragments of one canal are one polyline');
assert.equal(stitched[0].length, 8, 'the shared node at each join is not repeated');
assert.deepEqual(stitched[0][0], { x: -51, y: -7 }, 'the chain starts at the far end of the last fragment');
assert.deepEqual(stitched[0][stitched[0].length - 1], { x: 244, y: 22 });

// The rule this replaces existed for a reason: joining fragments that do not
// touch draws a chord straight across the map. They must stay separate.
const disjoint = stitchOverlayPaths([
  [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  [{ x: 900, y: 900 }, { x: 910, y: 900 }],
]);
assert.equal(disjoint.length, 2, 'fragments that do not meet are never chorded together');

// A fragment handed over mid-chain still has to come back whole, so the walk
// grows from both ends rather than only forwards.
const middleFirst = stitchOverlayPaths([
  [{ x: 10, y: 0 }, { x: 20, y: 0 }],
  [{ x: 20, y: 0 }, { x: 30, y: 0 }],
  [{ x: 0, y: 0 }, { x: 10, y: 0 }],
]);
assert.equal(middleFirst.length, 1);
assert.equal(middleFirst[0].length, 4);

// Ways are not stored nose-to-tail. A fragment digitised in the opposite
// direction joins by its tail and has to be reversed into the chain.
const reversed = stitchOverlayPaths([
  [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  [{ x: 30, y: 0 }, { x: 10, y: 0 }],
]);
assert.equal(reversed.length, 1);
assert.deepEqual(reversed[0], [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }]);

// A node that two ways round differently must still count as one node.
const slack = stitchOverlayPaths([
  [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  [{ x: 10.9, y: 0.4 }, { x: 20, y: 0 }],
]);
assert.equal(slack.length, 1, 'a metre of rounding slack still joins');

// The routing extract stores Singel pieces both on a grouped feature and as
// their original features. A duplicate must not consume the shared endpoint,
// make the chain double back, and strand the real continuation as a separate
// round-capped line. Reversed duplicates are the same geometry too.
const duplicatedExtractPaths = stitchOverlayPaths([
  [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  [{ x: 20, y: 0 }, { x: 10, y: 0 }],
  [{ x: 20, y: 0 }, { x: 30, y: 0 }],
  [{ x: 30, y: 0 }, { x: 20, y: 0 }],
]);
assert.equal(duplicatedExtractPaths.length, 1,
  'duplicate extract paths do not split one visible street into capped pieces');
assert.deepEqual(duplicatedExtractPaths[0], [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 },
]);

assert.deepEqual(stitchOverlayPaths([]), []);
assert.equal(stitchOverlayPaths([[{ x: 0, y: 0 }]]).length, 0, 'a single point is not a line');

{
  // "crazy multiple blue lines" on Prins Hendrikkade (user reports
  // 2026-09-28): two one-way carriageways and a named cycle track, all one
  // name, all highlighted. Only the ridden corridor is drawn.
  const line = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y1 }];
  const east = { points: line(0, 0, 300, 0), type: 'secondary' };
  const eastOn = { points: line(300, 0, 600, 0), type: 'secondary' };
  const west = { points: line(600, 45, 0, 45), type: 'secondary' }; // other carriageway, 15 m away
  const track = { points: line(0, -30, 600, -30), type: 'cycleway' };
  const branch = { points: line(300, 0, 300, -400), type: 'secondary' }; // a spur that turns off
  const quay = { points: line(0, 400, 600, 400), type: 'residential' }; // the far bank, 130 m away
  const kept = collapseParallelFragments([west, track, east, eastOn, branch, quay], east);
  const length = (paths: { x: number; y: number }[][]) => paths.reduce((sum, path) =>
    sum + path.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0), 0);
  const near = (y: number) => kept.filter(path => path.every(point => Math.abs(point.y - y) < 1 && point.x >= 0));
  assert.equal(length(near(0)), 600, 'the ridden carriageway and its straight continuation stay whole');
  assert.equal(near(45).length, 0, 'the other carriageway is not drawn');
  assert.equal(near(-30).length, 0, 'the cycle track beside it is not drawn');
  assert.ok(length(kept.filter(path => path.every(point => point.x === 300))) > 300, 'a branch turning off survives');
  assert.equal(length(near(400)), 600, 'a far-apart fragment of the name survives');
  // Seeded on the other carriageway, that one is the one drawn.
  const fromWest = collapseParallelFragments([west, east, eastOn], west);
  assert.equal(length(fromWest.filter(path => path.every(point => Math.abs(point.y - 45) < 1))), 600, 'the seed wins');
  assert.equal(fromWest.length, 1, 'and nothing runs beside it');
  // A 9 m link between two fragments used to be dropped as a sliver, which
  // stranded the walk; the other carriageway then won the rest of the road.
  const link = { points: line(300, 0, 327, 0), type: 'secondary' };
  const after = { points: line(327, 0, 700, 0), type: 'secondary' };
  const farSide = { points: line(700, 45, 0, 45), type: 'secondary' };
  const linked = collapseParallelFragments([farSide, east, link, after], east);
  assert.equal(length(linked.filter(path => path.every(point => Math.abs(point.y) < 1))), 700, 'the walk crosses a short link');
  assert.equal(linked.filter(path => path.every(point => Math.abs(point.y - 45) < 1)).length, 0, 'and the far carriageway stays hidden');
  // The two quays of a canal (Herengracht, about 40 m apart) are both the answer.
  const quays = collapseParallelFragments([east, { points: line(300, 120, 0, 120), type: 'residential' }], east);
  assert.equal(quays.length, 2, 'the opposite quay survives');
}

process.stdout.write('Canal Recall native street-overlay checks passed.\n');

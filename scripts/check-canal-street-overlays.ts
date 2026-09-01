import assert from 'node:assert/strict';
import {
  STREET_OVERLAY_LAYER_IDS, streetOverlayLayers, stitchOverlayPaths,
} from '../src/canalRecall/streetOverlayStyle';

const layers = streetOverlayLayers();
assert.deepEqual(layers.map(layer => layer.id), [...STREET_OVERLAY_LAYER_IDS]);
assert.equal(layers.filter(layer => layer.type === 'line').length, 3);
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

process.stdout.write('Canal Recall native street-overlay checks passed.\n');

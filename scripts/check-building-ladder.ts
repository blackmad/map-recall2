/**
 * Does the building ladder pick the right source, and only one of them?
 *
 * The merge in `build-lod1-city.ts` decides, for a few hundred thousand
 * buildings, which of two sources describes each one. Both failure directions
 * are invisible in aggregate counts and obvious on screen:
 *
 *   - letting a measured extrusion beat a hand-mapped composition turns the
 *     Waag's fourteen stepped parts into three flat boxes;
 *   - letting both through leaves two solids in the same place, which is the
 *     z-fighting the current three-layer stack exists to work around.
 *
 * These are synthetic footprints rather than real ones on purpose: this checks
 * the decision, and it has to run without the 300 MB CityJSON cache. The real
 * geometry is exercised by the build's own report.
 */

import assert from 'node:assert/strict';
import {
  bboxesOverlap, decideTier, FootprintGrid, pointInRing, ringBbox, ringCentroid,
  type OsmFootprint, type Ring
} from '../src/canalRecall/buildingLadder.js';

/** A square of `size` degrees with its lower-left corner at `x,y`. */
const square = (x: number, y: number, size: number): Ring =>
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];

const osm = (id: string, ring: Ring, minHeightM = 0, heightM = 12): OsmFootprint =>
  ({ osmId: id, rings: [ring], minHeightM, heightM });

// --- the primitives ----------------------------------------------------------
const unit = square(0, 0, 1);
const [centroidX, centroidY] = ringCentroid(unit);
assert.ok(Math.abs(centroidX - 0.5) < 1e-9 && Math.abs(centroidY - 0.5) < 1e-9, 'a unit square is centred on its middle');
assert.deepEqual(ringBbox(unit), [0, 0, 1, 1], 'ring bbox spans the ring');
assert.ok(pointInRing([0.5, 0.5], unit), 'the middle is inside');
assert.ok(!pointInRing([1.5, 0.5], unit), 'a point to the east is outside');
assert.ok(!pointInRing([0.5, 1.5], unit), 'a point to the north is outside');
assert.ok(bboxesOverlap([0, 0, 1, 1], [0.5, 0.5, 2, 2]), 'overlapping boxes overlap');
assert.ok(!bboxesOverlap([0, 0, 1, 1], [2, 2, 3, 3]), 'disjoint boxes do not');

// A ring wound the other way must still yield the same centroid: BAG and OSM do
// not agree on winding, and a sign error here would push every centroid of one
// source outside its own footprint.
const reversed = [...unit].reverse() as Ring;
const [reversedX, reversedY] = ringCentroid(reversed);
assert.ok(Math.abs(reversedX - 0.5) < 1e-9 && Math.abs(reversedY - 0.5) < 1e-9, 'winding does not move a centroid');

// --- the grid ----------------------------------------------------------------
const grid = new FootprintGrid<OsmFootprint>(0.0015);
const here = osm('w1', square(4.9, 52.37, 0.0004));
const alsoHere = osm('w2', square(4.90005, 52.37005, 0.0002), 6);
const farAway = osm('w3', square(4.95, 52.40, 0.0004));
for (const item of [here, alsoHere, farAway]) grid.add(item);

const pandRing = square(4.9, 52.37, 0.0004);
const candidates = grid.near([pandRing]);
assert.ok(candidates.includes(here) && candidates.includes(alsoHere), 'the grid returns footprints in the same cell');
assert.ok(!candidates.includes(farAway), 'the grid does not return a footprint a kilometre away');

// A footprint larger than one cell must be found from every cell it touches —
// a big landmark indexed only by its centroid cell would be missed by most of
// the panden under it.
const wide = new FootprintGrid<OsmFootprint>(0.0015);
const sprawling = osm('w-big', square(4.9, 52.37, 0.006));
wide.add(sprawling);
assert.ok(wide.near([square(4.9055, 52.3755, 0.0002)]).includes(sprawling), 'a footprint spanning cells is found from any of them');

// --- the decision ------------------------------------------------------------
const pand = { bagId: 'NL.IMBAG.Pand.1', rings: [pandRing] };

const modelled = decideTier(pand, [here, alsoHere]);
assert.equal(modelled.tier, 2, 'a stacked part wins over a measured extrusion');
assert.deepEqual(modelled.osmIds.sort(), ['w1', 'w2'], 'the whole composition stands in, not only the raised part');

const flatOnly = decideTier(pand, [here]);
assert.equal(flatOnly.tier, 3, 'an OSM outline with one guessed height does not beat a measured extrusion');
assert.deepEqual(flatOnly.osmIds, [], 'tier 3 emits the pand, so nothing stands in for it');
assert.deepEqual(flatOnly.matchedOsmIds, ['w1'], 'the overlapping outline is still reported, so its colour can be carried');

const unmatched = decideTier(pand, [farAway]);
assert.equal(unmatched.tier, 3, 'a pand with no OSM nearby is a measured extrusion');
assert.deepEqual(unmatched.matchedOsmIds, [], 'nothing far away is reported as a match');

// One OSM outline covering several panden: each pand must see it, or the
// building would be emitted once and the rest of the block left empty.
const bigOutline = osm('w-block', square(4.9, 52.37, 0.001), 4);
for (const offset of [0, 0.0003, 0.0006]) {
  const neighbour = { bagId: `NL.IMBAG.Pand.${offset}`, rings: [square(4.9 + offset, 52.37, 0.0002)] };
  assert.equal(decideTier(neighbour, [bigOutline]).tier, 2, 'every pand under one modelled outline is claimed by it');
}

// One pand under several modelled parts, none of whose centroids land inside
// the pand — containment has to work in the other direction too.
const tallPand = { bagId: 'NL.IMBAG.Pand.tall', rings: [square(4.91, 52.38, 0.0002)] };
const enclosing = osm('w-enclosing', square(4.9095, 52.3795, 0.0012), 9);
assert.equal(decideTier(tallPand, [enclosing]).tier, 2, 'a pand inside a modelled outline is claimed by it');

process.stdout.write('Building ladder checks passed (tier 2 beats a measured extrusion only when a part is stacked, and ownership never overlaps)\n');

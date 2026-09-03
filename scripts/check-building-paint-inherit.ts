/**
 * Paint inheritance when colour tags live on a different osmId, and the
 * Droogbak courtyard-hole regression (holes must not become extra outers).
 */

import assert from 'node:assert/strict';
import {
  footprintsShareOwnership,
  footprintsWithinMetres,
  hasPaintColour,
  resolvePaintProps,
  type PaintDonor,
} from '../src/canalRecall/buildingPaintInherit.js';
import { FootprintGrid } from '../src/canalRecall/buildingLadder.js';
import {
  asGeometry,
  geometryHasHoles,
  outerRingsOf,
  polygonsOf,
  type Ring,
} from '../src/canalRecall/buildingGeometry.js';

const square = (x: number, y: number, size: number): Ring =>
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];

assert.equal(hasPaintColour({ colour: '#5a81a0' }), true);
assert.equal(hasPaintColour({ height: 12 }), false);

const donors = new FootprintGrid<PaintDonor>(0.01);
donors.add({
  rings: [square(0, 0, 1)],
  properties: { colour: '#888888', osmId: 'w-big' },
});
donors.add({
  rings: [square(0.2, 0.2, 0.3)],
  properties: { colour: '#30475f', osmId: 'w-office' },
});

const partRing = [square(0.25, 0.25, 0.1)];
assert.equal(resolvePaintProps(undefined, partRing, donors).colour, '#30475f',
  'smallest containing donor wins over a grey shell');
assert.equal(resolvePaintProps({ colour: '#bd8161' }, partRing, donors).colour, '#bd8161',
  'direct paint is not overwritten');

const left = { rings: [square(4.9, 52.37, 0.0002)] };
const nested = { rings: [square(4.90005, 52.37005, 0.00005)] };
assert.equal(footprintsShareOwnership(left, nested), true);

const adjacent = { rings: [square(4.90025, 52.37, 0.0002)] };
assert.equal(footprintsShareOwnership(left, adjacent), false);
assert.equal(footprintsWithinMetres(left, adjacent, 10), true,
  'adjacent Centraal-style parts are within metres even when not nested');
assert.equal(footprintsWithinMetres(left, { rings: [square(4.91, 52.38, 0.0002)] }, 10), false);

process.stdout.write('Building paint-inherit checks passed\n');

// Droogbak regression: Polygon holes must not become extra outer rings.
const droogbak = {
  type: 'Polygon' as const,
  coordinates: [
    [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
    [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]],
  ],
};
const polys = polygonsOf(droogbak);
assert.equal(polys.length, 1);
assert.equal(polys[0].length, 2, 'outer + one hole');
assert.equal(outerRingsOf(polys).length, 1, 'ladder only sees the outer');
assert.equal(geometryHasHoles(polys), true);
assert.equal(asGeometry(polys).type, 'Polygon');
assert.equal((asGeometry(polys) as { coordinates: unknown[] }).coordinates.length, 2);

process.stdout.write('Building footprint-hole checks passed\n');

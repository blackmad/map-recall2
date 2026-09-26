import assert from 'node:assert/strict';
import { buildElevations, type Elevation } from './elevations.ts';
import type { ProjectedPoint } from './sources.ts';
import type { RoadSegment } from '../osm/roadProjection.ts';
import {
  assignWallToStreetSide,
  blockFaceId,
  chainBlockFaces,
  frontageWall,
  splitBlockFaceAtIntersections,
  type FrontageWall,
} from './blockFaces.ts';

const PPM = 3;
const close = (actual: number, expected: number, label: string, tolerance = 1e-6) =>
  assert.equal(Math.abs(actual - expected) <= tolerance, true, `${label}: ${actual} ≠ ${expected}`);

/** A straight street running due east along y=0, from x=0 to x=`lengthM` metres. */
const straightStreet = (name: string, lengthM = 40): RoadSegment => ({
  points: [{ x: 0, y: 0 }, { x: lengthM * PPM, y: 0 }],
  width: 5,
  type: 'residential',
  oneway: false,
  name,
});

/**
 * A rectangular plot north of the y=0 street, its south face on y = `frontSetbackPPM`.
 * Ring is given CCW so the south face's outward normal points south, at the street.
 */
const plotNorthOfStreet = (
  pandId: string,
  xMinM: number,
  xMaxM: number,
  depthM: number,
  frontSetbackPPM = 6,
): Elevation[] =>
  buildElevations(
    [
      { x: xMinM * PPM, y: frontSetbackPPM },
      { x: xMaxM * PPM, y: frontSetbackPPM },
      { x: xMaxM * PPM, y: frontSetbackPPM + depthM * PPM },
      { x: xMinM * PPM, y: frontSetbackPPM + depthM * PPM },
      { x: xMinM * PPM, y: frontSetbackPPM },
    ],
    { pandId },
  );

const southWallOf = (elevations: Elevation[]): Elevation =>
  elevations.find(elevation => elevation.normal.y < -0.5)!;

// --- 1. Three touching, collinear footprints → exactly one BlockFace ---------

const street = straightStreet('Kerkstraat');
const rows = [
  southWallOf(plotNorthOfStreet('pand-1', 0, 10, 8)),
  southWallOf(plotNorthOfStreet('pand-2', 10, 20, 8)),
  southWallOf(plotNorthOfStreet('pand-3', 20, 30, 8)),
];
const rowWalls = rows.map(elevation => frontageWall(elevation, [street]));
assert.equal(rowWalls.every(wall => wall !== null), true, 'street-facing south walls all tie to the street');
const rowFaces = chainBlockFaces(rowWalls as FrontageWall[]);
assert.equal(rowFaces.length, 1, 'three touching collinear footprints make one blockface');
assert.equal(rowFaces[0].walls.length, 3, 'the blockface carries all three frontage walls');
assert.equal(rowFaces[0].side, 'right', 'north-side walls are on the right of an eastward street');
assert.equal(rowFaces[0].streetName, 'Kerkstraat');
close(rowFaces[0].lengthM, 30, 'blockface length sums its walls');
assert.deepEqual(rowFaces[0].partyWallBreaksM.length, 2, 'two party joins in a three-wall chain');

// --- 2. A courtyard/rear wall normal points away from the street → null ------

const plot = plotNorthOfStreet('pand-court', 0, 20, 12);
const courtyardWall = plot.find(elevation => elevation.normal.y > 0.5)!;
assert.equal(assignWallToStreetSide(courtyardWall, [street]), null, 'a rear wall facing away from the street is not a frontage');
assert.equal(frontageWall(courtyardWall, [street]), null, 'frontageWall agrees the rear wall has no street side');

// --- 3. A corner building has two public walls in two BlockFaces -------------

const cornerStreet = straightStreet('Kerkstraat', 40);
const crossStreet: RoadSegment = {
  points: [{ x: 24 * PPM, y: -15 * PPM }, { x: 24 * PPM, y: 15 * PPM }],
  width: 5,
  type: 'residential',
  oneway: false,
  name: 'Prinsengracht',
};
const corner = buildElevations(
  [
    { x: 25 * PPM, y: 6 },
    { x: 35 * PPM, y: 6 },
    { x: 35 * PPM, y: 20 * PPM },
    { x: 25 * PPM, y: 20 * PPM },
    { x: 25 * PPM, y: 6 },
  ],
  { pandId: 'pand-corner' },
);
const cornerWestWall = corner.find(elevation => elevation.normal.x < -0.5)!;
const cornerSouthWall = corner.find(elevation => elevation.normal.y < -0.5)!;
const westWall = frontageWall(cornerWestWall, [cornerStreet, crossStreet]);
const southWall = frontageWall(cornerSouthWall, [cornerStreet, crossStreet]);
assert.equal(westWall !== null && southWall !== null, true, 'a corner building exposes two public walls');
assert.equal(westWall!.street!.segmentIndex, 1, 'the west face ties to the crossing street');
assert.equal(southWall!.street!.segmentIndex, 0, 'the south face ties to the main street');

const westNeighbour = frontageWall(southWallOf(plotNorthOfStreet('pand-west', 15, 25, 8)), [cornerStreet, crossStreet]);
const eastNeighbour = frontageWall(southWallOf(plotNorthOfStreet('pand-east', 35, 45, 8)), [cornerStreet, crossStreet]);
const cornerFaces = chainBlockFaces([westNeighbour, southWall, eastNeighbour, westWall].filter((wall): wall is FrontageWall => wall !== null));
const facesWithCorner = cornerFaces.filter(face => face.cornerBuildingIds.includes('pand-corner'));
assert.equal(facesWithCorner.length, 2, 'the corner building reaches two blockfaces');
assert.equal(cornerFaces.find(face => face.streetName === 'Prinsengracht')!.side, 'left');
assert.equal(cornerFaces.find(face => face.streetName === 'Kerkstraat')!.side, 'right');

// --- 4. Deterministic id: rebuilding yields the same BlockFace.id -------------

const rebuilt = chainBlockFaces((rowWalls as FrontageWall[]).map(wall => ({ ...wall })));
assert.equal(rebuilt[0].id, rowFaces[0].id, 'a rebuild reproduces the same blockface id');
assert.equal(blockFaceId(rows.map(elevation => elevation.elevationId)), rowFaces[0].id, 'the id hashes the ordered elevation ids');
assert.notEqual(blockFaceId([...rows].reverse().map(elevation => elevation.elevationId)), rowFaces[0].id, 'order is part of the identity');

// --- 5. A gap larger than gapToleranceM splits into two faces -----------------

const gapped = chainBlockFaces([
  frontageWall(southWallOf(plotNorthOfStreet('pand-g1', 0, 10, 8)), [street])!,
  frontageWall(southWallOf(plotNorthOfStreet('pand-g2', 14, 24, 8)), [street])!,
]);
assert.equal(gapped.length, 2, 'a 4 m gap splits the frontage into two blockfaces');
assert.equal(gapped[0].walls.length, 1);

const touching = chainBlockFaces([
  frontageWall(southWallOf(plotNorthOfStreet('pand-t1', 0, 10, 8)), [street])!,
  frontageWall(southWallOf(plotNorthOfStreet('pand-t2', 10.4, 20.4, 8)), [street])!,
]);
assert.equal(touching.length, 1, 'a 0.4 m gap is still one blockface');

// --- 6. Split at a crossing street -------------------------------------------

const crossing: RoadSegment = {
  points: [{ x: 10 * PPM, y: -10 * PPM }, { x: 10 * PPM, y: 10 * PPM }],
  width: 5,
  type: 'residential',
  oneway: false,
  name: 'Zijstraat',
};
const splitFaces = splitBlockFaceAtIntersections(rowFaces[0], [street, crossing], { crossingToleranceM: 4 });
assert.equal(splitFaces.length, 2, 'a named crossing splits the chain into two blockfaces');
assert.equal(splitFaces[0].walls.length, 2, 'the corner wall stays with the left part');
assert.equal(splitFaces[1].walls.length, 1, 'the far wall starts the new face');
assert.notEqual(splitFaces[0].id, rowFaces[0].id, 'the split face is re-identified');
assert.equal(splitBlockFaceAtIntersections(rowFaces[0], [street], {}).length, 1, 'a street that crosses nothing leaves the face whole');

console.log('Facade blockfaces: street-side assignment, chaining, corner ids, stable ids and crossing splits passed.');

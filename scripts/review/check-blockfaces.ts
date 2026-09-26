import assert from 'node:assert/strict';
import { buildElevations, type Elevation } from '../../src/canalRecall/facade/elevations.ts';
import type { RoadSegment } from '../../src/canalRecall/osm/roadProjection.ts';
import {
  assignWallToStreetSide,
  chainBlockFaces,
  frontageWall,
  splitBlockFaceAtIntersections,
  type FrontageWall,
} from '../../src/canalRecall/facade/blockFaces.ts';

const PPM = 3;
const street: RoadSegment = {
  points: [{ x: 0, y: 0 }, { x: 40 * PPM, y: 0 }],
  width: 5, type: 'residential', oneway: false, name: 'Kerkstraat',
};
const plot = (pandId: string, xMinM: number, xMaxM: number): Elevation[] => buildElevations([
  { x: xMinM * PPM, y: 6 }, { x: xMaxM * PPM, y: 6 },
  { x: xMaxM * PPM, y: 30 }, { x: xMinM * PPM, y: 30 }, { x: xMinM * PPM, y: 6 },
], { pandId });
const south = (elevations: Elevation[]) => elevations.find(elevation => elevation.normal.y < -0.5)!;
const asFrontage = (elevation: Elevation) => frontageWall(elevation, [street])!;

assert.equal(assignWallToStreetSide(south(plot('pand-rear', 0, 10)), [street]) !== null, true, 'a street-facing wall ties to the street');
assert.equal(assignWallToStreetSide(plot('pand-rear', 0, 10).find(elevation => elevation.normal.y > 0.5)!, [street]), null, 'a courtyard/rear wall ties to no street');

const one = chainBlockFaces([asFrontage(south(plot('pand-a', 0, 10))), asFrontage(south(plot('pand-b', 10, 20))), asFrontage(south(plot('pand-c', 20, 30)))]);
assert.equal(one.length, 1, 'three touching collinear footprints make one blockface');
assert.equal(one[0].walls.length, 3);
assert.equal(chainBlockFaces([asFrontage(south(plot('pand-a', 0, 10))), asFrontage(south(plot('pand-b', 15, 25)))]).length, 2, 'a real gap splits the blockface');

const crossing: RoadSegment = {
  points: [{ x: 10 * PPM, y: -10 * PPM }, { x: 10 * PPM, y: 10 * PPM }],
  width: 5, type: 'residential', oneway: false, name: 'Zijstraat',
};
const split = splitBlockFaceAtIntersections(one[0], [street, crossing], { crossingToleranceM: 4 });
assert.equal(split.length, 2, 'a named crossing splits the blockface');

console.log(`Facade blockfaces check passed: ${one[0].walls.length} walls chained, ${split.length} faces after crossing split.`);

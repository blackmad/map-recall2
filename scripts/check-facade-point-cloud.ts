import assert from 'node:assert/strict';
import { extractFacadeWallPlanes, extractRoofPlanes, measureFacadeColour, measureSurfaceColour, type FacadeWallPlane, type RgbPoint } from '../src/canalRecall/building/facadePointCloud.ts';

const response = {
  metadata: { transform: { scale: [0.1, 0.1, 0.1], translate: [100, 200, 0] } },
  feature: {
    id: 'NL.IMBAG.Pand.1234', vertices: [[0, 0, 0], [0, 100, 0], [0, 100, 80], [0, 0, 80]],
    CityObjects: { part: { type: 'BuildingPart', geometry: [{ lod: '2.2', boundaries: [[[[0, 1, 2, 3]]]], semantics: { surfaces: [{ type: 'WallSurface', on_footprint_edge: true }], values: [[0]] } }] } },
  },
};
const walls = extractFacadeWallPlanes(response);
assert.equal(walls.length, 1);
assert.equal(walls[0].buildingId, 'bag:1234');
assert.equal(Math.round(walls[0].areaSquareMetres), 80);
assert.deepEqual(walls[0].vertices[2], [100, 210, 8]);
const roofResponse = structuredClone(response);
roofResponse.feature.CityObjects.part.geometry[0].semantics.surfaces[0] = { type: 'RoofSurface', b3_hellingshoek: 35, b3_azimut: 180 } as never;
const roofs = extractRoofPlanes(roofResponse);
assert.equal(roofs.length, 1);
assert.equal(roofs[0].slopeDegrees, 35);
assert.equal(roofs[0].azimuthDegrees, 180);

const wall: FacadeWallPlane = { ...walls[0], vertices: [[0, 0, 0], [0, 10, 0], [0, 10, 8], [0, 0, 8]], normal: [1, 0, 0] };
const points: RgbPoint[] = [];
for (let y = 0.1; y < 9.9; y += 0.3) for (let z = 0.1; z < 7.9; z += 0.3) points.push({ x: (y % 0.06) - 0.03, y, z, red: 154 * 257, green: 82 * 257, blue: 55 * 257 });
const result = measureFacadeColour(wall, points);
assert.equal(result.status, 'accepted');
assert.equal(result.hex, '#9a5237');
assert.ok(result.coverage > 0.5);
assert.equal(measureFacadeColour(wall, points.slice(0, 20)).reason, 'too-few-points');
const shadow = points.map((point) => ({ ...point, red: 12, green: 12, blue: 12 }));
assert.equal(measureFacadeColour(wall, shadow).reason, 'shadowed');
const mixed = points.map((point, index) => ({ ...point, red: index % 2 ? 230 : 20, green: 25, blue: index % 2 ? 20 : 230 }));
assert.equal(measureFacadeColour(wall, mixed).reason, 'mixed-colours');
const verticallyOffset = points.map((point) => ({ ...point, x: point.x + 0.43 }));
const offsetResult = measureSurfaceColour(wall, verticallyOffset, { maximumPlaneDistance: 0.12, maximumOffsetSearch: 0.8 });
assert.equal(offsetResult.status, 'accepted');
assert.ok(Math.abs((offsetResult.planeOffsetMetres || 0) - 0.45) < 0.01);
process.stdout.write('Façade point-cloud geometry and colour checks passed.\n');

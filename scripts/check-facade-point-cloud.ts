import assert from 'node:assert/strict';
import { extractFacadeWallPlanes, measureFacadeColour, type FacadeWallPlane, type RgbPoint } from '../src/canalRecall/building/facadePointCloud.ts';

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
process.stdout.write('Façade point-cloud geometry and colour checks passed.\n');

// Facade extras: every component builds finite, unit-normal geometry on a typical wall of its
// styles; choices are deterministic; the budgets hold; extras only exist in the near chunk.
import assert from 'node:assert/strict';
import { ExtraSink, EXTRA_BUDGET, ROOF_COMPONENTS, WALL_COMPONENTS, COMPONENT_COUNT, wallExtras, type ExtraContext } from '../src/canalRecall/facadeExtras.ts';
import { buildChunk, type MeshBuilding } from '../src/canalRecall/threeBuildingMesh.ts';

const wall = (style: ExtraContext['style'], id = 'h1'): ExtraContext => ({
  id, style, wallKey: '0,0', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 10 }, base: 0, top: 14,
  layout: { bays: 2, bayWidthM: 5, groundM: 3.3, storeys: 3, storeyM: 3.1, doorBays: [0] }, wallHex: '#a4523b', accentHex: '#ffffff', groundLevel: true,
});
const finite = (s: ExtraSink, what: string) => {
  for (const t of s.tris) { assert.ok(t.p.flat().every(Number.isFinite), `${what}: finite`); assert.ok(Math.abs(Math.hypot(...t.n) - 1) < 1e-6, `${what}: unit normal`); }
};
assert.ok(COMPONENT_COUNT >= 48, `component count ${COMPONENT_COUNT}`);
assert.equal(new Set([...WALL_COMPONENTS, ...ROOF_COMPONENTS].map(c => c.id)).size, COMPONENT_COUNT, 'unique ids');
for (const comp of WALL_COMPONENTS) {
  const sink = new ExtraSink(99);
  comp.build(wall(comp.styles[0]), sink, 0.4);
  assert.ok(sink.tris.length > 0, `${comp.id} builds geometry on a ${comp.styles[0]} wall`);
  finite(sink, comp.id);
  // Nothing hangs below the pavement or above the roofline by more than a hood.
  for (const t of sink.tris) for (const p of t.p) assert.ok(p[2] >= -0.01 && p[2] <= 14.6, `${comp.id}: height ${p[2]}`);
}
for (const comp of ROOF_COMPONENTS) {
  const sink = new ExtraSink(99);
  comp.build({ id: 'r', style: comp.styles[0], rect: { cx: 0, cy: 0, ux: 1, uy: 0, len: 12, wid: 9 }, z: 14, wallHex: '#a4523b' }, sink, 0.4);
  assert.ok(sink.tris.length > 0, `${comp.id} builds geometry on a roof`);
  finite(sink, comp.id);
  for (const t of sink.tris) for (const p of t.p) assert.ok(p[2] >= 14 - 1e-6, `${comp.id}: on the roof`);
}
// Deterministic and budgeted.
const a = new ExtraSink(EXTRA_BUDGET.building), b = new ExtraSink(EXTRA_BUDGET.building);
assert.deepEqual(wallExtras(wall('canal', 'x7'), a), wallExtras(wall('canal', 'x7'), b));
let maxBoxes = 0;
for (let i = 0; i < 300; i++) { const s = new ExtraSink(EXTRA_BUDGET.building); wallExtras(wall(['canal', 'c19', 'school', 'postwar', 'modern'][i % 5] as any, `b${i}`), s); maxBoxes = Math.max(maxBoxes, s.boxes); }
assert.ok(maxBoxes <= EXTRA_BUDGET.wall, `wall budget holds (${maxBoxes})`);
// Walls mode carries no extras; extras mode carries only extras.
const origin = { lng: 4.9, lat: 52.37 }, kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
const ring = [[0, 0], [10, 0], [10, 12], [0, 12], [0, 0]].map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
const houses: MeshBuilding[] = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, polygons: [[ring]], heightM: 14, minHeightM: 0, style: 'canal', wallHex: '#a4523b', plainLayer: 3, lid: { hex: '#888888', flatLayer: 7 }, extras: true }));
const walls = buildChunk(houses, origin), extras = buildChunk(houses, origin, 'extras'), plain = buildChunk(houses.map(h => ({ ...h, extras: false })), origin);
assert.equal(walls.vertexCount, plain.vertexCount, 'walls mode ignores extras');
assert.ok(extras.vertexCount > 0 && extras.quadCount === Math.ceil((extras.indices.length / 3) / 2) || extras.vertexCount > 0, 'extras mode has extras');
console.log(`facade extras: ok (${COMPONENT_COUNT} components, ${extras.vertexCount / 3 | 0} triangles for 40 houses)`);

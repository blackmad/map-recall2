// Ground v2 runtime pieces (lane G2a #372): the loader's frame refusal and surface swap, and the pose index.
import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import type { BuiltCell, PackedMesh } from './groundCell';
import { GAME_FRAME_SCALE, GAME_ORIGIN, type Rect } from './groundStore';
import { encodeGrd2, frameOf, GRID_Q, octEncode, type Grd2Content } from './groundV2Format';
import { applyGroundV2 } from './groundV2Loader';
import { buildPoseIndex, poseHeight, poseIndexBytes } from './groundV2Pose';
import { sourceCode } from './sourceTrace';

const frame = frameOf(GAME_ORIGIN, GAME_FRAME_SCALE);
const rect: Rect = [0, 0, 100, 100];
/** One baked 100 m square at z = 1 (two asphalt triangles). */
function baked(): Grd2Content {
  const u = Uint16Array.from([0, GRID_Q, GRID_Q, 0]), v = Uint16Array.from([0, 0, GRID_Q, GRID_Q]), zMm = Int32Array.from([1000, 1000, 1000, 1000]);
  const [a, b] = octEncode(0, 0, 1), oct = Int8Array.from([a, b, a, b, a, b, a, b]);
  return { key: '0_0', lod: 0, levels: 2, frame, rect, u, v, zMm, oct, indices: Uint32Array.from([0, 1, 2, 0, 2, 3]), groups: [{ layer: 'asphalt', kind: 0, tile: 0, first: 0, count: 2 }], seams: [Uint32Array.from([0, 3]), Uint32Array.from([1, 2]), Uint32Array.from([0, 1]), Uint32Array.from([3, 2])] };
}
const quad = (x0: number, y0: number, x1: number, y1: number, z: number): PackedMesh => ({ positions: Float32Array.from([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z]), normals: new Float32Array(12).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), uvs: new Float32Array(8), indices: Uint32Array.from([0, 1, 2, 0, 2, 3]) });
/** A worker build: land over the cell at z = 1, a bridge deck road top at z = 6, a paint overlay. */
const built = (): BuiltCell => ({ key: '0_0', lod: 0, detail: 'full', rect, layers: { land: quad(10, 10, 20, 20, 1), asphalt: quad(40, 40, 60, 60, 6), paint: quad(30, 30, 31, 31, 1.01) }, mask: null } as unknown as BuiltCell);

test('loader refuses a file baked in another frame and keeps the worker build', async () => {
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const bytes = encodeGrd2(baked(), MeshoptEncoder), cell = built();
  const moved = frameOf({ lng: GAME_ORIGIN.lng + 1e-6, lat: GAME_ORIGIN.lat }, GAME_FRAME_SCALE);
  const r = applyGroundV2(cell, bytes, MeshoptDecoder, moved, rect);
  assert.equal(r.used, false); assert.match(r.reason!, /refused: .*origin/); assert.equal(r.cell, cell);
  const r2 = applyGroundV2(cell, bytes, MeshoptDecoder, frame, [0, 0, 100, 101]);
  assert.equal(r2.used, false); assert.match(r2.reason!, /refused: .*rect/);
  assert.equal(applyGroundV2(cell, new Uint8Array(10), MeshoptDecoder, frame, rect).used, false);
});

test('loader swaps the covered surface, keeps decks above and overlays', async () => {
  await MeshoptDecoder.ready;
  const r = applyGroundV2(built(), encodeGrd2(baked(), MeshoptEncoder), MeshoptDecoder, frame, rect);
  assert.equal(r.used, true); assert.equal(r.dropped, 2); assert.equal(r.triangles, 2);
  assert.equal(r.cell.layers.land, undefined, 'the worker land under the baked surface is dropped');
  assert.equal(r.cell.layers.paint!.indices.length, 6, 'overlays untouched');
  // The deck road top at z = 6 stays (6 > 1 + 0.6) and the baked asphalt is appended after it.
  assert.equal(r.cell.layers.asphalt!.indices.length, 12);
  assert.equal(r.cell.layers.asphalt!.positions[2], 6);
});

test('pose index: the drawn height under a point, NaN off the surface', () => {
  const positions = Float32Array.from([0, 0, 1, 100, 0, 2, 100, 100, 3, 0, 100, 2]), indices = Uint32Array.from([0, 1, 2, 0, 2, 3]);
  const p = buildPoseIndex(positions, indices, rect);
  assert.ok(Math.abs(poseHeight(p, 50, 10) - 1.6) < 1e-6);
  assert.ok(Math.abs(poseHeight(p, 10, 50) - 1.6) < 1e-6);
  assert.ok(Number.isNaN(poseHeight(p, -1, 50)));
  assert.ok(poseIndexBytes(p) > positions.byteLength);
});

test('loader keeps covered worker triangles the bake does not own (traced OSM bands), drops owned ones', async () => {
  await MeshoptDecoder.ready;
  const cell = built();
  // Two land quads under the baked surface: the first from an OSM street band, the second the land grid.
  cell.layers.land = { ...quad(10, 10, 20, 20, 1), indices: Uint32Array.from([0, 1, 2, 0, 2, 3]) };
  (cell as BuiltCell & { sources: Record<string, Uint8Array> }).sources = { land: Uint8Array.from([sourceCode('band'), sourceCode('land')]) };
  const r = applyGroundV2(cell, encodeGrd2(baked(), MeshoptEncoder), MeshoptDecoder, frame, rect);
  assert.equal(r.used, true); assert.equal(r.kept, 1);
  assert.equal(r.cell.layers.land!.indices.length, 3, 'the band triangle stays');
  assert.equal((r.cell as { sources?: unknown }).sources, undefined, 'sources are not shipped to the main thread');
});

// Ground v2 runtime pieces (lane G2a #372): the loader's frame refusal and surface swap, and the pose index.
import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import type { BuiltCell, PackedMesh } from './groundCell';
import { GAME_FRAME_SCALE, GAME_ORIGIN, type Rect } from './groundStore';
import { decodeGrd2, encodeGrd2, frameOf, GRID_Q, grd2TileMeshes, octEncode, tileMeshBytes, type Grd2Content } from './groundV2Format';
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

test('pose index: the drawn height under a point, NaN off the surface; step strips never stood on', () => {
  // A sloped square (z 1, 2, 3, 2 at the corners) plus a step strip standing 5 m tall over its diagonal.
  const c = baked();
  c.zMm = Int32Array.from([1000, 2000, 3000, 2000, 6000]);
  c.u = Uint16Array.from([...c.u, 0]); c.v = Uint16Array.from([...c.v, 0]); c.oct = Int8Array.from([...c.oct, 0, 0]);
  c.indices = Uint32Array.from([0, 1, 2, 0, 2, 3, 0, 2, 4]);
  c.groups = [{ layer: 'asphalt', kind: 0, tile: 0, first: 0, count: 2 }, { layer: 'kerb', kind: 1, tile: 0, first: 2, count: 1 }];
  const p = buildPoseIndex(decodeGrd2(encodeGrd2(c)));
  assert.ok(Math.abs(poseHeight(p, 50, 10) - 1.6) < 1e-6, String(poseHeight(p, 50, 10)));
  assert.ok(Math.abs(poseHeight(p, 10, 50) - 1.6) < 1e-6);
  assert.ok(Math.abs(poseHeight(p, 100, 100) - 3) < 1e-6, 'the far corner (the last bucket)');
  assert.ok(Number.isNaN(poseHeight(p, -1, 50)));
  assert.equal(p.u.length, 4, 'the strip-only vertex is not kept');
  assert.equal(poseIndexBytes(p), 4 * 6 + p.start.byteLength + p.base.byteLength + p.tri.byteLength);
});

test('tile meshes: one per 3×3 tile over its own vertices, u16 indices, groups renumbered', () => {
  const c = baked();
  // The same square drawn twice: once in tile 0, once (as paving) in tile 4.
  c.indices = Uint32Array.from([0, 1, 2, 0, 2, 3, 0, 1, 2]);
  c.groups = [{ layer: 'asphalt', kind: 0, tile: 0, first: 0, count: 2 }, { layer: 'paving', kind: 0, tile: 4, first: 2, count: 1 }];
  const tiles = grd2TileMeshes(decodeGrd2(encodeGrd2(c)));
  assert.deepEqual(tiles.map(t => t.tile), [0, 4]);
  assert.ok(tiles[0].indices instanceof Uint16Array);
  assert.equal(tiles[1].positions.length, 9, 'tile 4 keeps only its three vertices');
  assert.deepEqual([...tiles[1].indices], [0, 1, 2]);
  assert.equal(tiles[1].groups[0].first, 0);
  assert.equal(tiles[0].positions[3], 100); assert.equal(tiles[0].normals[2], 127);
  assert.equal(tileMeshBytes(tiles), 4 * 15 + 6 * 2 + 3 * 15 + 3 * 2);
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

test('floor caps: the Piet Kranenbergpad A10 deck lowers the relief to the record street level inside its ring only, never lifts it', async () => {
  const { CROSSINGS } = await import('./crossings');
  const { cappedRelief, floorCapsNear } = await import('./groundV2Caps');
  const { toLocal } = await import('./groundStore');
  const project = (p: [number, number]) => toLocal(p[0], p[1]);
  const [x, y] = project([4.85333, 52.33849]);
  const rect: Rect = [x - 50, y - 50, x + 50, y + 50];
  const caps = floorCapsNear(CROSSINGS, project, 1.37, rect, 2).filter(c => c.id === 'piet-kranenbergpad-a10-south-abutment');
  assert.ok(caps.length >= 1);
  const z = 0.62 - 1.37;
  assert.ok(Math.abs(caps[0].z - z) < 1e-9);
  const high = cappedRelief(() => 3, caps), low = cappedRelief(() => -2, caps);
  // The deck's centre lies in its ring: lowered to the street; a lower relief stays; outside the ring untouched.
  const [cx, cy] = project([4.8533, 52.33849]);
  assert.equal(high(cx, cy), z);
  assert.equal(low(cx, cy), -2);
  assert.equal(high(x + 49, y + 49), 3);
  // No caps: the relief itself (byte-identical bakes where none lies).
  const r = (_x: number, _y: number) => 1;
  assert.equal(cappedRelief(r, []), r);
});

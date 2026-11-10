import test from 'node:test';
import assert from 'node:assert/strict';
import { rasterise, viewSize, type RasterAtlas, type RasterMesh } from './softRaster.ts';
import { storeyLines } from './previewVerdict.ts';

/**
 * A 4 x 4 texel atlas, one layer, in quadrants of 2 x 2 texels: bottom (v < 0.5) red | green, top blue | white; the
 * mask is (maskR, maskG) everywhere. Quadrant interiors are pure under bilinear filtering; edges blend (repeat wrap).
 */
function atlas(maskR = 255, maskG = 0): RasterAtlas {
  const quadrant = (x: number, y: number) => y < 2 ? (x < 2 ? [255, 0, 0] : [0, 255, 0]) : (x < 2 ? [0, 0, 255] : [255, 255, 255]);
  const colour = new Uint8Array(64), mask = new Uint8Array(32);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { colour.set([...quadrant(x, y), 255], (y * 4 + x) * 4); mask.set([maskR, maskG], (y * 4 + x) * 2); }
  return { colour, mask, size: 4, total: 1 };
}
/** A 2 m x 2 m wall in the x-z plane (y = 0) facing -y (south), counter-clockwise seen from the south. */
function quad(tint = [255, 255, 255, 255], accent = [255, 255, 255, 255]): RasterMesh {
  return {
    positions: new Float32Array([0, 0, 0, 2, 0, 0, 2, 0, 2, 0, 0, 2]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    layers: new Uint8Array(4), tints: new Uint8Array([...tint, ...tint, ...tint, ...tint]), accents: new Uint8Array([...accent, ...accent, ...accent, ...accent]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}
const front = { kind: 'ortho' as const, origin: [0, 0, 0] as const, right: [1, 0, 0] as const, normal: [0, -1, 0] as const, u0: 0, u1: 2, v0: 0, v1: 2, pxPerM: 4 };
const px = (img: ReturnType<typeof rasterise>, x: number, y: number) => Array.from(img.rgba.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

test('ortho front: texels land where the uv puts them, rows bottom-up', () => {
  const img = rasterise(quad(), atlas(), front, { supersample: 2 });
  assert.deepEqual(viewSize(front), { width: 8, height: 8 });
  assert.equal(img.width, 8); assert.equal(img.height, 8);
  // Lower left (image rows grow downward from the top): red; upper right: white; upper left: blue.
  assert.deepEqual(px(img, 1, 6), [255, 0, 0, 255]);
  assert.deepEqual(px(img, 6, 1), [255, 255, 255, 255]);
  assert.deepEqual(px(img, 1, 1), [0, 0, 255, 255]);
  // The corner pixel wraps: GL REPEAT blends the opposite edge's texel in.
  assert.notDeepEqual(px(img, 0, 7), [255, 0, 0, 255]);
  assert.ok(img.coverage.every(c => c === 1));
});

test('tint multiplies where mask.r is set, accent where mask.g is set, alpha shades', () => {
  const white = (img: ReturnType<typeof rasterise>) => px(img, 6, 1);
  assert.deepEqual(white(rasterise(quad([128, 64, 255, 255]), atlas(255, 0), front)), [128, 64, 255, 255]);
  assert.deepEqual(white(rasterise(quad([128, 64, 255, 255]), atlas(0, 0), front)), [255, 255, 255, 255]);
  assert.deepEqual(white(rasterise(quad(undefined, [10, 20, 30, 255]), atlas(0, 255), front)), [10, 20, 30, 255]);
  assert.deepEqual(white(rasterise(quad([255, 255, 255, 128]), atlas(), front)), [128, 128, 128, 255]);
});

test('back faces are culled and uncovered pixels take the background', () => {
  const back = { ...front, normal: [0, 1, 0] as const, origin: [2, 0, 0] as const, right: [-1, 0, 0] as const };
  const img = rasterise(quad(), atlas(), back, { background: [1, 2, 3] });
  assert.deepEqual(px(img, 3, 3), [1, 2, 3, 0]);
  assert.ok(img.coverage.every(c => c === 0));
});

test('z-buffer keeps the nearer of two walls; uv wraps (fract)', () => {
  const m = quad(), near = quad([0, 0, 0, 255]);
  // A second, black wall 1 m nearer the viewer (y = -1), drawn first.
  const positions = new Float32Array([...Array.from(near.positions).map((v, i) => i % 3 === 1 ? -1 : v), ...m.positions]);
  const merged: RasterMesh = { positions, uvs: new Float32Array([...near.uvs, ...m.uvs]), layers: new Uint8Array(8), tints: new Uint8Array([...near.tints, ...m.tints]), accents: new Uint8Array([...near.accents, ...m.accents]), indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]) };
  assert.deepEqual(px(rasterise(merged, atlas(), front), 6, 1), [0, 0, 0, 255]);
  const wrapped = quad(); wrapped.uvs = new Float32Array([2, 3, 3, 3, 3, 4, 2, 4]);
  assert.deepEqual(px(rasterise(wrapped, atlas(), front), 6, 1), [255, 255, 255, 255]);
});

test('perspective view: a wall straight ahead fills the centre with perspective-correct uv', () => {
  const img = rasterise(quad(), atlas(), { kind: 'perspective', eye: [1, -4, 1], target: [1, 0, 1], fovDeg: 60, width: 32, height: 32 });
  // Lower left quarter of the wall: red; upper right: white (bilinear between the 2 x 2 texels, so within a few levels).
  const [r, g, b] = px(img, 12, 19), [wr, wg, wb] = px(img, 19, 12);
  assert.ok(r > 220 && g < 30 && b < 30, `red quarter ${[r, g, b]}`);
  assert.ok(wr > 220 && wg > 220 && wb > 220, `white quarter ${[wr, wg, wb]}`);
  assert.equal(px(img, 0, 0)[3], 0);
});

test('storeyLines: ground then equal upper storeys', () => {
  assert.deepEqual(storeyLines(15.2, 3.2, 3), [0, 3.2, 6.2, 9.2, 12.2, 15.2]);
  assert.deepEqual(storeyLines(2, 3.2), [0, 2]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mipChain, atlasFrom, sampleAtlas } from './atlas.ts';
import { geoFrame, worldOfLngLat, chunkToWorld } from './frame.ts';
import { hexLinear, lambert, linearToSrgb, linearToSrgbExact, srgbToLinear, type SceneLight } from './light.ts';
import { texture2D, sample2D } from './texture.ts';
import { rasteriseWorld, type WorldDraw, type WorldMaterial } from './worldRaster.ts';
import { maskCut } from './ground.ts';
import { modelMatrix } from './models.ts';
import { fogFor } from './fog.ts';
import { shadowMap } from './shadow.ts';
import { dfgApprox, surfaceMaterial } from './surfaceMaterial.ts';

const flat = (r: number, g: number, b: number): WorldMaterial => ({ shade(_s, out) { out[0] = r; out[1] = g; out[2] = b; out[3] = 1; return true; } });
/** A camera at the origin, 2 m up, looking north. */
const cam = { eye: [0, 0, 2], right: [1, 0, 0], up: [0, 0, 1], forward: [0, 1, 0], focal: 50, width: 100, height: 60 };
/** A wall facing the camera (front face toward -y) at distance `y`, spanning x and z. */
const wall = (y: number, half = 5): Float32Array => new Float32Array([-half, y, -half + 2, half, y, -half + 2, half, y, half + 2, -half, y, half + 2]);
const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
const bg = { background: (_x: number, _y: number, _d: unknown, o: Float64Array) => { o[0] = 0; o[1] = 0; o[2] = 1; } };
const px = (img: { rgba: Uint8ClampedArray; width: number }, x: number, y: number) => [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];

test('rasteriseWorld: nearest surface wins, sky elsewhere, deterministic', () => {
  const draws: WorldDraw[] = [{ positions: wall(20), indices: QUAD, material: flat(1, 0, 0), cull: 'none' }, { positions: wall(10, 1), indices: QUAD, material: flat(0, 1, 0), cull: 'none' }];
  const a = rasteriseWorld(draws, cam, bg), b = rasteriseWorld(draws, cam, bg);
  assert.deepEqual(px(a, 50, 30), [0, 255, 0]);
  assert.deepEqual(px(a, 40, 30), [255, 0, 0]);
  assert.deepEqual(px(a, 50, 1), [0, 0, 255]);
  assert.deepEqual(a.rgba, b.rgba);
  assert.ok(Math.abs(a.depth[30 * 100 + 50] - 10) < 1e-3);
});

test('rasteriseWorld: back faces cull with cull back, front faces are counter-clockwise on screen', () => {
  const front: WorldDraw = { positions: wall(10), indices: QUAD, material: flat(1, 0, 0), cull: 'back' };
  assert.deepEqual(px(rasteriseWorld([front], cam, bg), 50, 30), [255, 0, 0]);
  const back: WorldDraw = { ...front, indices: new Uint32Array([0, 2, 1, 0, 3, 2]) };
  assert.deepEqual(px(rasteriseWorld([back], cam, bg), 50, 30), [0, 0, 255]);
});

test('rasteriseWorld: polygon offset lifts a coplanar layer, cut discards before the depth write', () => {
  const ground = (z: number) => new Float32Array([-50, 1, z, 50, 1, z, 50, 100, z, -50, 100, z]);
  const gi = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const base: WorldDraw = { positions: ground(0), indices: gi, material: flat(1, 0, 0), cull: 'none' };
  const top: WorldDraw = { positions: ground(0), indices: gi, material: flat(0, 1, 0), cull: 'none', offset: 2 };
  const img = rasteriseWorld([top, base], cam, bg);
  assert.deepEqual(px(img, 50, 50), [0, 255, 0]);
  const cut: WorldDraw = { ...top, cut: x => x > 0 };
  const c = rasteriseWorld([cut, base], cam, bg);
  assert.deepEqual(px(c, 90, 50), [255, 0, 0]);
  assert.deepEqual(px(c, 10, 50), [0, 255, 0]);
});

test('rasteriseWorld: blended draws composite over the opaque scene', () => {
  const glass: WorldMaterial = { shade(_s, out) { out[0] = 1; out[1] = 1; out[2] = 1; out[3] = 0.5; return true; } };
  const img = rasteriseWorld([{ positions: wall(20), indices: QUAD, material: flat(0, 0, 0), cull: 'none' }, { positions: wall(10, 1), indices: QUAD, material: glass, cull: 'none', blend: true }], cam, bg);
  assert.deepEqual(px(img, 50, 30), [128, 128, 128]);
});

test('mipChain and atlas sampling: box filter, repeat wrap, layer means', () => {
  const colour = new Uint8Array(4 * 4 * 4), mask = new Uint8Array(4 * 4 * 2);
  for (let i = 0; i < 16; i++) { colour[i * 4] = i % 2 ? 255 : 0; colour[i * 4 + 3] = 255; mask[i * 2] = 255; }
  const levels = mipChain(colour, 4, 1, 4);
  assert.equal(levels.length, 3);
  assert.equal(levels[2][0], 128);
  const a = atlasFrom(colour, mask, 4, 1, 1);
  assert.ok(Math.abs(a.mean[0] - 128 / 255) < 1e-6);
  const c = new Float64Array(3), m = new Float64Array(2);
  sampleAtlas(a, 0, 0.125, 0.125, 0, c, m);
  assert.equal(c[0], 0);
  sampleAtlas(a, 0, 1.375, 0.125, 0, c, m);
  assert.equal(c[0], 1);
  assert.equal(m[0], 1);
});

test('texture2D: flipY puts the top row at v = 1; trilinear reaches the mean at the last level', () => {
  const rgba = new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
  const t = texture2D(rgba, 2, 2, true);
  const o = new Float64Array(4);
  sample2D(t, 0.25, 0.75, 0, o); assert.equal(o[0], 1);
  sample2D(t, 0.25, 0.25, 0, o); assert.equal(o[2], 1);
  sample2D(t, 0.5, 0.5, 5, o); assert.ok(Math.abs(o[0] - 0.5) < 0.01);
});

test('frame: the camera point is the origin, east and north are +x and +y, metres agree with the chunk frame', () => {
  const f = geoFrame([4.89, 52.37]);
  assert.ok(worldOfLngLat(f, 4.89, 52.37).every(v => v === 0));
  const e = worldOfLngLat(f, 4.8901, 52.37), n = worldOfLngLat(f, 4.89, 52.3701);
  assert.ok(Math.abs(e[0] - 6.79) < 0.05 && Math.abs(e[1]) < 1e-6, `${e}`);
  assert.ok(Math.abs(n[1] - 11.13) < 0.06 && Math.abs(n[0]) < 1e-6, `${n}`);
  const map = chunkToWorld(f, { lng: 4.9, lat: 52.37 }), out = new Float64Array(3);
  map(-0.01 * 111320 * Math.cos(52.37 * Math.PI / 180), 0, 3, out, 0);
  assert.ok(Math.hypot(out[0], out[1]) < 0.05, `${[...out]}`);
  assert.ok(Math.abs(out[2] - 3) < 0.01);
});

test('light: Lambert splits sun and hemisphere; the encode table matches the curve', () => {
  const L: SceneLight = { toSun: [0, 0, 1], sun: [Math.PI, Math.PI, Math.PI], sky: [0, 0, 0], ground: [0, 0, 0], shadowIntensity: 0.5 };
  const o = new Float64Array(3);
  lambert(L, 0, 0, 1, 1, o); assert.ok(Math.abs(o[0] - 1) < 1e-9);
  lambert(L, 0, 0, 1, 0, o); assert.ok(Math.abs(o[0] - 0.5) < 1e-9);
  for (const x of [0, 0.001, 0.2, 0.5, 0.99]) assert.ok(Math.abs(linearToSrgb(x) - linearToSrgbExact(x)) < 1e-3);
  assert.ok(Math.abs(srgbToLinear(linearToSrgbExact(0.3)) - 0.3) < 1e-9);
  assert.deepEqual(hexLinear('#ffffff'), [1, 1, 1]);
});

test('maskCut: inside the extent the channel decides, outside nothing is cut', () => {
  const texels = new Uint8Array([0, 255, 255, 255, 0, 255, 255, 255]); // 2 x 2, R: water left column
  const cut = maskCut({ x0: 0, y0: 0, res: 1, width: 2, height: 2, texels }, 0);
  assert.equal(cut(0.2, 0.5), true);
  assert.equal(cut(1.8, 0.5), false);
  assert.equal(cut(5, 5), false);
  const shifted = maskCut({ x0: 0, y0: 0, res: 1, width: 2, height: 2, texels }, 0, [1, 0, 10, 0, 1, 0]);
  assert.equal(shifted(-9.8, 0.5), true);
});

test('modelMatrix: GLB +y is up, bearing 90 keeps GLB +x east, a mirror flips handedness', () => {
  const f = geoFrame([4.9, 52.37]);
  const M = modelMatrix(f, { anchor: [4.9, 52.37], modelRotationDegrees: 90, scale: 1 }, [0, 0, 0], 1.5);
  const at = (x: number, y: number, z: number) => [0, 1, 2].map(r => M[r * 4] * x + M[r * 4 + 1] * y + M[r * 4 + 2] * z + M[r * 4 + 3]);
  const up = at(0, 10, 0), east = at(10, 0, 0);
  assert.ok(Math.abs(up[2] - 11.5) < 0.05 && Math.hypot(up[0], up[1]) < 1e-6, `${up}`);
  assert.ok(east[0] > 9.9 && Math.abs(east[1]) < 1e-6, `${east}`);
  // glTF +z (toward the viewer) is south at bearing 90.
  assert.ok(at(0, 0, 10)[1] < -9.9);
  const Mm = modelMatrix(f, { anchor: [4.9, 52.37], modelRotationDegrees: 90, scale: 1, mirror: true }, [0, 0, 0], 0);
  const det = (m: number[]) => m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
  assert.ok(det(M) > 0 && det(Mm) < 0);
});

test('fog: street ranges as the shared frame (gentle 180 to 400 m, opaque at the 2 km limit)', () => {
  const f = fogFor({ frame: { distance: 20 } });
  assert.equal(f.near, 180);
  assert.ok(Math.abs(f.gentleFar - 400) < 1);
  assert.equal(f.limit, 2000);
  const rgb = new Float64Array([1, 0, 0]);
  f.full(10, rgb); assert.deepEqual([...rgb], [1, 0, 0]);
  f.full(5000, rgb); assert.ok(Math.abs(rgb[2] - hexLinear('#a1c6e5')[2]) < 1e-9);
});

test('shadowMap: a roof over the ground shades the ground under it along the sun', () => {
  const roof: WorldDraw = { positions: new Float32Array([-5, -5, 10, 5, -5, 10, 5, 5, 10, -5, 5, 10]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), material: flat(0, 0, 0) };
  const sm = shadowMap([roof], [0, 0, 1], [0, 0, 0], 18);
  assert.equal(sm.lookup(0, 0, 0, 0, 0, 1), 0);
  assert.equal(sm.lookup(30, 0, 0, 0, 0, 1), 1);
});

test('surfaceMaterial: standard at roughness 1 is close to Lambert; DFG terms stay in range', () => {
  const L: SceneLight = { toSun: [0, 0, 1], sun: [2, 2, 2], sky: [1, 1, 1], ground: [0.5, 0.5, 0.5], shadowIntensity: 0.5 };
  const env = { light: L, eye: [0, -10, 10], focal: 1000 };
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const s = { i0: 0, i1: 1, i2: 2, b0: 1 / 3, b1: 1 / 3, b2: 1 / 3, px: 0.3, py: 0.3, pz: 0, dist: 14, nx: 0, ny: 0, nz: 1, back: false, x: 0, y: 0, cosView: 0.7 };
  const a = new Float64Array(4), b = new Float64Array(4);
  surfaceMaterial({ kind: 'standard', color: [0.3, 0.3, 0.3], roughness: 1 }, {}, env, pos).shade(s, a);
  surfaceMaterial({ kind: 'lambert', color: [0.3, 0.3, 0.3] }, {}, env, pos).shade(s, b);
  assert.ok(Math.abs(a[0] - b[0]) < 0.06, `${a[0]} vs ${b[0]}`);
  for (const r of [0.1, 0.5, 1]) for (const nv of [0, 0.5, 1]) { const [x, y] = dfgApprox(r, nv); assert.ok(x + y > 0 && x + y <= 1.05); }
});

test('compareFrames: identical frames are perfect, a shifted edge still matches, a recolour shows in dE', async () => {
  const { compareFrames, lab } = await import('./compare.ts');
  const w = 20, h = 10, mk = (split: number, col: number[]) => { const d = new Uint8Array(w * h * 3); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(x < split ? [0x9e, 0xc3, 0xed] : col, (y * w + x) * 3); return { width: w, height: h, data: d, channels: 3 }; };
  const a = mk(10, [120, 60, 40]);
  const same = compareFrames(a, a);
  assert.equal(same.meanDE, 0); assert.equal(same.skyIoU, 1); assert.equal(same.edgeIoU, 1);
  const shifted = compareFrames(a, mk(11, [120, 60, 40]));
  assert.equal(shifted.edgeIoU, 1);
  assert.ok(shifted.skyIoU > 0.85);
  const recoloured = compareFrames(a, mk(10, [60, 60, 120]));
  assert.ok(recoloured.meanDE > 10);
  assert.ok(Math.abs(lab(255, 255, 255)[0] - 100) < 0.01);
});

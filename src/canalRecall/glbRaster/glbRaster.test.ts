import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { cameraBasis, makeTexture, rasteriseScene, sampleTexture, type RasterMaterial, type RasterScene } from './raster.ts';
import { loadGlb } from './load.ts';
import { buildScene, SHEET_RIG } from './look.ts';
import { boxOf, gallerySheetViews, orientWall, resolveView, wallNormal } from './views.ts';

/** A 2 m x 2 m wall in the x-y plane at z = 0 facing +z (south), counter-clockwise seen from +z. */
function wall(material: RasterMaterial, z = 0, extra: Partial<RasterScene> = {}): RasterScene {
  return {
    positions: new Float32Array([0, 0, z, 2, 0, z, 2, 2, z, 0, 2, z]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), shade: new Float32Array([1, 1, 1, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]), triMaterial: new Uint16Array([0, 0]), materials: [material], ...extra,
  };
}
const front = resolveView({ kind: 'front', a: [0, 0], b: [2, 0], ppm: 4, v0: 0, v1: 2 }, { min: [0, 0, 0], max: [2, 2, 0] });
const px = (img: { width: number; rgba: Uint8ClampedArray }, x: number, y: number) => Array.from(img.rgba.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
const red: RasterMaterial = { kind: 'unlit', color: [1, 0, 0] };

test('views: front elevation is rectify.ts axis (a on the left, rows from the top) at ppm', () => {
  assert.deepEqual(wallNormal([0, 0], [2, 0]), [-0, 1]);
  assert.equal(front.width, 8); assert.equal(front.height, 8);
  assert.deepEqual(front.ortho, [-1, 1, 1, -1]);
  // The eye is outside the wall (+z), looking back at it.
  assert.ok(front.eye[2] > 0 && Math.abs(front.eye[0] - 1) < 1e-9);
  assert.deepEqual(orientWall([2, 0], [0, 0], [0, 1]), { a: [0, 0], b: [2, 0] });
  const b = cameraBasis(front.eye, front.target);
  assert.ok(Math.abs(b.x[0] - 1) < 1e-9, 'camera right is +x, so a (x = 0) is on the left');
});

test('views: orbit fits the box like landmark-views.ts and the sheet has four views', () => {
  const box = { min: [-1, 0, -1] as [number, number, number], max: [1, 2, 1] as [number, number, number] };
  const o = resolveView({ kind: 'orbit', theta: 0, phi: Math.PI / 2 }, box, { width: 1200, height: 800 });
  assert.ok(Math.abs(o.eye[0]) < 1e-9 && o.eye[2] > 0 && Math.abs(o.eye[1] - 1) < 1e-9);
  const d = Math.hypot(2, 2, 2) * 0.5 / Math.sin(16 * Math.PI / 180) * 1.05;
  assert.ok(Math.abs(o.eye[2] - d) < 1e-9);
  const s = resolveView({ kind: 'street', x: 0, z: 0, h: 90, fov: 90 }, box, { width: 100, height: 100 });
  assert.ok(Math.abs(s.target[0] - 1) < 1e-9 && Math.abs(s.fov - 90) < 1e-9, 'heading 90 looks east');
  assert.deepEqual(gallerySheetViews().map(v => v.name), ['gallery-card', 'front', 'top', 'back']);
  assert.deepEqual(boxOf([new Float32Array([1, 2, 3, -1, 5, 0])]), { min: [-1, 2, 0], max: [1, 5, 3] });
});

test('raster: an unlit wall fills the front elevation; the background shows elsewhere; same bytes twice', () => {
  const img = rasteriseScene(wall(red), front, { background: [0, 0, 255] });
  assert.deepEqual(px(img, 1, 1), [255, 0, 0]);
  assert.deepEqual(px(img, 6, 6), [255, 0, 0]);
  const half = rasteriseScene(wall(red), { ...front, ortho: [-1, 3, 1, -1], width: 16 }, { background: [0, 0, 255] });
  assert.deepEqual(px(half, 14, 4), [0, 0, 255]);
  assert.deepEqual(Buffer.from(rasteriseScene(wall(red), front).rgba), Buffer.from(rasteriseScene(wall(red), front).rgba));
});

test('raster: back faces cull unless double-sided; the nearer wall wins the z-buffer', () => {
  const behind = resolveView({ kind: 'front', a: [2, 0], b: [0, 0], ppm: 4, v0: 0, v1: 2 }, { min: [0, 0, 0], max: [2, 2, 0] });
  assert.deepEqual(px(rasteriseScene(wall(red), behind, { background: [0, 0, 255] }), 4, 4), [0, 0, 255]);
  assert.deepEqual(px(rasteriseScene(wall({ ...red, doubleSided: true }), behind, { background: [0, 0, 255] }), 4, 4), [255, 0, 0]);
  const two = wall(red);
  const both: RasterScene = {
    positions: new Float32Array([...two.positions, 0, 0, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1]), normals: new Float32Array([...two.normals, ...two.normals]),
    uvs: new Float32Array([...two.uvs, ...two.uvs]), shade: new Float32Array(8).fill(1), indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
    triMaterial: new Uint16Array([0, 0, 1, 1]), materials: [red, { kind: 'unlit', color: [0, 1, 0] }],
  };
  assert.deepEqual(px(rasteriseScene(both, front), 4, 4), [0, 255, 0], 'the z = 1 wall is nearer the +z eye');
});

test('raster: BLEND draws over what is behind it; MASK cuts below the cutoff', () => {
  const img = rasteriseScene(wall({ kind: 'unlit', color: [1, 1, 1], opacity: 0.5, alphaMode: 'BLEND' }), front, { background: [0, 0, 0] });
  assert.deepEqual(px(img, 4, 4), [128, 128, 128]);
  // A texture whose left half is transparent: MASK keeps the right half only.
  const rgba = new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255]);
  const t = makeTexture(rgba, 2, 2);
  const masked = rasteriseScene(wall({ kind: 'unlit', color: [1, 1, 1], texture: t, alphaMode: 'MASK', alphaCutoff: 0.5 }), front, { background: [0, 0, 0] });
  assert.deepEqual(px(masked, 1, 4), [0, 0, 0]);
  assert.deepEqual(px(masked, 6, 4), [255, 255, 255]);
});

test('raster: cell textures sample bottom-up (CanvasTexture flipY) times tint times the vertex shade', () => {
  // Canvas (top-down): top row red, bottom row green. flipY: v = 0 is the bottom row, green.
  const t = makeTexture(new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255]), 2, 2, true, true);
  const out = new Float64Array(4);
  sampleTexture(t, 0.5, 0.1, 0, out);
  assert.ok(out[1] > 0.99 && out[0] < 0.01);
  const img = rasteriseScene(wall({ kind: 'cell', color: [1, 1, 1], texture: t, uvScale: 1 }, 0, { shade: new Float32Array([0.5, 0.5, 0.5, 0.5]) }), front);
  assert.deepEqual(px(img, 4, 7), [0, 128, 0], 'bottom of the image is v = 0: green at half shade');
  assert.deepEqual(px(img, 4, 0), [128, 0, 0]);
  assert.equal(t.levels.length, 2, 'mip pyramid 2x2 -> 1x1');
});

test('raster: lit diffuse is albedo / PI x (sun n.l + hemisphere), sRGB encoded', () => {
  const light = { sunDir: [0, 0, 1] as const, sun: [Math.PI / 2, Math.PI / 2, Math.PI / 2] as const, sky: [0, 0, 0] as const, ground: [0, 0, 0] as const };
  const img = rasteriseScene(wall({ kind: 'lit', color: [1, 1, 1] }), front, { light });
  // linear 0.5 -> sRGB 188
  assert.deepEqual(px(img, 4, 4), [188, 188, 188]);
  const lit = rasteriseScene(wall({ kind: 'lit', color: [1, 1, 1], standard: { roughness: 0.9, metallic: 0 } }), front, { light });
  assert.ok(px(lit, 4, 4)[0] > 188, 'the standard material adds its GGX specular toward the viewer');
});

test('raster: a triangle crossing the near plane is clipped, not dropped', () => {
  const floor: RasterScene = {
    positions: new Float32Array([-50, 0, 50, 50, 0, 50, 50, 0, -50, -50, 0, -50]), normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array(8), shade: new Float32Array(4).fill(1), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), triMaterial: new Uint16Array([0, 0]), materials: [red],
  };
  const v = resolveView({ kind: 'street', x: 0, z: 0, h: 0, fov: 60, eye: 1.5, pitch: -30 }, { min: [0, 0, 0], max: [1, 1, 1] }, { width: 32, height: 32 });
  assert.deepEqual(px(rasteriseScene(floor, v, { background: [0, 0, 255] }), 16, 30), [255, 0, 0]);
});

test('load: meshopt + quantised GLB, vertex colours and a MASK material come back; buildScene lights them', async () => {
  const doc = new Document(), buf = doc.createBuffer();
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0])).setBuffer(buf);
  const nrm = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])).setBuffer(buf);
  const col = doc.createAccessor().setType('VEC4').setArray(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1])).setBuffer(buf);
  const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buf);
  const mat = doc.createMaterial('leaves').setAlphaMode('MASK').setAlphaCutoff(0.3).setMetallicFactor(0).setDoubleSided(true).setExtras({ materialSlot: 'brick', tint: '#884433' });
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nrm).setAttribute('COLOR_0', col).setIndices(idx).setMaterial(mat);
  const node = doc.createNode('n').setMesh(doc.createMesh().addPrimitive(prim)).setTranslation([10, 0, 0]);
  doc.createScene().addChild(node);
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const bytes = await io.writeBinary(doc);
  const glb = await loadGlb(bytes);
  assert.equal(glb.primitives.length, 1);
  const p = glb.primitives[0], xs = Array.from(p.positions).filter((_, i) => i % 3 === 0);
  assert.ok(Math.abs(Math.min(...xs) - 10) < 0.01 && Math.abs(Math.max(...xs) - 12) < 0.01, 'node translation applied, quantisation undone');
  assert.ok(p.colors && Math.abs(p.colors[0] - 1) < 0.01 && Math.abs(p.colors[1]) < 0.01);
  assert.equal(glb.materials[0].alphaMode, 'MASK'); assert.equal(glb.materials[0].alphaCutoff, 0.3); assert.ok(glb.materials[0].doubleSided);
  assert.equal(glb.materials[0].extras.materialSlot, 'brick');
  // flat look: lit, vertex colour red multiplies the white base colour.
  const scene = buildScene([{ glb, position: [-10, 0, 0] }], { look: 'flat', ground: null });
  const img = rasteriseScene(scene, front, { light: SHEET_RIG, background: [0, 0, 255] });
  const c = px(img, 4, 4);
  assert.ok(c[0] > 100 && c[1] < 10 && c[2] < 10, `vertex colour drawn: ${c}`);
});

test('windowGrid: the baked tile is the shader grid (a window per 3.0 m bay and 3.2 m storey, untinted)', async () => {
  const { GRID_TILE_M, paintsWindowGrid, windowGridTexture } = await import('./windowGrid.ts');
  assert.equal(paintsWindowGrid({ materialSlot: 'brick', windowGrid: true }), true);
  assert.equal(paintsWindowGrid({ materialSlot: 'brick' }), false);
  assert.equal(paintsWindowGrid({ materialSlot: 'glass', windowGrid: true }), false, 'glass never takes the grid');
  const tint: [number, number, number] = [0.5, 0.4, 0.3], t = windowGridTexture([0.8, 0.8, 0.8], tint);
  const out = new Float64Array(4), at = (mx: number, my: number) => { sampleTexture(t, mx / GRID_TILE_M, my / GRID_TILE_M, 0, out); return [0, 1, 2].map(c => out[c] * tint[c]); };
  // wall between windows: cell mean x tint
  at(0.2, 0.2).forEach((v, c) => assert.ok(Math.abs(v - 0.8 * tint[c]) < 1e-3));
  // glass at the centre of the second bay, third storey: dark and untinted (blue-grey, b > r)
  const g = at(4.5, 2 * 3.2 + 1.76);
  assert.ok(g[2] > g[0] && g[0] < 0.4, `glass ${g}`);
  // seamless: the tile edge is the same cell phase as the origin
  assert.deepEqual(at(GRID_TILE_M + 4.5, 1.76).map(v => +v.toFixed(3)), at(4.5, 1.76).map(v => +v.toFixed(3)));
});

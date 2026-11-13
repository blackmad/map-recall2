// Thin-element fade (lane R3-A, #230): the cross-section, the ramp, the shader patch on the real city-look and lit
// facade shaders, the off switch, and the chunk attribute buildChunk writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { THIN_CLASS, THIN_OWNER_CLASSES, installThinFade, passHeightPx, patchThinShaders, projectionFocal11, thinCm, thinFadeCoverage, thinFocalPx, thinFocalUniform } from './thinFade.ts';
import { createCityLookMaterial, createCityUniforms } from './cityLook.ts';
import { createLitFacadeMaterial } from '../rendererShared/litFacadeMaterial.ts';
import { buildFeatureChunk, ORIGIN } from '../threeBuildingFeatures.ts';

test('thinCm: the shortest altitude, in cm; wide faces are not thin', () => {
  // Half of a 0.1 m × 10 m strip (a string course): ~10 cm.
  assert.equal(thinCm([0, 0, 0], [10, 0, 0], [10, 0, 0.1]), 10);
  // A 0.04 m railing bar 1 m tall: 4 cm.
  assert.equal(thinCm([0, 0, 0], [0.04, 0, 0], [0.04, 0, 1]), 4);
  // A 6 m × 5 m face is not a thin element (its 3.8 m altitude is past THIN_MAX_CM).
  assert.equal(thinCm([0, 0, 0], [6, 0, 0], [6, 0, 5]), 0);
  // Degenerate triangles still read as thin (1 cm), never 0 (= solid).
  assert.equal(thinCm([0, 0, 0], [1, 0, 0], [2, 0, 0]), 1);
});

test('the ramp: gone under 1 px, solid from 2 px; the focal length from the projection', () => {
  assert.equal(thinFadeCoverage(0.5), 0);
  assert.equal(thinFadeCoverage(1), 0);
  assert.equal(thinFadeCoverage(1.5), 0.5);
  assert.equal(thinFadeCoverage(2.5), 1);
  // 36.87° vertical field of view, a 1314 px drawing buffer (the user's S3 window at DPR 2): 1971 px per metre at 1 m.
  const p11 = 1 / Math.tan((36.86989764584402 / 2) * Math.PI / 180);
  assert.ok(Math.abs(thinFocalPx(p11, 1314) - 1971) < 1);
  // A 0.16 m coping at the slab's 150 m is 2.1 px there: drawn. At 400 m it is 0.8 px: faded out.
  assert.ok(0.16 * thinFocalPx(p11, 1314) / 150 > 2 && 0.16 * thinFocalPx(p11, 1314) / 400 < 1);
});

test('owner classes: one colour per class, far apart (the bucket tolerance is L1 < 90)', () => {
  assert.equal(new Set(THIN_OWNER_CLASSES.map(c => c.id)).size, Object.keys(THIN_CLASS).length);
  for (const [i, a] of THIN_OWNER_CLASSES.entries()) for (const b of THIN_OWNER_CLASSES.slice(i + 1)) {
    assert.ok(a.rgb.reduce((s: number, v: number, k: number) => s + Math.abs(v - b.rgb[k]), 0) >= 254, `${a.name} vs ${b.name}`);
  }
});

const chunkMaterial = (lit: boolean) => createCityLookMaterial(THREE, { lit, kind: 'chunk', side: THREE.FrontSide }, createCityUniforms(THREE));
/** The lit material's final shader strings: three's Lambert source through the material's onBeforeCompile. */
function compiled(material: any) {
  const shader = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader, uniforms: {} as Record<string, any> };
  material.onBeforeCompile(shader, null);
  return shader;
}

test('city look, unlit and lit: patched behind CITY_THIN_FADE with its own program key, the hook anchors present', () => {
  const g = globalThis as Record<string, unknown>;
  try {
    g.__canalRecallThinFade = false;
    const offUnlit = chunkMaterial(false), offLit = chunkMaterial(true);
    assert.ok(!('CITY_THIN_FADE' in (offUnlit.defines ?? {})) && !offUnlit.vertexShader.includes('vThinM'), 'off: unlit shader untouched');
    assert.ok(!('CITY_THIN_FADE' in offLit.defines) && !compiled(offLit).fragmentShader.includes('thinFocalPx'), 'off: lit defines and shader untouched');
    g.__canalRecallThinFade = undefined;
    const unlit = chunkMaterial(false), lit = chunkMaterial(true);
    assert.ok('CITY_THIN_FADE' in unlit.defines && unlit.vertexShader.includes('vThinM = thin.x * 0.01') && unlit.fragmentShader.includes('thinFocalPx'), 'on: unlit patched');
    assert.equal(unlit.uniforms.thinFocalPx.value > 0, true);
    assert.deepEqual(unlit.defaultAttributeValues.thin, [0, 0], 'a mesh without the attribute is never thin');
    assert.ok('CITY_THIN_FADE' in lit.defines && lit.customProgramCacheKey() === offLit.customProgramCacheKey(), 'on: lit define (three hashes defines into the key); the registry key is unchanged');
    const s = compiled(lit);
    assert.ok(s.vertexShader.includes('vThinM = thin.x * 0.01') && s.fragmentShader.includes('thinCover') && s.uniforms.thinFocalPx, 'on: lit shader patched');
    // Slot meshes (landmarks, recipe houses) carry no attribute and are left alone.
    const slot = createCityLookMaterial(THREE, { lit: true, kind: 'slot', side: THREE.FrontSide }, createCityUniforms(THREE));
    assert.ok(!('CITY_THIN_FADE' in slot.defines));
    // The owner view: its own key and define.
    g.__canalRecallThinDebug = 'owner';
    const owner = chunkMaterial(true);
    assert.ok('CITY_THIN_OWNER' in owner.defines && compiled(owner).fragmentShader.includes('thinOwnerColour(vThinClass)'));
  } finally { delete g.__canalRecallThinFade; delete g.__canalRecallThinDebug; }
});

test('lit facade material: patched the same way; the focal length follows the drawing buffer', () => {
  const m = createLitFacadeMaterial(THREE, {});
  assert.ok('CITY_THIN_FADE' in m.defines && m.customProgramCacheKey() === 'shared-frame-facade-v7');
  const s = compiled(m);
  assert.ok(s.vertexShader.includes('vThinM') && s.fragmentShader.includes('thinCover'));
  const camera = new THREE.PerspectiveCamera(36.86989764584402, 1448 / 657, 1, 1000);
  m.onBeforeRender({ getDrawingBufferSize: (v: any) => v.set(2896, 1314).floor() }, null, camera);
  assert.ok(Math.abs(s.uniforms.thinFocalPx.value - 1971) < 1);
});

test('shared frame: the view lives in the projection; the focal length does not turn with the heading', () => {
  // rendererShared/sharedFrame.ts keeps the camera's matrices identity and sets projectionMatrix = clipFromWorld = P · V
  // (world: east, north, up metres about the eye). Until 2026-11-10 the fade read elements[5] (P11 times the camera
  // up vector's north component): a ride camera facing west read ~0 px per metre and every facade extra (stoops, door
  // surrounds, cornices: all thin) was faded out at 9 m (lane register-extras, Langestraat 175320).
  const persp = new THREE.PerspectiveCamera(36.86989764584402, 1448 / 657, 1, 1000);
  const m = createLitFacadeMaterial(THREE, {});
  const s = compiled(m);
  const renderer = { getDrawingBufferSize: (v: any) => v.set(2896, 1314).floor() };
  for (const heading of [0, 90, 180, 262, 270]) for (const pitchDeg of [60, 80, 88]) {
    // The ride camera: pitched pitchDeg from straight down, facing `heading` (deg from north).
    const eye = new THREE.Object3D();
    eye.up.set(0, 0, 1);
    const h = heading * Math.PI / 180, t = pitchDeg * Math.PI / 180;
    eye.lookAt(Math.sin(h) * Math.sin(t), Math.cos(h) * Math.sin(t), -Math.cos(t));
    eye.updateMatrixWorld(true);
    const frame = new THREE.Camera();
    frame.projectionMatrix.copy(persp.projectionMatrix).multiply(eye.matrixWorld.clone().invert());
    assert.ok(Math.abs(projectionFocal11(frame.projectionMatrix.elements) - persp.projectionMatrix.elements[5]) < 1e-9, `P11 at heading ${heading}, pitch ${pitchDeg}`);
    m.onBeforeRender(renderer, null, frame);
    assert.ok(Math.abs(s.uniforms.thinFocalPx.value - 1971) < 1, `heading ${heading}, pitch ${pitchDeg}: ${s.uniforms.thinFocalPx.value.toFixed(0)} px/m`);
  }
  // MapLibre's clip matrix carries a homogeneous factor and the chase camera an off-centre principal point (its
  // padding): neither changes the focal (lane TF: the default chase read 7292 px/m for 1350 before).
  for (const lambda of [1, 5.4, 1e-3]) {
    const off = persp.projectionMatrix.clone();
    off.elements[9] = 0.35; // principal point 0.35 of the half-height off centre (P12 in three's column-major layout)
    const frame = new THREE.Matrix4().copy(off).multiply(new THREE.Matrix4().makeRotationX(0.7).multiply(new THREE.Matrix4().makeRotationZ(1.1)));
    frame.multiplyScalar(lambda);
    assert.ok(Math.abs(projectionFocal11(frame.elements) / persp.projectionMatrix.elements[5] - 1) < 1e-9, `lambda ${lambda}`);
  }
  // Orthographic: the row's length, as before.
  const ortho = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
  assert.ok(Math.abs(projectionFocal11(ortho.projectionMatrix.elements) - 2 / 18) < 1e-12);
  // A stoop step (20 cm) at 9 m is ~44 px across in that window: solid, at any heading.
  assert.equal(thinFadeCoverage(0.2 * thinFocalPx(projectionFocal11(persp.projectionMatrix.elements), 1314) / 9), 1);
});

/**
 * A renderer the way engine/frameHost.ts drives three: built on a fresh canvas (three caches its 300 x 150 as
 * `_width/_height`), then the host writes canvas.width/height itself and calls setViewport, never setSize. three's
 * getDrawingBufferSize keeps answering 300 x 150; getCurrentViewport answers what clip space maps onto.
 */
function hostRenderer(w: number, h: number, target?: { width: number; height: number }) {
  const v = target ? [0, 0, target.width, target.height] : [0, 0, w, h];
  return {
    getDrawingBufferSize: (out: any) => out.set(300, 150).floor(),
    getCurrentViewport: (out: any) => out.copy({ x: v[0], y: v[1], z: v[2], w: v[3] }),
  };
}

test('focal (lane TF): the pass viewport, not three\'s cached drawing-buffer size (house:frames read 48.9 for 293)', () => {
  const m = createLitFacadeMaterial(THREE, {});
  compiled(m);
  const focal = thinFocalUniform();
  // WG's house:frames pose: a 1440 x 900 frame at dpr 1, a 114 deg pano lens: 293 px per metre at 1 m. Before the fix
  // the uniform read 0.651 x 150 / 2 = 48.9 (the canvas default height), so a 14 cm speklaag fell under 1 px at 20 m.
  const pano = new THREE.PerspectiveCamera(113.86, 1440 / 900, 1, 1000);
  m.onBeforeRender(hostRenderer(1440, 900), null, pano);
  assert.ok(Math.abs(focal.value / (pano.projectionMatrix.elements[5] * 450) - 1) < 0.01, `pano: ${focal.value.toFixed(1)} px/m`);
  assert.ok(Math.abs(focal.value - 293) < 2, `pano: ${focal.value.toFixed(1)} px/m`);
  // First-person 72 deg and the MapLibre chase 36.87 deg at dpr 1 and 2 (1440 x 900 css).
  for (const [fov, dpr, want] of [[72, 1, 619], [72, 2, 1239], [36.86989764584402, 1, 1350], [36.86989764584402, 2, 2700]] as const) {
    const cam = new THREE.PerspectiveCamera(fov, 1.6, 1, 1000);
    m.onBeforeRender(hostRenderer(1440 * dpr, 900 * dpr), null, cam);
    assert.ok(Math.abs(focal.value / want - 1) < 0.01, `${fov} deg at dpr ${dpr}: ${focal.value.toFixed(0)} want ${want}`);
  }
  // A 14 cm speklaag at 20 m in the 72 deg first-person frame at dpr 1: 4.3 px, solid (before: 0.43 px, gone).
  const fps = new THREE.PerspectiveCamera(72, 1.6, 1, 1000);
  m.onBeforeRender(hostRenderer(1440, 900), null, fps);
  assert.equal(thinFadeCoverage(0.14 * focal.value / 20), 1);
  // A pass into a half-size target (swapProbe) uses the target's height.
  m.onBeforeRender(hostRenderer(1440, 900, { width: 720, height: 450 }), null, fps);
  assert.ok(Math.abs(focal.value - 619 / 2) < 4, `target: ${focal.value.toFixed(0)}`);
  // A renderer without getCurrentViewport (tests, older three) falls back to the drawing buffer size.
  assert.equal(passHeightPx({ getDrawingBufferSize: (v: any) => v.set(2896, 1314).floor() }), 1314);
});

test('patchThinShaders: a missing anchor leaves the material alone', () => {
  assert.equal(patchThinShaders('void main() {}', 'void main() {}', false), null);
  assert.equal(installThinFade({ vertexShader: 'void main() {}', fragmentShader: 'void main() {}', uniforms: {} }, false, { fade: true }).uniforms.thinFocalPx, undefined);
});

test('buildChunk: two bytes a vertex; walls and lids are never thin, extras strips are', () => {
  const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
  const ll = (x: number, y: number) => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
  const feature = { type: 'Feature' as const, properties: { id: 'thin-fade-house', height: 14, minHeight: 0, facade: 'c19-priorBrickRed', facadeStyle: 'c19', constructionYear: 1890 }, geometry: { type: 'Polygon', coordinates: [[ll(0, 0), ll(7, 0), ll(7, 12), ll(0, 12), ll(0, 0)]] } };
  const streets = new Float32Array([-20, -4, 20, -4]);
  for (const mode of ['walls', 'extras'] as const) {
    const chunk = buildFeatureChunk([feature] as any, 'photo', mode, streets);
    assert.ok(chunk.thin && chunk.thin.length === chunk.vertexCount * 2, `${mode}: thin attribute sized`);
    const classes = new Map<number, number[]>();
    for (let v = 0; v < chunk.vertexCount; v++) { const c = chunk.thin![v * 2 + 1]; (classes.get(c) ?? classes.set(c, []).get(c)!).push(chunk.thin![v * 2]); }
    for (const c of [THIN_CLASS.wall, THIN_CLASS.lid, THIN_CLASS.roof]) assert.ok((classes.get(c) ?? []).every(t => t === 0), `${mode}: class ${c} never fades`);
    if (mode === 'walls') assert.ok(classes.has(THIN_CLASS.wall), 'walls: wall quads');
    else {
      const strips = classes.get(THIN_CLASS.extrasStrip) ?? [];
      assert.ok(strips.length && strips.every(t => t > 0 && t <= 254), 'extras: strips carry their cross-section');
      assert.ok(![...classes.keys()].includes(THIN_CLASS.wall), 'extras: no wall quads');
    }
  }
});

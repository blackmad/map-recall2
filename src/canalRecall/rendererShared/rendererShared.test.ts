// node --import tsx --test src/canalRecall/rendererShared/rendererShared.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyeOfClipMatrix, frameMatrices, invert, mercatorFromWorld, mercatorOfLngLat, mercatorUnitsPerMetre, multiply, worldFromMercator, worldOfMercator, type Vec3 } from './frameMath.js';
import { fitShadowCamera, lightBasis, shadowHalfSizeForZoom } from './shadowFit.js';
import { createLightRig, sunDirection } from './lightRig.js';
import { LayerRegistry, PARTICIPANT_ORDER } from './layerRegistry.js';
import { withinView } from './residency.js';
import { SharedFrame, SHARED_FRAME_MAIN_ID, SHARED_FRAME_OVERLAY_ID } from './sharedFrame.js';
import { createLitFacadeMaterial, createFacadeDepthMaterial } from './litFacadeMaterial.js';

const close = (a: number, b: number, eps: number, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b}`);
const apply = (m: ArrayLike<number>, p: Vec3): [number, number, number, number] => {
  const v = new THREE.Vector4(p[0], p[1], p[2], 1).applyMatrix4(new THREE.Matrix4().fromArray(Array.from(m)));
  return [v.x, v.y, v.z, v.w];
};

/** A MapLibre-like clip ← Mercator matrix for an eye over Amsterdam looking at the Westerkerk. */
function amsterdamClip(): { clip: number[]; eye: Vec3; target: Vec3 } {
  const target = mercatorOfLngLat(4.8840, 52.3745, 0);
  const u = mercatorUnitsPerMetre(target[1]);
  // 300 m south-west and 180 m up, in Mercator (y runs south).
  const eye: Vec3 = [target[0] - 200 * u, target[1] + 220 * u, 180 * u];
  const cam = new THREE.PerspectiveCamera(37, 1.6, 1 * u, 5000 * u);
  cam.up.set(0, 0, 1);
  cam.position.set(...eye);
  cam.lookAt(new THREE.Vector3(...target));
  cam.updateMatrixWorld();
  const clip = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { clip: clip.toArray(), eye, target };
}

test('Mercator metre units match MapLibre at Amsterdam', () => {
  const [, y] = mercatorOfLngLat(4.9, 52.37);
  close(mercatorUnitsPerMetre(y), 1 / (2 * Math.PI * 6378137 * Math.cos(52.37 * Math.PI / 180)), 1e-15);
  const [x0] = mercatorOfLngLat(0, 0);
  close(x0, 0.5, 1e-12);
});

test('world ↔ Mercator matrices are inverses and keep east/north/up', () => {
  const origin = mercatorOfLngLat(4.9, 52.37, 3);
  const mFromW = mercatorFromWorld(origin), wFromM = worldFromMercator(origin);
  const id = multiply(mFromW, wFromM);
  for (let i = 0; i < 16; i++) close(id[i], i % 5 === 0 ? 1 : 0, 1e-9, `identity[${i}]`);
  const u = mercatorUnitsPerMetre(origin[1]);
  // 10 m north is a smaller Mercator y.
  const north = apply(mFromW, [0, 10, 0]);
  close(north[1], origin[1] - 10 * u, 1e-15);
  const up = apply(mFromW, [0, 0, 10]);
  close(up[2], origin[2] + 10 * u, 1e-15);
});

test('the eye is recovered from the clip matrix', () => {
  const { clip, eye } = amsterdamClip();
  const got = eyeOfClipMatrix(clip)!;
  const u = mercatorUnitsPerMetre(eye[1]);
  for (let i = 0; i < 3; i++) close(got[i] / u, eye[i] / u, 0.01, `eye[${i}] metres`);
});

test('drawing in frame world lands where MapLibre would draw the Mercator point', () => {
  const { clip, target } = amsterdamClip();
  const frame = frameMatrices(clip)!;
  const u = frame.unitsPerMetre;
  for (const offset of [[0, 0, 0], [35, -12, 20], [-80, 60, 2]] as Vec3[]) {
    const p: Vec3 = [target[0] + offset[0] * u, target[1] - offset[1] * u, offset[2] * u];
    const viaMercator = apply(clip, p);
    const viaWorld = apply(frame.clipFromWorld, worldOfMercator(frame, p));
    for (let i = 0; i < 4; i++) close(viaWorld[i] / viaWorld[3], viaMercator[i] / viaMercator[3], 1e-6, `clip[${i}]`);
  }
  // The eye is the world origin.
  const atEye = worldOfMercator(frame, frame.eye);
  for (const v of atEye) close(v, 0, 1e-9);
});

test('invert returns null for singular matrices', () => {
  assert.equal(invert(new Array(16).fill(0)), null);
});

test('sun direction is a unit vector pointing at the given bearing', () => {
  const s = sunDirection(180, 30);
  close(Math.hypot(...s), 1, 1e-12);
  assert.ok(s[1] < 0 && Math.abs(s[0]) < 1e-9 && s[2] > 0, 'south and up');
  const w = sunDirection(270, 0);
  close(w[0], -1, 1e-12);
});

test('shadow box snaps to light-space texels and covers the focus', () => {
  const toSun = sunDirection(215, 40);
  const half = 160, size = 2048;
  const a = fitShadowCamera({ focusAbs: [123.4, -56.7, 0], toSun, halfSizeM: half, mapSize: size });
  const { right, up } = lightBasis(toSun);
  const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  // Snapped coordinates are whole texels.
  for (const axis of [right, up]) {
    const t = dot(a.targetAbs, axis) / a.texelM;
    close(t, Math.round(t), 1e-6, 'texel multiple');
  }
  // Moving less than half a texel along the light's right axis does not move the box.
  const nudge = 0.3 * a.texelM;
  const b = fitShadowCamera({ focusAbs: [123.4 + right[0] * nudge, -56.7 + right[1] * nudge, right[2] * nudge], toSun, halfSizeM: half, mapSize: size });
  close(dot(b.targetAbs, right), dot(a.targetAbs, right), 1e-6);
  // The focus and an 87 m spire top on it are inside near/far.
  const dir = [a.targetAbs[0] - a.lightAbs[0], a.targetAbs[1] - a.lightAbs[1], a.targetAbs[2] - a.lightAbs[2]] as Vec3;
  const len = Math.hypot(...dir);
  const depthOf = (p: Vec3) => dot([p[0] - a.lightAbs[0], p[1] - a.lightAbs[1], p[2] - a.lightAbs[2]], dir) / len;
  for (const p of [[123.4, -56.7, 0], [123.4, -56.7, 87], [123.4 + half * 0.9, -56.7, 0]] as Vec3[]) {
    const d = depthOf(p);
    assert.ok(d > a.near && d < a.far, `depth ${d} in [${a.near}, ${a.far}]`);
  }
});

test('shadow box size steps with zoom and is clamped', () => {
  assert.equal(shadowHalfSizeForZoom(18), 160);
  assert.equal(shadowHalfSizeForZoom(18.7), 160);
  assert.equal(shadowHalfSizeForZoom(17.5), 320);
  assert.equal(shadowHalfSizeForZoom(12), 640);
  assert.equal(shadowHalfSizeForZoom(20), 100);
});

test('light rig is z-up and its shadow camera basis matches the snap basis', () => {
  const rig = createLightRig(THREE);
  assert.deepEqual(rig.sky.position.toArray(), [0, 0, 1]);
  const fit = rig.follow([10, 20, 0], 18, abs => abs);
  assert.equal(rig.sun.shadow.camera.right, fit.right);
  // Reproduce three's DirectionalLightShadow.updateMatrices.
  const cam = rig.sun.shadow.camera;
  cam.position.copy(rig.sun.position);
  cam.lookAt(rig.sun.target.position);
  cam.updateMatrixWorld();
  const x = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const { right } = lightBasis(rig.toSun);
  for (let i = 0; i < 3; i++) close(x.getComponent(i), right[i], 1e-9, `right[${i}]`);
});

test('registry orders by pass, order, then registration and rejects duplicates', () => {
  const r = new LayerRegistry<string>();
  r.add('bike', 'b', { pass: 'overlay', order: PARTICIPANT_ORDER.bike });
  r.add('trees', 't', { order: PARTICIPANT_ORDER.trees });
  r.add('facades', 'f', { order: PARTICIPANT_ORDER.facades });
  r.add('roofs-a', 'a', { order: 40 });
  r.add('roofs-b', 'c', { order: 40 });
  assert.deepEqual(r.all().map(e => e.id), ['facades', 'trees', 'roofs-a', 'roofs-b', 'bike']);
  assert.deepEqual(r.inPass('overlay').map(e => e.id), ['bike']);
  assert.throws(() => r.add('bike', 'x'));
  r.remove('trees');
  assert.deepEqual(r.all().map(e => e.id), ['facades', 'roofs-a', 'roofs-b', 'bike']);
});

test('view residency pads the view and widens for big footprints', () => {
  const bounds = { west: 4.88, east: 4.90, south: 52.37, north: 52.38 };
  assert.equal(withinView(bounds, [4.89, 52.375]), true);
  assert.equal(withinView(bounds, [4.903, 52.375]), true, 'inside the pad');
  assert.equal(withinView(bounds, [4.906, 52.375]), false);
  assert.equal(withinView(bounds, [4.906, 52.375], 200), true, 'a 200 m footprint reaches in');
  assert.equal(withinView(bounds, null), false);
});

test('lit facade materials expose game-compatible uniforms', () => {
  const m = createLitFacadeMaterial(THREE);
  for (const key of ['cells', 'masks', 'bands', 'flatColour', 'cityFade']) assert.ok(key in m.uniforms, key);
  assert.equal(m.flatShading, true);
  const shader = { uniforms: {} as any, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader, null);
  assert.match(shader.vertexShader, /attribute float hidden/);
  assert.match(shader.vertexShader, /gl_Position = vec4\(2\.0, 2\.0, 2\.0, 1\.0\)/);
  assert.match(shader.fragmentShader, /texture\(cells, fp\)/);
  assert.match(shader.fragmentShader, /cityFade/);
  assert.equal(shader.uniforms.cityFade, m.uniforms.cityFade, 'uniform objects are shared, not copied');
  const depth = createFacadeDepthMaterial(THREE);
  const depthShader = { uniforms: {}, vertexShader: THREE.ShaderLib.depth.vertexShader, fragmentShader: THREE.ShaderLib.depth.fragmentShader };
  depth.onBeforeCompile(depthShader, null);
  assert.match(depthShader.vertexShader, /hidden > 0\.5/);
});

function fakeMap() {
  const layers: string[] = [];
  const handlers: Record<string, (() => void)[]> = {};
  return {
    layers,
    getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
    addLayer: (layer: any, before?: string) => { const i = before ? layers.indexOf(before) : -1; if (i >= 0) layers.splice(i, 0, layer.id); else layers.push(layer.id); },
    moveLayer: (id: string) => { layers.splice(layers.indexOf(id), 1); layers.push(id); },
    getLayersOrder: () => [...layers],
    on: (type: string, fn: () => void) => { (handlers[type] ??= []).push(fn); },
    fire: (type: string) => { for (const fn of handlers[type] ?? []) fn(); },
    getCanvas: () => ({}),
    getZoom: () => 18,
    getCenter: () => ({ lng: 4.884, lat: 52.3745 }),
    getBounds: () => ({ getWest: () => 4.88, getEast: () => 4.89, getSouth: () => 52.37, getNorth: () => 52.38 }),
    triggerRepaint: () => {},
  };
}

function fakeRenderer(log: string[], frame: SharedFrame) {
  return {
    info: { autoReset: true, reset() {}, render: { calls: 3, triangles: 99 } },
    shadowMap: { needsUpdate: false, autoUpdate: false },
    resetState() { log.push('reset'); },
    setViewport(_x: number, _y: number, w: number, h: number) { log.push(`viewport ${w}x${h}`); },
    render(scene: any) {
      const visible = scene.children.filter((c: any) => c.isGroup && c.visible).map((c: any) => c.name.replace('shared-frame/', ''));
      log.push(`render${scene.overrideMaterial ? '[xray]' : ''}${frame.renderer.shadowMap.needsUpdate ? '[shadow]' : ''} ${visible.join(',')}`);
    },
    compile() {},
    dispose() {},
  };
}

test('shared frame: two passes, one renderer, participants placed by their own local→Mercator', () => {
  const map = fakeMap();
  map.layers.push('city-building-overview', 'own-poi-labels');
  const frame = new SharedFrame(THREE, map, { beforeId: () => 'city-building-overview' });
  frame.attach();
  assert.deepEqual(map.layers, [SHARED_FRAME_MAIN_ID, 'city-building-overview', 'own-poi-labels', SHARED_FRAME_OVERLAY_ID]);
  map.layers.push('late-label');
  map.fire('styledata');
  assert.equal(map.layers[map.layers.length - 1], SHARED_FRAME_OVERLAY_ID, 'overlay kept on top');

  const log: string[] = [];
  frame.renderer = fakeRenderer(log, frame);
  const { clip, target } = amsterdamClip();
  const u = mercatorUnitsPerMetre(target[1]);
  const facadeLocal = new THREE.Matrix4().makeTranslation(target[0], target[1], 0).scale(new THREE.Vector3(u, -u, u));
  let attached = 0;
  frame.register('facades', { root: new THREE.Group(), mercatorFromLocal: () => facadeLocal.toArray(), onAttach: () => { attached++; } }, { order: 0 });
  assert.equal(attached, 1, 'attached immediately when the renderer exists');
  frame.register('trees', { root: new THREE.Group(), beforeRender: () => false }, { order: 30 });
  const xray = new THREE.MeshBasicMaterial();
  frame.register('bike', { root: new THREE.Group(), xrayMaterial: () => xray }, { order: 100, pass: 'overlay' });

  const gl = { drawingBufferWidth: 800, drawingBufferHeight: 600 } as any;
  frame.mainLayer.render(gl, { defaultProjectionData: { mainMatrix: clip } });
  assert.deepEqual(log, ['reset', 'viewport 800x600', 'render[shadow] facades']);
  // The facade wrapper maps local metres to world metres about the eye.
  const wrapper = frame.scene.getObjectByName('shared-frame/facades');
  const atTarget = new THREE.Vector3(0, 0, 0).applyMatrix4(wrapper.matrix);
  const expected = worldOfMercator(frame.lastFrame!, [target[0], target[1], 0]);
  close(atTarget.x, expected[0], 1e-6); close(atTarget.y, expected[1], 1e-6); close(atTarget.z, expected[2], 1e-6);
  log.length = 0;
  frame.overlayLayer.render(gl, { defaultProjectionData: { mainMatrix: clip } });
  assert.deepEqual(log, ['reset', 'render[xray] bike', 'render bike'], 'x-ray first, no shadow redraw in the overlay');
  frame.setShadows(false);
  log.length = 0;
  frame.mainLayer.render(gl, { defaultProjectionData: { mainMatrix: clip } });
  assert.deepEqual(log, ['reset', 'render facades']);
  assert.equal(frame.rig.sun.shadow.intensity, 0);
});

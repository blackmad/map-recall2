import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FlatLines, lineCullFlag, type LngLatLine } from './overlays/flatLines';
import { ORIGIN } from '../ownMap/frame';

/** Region-wide lines: 40 east-west and 40 north-south lines over ~8 km round the origin, 50 segments each. */
function regionLines(): LngLatLine[] {
  const out: LngLatLine[] = [], dLat = 0.036, dLng = 0.06;
  for (let k = 0; k < 40; k++) {
    const f = k / 39 - 0.5, ew: [number, number][] = [], ns: [number, number][] = [];
    for (let i = 0; i <= 50; i++) { const t = i / 50 - 0.5; ew.push([ORIGIN.lng + t * dLng, ORIGIN.lat + f * dLat]); ns.push([ORIGIN.lng + f * dLng, ORIGIN.lat + t * dLat]); }
    out.push(ew, ns);
  }
  return out;
}

function chaseCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1.6, 1, 800);
  camera.position.set(0, -300, 120);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 200, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

function lines(withCasing: boolean): FlatLines {
  const l = new FlatLines('cycle-tracks', { center: () => ({ lng: ORIGIN.lng, lat: ORIGIN.lat }), zoom: () => 17 });
  l.set([{ lines: regionLines(), style: { color: '#c0392b', width: [[12, 1], [18, 5]], ...(withCasing ? { casing: { color: '#ffffff', extraPx: 2 } } : {}) } }]);
  l.root.updateMatrixWorld(true);
  return l;
}

test('flat lines: a chase view draws only the span on screen; the casing shares it; ?lineCull=0 draws whole', () => {
  const l = lines(true), camera = chaseCamera();
  assert.equal(l.beforeRender(), true);
  const [casing, fill] = l.root.children as THREE.Mesh[];
  const total = fill.geometry.index!.count;
  fill.onBeforeRender(null as any, null as any, camera, fill.geometry, fill.material as THREE.Material, null as any);
  const { start, count } = fill.geometry.drawRange;
  assert.ok(count > 0 && count < total / 4, `span ${count} of ${total}`);
  fill.onAfterRender(null as any, null as any, camera, fill.geometry, fill.material as THREE.Material, null as any);
  assert.equal(fill.geometry.drawRange.count, Infinity);
  casing.onBeforeRender(null as any, null as any, camera, casing.geometry, casing.material as THREE.Material, null as any);
  assert.deepEqual([casing.geometry.drawRange.start, casing.geometry.drawRange.count], [start, count]);

  (globalThis as any).__canalRecallLineCull = false;
  try {
    assert.equal(lineCullFlag(), false);
    const whole = lines(false), [mesh] = whole.root.children as THREE.Mesh[];
    whole.beforeRender();
    mesh.onBeforeRender(null as any, null as any, camera, mesh.geometry, mesh.material as THREE.Material, null as any);
    assert.equal(mesh.geometry.drawRange.count, Infinity);
  } finally { delete (globalThis as any).__canalRecallLineCull; }
});

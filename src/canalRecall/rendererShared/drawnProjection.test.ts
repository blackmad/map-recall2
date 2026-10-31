import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { drawnProjector, invert4, latOf, lngOf, mercatorXOf, mercatorYOf, projectGround, unprojectGround } from './drawnProjection';

// A chase-like camera over Prinsengracht in MapLibre's world units (mercator x worldSize, y down, z up in pixels).
const WS = 512 * 2 ** 18, W = 390, H = 664;
const AF = { lng: 4.8839, lat: 52.3752 };
function viewProj(liftPx: number): number[] {
  const cx = mercatorXOf(AF.lng) * WS, cy = mercatorYOf(AF.lat) * WS;
  const cam = new THREE.PerspectiveCamera(36.87, W / H, 1, 1e5);
  cam.up.set(0, 0, 1);
  cam.position.set(cx, cy + 600, 700 + liftPx);
  cam.lookAt(cx, cy, liftPx);
  cam.updateMatrixWorld(true);
  // A y-down world seen by a y-up camera: mirror y so screen-up is north, as MapLibre's scale [1, -1, 1] does.
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return m.elements.slice();
}

test('mercator helpers invert each other', () => {
  assert.ok(Math.abs(lngOf(mercatorXOf(AF.lng)) - AF.lng) < 1e-12);
  assert.ok(Math.abs(latOf(mercatorYOf(AF.lat)) - AF.lat) < 1e-10);
});

test('unprojectGround inverts projectGround on the ground plane', () => {
  const vp = viewProj(40);
  assert.ok(invert4(vp));
  for (const [dx, dy] of [[0, 0], [0.0004, -0.0002], [-0.0003, 0.0005]]) {
    const p = projectGround(vp, WS, AF.lng + dx, AF.lat + dy, W, H);
    assert.ok(p, 'in front of the camera');
    const q = unprojectGround(vp, WS, p.x, p.y, W, H);
    assert.ok(q);
    assert.ok(Math.abs(q.lng - (AF.lng + dx)) < 1e-9 && Math.abs(q.lat - (AF.lat + dy)) < 1e-9, `${dx},${dy}`);
  }
});

function fakeMap(elevation: number, vp: number[]) {
  // map.project here is the un-lifted pixel matrix (MapLibre's quirk): the same camera without the lift.
  const pixel = viewProj(0);
  return {
    transform: { _viewProjMatrix: vp, elevation, worldSize: WS },
    getCanvas: () => ({ clientWidth: W, clientHeight: H }),
    project: (ll: any) => { const [lng, lat] = Array.isArray(ll) ? ll : [ll.lng, ll.lat]; const p = projectGround(pixel, WS, lng, lat, W, H)!; return { x: p.x, y: p.y, isPoint: true }; },
    unproject: (px: any) => { const [x, y] = Array.isArray(px) ? px : [px.x, px.y]; return { ...unprojectGround(pixel, WS, x, y, W, H)!, isLngLat: true }; },
  };
}

test('drawnProjector follows the drawn (lifted) matrix while the deck is up, and is map.project at elevation 0', () => {
  const lifted = viewProj(40);
  const flat = fakeMap(0, lifted), deck = fakeMap(1.2, lifted);
  const target: [number, number] = [AF.lng + 0.0002, AF.lat - 0.0001];
  const p0 = drawnProjector(flat).project(target), raw = flat.project(target);
  assert.deepEqual(p0, raw, 'flat: unchanged');
  const pd = drawnProjector(deck).project(target) as any, drawn = projectGround(lifted, WS, target[0], target[1], W, H)!;
  assert.ok(pd.isPoint, 'keeps MapLibre\'s Point object');
  assert.ok(Math.hypot(pd.x - drawn.x, pd.y - drawn.y) < 1e-3);
  assert.ok(Math.hypot(raw.x - drawn.x, raw.y - drawn.y) > 1, 'the quirk this fixes: map.project misses the drawn frame');
  const ll = drawnProjector(deck).unproject([drawn.x, drawn.y]) as any;
  assert.ok(ll.isLngLat && Math.abs(ll.lng - target[0]) < 1e-9 && Math.abs(ll.lat - target[1]) < 1e-9);
  // A tap on what is drawn queries MapLibre at the pixel its own (un-lifted) projection gives that point.
  const qp = drawnProjector(deck).queryPixel([drawn.x, drawn.y]) as number[];
  assert.ok(Math.hypot(qp[0] - raw.x, qp[1] - raw.y) < 1e-3, JSON.stringify([qp, raw]));
  assert.deepEqual(drawnProjector(flat).queryPixel([10, 20]), [10, 20]);
});

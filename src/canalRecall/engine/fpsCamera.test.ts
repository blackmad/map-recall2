// First-person camera pose maths (issue #171). Run: node --import tsx --test src/canalRecall/engine/fpsCamera.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraFrame, metresPerPixel } from '../ownMap/mapCamera';
import { clearBackM, fpsPose, fpsRequested, FPS_EYE_HEIGHT_M, headBobM, stepFpsYaw, wrapDeg, zoomForMetresPerPixel } from './fpsCamera';

const LAT = 52.3702;
const kx = 111_320 * Math.cos(LAT * Math.PI / 180);
const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const frameOf = (pose: ReturnType<typeof fpsPose>, w = 1440, h = 900) =>
  cameraFrame({ center: [0, 0], zoom: pose.zoom, bearing: pose.bearing, pitch: pose.pitch, fovDeg: pose.fovDeg }, { width: w, height: h }, LAT);

test('the camera model eye is 1.6 m over the rider for any heading', () => {
  for (const bearing of [0, 37, 90, 211, -150]) {
    const pose = fpsPose({ rider: [4.88, LAT], bearingDeg: bearing, viewportHeightPx: 900 });
    const frame = frameOf(pose);
    close(frame.eye[2], FPS_EYE_HEIGHT_M, 1e-3, 'height');
    close(frame.eye[0], (4.88 - pose.center[0]) * kx, 1e-2, 'east');
    close(frame.eye[1], (LAT - pose.center[1]) * 111_320, 1e-2, 'north');
    assert.equal(pose.pitch, 85);
  }
});

test('backM moves the eye back along the heading and keeps its height', () => {
  const pose = fpsPose({ rider: [4.88, LAT], bearingDeg: 90, viewportHeightPx: 800, backM: 2 });
  const frame = frameOf(pose, 1200, 800);
  close((4.88 - pose.center[0]) * kx, frame.eye[0] + 2, 1e-2);
  close(frame.eye[2], FPS_EYE_HEIGHT_M, 1e-3);
});

test('a lower pitch ceiling and a bob lift are honoured', () => {
  const pose = fpsPose({ rider: [4.88, LAT], bearingDeg: 0, viewportHeightPx: 900, maxPitchDeg: 80, bobM: 0.02 });
  assert.equal(pose.pitch, 80);
  close(pose.eye.heightM, 1.62, 1e-9);
});

test('zoom round-trips', () => {
  close(metresPerPixel(zoomForMetresPerPixel(0.03, LAT), LAT), 0.03, 1e-9);
});

test('stepFpsYaw snaps without history and takes the short way round the wrap', () => {
  assert.equal(stepFpsYaw(null, 123, 0.016), 123);
  const next = stepFpsYaw(170, -170, 0.016);
  assert.ok(next > 170 && wrapDeg(next - 170) > 0);
});

test('stepFpsYaw is frame-rate independent and converges', () => {
  let a = 0, b = 0;
  for (let i = 0; i < 60; i++) a = stepFpsYaw(a, 40, 1 / 60);
  for (let i = 0; i < 30; i++) b = stepFpsYaw(b, 40, 1 / 30);
  close(a, b, 0.1);
  assert.ok(a > 39);
});

test('head bob is zero at rest and bounded by its amplitude', () => {
  assert.equal(headBobM(1, 0), 0);
  assert.ok(Math.abs(headBobM(0.6, 5)) <= 0.025);
  assert.equal(headBobM(0.6, 5, 0), 0);
});

test('clearBackM steps back until clear, null when it never does', () => {
  assert.equal(clearBackM(back => back < 1), 1);
  assert.equal(clearBackM(() => true), null);
  assert.equal(clearBackM(() => false), 0);
});

test('fpsRequested reads ?cam= and the stored choice', () => {
  assert.equal(fpsRequested('?cam=fps', null), true);
  assert.equal(fpsRequested('?cam=chase', 'fps'), false);
  assert.equal(fpsRequested('', 'fps'), true);
  assert.equal(fpsRequested('', null), false);
});

// The clearance guard's poses (engine/ownWorldView.ts solveFps): the eye against a wall, and the 2026-11-10 probe at the
// quay (4.88395, 52.37335) and Egelantiersstraat (4.8815, 52.37585), where the guard's `stuck` was right: the probe's
// `exact` test put the eye point itself inside pand ...4217 (top 14.25 m) and ...2887 (8.95 m), the teleport spots being
// off the road graph on the plaza that the footprint covers. Not a margin fault.
import { eyeInsideBuilding, nearPlaneReachM } from './streetVisibility';
import { FPS_NEAR_DIVISOR, clearBackM as clearBack } from './fpsCamera';

const wallEast = (lng: number, lat: number, gapM: number, topM = 12) => {
  const x0 = lng + gapM / kx, x1 = x0 + 10 / kx, dy = 10 / 111_320;
  return { type: 'Feature', properties: { id: 'wall', height: topM }, geometry: { type: 'Polygon', coordinates: [[[x0, lat - dy], [x1, lat - dy], [x1, lat + dy], [x0, lat + dy], [x0, lat - dy]]] } } as never;
};
const reachOf = (distanceM: number) => 0.2 + nearPlaneReachM(distanceM / FPS_NEAR_DIVISOR, 72, 1440 / 900);

function guard(wall: never, rider: [number, number]) {
  const base = { rider, bearingDeg: 90, viewportHeightPx: 900 };
  const reach = reachOf(fpsPose(base).distanceM);
  const blockerAt = (back: number) => { const p = fpsPose({ ...base, backM: back }); return eyeInsideBuilding({ lngLat: p.eye.lngLat, altitude: p.eye.heightM }, [wall], reach); };
  return { reach, blockerAt, back: clearBack(back => !!blockerAt(back)) };
}

test('an eye 0.25 m from a wall backs off until the near plane clears it', () => {
  const { reach, blockerAt, back } = guard(wallEast(4.88, LAT, 0.25), [4.88, LAT]);
  assert.ok(reach > 0.3 && reach < 0.5, `reach ${reach}`);
  assert.ok(back != null && back > 0, `back ${back}`);
  assert.equal(blockerAt(back!), null);
  assert.ok(0.25 + back! >= reach - 0.25, 'the cleared eye is at least the reach (to a probe step) from the wall');
});

test('an eye 2 m from a wall does not move', () => {
  assert.equal(guard(wallEast(4.88, LAT, 2), [4.88, LAT]).back, 0);
});

test('an eye inside a footprint (a passage, or a rider off the road) is stuck: no step back clears it', () => {
  const inside = { type: 'Feature', properties: { id: 'passage', height: 14.25 }, geometry: { type: 'Polygon', coordinates: [[[4.8799, LAT - 0.0001], [4.8805, LAT - 0.0001], [4.8805, LAT + 0.0001], [4.8799, LAT + 0.0001], [4.8799, LAT - 0.0001]]] } } as never;
  const { back, blockerAt } = guard(inside, [4.8802, LAT]);
  assert.equal(back, null);
  assert.ok(blockerAt(0));
});

test('a low footprint under the eye (a kerb-height sliver below 1.6 m - 0.75 m) does not block', () => {
  assert.equal(guard(wallEast(4.88, LAT, 0.1, 0.5), [4.88, LAT]).back, 0);
});

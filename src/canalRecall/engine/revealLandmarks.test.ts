import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVEAL_LANDMARK_BUDGET_DESKTOP, REVEAL_LANDMARK_BUDGET_TOUCH, isRideAim, revealLandmarkBudget, poseCamera, revealPose, revealSwapBudget, revealSwapEnabled } from './revealLandmarks';
import { GameCameraSolver, type SolveDeps } from './gameCamera';
import { EngineCamera } from './cameraMap';

const loader = { _lastCenterLng: 4.8868, _lastCenterLat: 52.3596, _lastOffsetX: 0, _lastOffsetY: 0 };
const deps: SolveDeps = {
  pitchForViewMode: m => (m === 'chase' ? 60 : 14), zoomOffsetForViewMode: m => (m === 'chase' ? 0.3 : 0),
  landmarkView: null, displayScale: 1, now: 1000,
};
const camera = { x: 120, y: -45, zoom: 1.6, rotation: 0.22, viewMode: 'chase' };

test('flag: on unless 0/false/off', () => {
  assert.equal(revealSwapEnabled(undefined), true);
  assert.equal(revealSwapEnabled(null), true);
  assert.equal(revealSwapEnabled('1'), true);
  assert.equal(revealSwapEnabled(true), true);
  for (const off of ['0', 'false', 'off', 'OFF', false]) assert.equal(revealSwapEnabled(off), false);
});

test('budget: per device, explicit, invalid', () => {
  assert.equal(revealLandmarkBudget(false), REVEAL_LANDMARK_BUDGET_DESKTOP);
  assert.equal(revealLandmarkBudget(true), REVEAL_LANDMARK_BUDGET_TOUCH);
  assert.ok(REVEAL_LANDMARK_BUDGET_TOUCH < REVEAL_LANDMARK_BUDGET_DESKTOP);
  assert.equal(revealSwapBudget(null, 8), 8);
  assert.equal(revealSwapBudget('', 8), 8);
  assert.equal(revealSwapBudget('6', 8), 6);
  assert.equal(revealSwapBudget('0', 8), 0);
  assert.equal(revealSwapBudget('2.7', 8), 2);
  assert.equal(revealSwapBudget('-1', 4), 4);
  assert.equal(revealSwapBudget('x', 4), 4);
});

test('ride aim: covered, at the game camera, no flight, not panned off', () => {
  const aim = { covered: true, worldX: 120, worldY: -45, camera };
  assert.equal(isRideAim(aim), true);
  assert.equal(isRideAim({ ...aim, worldX: 122, worldY: -43 }), true, 'within 3 px');
  assert.equal(isRideAim({ ...aim, covered: false }), false, 'racing: the sync owns the camera');
  assert.equal(isRideAim({ ...aim, worldX: 400 }), false, "the route's first aim, the camera still elsewhere");
  assert.equal(isRideAim({ ...aim, camera: { ...camera, introOverview: 1 } }), false, 'start flight');
  assert.equal(isRideAim({ ...aim, camera: { ...camera, detached: true } }), false);
  assert.equal(isRideAim({ ...aim, camera: null }), false);
  assert.equal(isRideAim({ ...aim, camera: { ...camera, zoom: NaN } }), false);
});

test('pose: the first racing request, without touching the view solver', () => {
  const solver = new GameCameraSolver();
  solver.pitchSmoothed = 60;
  const before = JSON.stringify(solver);
  const pose = revealPose(camera, loader, deps, solver.pitchSmoothed);
  assert.equal(JSON.stringify(solver), before);
  const racing = solver.request(camera, loader, deps);
  assert.deepEqual([pose.lngLat, pose.zoom, pose.bearing, pose.pitch], [racing.lngLat, racing.zoom, racing.bearing, racing.pitch]);
  // The chase offset is in the zoom: the hold's aim keeps zoom 17, the ride asks for more.
  const plain = revealPose({ ...camera, viewMode: 'north' }, loader, deps, 14);
  assert.ok(Math.abs(pose.zoom - plain.zoom - 0.3) < 1e-9);
});

test('pose camera reads like the view camera at that pose', () => {
  const viewport = () => ({ width: 1512, height: 982 });
  const pose = { lngLat: [4.8869, 52.36] as [number, number], zoom: 18.05, bearing: 12.7, pitch: 60 };
  const cam = poseCamera(viewport, pose);
  const ref = new EngineCamera(viewport, { center: pose.lngLat, zoom: pose.zoom, bearing: pose.bearing, pitch: pose.pitch });
  assert.equal(cam.zoom(), 18.05);
  assert.equal(cam.pitch(), 60);
  assert.ok(Math.abs(cam.bearing() - 12.7) < 1e-9);
  assert.deepEqual(cam.center().toArray(), [4.8869, 52.36]);
  const b = cam.bounds(), r = ref.bounds();
  assert.deepEqual(b.toArray(), [[r.west, r.south], [r.east, r.north]]);
  assert.equal(b.contains([4.8869, 52.3602]), true);
  assert.equal(b.contains([4.95, 52.3602]), false);
});

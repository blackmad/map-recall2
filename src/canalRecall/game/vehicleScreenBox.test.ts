// node --import tsx --test src/canalRecall/game/vehicleScreenBox.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxesIntersect, glyphBox, multiplyMat4, projectLocalBox, StartTagLatch, startTagCentreY, START_TAG_GAP_PX, START_TAG_HIDE_M } from './vehicleScreenBox.ts';
import { anchorInView, EngineCamera } from '../engine/cameraMap.ts';
import { boatZoomScale, ferryZoomScale, transitZoomScale, VEHICLE_ZOOM_MAX_SCALE } from './vehicleZoomScale.ts';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test('multiplyMat4 composes column-major matrices', () => {
  const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1];
  const scale = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1];
  // translate × scale: scale first, then move.
  assert.deepEqual(multiplyMat4(translate, scale), [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 2, 3, 4, 1]);
  assert.deepEqual(multiplyMat4(IDENTITY, translate), translate);
});

test('projectLocalBox maps clip space to CSS pixels, y down', () => {
  const box = projectLocalBox(IDENTITY, [-0.5, -0.5, 0], [0.5, 0.5, 0], 1, 200, 100);
  assert.deepEqual(box, { left: 50, top: 25, right: 150, bottom: 75 });
  const scaled = projectLocalBox(IDENTITY, [-0.25, -0.25, 0], [0.25, 0.25, 0], 2, 200, 100);
  assert.deepEqual(scaled, box, 'the per-frame scale applies about the origin');
  const behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1];
  assert.equal(projectLocalBox(behind, [0, 0, 0], [1, 1, 1], 1, 200, 100), null, 'behind the camera: no box');
});

test('the START tag keeps its spot clear of the vehicle, and moves above it when they overlap', () => {
  const pill = { width: 60, height: 20 };
  const clear = glyphBox(300, 400, 20);
  assert.equal(startTagCentreY(300, 300, pill, clear), 300, 'well above: unchanged');
  assert.equal(startTagCentreY(300, 300, pill, null), 300, 'no vehicle: unchanged');
  // Zoomed out (user follow-up 2026-10-22): the tag's offset shrinks to a few px and lands on the hull.
  const hull = glyphBox(300, 400, 20);
  const y = startTagCentreY(300, 396, pill, hull);
  assert.equal(y, hull.top - START_TAG_GAP_PX - pill.height / 2);
  const tag = { left: 270, right: 330, top: y - 10, bottom: y + 10 };
  assert.ok(!boxesIntersect(tag, hull), 'moved tag does not cover the vehicle');
  // A vehicle to the side does not move it.
  assert.equal(startTagCentreY(300, 396, pill, glyphBox(500, 400, 20)), 396);
});

test('ferry and transit grow when zoomed out like the boat, never shrinking below their tuned size', () => {
  for (const scale of [boatZoomScale, ferryZoomScale, transitZoomScale]) {
    assert.equal(scale(0.65), 1, 'default zoom: tuned size');
    assert.equal(scale(1.3), 1, 'zoomed in: never smaller');
    assert.ok(scale(0.3) > 1.4, 'zoomed out: grown');
    assert.equal(scale(0.1), VEHICLE_ZOOM_MAX_SCALE, 'slider minimum: capped');
  }
});

test('the START tag goes once the rider is 50 m on or a question is up, and returns for a new start (d18eca)', () => {
  const ppm = 3, start = { x: 1000, y: 2000 };
  const latch = new StartTagLatch();
  assert.equal(latch.visible(start, { x: 1000, y: 2000 }, false, ppm), true);
  assert.equal(latch.visible(start, { x: 1000 + 49 * ppm, y: 2000 }, false, ppm), true);
  assert.equal(latch.visible(start, { x: 1000 + 51 * ppm, y: 2000 }, false, ppm), false);
  // Riding back to the start does not bring it back.
  assert.equal(latch.visible(start, { x: 1000, y: 2000 }, false, ppm), false);
  // A new ride's start does.
  const next = { x: 5000, y: 5000 };
  assert.equal(latch.visible(next, { x: 5000, y: 5000 }, false, ppm), true);
  // The first question hides it even at the start.
  assert.equal(latch.visible(next, { x: 5000, y: 5000 }, true, ppm), false);
  assert.equal(latch.visible(next, { x: 5000, y: 5000 }, false, ppm), false);
  // No rider yet: still shown.
  assert.equal(new StartTagLatch().visible(start, null, false, ppm), true);
  assert.equal(START_TAG_HIDE_M, 50);
});

test('a label anchor behind the camera or past the far plane is off view (d18eca)', () => {
  // A chase view, pitched 60°, looking north from the Nassaukade.
  const cam = new EngineCamera(() => ({ width: 800, height: 600 }), { center: [4.8737, 52.3707], zoom: 17.5, pitch: 60, bearing: 0 });
  const range = cam.depthRange();
  assert.ok(range.near > 0 && range.far > range.near);
  const ahead = cam.project([4.8737, 52.3712]);
  assert.equal(anchorInView(ahead.depth, range), true);
  // 400 m south, behind the eye: projects mirrored, above the horizon.
  const behind = cam.project([4.8737, 52.3671]);
  assert.ok(behind.depth < 0);
  assert.equal(anchorInView(behind.depth, range), false);
  // Far beyond the visible ground.
  const far = cam.project([4.8737, 52.60]);
  assert.equal(anchorInView(far.depth, { near: range.near, far: Math.min(range.far, 5000) }), false);
  assert.equal(anchorInView(Number.NaN, range), false);
});

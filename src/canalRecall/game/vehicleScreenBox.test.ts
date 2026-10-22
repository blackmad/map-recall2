// node --import tsx --test src/canalRecall/game/vehicleScreenBox.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxesIntersect, glyphBox, multiplyMat4, projectLocalBox, startTagCentreY, START_TAG_GAP_PX } from './vehicleScreenBox.ts';
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

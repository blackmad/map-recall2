import test from 'node:test';
import assert from 'node:assert/strict';
import { ViewResidency, containsBox, padBox } from './viewResidency';

const view = { west: 4.88, south: 52.37, east: 4.89, north: 52.375 };
const shift = (dx: number, dy = 0) => ({ west: view.west + dx, east: view.east + dx, south: view.south + dy, north: view.north + dy });

test('padBox grows by span fraction plus metres', () => {
  const padded = padBox(view, 0.25, 0);
  assert.ok(Math.abs(padded.west - (view.west - 0.0025)) < 1e-12);
  assert.ok(Math.abs(padded.north - (view.north + 0.00125)) < 1e-12);
  const metres = padBox(view, 0, 111.32);
  assert.ok(Math.abs(metres.north - view.north - 0.001) < 1e-9);
  assert.ok(metres.east - view.east > 0.001, 'longitude margin widens with latitude');
});

test('containsBox', () => {
  assert.ok(containsBox(padBox(view, 0.1), view));
  assert.ok(!containsBox(view, padBox(view, 0.1)));
});

test('a small pan reuses the build, leaving the padded area rebuilds', () => {
  const residency = new ViewResidency(0.25, 0);
  assert.ok(residency.needsRebuild(view, 'a'));
  residency.built(view, 'a');
  assert.ok(!residency.needsRebuild(view, 'a'));
  assert.ok(!residency.needsRebuild(shift(0.002), 'a'), 'pan within the margin');
  assert.ok(residency.needsRebuild(shift(0.003), 'a'), 'pan beyond the margin');
  assert.ok(residency.needsRebuild(view, 'b'), 'changed inputs');
  residency.invalidate();
  assert.ok(residency.needsRebuild(view, 'a'));
});

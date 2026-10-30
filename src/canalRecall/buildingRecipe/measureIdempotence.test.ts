import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {sameMeasuredIntent, settledShape, stableJson} from './measureWriteback.ts';
import type {LargeBuildingIntent} from './intent.ts';

// GitHub #127: measure.ts --write run twice on Pilotenstraat 103794 drifted walls[2]'s window shape (PASS 0.39 -> FAIL 0.43
// glazing vs photo 0.41); a second run on the same crops and intent must write nothing
const fx = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/measure-idempotence-pand-103794.json'), 'utf8'));

test('a group measured before from the same crops keeps its window shape when nothing else moves', () => {
  const patch = {palette: {...fx.wall.palette}, windowShape: fx.secondRunWindowShape, baysPerStorey: fx.wall.baysPerStorey};
  assert.equal(settledShape(fx.wall, patch, {measuredBefore: true, sources: fx.intent.sources, crops: fx.sources}), true);
});

test('the window shape is re-measured when the crops, the measured groups or another proposed field change', () => {
  const patch = {palette: {...fx.wall.palette}, windowShape: fx.secondRunWindowShape, baysPerStorey: fx.wall.baysPerStorey};
  assert.equal(settledShape(fx.wall, patch, {measuredBefore: false, sources: fx.intent.sources, crops: fx.sources}), false, 'not measured before');
  const newCrop = fx.sources.map((s: {sha256?: string}, i: number) => (i ? s : {...s, sha256: 'f'.repeat(64)}));
  assert.equal(settledShape(fx.wall, patch, {measuredBefore: true, sources: fx.intent.sources, crops: newCrop}), false, 'a re-archived crop');
  assert.equal(settledShape(fx.wall, {...patch, system: 'ribbon-windows'}, {measuredBefore: true, sources: fx.intent.sources, crops: fx.sources}), false, 'a new system re-folds the shape');
  assert.equal(settledShape(fx.wall, {...patch, baysPerStorey: 25}, {measuredBefore: true, sources: fx.intent.sources, crops: fx.sources}), false, 'a new bay count');
  assert.equal(settledShape({...fx.wall, windowShape: undefined}, patch, {measuredBefore: true, sources: fx.intent.sources, crops: fx.sources}), false, 'no shape yet');
});

test('a second run that changes nothing but the measurement record is the same intent (no write)', () => {
  const prev: LargeBuildingIntent = fx.intent;
  const next: LargeBuildingIntent = structuredClone(prev);
  next.measured = {...next.measured!, date: '2027-01-01'};
  next.notes = (next.notes ?? []).map(t => (t.startsWith('Measured ') ? 'Measured 2027-01-01 (measure.ts, evidence in measured.json): groups 0, 1, 2, 3, 4, 7 take the photo\'s wall colour.' : t));
  // key order is not content
  next.walls[2] = JSON.parse(stableJson(next.walls[2]));
  assert.equal(sameMeasuredIntent(prev, next), true);
  const moved = structuredClone(prev);
  moved.walls[2].windowShape = fx.secondRunWindowShape;
  assert.equal(sameMeasuredIntent(prev, moved), false);
  const grouped = structuredClone(prev);
  grouped.measured = {...grouped.measured!, groups: [0, 1, 2]};
  assert.equal(sameMeasuredIntent(prev, grouped), false);
});

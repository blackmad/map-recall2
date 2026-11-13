// Lane 1 step d (option c): window units placed on measured boxes. The unit's window lands exactly on each box, the
// wall pieces tile the rest of the region with no overlap, and a stretch past the cap or overlapping boxes keep the grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interimBoxes, nearestUnit, placeOnBoxes, STRETCH_CAP, type WindowUnit } from './boxPlacement.js';
import { cellUnit } from './boxCells.js';
import { BAY_ENTRIES } from '../bayLook.js';

const unit: WindowUnit = { aspect: 0.6, margin: { l: 0.1, r: 0.1, t: 0.1, b: 0.2 }, uv: { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.8 } };
const region = { lengthM: 6, z0: 3.5, z1: 12 };

test('each box gets the unit window on it, the uv crop maps window to box', () => {
  const boxes = interimBoxes([{ sillM: 4, headM: 6 }, { sillM: 7, headM: 9 }], 3, 6, 0.6);
  const p = placeOnBoxes(boxes, unit, region)!;
  assert.ok(p);
  assert.equal(p.windows.length, 6);
  for (const w of p.windows) {
    const width = w.box.a1 - w.box.a0, h = w.box.headM - w.box.sillM;
    // Window edges (box) sit at the unit's window edges inside the crop.
    const uAt = (a: number) => w.u0 + (w.u1 - w.u0) * (a - w.a0) / (w.a1 - w.a0);
    assert.ok(Math.abs(uAt(w.box.a0) - (0.1 + 0.3 * 0.1 / 1.2)) < 1e-9);
    assert.ok(Math.abs(w.z0 - (w.box.sillM - 0.2 * h)) < 1e-9 && Math.abs(w.a1 - (w.box.a1 + 0.1 * width)) < 1e-9);
  }
});

test('windows plus walls tile the region exactly once', () => {
  const p = placeOnBoxes(interimBoxes([{ sillM: 4, headM: 6 }, { sillM: 7, headM: 9 }], 3, 6, 0.6), unit, region)!;
  const area = [...p.windows, ...p.walls].reduce((s, r) => s + (r.a1 - r.a0) * (r.z1 - r.z0), 0);
  assert.ok(Math.abs(area - 6 * 8.5) < 1e-6, `area ${area}`);
  // No two pieces overlap (sample a grid).
  for (let a = 0.05; a < 6; a += 0.1) for (let z = 3.55; z < 12; z += 0.1) {
    const n = [...p.windows, ...p.walls].filter(r => a > r.a0 && a < r.a1 && z > r.z0 && z < r.z1).length;
    assert.ok(n <= 1, `overlap at ${a},${z}`);
  }
});

test('stretch past the cap, overlap or a box below the region keep the grid', () => {
  assert.equal(placeOnBoxes([{ a0: 0.5, a1: 5.5, sillM: 4, headM: 5 }], unit, region), null);
  assert.equal(placeOnBoxes([{ a0: 1, a1: 2.2, sillM: 4, headM: 6 }, { a0: 2.1, a1: 3.3, sillM: 4, headM: 6 }], unit, region), null);
  assert.equal(placeOnBoxes([{ a0: 1, a1: 2.2, sillM: 3, headM: 5 }], unit, region), null);
  assert.ok(STRETCH_CAP > 1);
});

test('nearestUnit picks the unit whose aspect fits the boxes', () => {
  const boxes = [{ a0: 0, a1: 1, sillM: 0, headM: 2 }];
  assert.equal(nearestUnit(boxes, [{ aspect: 1.2 }, { aspect: 0.55 }, { aspect: 0.3 }]), 1);
  assert.equal(nearestUnit(boxes, [{ aspect: 3 }]), -1);
});

test('an upper bay cell gives a unit whose crop stays inside the cell', () => {
  const layer = BAY_ENTRIES.findIndex(e => e.kind === 'upper');
  const u = cellUnit(layer)!;
  assert.ok(u && u.aspect > 0.2 && u.aspect < 2);
  assert.ok(u.uv.u0 > 0 && u.uv.u1 < 1 && u.uv.v0 > 0 && u.uv.v1 < 1 && u.uv.v1 > u.uv.v0);
});

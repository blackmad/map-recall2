// H1c (#350): odd bay counts on two-window cells, drawn as half-cell axis units (streetFacadeRendering.ts axisUnitPlan).
import assert from 'node:assert/strict';
import test from 'node:test';
import { axisUnitOpenings, axisUnitPlan, oddAxisCellsEnabled, AXIS_UNIT_U, DOOR_UNIT_CLEARANCE, MIN_AXIS_PITCH_M } from './streetFacadeRendering.js';
import { layoutWall } from './facadeLayout.js';
import { STYLE_DIMS } from './facadeCells.js';
import type { Openings } from './facadeOpenings.js';

const two = (): Openings => ({
  upper: { axes: [0.25, 0.75], width: 0.22, sill: 0.14, head: 0.8 },
  ground: { axes: [0.25, 0.75], width: 0.2, sill: 0.29, head: 0.86 },
  doorWindow: { axes: [0.75], width: 0.2, sill: 0.29, head: 0.86 },
  door: { axis: 0.27, width: 0.3, bottom: 0, top: 0.9, fanlight: true },
});
const fallback = { bay: 1, storey: 1, ground: 1 };

test('a two-window cell halves into one-window units with the same sill and head', () => {
  const u = axisUnitOpenings(two())!;
  assert.deepEqual(u.upper, { axes: [0.5], width: 0.44, sill: 0.14, head: 0.8 });
  assert.deepEqual(u.ground, { axes: [0.5], width: 0.4, sill: 0.29, head: 0.86 });
  assert.equal(u.doorWindow, null);
  // The door's half-cell sample holds the whole door and stays clear of the side window (0.65..0.85) by the clearance.
  assert.ok(u.doorU <= 0.27 - 0.15 && u.doorU + AXIS_UNIT_U >= 0.27 + 0.15);
  assert.ok(u.doorU + AXIS_UNIT_U <= 0.65 - DOOR_UNIT_CLEARANCE + 1e-9);
  assert.ok(u.door.axis - u.door.width / 2 >= 0 && u.door.axis + u.door.width / 2 <= 1);
  assert.equal(u.door.width, 0.6);
});

test('cells that cannot be halved keep whole cells', () => {
  assert.equal(axisUnitOpenings({ ...two(), upper: { axes: [0.3, 0.7], width: 0.22, sill: 0.14, head: 0.8 } }), null);
  assert.equal(axisUnitOpenings({ ...two(), ribbon: true }), null);
  assert.equal(axisUnitOpenings({ ...two(), upper: { axes: [0.25, 0.75], width: 0.22, widths: [0.2, 0.3], sill: 0.14, head: 0.8 } }), null);
  // A door too wide for a half cell clear of its side window.
  assert.equal(axisUnitOpenings({ ...two(), door: { axis: 0.4, width: 0.45, bottom: 0, top: 0.9, fanlight: false } }), null);
  assert.equal(axisUnitOpenings(undefined), null);
});

test('an odd stated count on a two-window cell lays exactly that many units', () => {
  for (const [bays, len] of [[3, 5.6], [1, 1.9], [5, 9.5]] as const) {
    const plan = axisUnitPlan({ bays, axesPerCell: 2 }, two(), 'canal', len, fallback)!;
    assert.ok(plan, `bays ${bays}`);
    assert.equal(plan.units, bays);
    const layout = layoutWall('canal', len, 12, 7, true, plan.scale)!;
    assert.equal(layout.bays, bays);
    // layoutWall puts no door on a wall under 2.4 m, whatever its cells.
    assert.equal(layout.doorBays.length >= 1, len >= 2.4, 'a unit still carries the door');
  }
});

test('even counts, one-window cells, unmeasured pitches and the kill switch keep whole cells', () => {
  assert.equal(axisUnitPlan({ bays: 2, axesPerCell: 2 }, two(), 'canal', 5.6, fallback), null);
  assert.equal(axisUnitPlan({ bays: 3, axesPerCell: 1 }, two(), 'canal', 5.6, fallback), null);
  assert.equal(axisUnitPlan(undefined, two(), 'canal', 5.6, fallback), null);
  assert.equal(axisUnitPlan({ bays: 3, axesPerCell: 2 }, two(), 'canal', 3 * (MIN_AXIS_PITCH_M - 0.05), fallback), null);
  assert.equal(axisUnitPlan({ bays: 3, axesPerCell: 2 }, two(), 'canal', 3 * STYLE_DIMS.canal.bay * 2, fallback), null);
  process.env.ODD_AXIS_CELLS = '0';
  try { assert.equal(axisUnitPlan({ bays: 3, axesPerCell: 2 }, two(), 'canal', 5.6, fallback), null); }
  finally { delete process.env.ODD_AXIS_CELLS; }
  assert.equal(oddAxisCellsEnabled('?oddAxisCells=0'), false);
  assert.equal(oddAxisCellsEnabled('?x=1'), true);
});

test('doorMinBayM absent is the old 2.4 m door rule', () => {
  for (const len of [2.3, 4.6, 5.5, 7.2, 11]) for (const style of ['canal', 'c19'] as const) {
    const scale = { bay: 0.8, storey: 1, ground: 1 };
    assert.deepEqual(layoutWall(style, len, 12, 3, true, scale), layoutWall(style, len, 12, 3, true, { ...scale, doorMinBayM: 2.4 }));
  }
  const narrow = { bay: 1.8 / STYLE_DIMS.canal.bay, storey: 1, ground: 1 };
  assert.equal(layoutWall('canal', 5.4, 12, 3, true, narrow)!.doorBays.length, 0);
  assert.ok(layoutWall('canal', 5.4, 12, 3, true, { ...narrow, doorMinBayM: 1.2 })!.doorBays.length > 0);
});

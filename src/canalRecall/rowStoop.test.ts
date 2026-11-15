// House rows: a stated stoop (row-stoop) on the canal belt. Named regressions from lane D's belt sheets: Herengracht 130
// (0363100012177006, centre door, 5 bays, stoop-and-windows), 132 (0363100012177007, door index 2 of 6, drawn as several
// walls: one stoop per wall), 162 (0363100012167646, left door, stoop).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExtraContext } from './facadeExtras.js';
import { stoopDoor, stoopHiddenWindows } from './facadeOrnaments.js';
import { stoopAt } from './threeBuildingMesh.js';

const wall = (over: Partial<ExtraContext> = {}): ExtraContext => ({
  id: 'h130', style: 'canal', period: 'canal', wallKey: 'front',
  f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 10 }, base: 0, top: 14,
  layout: { bays: 5, bayWidthM: 2, groundM: 2.4, storeys: 3, storeyM: 3.2, doorBays: [] },
  wallHex: '#6b4a3c', accentHex: '#ffffff', groundLevel: true, streetSide: true,
  openings: {
    upper: { axes: [0.5], width: 0.45, sill: 0.25, head: 0.85 },
    ground: { axes: [0.5], width: 0.45, sill: 0.3, head: 0.8 },
    doorWindow: null,
    door: { axis: 0.5, width: 0.4, bottom: 0, top: 0.8, fanlight: false },
  },
  ...over,
} as ExtraContext);

test('stoopAt: the read door index as seen, else its side; mirrored on a right-to-left wall; per wall of the run', () => {
  assert.deepEqual(stoopAt({ side: 'centre', index: 2, bays: 5 }, true, 10, 0), { at: 5, exact: true });
  assert.equal(stoopAt({ side: 'centre', index: 2, bays: 6 }, true, 12, 0)!.at, 5);
  assert.ok(Math.abs(stoopAt({ side: 'centre', index: 2, bays: 6 }, false, 12, 0)!.at - 7) < 1e-9);
  // Herengracht 132 as two walls (6 m + 6 m): the door is on the first wall only.
  assert.ok(stoopAt({ side: 'centre', index: 2, bays: 6 }, true, 12, 6)!.at < 0);
  const left = stoopAt({ side: 'left' }, true, 10, 0)!;
  assert.ok(Math.abs(left.at - 0.01) < 1e-9 && !left.exact);
  assert.equal(stoopAt(undefined, true, 10, 0), undefined);
});

test('stoopDoor: at the bel-etage window nearest the read door; a traced window when the record traced them', () => {
  const grid = stoopDoor(wall({ rowDress: { stoop: { end: 'centre', at: 3.1 } } }))!;
  assert.equal(grid.x, 3);
  // A read door index is the place itself (132: the painted cells draw 6 windows where the grid has 4 spans).
  assert.equal(stoopDoor(wall({ rowDress: { stoop: { end: 'centre', at: 4.2, exact: true } } }))!.x, 4.2);
  const traced = stoopDoor(wall({ rowDress: { stoop: { end: 'centre', at: 5 }, windows: [{ x0: 1.2, x1: 2.1, z0: 3, z1: 5, storey: 1 }, { x0: 4.7, x1: 5.6, z0: 3, z1: 5, storey: 1 }, { x0: 4.7, x1: 5.6, z0: 6, z1: 8, storey: 2 }] } }))!;
  assert.ok(Math.abs(traced.x - 5.15) < 1e-9 && traced.z1 === 5, JSON.stringify(traced));
  // No read place: the stated end, as before (Weteringschans).
  assert.equal(stoopDoor(wall({ rowDress: { stoop: { end: 'start' } } }))!.x, 1);
});

test('stoopHiddenWindows: the souterrain cell behind the flight is walled to the floor, a shutter past the cheeks', () => {
  const hid = stoopHiddenWindows(wall(), 4.2, 5.8);
  assert.equal(hid.length, 1);
  assert.ok(hid[0][0] <= 3.8 + 1e-9 && hid[0][1] >= 6.2 - 1e-9 && hid[0][2] === 0 && hid[0][3] < 2.4);
  // No souterrain windows (a stoop over a plain basement wall): nothing to wall over.
  assert.equal(stoopHiddenWindows(wall({ openings: { upper: { axes: [0.5], width: 0.45, sill: 0.25, head: 0.85 }, ground: null, doorWindow: null, door: { axis: 0.5, width: 0.4, bottom: 0, top: 0.8, fanlight: false } } } as never), 4.2, 5.8).length, 0);
});

test('a stated stoop over a full ground storey (Herengracht 162, floor 4.4 m up) is a short flight to a ground-storey door', () => {
  const tall = wall({ layout: { bays: 3, bayWidthM: 2.45, groundM: 4.4, storeys: 3, storeyM: 3.2, doorBays: [] }, f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 7.35 } });
  const d = stoopDoor({ ...tall, rowDress: { stoop: { end: 'start', at: 1.226, exact: true } } })!;
  assert.equal(d.z0, 0.95);
  assert.ok(d.z1 < 4.4 && d.z1 > 3, JSON.stringify(d));
  // A souterrain stoop keeps its door at the bel-etage floor.
  assert.equal(stoopDoor(wall({ rowDress: { stoop: { end: 'centre', at: 5, exact: true } } }))!.z0, 2.4);
});

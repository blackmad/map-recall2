// House rows: a stated stoop (row-stoop) on the canal belt. Named regressions from lane D's belt sheets: Herengracht 130
// (0363100012177006, centre door, 5 bays, stoop-and-windows), 132 (0363100012177007, door index 2 of 6, drawn as several
// walls: one stoop per wall), 162 (0363100012167646, left door, stoop).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExtraContext } from './facadeExtras.js';
import { ORNAMENT_COMPONENTS, ROW_DOORCASE, STOOP_PARALLEL, stoopDoor, stoopFlights, stoopHiddenWindows } from './facadeOrnaments.js';
import { ExtraSink } from './facadeExtraCore.js';
import { rowDoorBay, stoopAt } from './threeBuildingMesh.js';
import { openingsOf } from './facadeOrnaments.js';

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

test('stoopFlights: a double stoop fits both flights at one tread; else one flight to the roomier side; else none', () => {
  const d = { x: 5, hw: 0.5 };
  const dbl = stoopFlights(10, d, 8, 'double')!;
  assert.deepEqual(dbl.flights.map(f => f.dir), [-1, 1]);
  assert.equal(dbl.flights[0].tread, dbl.flights[1].tread);
  // Door near the right end (Herengracht 148): only the left flight fits.
  const one = stoopFlights(10, { x: 9, hw: 0.5 }, 8, 'double')!;
  assert.deepEqual(one.flights.map(f => f.dir), [-1]);
  assert.equal(stoopFlights(10, d, 8, 'side')!.flights.length, 1);
  assert.equal(stoopFlights(2.2, { x: 1.1, hw: 0.5 }, 12, 'side'), null);
});

test('row-stoop: Herengracht 130 double stoop with railings draws flights along the wall and iron; absent form: unchanged', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-stoop')!;
  const run = (stoop: NonNullable<NonNullable<ExtraContext['rowDress']>['stoop']>) => {
    const s = new ExtraSink(100000);
    comp.build(wall({ layout: { bays: 5, bayWidthM: 2, groundM: 1.6, storeys: 3, storeyM: 3.2, doorBays: [], souterrain: true } as ExtraContext['layout'], rowDress: { stoop } }), s, 0);
    return s.tris;
  };
  const plain = run({ end: 'centre', at: 5, exact: true }), dbl = run({ end: 'centre', at: 5, exact: true, form: 'double', railing: true });
  assert.ok(plain.length > 0 && dbl.length > plain.length);
  const iron = dbl.filter(t => (t as { hex?: string }).hex === STOOP_PARALLEL.iron);
  assert.ok(iron.length > 20, 'railings drawn');
  const straightRail = run({ end: 'centre', at: 5, exact: true, railing: true });
  assert.ok(straightRail.some(t => (t as { hex?: string }).hex === STOOP_PARALLEL.iron), 'a straight flight takes the railing too');
});

test('row-stoop: a stated doorcase draws pilasters, an entablature, a pediment and a fanlight; absent: the plain frame', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-stoop')!;
  const run = (stoop: NonNullable<NonNullable<ExtraContext['rowDress']>['stoop']>) => {
    const s = new ExtraSink(100000);
    comp.build(wall({ layout: { bays: 5, bayWidthM: 2, groundM: 1.6, storeys: 3, storeyM: 3.2, doorBays: [], souterrain: true } as ExtraContext['layout'], rowDress: { stoop } }), s, 0);
    return s.tris as Array<{ hex?: string; p: number[][] }>;
  };
  const plain = run({ end: 'centre', at: 5, exact: true, steps: false });
  const ent = run({ end: 'centre', at: 5, exact: true, steps: false, doorcase: { material: 'stone' } });
  const ped = run({ end: 'centre', at: 5, exact: true, steps: false, doorcase: { material: 'stone', top: 'pediment' } });
  assert.ok(ent.length > plain.length && ped.length > ent.length);
  assert.ok(ent.some(t => t.hex === ROW_DOORCASE.glass), 'a fanlight');
  assert.ok(!run({ end: 'centre', at: 5, exact: true, steps: false, doorcase: { material: 'stone', fanlight: false } }).some(t => t.hex === ROW_DOORCASE.glass));
  assert.ok(ent.some(t => t.hex === ROW_DOORCASE.stone) && !plain.some(t => t.hex === ROW_DOORCASE.stone));
});

test('row-doorcase: a stated doorcase on the ground street door (Herengracht 144); absent: nothing', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-doorcase')!;
  const run = (rowDress: ExtraContext['rowDress']) => {
    const s = new ExtraSink(100000);
    comp.build(wall({ layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3.2, doorBays: [2] } as ExtraContext['layout'], ...(rowDress ? { rowDress } : {}) }), s, 0);
    return s.tris as Array<{ hex?: string }>;
  };
  assert.equal(run(undefined).length, 0);
  const t = run({ doorcase: { material: 'timber' } });
  assert.ok(t.length > 0 && t.some(x => x.hex === ROW_DOORCASE.glass));
});

test('row-doorcase: diamond fanlight tracery, a black leaf, and pilasters standing on the plinth strip (Herengracht 144)', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-doorcase')!;
  const run = (doorcase: NonNullable<ExtraContext['rowDress']>['doorcase']) => {
    const s = new ExtraSink(100000);
    const c = wall({ layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3.2, doorBays: [2] } as ExtraContext['layout'], rowDress: { doorcase } });
    comp.build(c, s, 0);
    return { c, t: s.tris as Array<{ hex?: string; p?: number[][] }> };
  };
  const plain = run({ material: 'timber' }).t, diamond = run({ material: 'timber', fanlight: 'diamond' }).t;
  assert.notDeepEqual(diamond, plain);
  const black = run({ material: 'timber', door: 'black' }).t;
  assert.ok(black.some(x => x.hex === ROW_DOORCASE.black) && !plain.some(x => x.hex === ROW_DOORCASE.black));
});

test('row-doorcase: a ground-storey surround (span ground) frames the door and windows under one entablature (Herengracht 142); oval fanlight', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-doorcase')!;
  const run = (doorcase: NonNullable<ExtraContext['rowDress']>['doorcase']) => {
    const s = new ExtraSink(100000);
    comp.build(wall({ layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3.2, doorBays: [0] } as ExtraContext['layout'], rowDress: { doorcase } }), s, 0);
    return s.tris as Array<{ hex?: string; p: number[][] }>;
  };
  const own = run({ material: 'timber' }), ground = run({ material: 'timber', span: 'ground' });
  const xsOf = (t: typeof own) => t.filter(x => x.hex === '#efece4').flatMap(x => x.p.map(p => p[0]));
  // The entablature reaches the far end of the 6 m front; the door's own case stays by the door.
  const reach = (t: typeof own) => Math.max(...xsOf(t)) - Math.min(...xsOf(t));
  assert.ok(reach(ground) > reach(own) + 2, `${reach(ground)} vs ${reach(own)}`);
  assert.notDeepEqual(run({ material: 'timber', fanlight: 'oval' }), own);
  assert.notDeepEqual(run({ material: 'timber', fanlight: 'oval-spoked' }), run({ material: 'timber', fanlight: 'oval' }));
});

test('row-doorcase: a ground frame (span frame, Herengracht 279) posts across the front with an entresol rail; no door pilasters', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-doorcase')!;
  const run = (doorcase: NonNullable<ExtraContext['rowDress']>['doorcase']) => {
    const s = new ExtraSink(100000);
    comp.build(wall({ layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3.2, doorBays: [0] } as ExtraContext['layout'], rowDress: { doorcase } }), s, 0);
    return s.tris as Array<{ hex?: string; p: number[][] }>;
  };
  const own = run({ material: 'timber' }), frame = run({ material: 'timber', span: 'frame' });
  const white = (t: typeof own) => t.filter(x => x.hex === '#efece4');
  const xs = white(frame).flatMap(x => x.p.map(p => p[0]));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 5.5, 'the frame spans the 6 m front');
  // The entresol rail: a white piece spanning the front at one height inside the storey.
  const rail = white(frame).filter(x => { const xx = x.p.map(p => p[0]), zz = x.p.map(p => p[2]); return Math.max(...xx) - Math.min(...xx) > 5.5 && Math.max(...zz) - Math.min(...zz) < 0.2 && Math.max(...zz) < 3; });
  assert.ok(rail.length > 0, 'an entresol rail under the head beam');
  assert.notDeepEqual(run({ material: 'timber', span: 'frame', entresol: 0.7 }), frame);
});

test('row-cornice: a stated timber cornice draws attic lights, supports and a centre; absent: the kind as today (Herengracht 174, 248)', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-cornice')!;
  const run = (rowDress: ExtraContext['rowDress']) => {
    const s = new ExtraSink(100000);
    comp.build(wall({ top: 16, layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 4, storeyM: 3.0, doorBays: [0] } as ExtraContext['layout'], ...(rowDress ? { rowDress } : {}) }), s, 0);
    return s.tris as Array<{ hex?: string; p: number[][] }>;
  };
  const today = run({ cornice: 'heavy' });
  assert.deepEqual(run({ cornice: 'heavy' }), today);
  const lights = run({ cornice: 'heavy', corniceDress: { paint: 'cream', frieze: 'attic-lights', supports: 'modillions' } });
  assert.ok(lights.some(t => t.hex === ROW_DOORCASE.glass) && !today.some(t => t.hex === ROW_DOORCASE.glass));
  const ped = run({ cornice: 'heavy', corniceDress: { frieze: 'plain', centre: 'pediment' } });
  assert.ok(Math.max(...ped.flatMap(t => t.p.map(p => p[2]))) > 16.3, 'pediment over the corona');
  const bal = run({ cornice: 'heavy', corniceDress: { centre: 'balustrade' } });
  assert.ok(Math.max(...bal.flatMap(t => t.p.map(p => p[2]))) > 16.5, 'balustrade on the corona');
});

test('rowDoorBay: a read door on the other side of its bay from the preset door mirrors the bay (Herengracht 144, one bay)', () => {
  // Herengracht 144: doorIndex 1 of 2 ground openings, a 4.3 m front of one layout bay, the canal preset's door at 0.3.
  assert.deepEqual(rowDoorBay({ side: 'right', index: 1, bays: 2 }, true, 1, 0.3), { bay: 0, mirror: true });
  assert.deepEqual(rowDoorBay({ side: 'right', index: 1, bays: 2 }, false, 1, 0.3), { bay: 0, mirror: false });
  assert.deepEqual(rowDoorBay({ side: 'left', index: 0, bays: 2 }, true, 1, 0.3), { bay: 0, mirror: false });
  assert.deepEqual(rowDoorBay({ side: 'right' }, true, 1, 0.3), { bay: 0, mirror: true });
  assert.deepEqual(rowDoorBay({ side: 'left' }, true, 3, 0.3), { bay: 0, mirror: false });
  assert.deepEqual(rowDoorBay({ side: 'centre' }, true, 3, 0.3), { bay: 1, mirror: false });
});

test('openingsOf: a mirrored door bay swaps the door and its side window; absent: the preset as is', () => {
  const layout = { bays: 1, bayWidthM: 4.3, groundM: 3.4, storeys: 3, storeyM: 3, doorBays: [0] };
  const c = { id: 'h144', style: 'canal', layout } as unknown as ExtraContext;
  const plain = openingsOf(c), mirrored = openingsOf({ ...c, layout: { ...layout, doorMirror: true } } as unknown as ExtraContext);
  assert.ok(Math.abs(mirrored.door.axis - (1 - plain.door.axis)) < 1e-9);
  assert.deepEqual(mirrored.doorWindow?.axes, plain.doorWindow?.axes.map(a => 1 - a));
  assert.deepEqual(mirrored.upper, plain.upper);
});

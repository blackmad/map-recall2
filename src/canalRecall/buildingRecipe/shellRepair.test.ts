import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bagRoofPieces, clampSpikes, hostTriangles, openPieces, prepareShell, repairHost, REPAIR_SURFACE_BASE} from './shellRepair.ts';
import type {BuildingFacts} from './facts.ts';
import type {V3} from '../blockBuilding/mesh.ts';

// Synthetic shells in the kit frame (X east, Y up, Z south). A box 10 x 6 m, 9 m tall.
const W = 10, D = 6, H = 9;
const wallRing = (a: [number, number], b: [number, number], top: number, bottom = 0): V3[] => [[a[0], bottom, a[1]], [b[0], bottom, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]];
const roofRing = (x0: number, x1: number, z0: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
const corners: [number, number][] = [[0, 0], [W, 0], [W, D], [0, D]];
const boxWalls = (top = H) => corners.map((c, i) => [wallRing(c, corners[(i + 1) % 4], top)]);
const open = (walls: V3[][][], roofs: V3[][][]) => repairHost(hostTriangles(walls, roofs));

test('a sound box has no open edge and gets no patch', () => {
  const r = open(boxWalls(), [[roofRing(0, W, 0, D, H)]]);
  assert.equal(r.openBeforeM, 0);
  assert.equal(r.patches.length, 0);
});

test('a missing wall is the roof edge extruded to the ground: one strip, closed', () => {
  const walls = boxWalls().slice(0, 3);
  const r = open(walls, [[roofRing(0, W, 0, D, H)]]);
  assert.ok(r.openBeforeM > 2 * H + D - 0.1, `open before ${r.openBeforeM}`);
  assert.equal(r.patches.filter(p => p.kind === 'strip').length, 1);
  const strip = r.patches[0].ring;
  assert.deepEqual([Math.min(...strip.map(p => p[1])), Math.max(...strip.map(p => p[1]))], [0, H]);
  assert.ok(r.openAfterM < 0.05, `open after ${r.openAfterM}`);
});

test('a missing step wall closes between the two roofs, not down to the ground', () => {
  // west half 9 m, east half 5 m; the step wall at x = 5 (5 m..9 m) is missing
  const walls = [
    [wallRing([0, 0], [5, 0], 9)], [wallRing([5, 0], [10, 0], 5)], [wallRing([10, 0], [10, D], 5)], [wallRing([10, D], [5, D], 5)], [wallRing([5, D], [0, D], 9)], [wallRing([0, D], [0, 0], 9)],
  ];
  const r = open(walls, [[roofRing(0, 5, 0, D, 9)], [roofRing(5, 10, 0, D, 5)]]);
  // the step is a closed vertical loop (roof edges + the walls' ends): a wall cap, 5..9 m
  assert.equal(r.patches.length, 1);
  assert.equal(r.patches[0].target, 'wall');
  assert.equal(Math.min(...r.patches[0].ring.map(p => p[1])), 5);
  assert.ok(r.openAfterM < 0.05, `open after ${r.openAfterM}`);
});

test('a step wall missing with its neighbours: the strip from the high roof edge stops on the low roof', () => {
  // west part 9 m over x 0..5, east part 5 m over x 5..10; the north wall of the east part and the step wall are missing
  const walls = [
    [wallRing([0, 0], [5, 0], 9)], [wallRing([10, 0], [10, D], 5)], [wallRing([10, D], [5, D], 5)], [wallRing([5, D], [0, D], 9)], [wallRing([0, D], [0, 0], 9)],
  ];
  const r = open(walls, [[roofRing(0, 5, 0, D, 9)], [roofRing(5, 10, 0, D, 5)]]);
  const step = r.patches.filter(p => p.ring.every(q => Math.abs(q[0] - 5) < 1e-6));
  assert.equal(Math.min(...step.flatMap(p => p.ring.map(q => q[1]))), 5);
  assert.ok(r.openAfterM < 0.05, `open after ${r.openAfterM}: ${JSON.stringify(r.leftover)}`);
});

test('a wall stopping short of its roof edge gets only the missing band (no double wall)', () => {
  const walls = boxWalls();
  walls[0] = [wallRing([0, 0], [W, 0], H - 1.5)];
  const r = open(walls, [[roofRing(0, W, 0, D, H)]]);
  const strips = r.patches;
  const area = strips.reduce((s, p) => { const ys = p.ring.map(q => q[1]); return s + (Math.max(...ys) - Math.min(...ys)); }, 0);
  assert.ok(strips.length >= 1 && strips.every(p => Math.min(...p.ring.map(q => q[1])) >= H - 1.5 - 1e-6), JSON.stringify(strips.map(p => p.ring)));
  assert.ok(area > 0);
  assert.ok(r.openAfterM < 0.05, `open after ${r.openAfterM}`);
});

test('a hole in the roof is capped (flat loop), a roof sheet edge is not', () => {
  const roof: V3[][] = [roofRing(0, W, 0, D, H), [[3, H, 2], [3, H, 4], [6, H, 4], [6, H, 2]]];
  const r = open(boxWalls(), [roof]);
  assert.equal(r.patches.filter(p => p.kind === 'cap').length, 1);
  assert.equal(r.patches[0].target, 'roof');
  assert.ok(r.openAfterM < 0.05);
  // a roof slab with no walls at all: its outline is not a hole, every edge gets a strip
  const slab = open([], [[roofRing(0, W, 0, D, H)]]);
  assert.equal(slab.patches.filter(p => p.kind === 'cap').length, 0);
  assert.equal(slab.patches.filter(p => p.kind === 'strip').length, 4);
  assert.ok(slab.openAfterM < 0.05);
});

test('a vertical slit between two walls that miss their corner gets a seam', () => {
  const walls = boxWalls();
  // the east wall stops 0.4 m short of the north-east corner, and its own strip under the roof is there: a slit
  walls[1] = [wallRing([W, 0.4], [W, D], H)];
  walls[0] = [wallRing([0, 0], [W - 0.0, 0], H)];
  const r = open(walls, [[roofRing(0, W, 0, D, H)]]);
  assert.ok(r.openAfterM < 0.05, `open after ${r.openAfterM}: ${JSON.stringify(r.leftover)}`);
});

test('spikes: a wall vertex 7 m over its roof edge drops onto it; sound walls never move', () => {
  const roofs = [[roofRing(0, W, 0, D, H)]];
  const sound = clampSpikes(boxWalls(), roofs);
  assert.equal(sound.clamped, 0);
  const walls = boxWalls();
  walls[0] = [[[0, 0, 0], [W, 0, 0], [W, H + 7, 0], [0, H, 0]]];
  const c = clampSpikes(walls, roofs);
  assert.equal(c.clamped, 1);
  assert.equal(c.walls[0][0][2][1], H);
  // a gable: the apex lies on the rake edges in the wall's plane, so it stays
  const gable: V3[][] = [[[0, 0, 0], [W, 0, 0], [W, H, 0], [W / 2, H + 4, 0], [0, H, 0]]];
  const rakes = [[[[0, H, 0], [W / 2, H + 4, 0], [W / 2, H + 4, D], [0, H, D]] as V3[]], [[[W / 2, H + 4, 0], [W, H, 0], [W, H, D], [W / 2, H + 4, D]] as V3[]]];
  assert.equal(clampSpikes([gable], rakes).clamped, 0);
});

test('footprint bag: the outline is partitioned by the roof planes, uncovered drift takes the nearest plane, walls close it', () => {
  const bag: [number, number][][][] = [[[[0, 0], [20, 0], [20, 10], [0, 10]]]];
  const roofs = [{rings: [roofRing(0, 12, 0, 10, 10)]}, {rings: [roofRing(12, 19, 0, 10, 6)]}];
  const pieces = bagRoofPieces(bag, roofs, 10);
  const area = (r: V3[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[2] - q[0] * p[2]; }, 0) / 2);
  assert.ok(Math.abs(pieces.reduce((s, p) => s + area(p.ring), 0) - 200) < 1e-6, 'pieces tile the outline');
  // the 1 m drift strip east of the low roof (x 19..20) is within 1.5 m of it: same 6 m plane, not the 10 m max
  assert.ok(pieces.filter(p => p.ring.some(q => q[0] > 19.5)).every(p => p.ring.every(q => q[1] === 6)));
  const r = repairHost(hostTriangles([], pieces.map(p => [p.ring])));
  assert.ok(r.openAfterM < 0.3, `open after ${r.openAfterM}`);
  // a part far from any LoD2.2 roof takes the pand's roof max
  const far = bagRoofPieces([[[[0, 0], [30, 0], [30, 10], [0, 10]]]], roofs, 10);
  assert.ok(far.some(p => p.source === 'max' && p.ring.every(q => q[1] === 10)));
});

test('openPieces reports only the open part of a partly seamed edge', () => {
  const walls = boxWalls();
  walls[0] = [wallRing([0, 0], [4, 0], H)];
  const pcs = openPieces(hostTriangles(walls, [[roofRing(0, W, 0, D, H)]]));
  const along = pcs.filter(p => Math.abs(p.a[1] - H) < 1e-6 && Math.abs(p.b[1] - H) < 1e-6).reduce((s, p) => s + Math.abs(p.b[0] - p.a[0]), 0);
  assert.ok(Math.abs(along - 6) < 0.3, `open roof edge ${along}`);
});

// prepareShell on synthetic facts (RD x, y; NAP z), ground at NAP 0.5.
function syntheticFacts(dropWall: boolean, lod22Shift = 0): BuildingFacts {
  const X = 120000, Y = 487000, g = 0.5;
  const rd = (x: number, y: number, z: number) => [X + x, Y + y, z + g];
  const ringCorners: [number, number][] = [[0, 0], [W, 0], [W, D], [0, D]];
  const walls = ringCorners.map((c, i) => {
    const n = ringCorners[(i + 1) % 4];
    return {surface: i + 3, ringsRD: [[rd(c[0] + lod22Shift, c[1], 0), rd(n[0] + lod22Shift, n[1], 0), rd(n[0] + lod22Shift, n[1], H), rd(c[0] + lod22Shift, c[1], H)]], onFootprintEdge: true, areaM2: 1, bearingDeg: 0, bottomM: 0, topM: H};
  }).filter((_, i) => !dropWall || i !== 2);
  const roof = ringCorners.map(([x, y]) => rd(x + lod22Shift, y, H));
  return {
    schemaVersion: 1, pandId: '0363100099999999', source: {threeDBag: '', fetchedAt: '', streets: ''}, attributes: {b3_h_maaiveld: g},
    bagFootprintRD: [ringCorners.map(([x, y]) => [X + x, Y + y] as [number, number])],
    surveyFootprintPolygonsRD: [[ringCorners.map(([x, y]) => [X + x + lod22Shift, Y + y] as [number, number])]],
    roofsRD: [{surfaceId: 'r', vertices: roof, ringsRD: [roof], slopeDeg: 0, areaM2: W * D}],
    heights: {groundNAP: g, roofMinM: H, roofMaxM: H, ridgeM: H, dak50pM: H, dak70pM: H, storeys: 3, builtYear: 1990},
    fronts: [], wallsRD: walls,
  };
}

test('prepareShell: repair patches become wall surfaces from REPAIR_SURFACE_BASE, deterministic, input untouched', () => {
  const facts = syntheticFacts(true), before = JSON.stringify(facts);
  const a = prepareShell(facts, {repair: true, footprint: 'lod22'}), b = prepareShell(facts, {repair: true, footprint: 'lod22'});
  assert.equal(JSON.stringify(facts), before);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.report.openBeforeM > 20 && a.report.openAfterM < 0.05, JSON.stringify(a.report));
  assert.deepEqual(a.report.patches.wallSurfaces, [REPAIR_SURFACE_BASE]);
  const patch = a.facts.wallsRD!.find(w => w.surface === REPAIR_SURFACE_BASE)!;
  assert.ok(patch.onFootprintEdge && Math.abs(patch.topM - H) < 1e-6 && Math.abs(patch.bottomM) < 1e-6);
});

test('prepareShell footprint bag: a shifted LoD2.2 shell is rebuilt on the BAG outline (IoU before/after)', () => {
  const facts = syntheticFacts(false, 3);
  const r = prepareShell(facts, {repair: false, footprint: 'bag'});
  assert.ok(r.report.iouBefore < 0.7, `iou before ${r.report.iouBefore}`);
  assert.ok(r.report.iouAfter > 0.98, `iou after ${r.report.iouAfter}`);
  assert.ok(r.report.openAfterM < 0.3, JSON.stringify(r.report));
  assert.ok(r.facts.wallsRD!.every(w => w.surface >= REPAIR_SURFACE_BASE));
  assert.ok(Math.max(...r.facts.roofsRD.flatMap(x => x.ringsRD[0].map(p => p[2] - 0.5))) <= H + 1e-6);
});

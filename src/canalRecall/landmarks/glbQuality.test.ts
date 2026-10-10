import assert from 'node:assert/strict';
import test from 'node:test';
import {Accessor, Document} from '@gltf-transform/core';
import {soupFromDocument} from '../../../scripts/audit-glb-quality';
import {analyseSoup} from './glbQuality';

type Quad = [number, number, number][];

/** Axis-aligned box as 6 quads (12 triangles), outward CCW; `omit` removes faces by name. */
function boxQuads(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, omit: string[] = []): Record<string, Quad> {
  const f: Record<string, Quad> = {
    top: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    bottom: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    south: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    north: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    east: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    west: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
  };
  for (const o of omit) delete f[o];
  return f;
}

/** Build a GLB document from quad lists via the same path the CLI uses. */
function soup(...quadSets: Record<string, Quad>[]) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const set of quadSets) for (const q of Object.values(set)) {
    const b = pos.length / 3;
    for (const p of q) pos.push(...p);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const doc = new Document();
  const buf = doc.createBuffer();
  const position = doc.createAccessor().setType(Accessor.Type.VEC3).setArray(new Float32Array(pos)).setBuffer(buf);
  const indices = doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(new Uint32Array(idx)).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices);
  const node = doc.createNode('n').setMesh(doc.createMesh('m').addPrimitive(prim));
  doc.createScene().addChild(node);
  return soupFromDocument(doc);
}

// A 10 x 8 x 10 m house on the ground.
const house = (omit: string[] = []) => boxQuads(0, 0, 0, 10, 8, 10, omit);

test('closed box passes with no findings that fail', () => {
  const r = analyseSoup(soup(house()));
  assert.equal(r.pass, true, JSON.stringify(r.findings));
  assert.equal(r.holes.loops, 0);
  assert.equal(r.seeThrough.rays, 0);
  assert.equal(r.detached.count, 0);
  assert.ok(r.seeThrough.tested > 0, 'wall rays must actually be tested');
});

test('box with a missing wall fails (hole loop and see-through rays)', () => {
  const r = analyseSoup(soup(house(['south'])));
  assert.equal(r.pass, false);
  assert.ok(r.holes.largestLoopPerimeter > 20, `loop ${r.holes.largestLoopPerimeter}`);
  assert.ok(r.seeThrough.rays > 3, `rays ${r.seeThrough.rays}`);
  assert.ok(r.findings.some(f => f.kind === 'holes'));
  assert.ok(r.findings.some(f => f.kind === 'see-through' && f.severity === 'fail'));
});

test('floating facade slab 15 cm in front of the wall fails as detached', () => {
  const slab = boxQuads(0, 2, 10.15, 10, 8, 10.35);
  const r = analyseSoup(soup(house(), slab));
  assert.equal(r.pass, false);
  const d = r.findings.find(f => f.kind === 'detached');
  assert.ok(d && d.severity === 'fail', JSON.stringify(r.findings));
  assert.ok(Math.abs(r.detached.parts[0].gap - 0.15) < 0.03, `gap ${r.detached.parts[0].gap}`);
});

test('slab touching the wall, boxes without undersides on the ground, and flat decals pass', () => {
  const attached = boxQuads(0, 2, 10, 10, 8, 10.2);
  const porch = boxQuads(2, 0, 10.2, 4, 3, 12, ['bottom']);
  const decal = {sign: [[3, 2, 12.05], [4, 2, 12.05], [4, 3, 12.05], [3, 3, 12.05]] as Quad};
  const r = analyseSoup(soup(house(), attached, porch, decal));
  assert.equal(r.pass, true, JSON.stringify(r.findings));
  assert.equal(r.holes.loops, 0);
});

test('inverted roof, below-ground and far-outside parts are reported', () => {
  const flipped = house();
  flipped.top = [...flipped.top].reverse();
  const roofOnly = {r: [[0, 8, 0], [10, 8, 0], [10, 8, 10], [0, 8, 10]] as Quad}; // faces down
  const r1 = analyseSoup(soup(house(['top']), roofOnly));
  assert.ok(r1.invertedRoof.area > 50, `inverted ${r1.invertedRoof.area}`);
  assert.ok(r1.findings.some(f => f.kind === 'inverted-roof' && f.severity === 'fail'));
  const r2 = analyseSoup(soup(house(), boxQuads(2, -1.5, 2, 4, 0, 4), boxQuads(20, 0, 20, 21, 1, 21)));
  assert.ok(r2.belowGround.vertices > 0 && r2.belowGround.minY < -1);
  assert.ok(r2.farOutside.vertices > 0 || r2.findings.some(f => f.kind === 'detached'));
});

test('triangle cap is enforced', () => {
  const r = analyseSoup(soup(house()), {triangleCap: 10});
  assert.ok(r.findings.some(f => f.kind === 'triangle-cap'));
});

// --- blank walls ---
/** Three 1.2 x 1.5 m window boxes protruding 0.1 m from the south (+z) face of the 10 x 8 x 10 house. */
const southWindows = () => [1.5, 4.4, 7.3].map(x => boxQuads(x, 3, 10, x + 1.2, 4.5, 10.1, ['bottom']));

test('box with windows on the south face only flags the other three faces as blank', () => {
  const r = analyseSoup(soup(house(), ...southWindows()));
  const blank = r.blankWalls.map(w => Math.round(w.bearingDeg)).sort((a, b) => a - b);
  assert.deepEqual(blank, [0, 90, 270], JSON.stringify(r.blankWalls));
  assert.ok(r.findings.filter(f => f.kind === 'blank-wall').every(f => f.severity === 'warn'), '80 m2 blank walls warn, they do not fail');
  assert.equal(r.pass, true);
  assert.ok(r.blankWalls.every(w => Math.abs(w.area - 80) < 1), JSON.stringify(r.blankWalls));
});

test('windows on every face leave no blank walls (protruding and recessed glazing both count)', () => {
  const all: Record<string, Quad>[] = [];
  for (const x of [1.5, 4.4, 7.3]) all.push(boxQuads(x, 3, 10, x + 1.2, 4.5, 10.1, ['bottom']), boxQuads(x, 3, -0.1, x + 1.2, 4.5, 0.1, ['bottom']));
  for (const z of [1.5, 4.4, 7.3]) all.push(boxQuads(10, 3, z, 10.1, 4.5, z + 1.2, ['bottom']), boxQuads(-0.1, 3, z, 0.1, 4.5, z + 1.2, ['bottom']));
  const r = analyseSoup(soup(house(), ...all));
  assert.equal(r.blankWalls.length, 0, JSON.stringify(r.blankWalls));
});

test('exempt bearings (party walls) are skipped, and a very large blank face fails', () => {
  const r = analyseSoup(soup(house(), ...southWindows()), {blankWallExemptBearings: [0, 90]});
  assert.deepEqual(r.blankWalls.map(w => Math.round(w.bearingDeg)), [270]);
  const big = analyseSoup(soup(boxQuads(0, 0, 0, 30, 25, 10)));
  assert.ok(big.findings.some(f => f.kind === 'blank-wall' && f.severity === 'fail'), JSON.stringify(big.findings));
  assert.equal(big.pass, false);
});

test('small walls are not examined', () => {
  const r = analyseSoup(soup(boxQuads(0, 0, 0, 4, 3, 4)));
  assert.equal(r.blankWalls.length, 0);
});

test('openings cut through the wall count as openings', () => {
  // South face built from four quads around a 2 x 2 m hole.
  const wall = {
    a: [[0, 0, 10], [10, 0, 10], [10, 3, 10], [0, 3, 10]] as Quad,
    b: [[0, 5, 10], [10, 5, 10], [10, 8, 10], [0, 8, 10]] as Quad,
    c: [[0, 3, 10], [4, 3, 10], [4, 5, 10], [0, 5, 10]] as Quad,
    d: [[6, 3, 10], [10, 3, 10], [10, 5, 10], [6, 5, 10]] as Quad,
  };
  const r = analyseSoup(soup(house(['south']), wall));
  assert.ok(!r.blankWalls.some(w => Math.round(w.bearingDeg) === 180), JSON.stringify(r.blankWalls));
});

test('internal partitions inside the shell are not blank walls; real outer blank walls still are', () => {
  const partition: Record<string, Quad> = {
    south: [[0, 0, 5], [20, 0, 5], [20, 8, 5], [0, 8, 5]],
    north: [[20, 0, 5], [0, 0, 5], [0, 8, 5], [20, 8, 5]],
  };
  const windows = [2, 6, 10, 14].map(x => boxQuads(x, 3, 10, x + 1.2, 4.5, 10.1, ['bottom']));
  const withPartition = analyseSoup(soup(boxQuads(0, 0, 0, 20, 8, 10), partition, ...windows));
  assert.ok(withPartition.blankWalls.every(w => Math.abs(w.centre[2] - 5) > 1.5 || Math.abs(w.bearingDeg - 90) < 1 || Math.abs(w.bearingDeg - 270) < 1), `partition reported: ${JSON.stringify(withPartition.blankWalls)}`);
  const bearings = withPartition.blankWalls.map(w => Math.round(w.bearingDeg)).sort((a, b) => a - b);
  assert.deepEqual(bearings, [0, 90, 270], 'north, east and west outer walls are still flagged, south has windows');
  const noPartition = analyseSoup(soup(boxQuads(0, 0, 0, 20, 8, 10), ...windows));
  assert.deepEqual(noPartition.blankWalls.map(w => Math.round(w.bearingDeg)).sort((a, b) => a - b), [0, 90, 270]);
});

test('a wall recessed behind a roofed canopy is closed; the same recess without a roof is see-through', () => {
  // 10 x 8 x 10 house whose south wall is at z=10; a 1 m-thick canopy slab sits 3 m up and 3.5 m in front of the wall.
  const base = [house()];
  const canopy = boxQuads(0, 3, 10, 10, 3.2, 13.5, []);
  const sides = [boxQuads(0, 0, 10, 0.2, 3, 13.5, []), boxQuads(9.8, 0, 10, 10, 3, 13.5, [])];
  const roofed = analyseSoup(soup(...base, canopy, ...sides));
  assert.equal(roofed.seeThrough.rays, 0, JSON.stringify(roofed.seeThrough));
  // A canopy so deep that the wall is more than ~8 m behind its front edge is still a gap.
  const open = analyseSoup(soup(...base, boxQuads(0, 3, 10, 10, 3.2, 20, [])));
  assert.ok(open.seeThrough.rays > 0, JSON.stringify(open.seeThrough));
});

test('stepped street front closes via the footprint (walls are at the footprint edge); an open-sided box still is not closed', () => {
  const left = boxQuads(0, 0, 0, 5, 8, 10), right = boxQuads(15, 0, 0, 20, 8, 10);
  const middle = boxQuads(5, 0, 0, 15, 8, 8.2);
  const stepped = analyseSoup(soup(left, right, middle));
  assert.equal(stepped.seeThrough.rays, 0, JSON.stringify(stepped.seeThrough));
  const openSided = analyseSoup(soup(boxQuads(0, 0, 0, 20, 8, 10, ['east'])));
  assert.ok(openSided.seeThrough.rays > 0, JSON.stringify(openSided.seeThrough));
});

test('a deep gap under a tall main roof stays see-through (only low soffits count as porches)', () => {
  // Front wall 3 m behind the footprint edge; the only cover is an 8 m-high roof slab, not a porch soffit.
  const body = boxQuads(0, 0, 0, 10, 8, 7);
  const tallRoof = boxQuads(0, 8, 0, 10, 8.3, 10);
  const r = analyseSoup(soup(body, tallRoof));
  assert.ok(r.seeThrough.rays > 0, JSON.stringify(r.seeThrough));
});

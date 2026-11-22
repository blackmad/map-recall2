import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rayToRing, setbackWalls, toRdWalls, type Surface} from './setback-walls';

/** A closed box (outward-wound walls, roof, ground) from x0..x1, z0..z1, y0..y1 in the native frame. */
function box(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Surface[] {
  const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  // seen from above (y up, z south) this ring runs clockwise on the map, so each wall quad below winds outward
  const walls = c.map((p, k) => { const q = c[(k + 1) % 4]; return {type: 'WallSurface', rings: [[[q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]]]]}; });
  return [...walls, {type: 'RoofSurface', rings: [c.map(p => [p[0], y1, p[1]])]}, {type: 'GroundSurface', rings: [c.map(p => [p[0], y0, p[1]])]}];
}
// footprint 0..40 x 0..20 (z south); a 6 m podium over all of it, a 16 m block on its north half (z 0..12)
const ring = [[0, 0], [40, 0], [40, 20], [0, 20]];
const shell = [...box(0, 40, 0, 20, 0, 6).filter(s => s.type !== 'RoofSurface'),
  {type: 'RoofSurface', rings: [[[0, 6, 12], [40, 6, 12], [40, 6, 20], [0, 6, 20]]]}, ...box(0, 40, 0, 12, 6, 16)];

test('the block behind a podium is found 8 m back, facing south, left end on the viewer left', () => {
  const ws = setbackWalls(shell, ring);
  const south = ws.filter(w => w.n[1] > 0.99);
  assert.equal(south.length, 1);
  const w = south[0];
  assert.ok(Math.abs(w.setbackM - 8) < 1e-6);
  assert.ok(Math.abs(w.len - 40) < 1e-6 && Math.abs(w.footM - 6) < 1e-6 && Math.abs(w.topM - 16) < 1e-6);
  // facing south (+z), the viewer looks north: their left is west (x = 0)
  assert.deepEqual(w.a.map(v => Math.round(v)), [0, 12]);
  assert.deepEqual(w.b.map(v => Math.round(v)), [40, 12]);
});

test('upper walls flush with the footprint and walls under the minimum setback are not set-back fronts', () => {
  const ws = setbackWalls(shell, ring);
  // north, east and west walls of the upper block stand on the footprint edge
  assert.equal(ws.filter(w => w.n[1] < -0.99 || Math.abs(w.n[0]) > 0.99).length, 0);
  assert.equal(setbackWalls(shell, ring, {minSetbackM: 9}).length, 0);
  assert.equal(setbackWalls(shell, ring, {minLen: 41}).length, 0);
});

test('coplanar pieces merge into one wall', () => {
  const split = [...box(0, 40, 0, 20, 0, 6).filter(s => s.type !== 'RoofSurface'),
    {type: 'RoofSurface', rings: [[[0, 6, 12], [40, 6, 12], [40, 6, 20], [0, 6, 20]]]}, ...box(0, 20, 0, 12, 6, 16), ...box(20, 40, 0, 12, 6, 19)];
  const south = setbackWalls(split, ring).filter(w => w.n[1] > 0.99);
  assert.equal(south.length, 1);
  assert.ok(Math.abs(south[0].len - 40) < 1e-6 && Math.abs(south[0].topM - 19) < 1e-6);
});

test('RD conversion flips the north axis and keeps a on the viewer left', () => {
  const [w] = toRdWalls(setbackWalls(shell, ring).filter(x => x.n[1] > 0.99), [1000, 2000]);
  assert.deepEqual([w.a.x, w.a.y, w.b.x, w.b.y].map(Math.round), [1000, 1988, 1040, 1988]);
  assert.ok(w.ny < -0.99, 'faces south in RD');
  assert.equal(rayToRing([20, 12], [0, 1], ring), 8);
});

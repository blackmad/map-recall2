import assert from 'node:assert/strict';
import test from 'node:test';
import {convexCorners, exposedRuns, type Piece} from './terraceBands';

const sq = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const total = (rs: {a: number[]; b: number[]}[]) => rs.reduce((s, r) => s + Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), 0);

test('a lone block is exposed all round, with four convex corners', () => {
  const runs = exposedRuns([{ring: sq(0, 0, 10, 4), base: 0, top: 10}], 5);
  assert.equal(runs.length, 4);
  assert.ok(Math.abs(total(runs) - 28) < 1e-9);
  for (const r of runs) {
    const mx = (r.a[0] + r.b[0]) / 2 + r.n[0], mz = (r.a[1] + r.b[1]) / 2 + r.n[1];
    assert.ok(mx < 0 || mx > 10 || mz < 0 || mz > 4, 'normal points out');
  }
  assert.equal(convexCorners(runs).length, 4);
});

test('the shared edge of two stepped pieces is exposed only above the lower one', () => {
  const pieces: Piece[] = [{ring: sq(0, 0, 10, 10), base: 0, top: 20}, {ring: sq(10, 0, 16, 10), base: 0, top: 12}];
  const shared = (y: number) => exposedRuns(pieces, y).filter(r => r.piece === 0 && r.a[0] === 10 && r.b[0] === 10);
  assert.equal(shared(8).length, 0);
  assert.equal(shared(15).length, 1);
  // the lower piece is not taking part above its top, and its free sides are exposed below it
  assert.equal(exposedRuns(pieces, 15).filter(r => r.piece === 1).length, 0);
  assert.ok(Math.abs(total(exposedRuns(pieces, 8)) - (10 + 16 + 10 + 16)) < 1e-9);
});

test('a neighbour blocks a party wall up to its height, and a void between bases leaves the inner sides exposed', () => {
  const pieces: Piece[] = [{ring: sq(0, 0, 10, 10), base: 0, top: 20}];
  const blocked = (x: number, _z: number, y: number) => x < 0 && y < 9;
  assert.equal(exposedRuns(pieces, 5, {blocked}).filter(r => r.a[0] === 0 && r.b[0] === 0).length, 0);
  assert.equal(exposedRuns(pieces, 12, {blocked}).filter(r => r.a[0] === 0 && r.b[0] === 0).length, 1);
  // a piece lifted over a passage: at 5 m the lower pieces see the gap
  const lifted: Piece[] = [{ring: sq(0, 0, 4, 10), base: 0, top: 20}, {ring: sq(4, 0, 8, 10), base: 12, top: 20}, {ring: sq(8, 0, 12, 10), base: 0, top: 20}];
  const inner = exposedRuns(lifted, 5).filter(r => r.a[0] === r.b[0] && (r.a[0] === 4 || r.a[0] === 8));
  assert.equal(inner.length, 2);
  assert.equal(exposedRuns(lifted, 15).filter(r => r.a[0] === r.b[0] && (r.a[0] === 4 || r.a[0] === 8)).length, 0);
});

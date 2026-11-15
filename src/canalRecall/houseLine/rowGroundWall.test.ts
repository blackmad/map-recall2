// House rows round 5 (lane R): stated window joinery (row-sash) and a ground storey faced apart from the wall
// (row-ground-wall, Herengracht 12's white stucco under brown brick, 73's white lower front).
import test from 'node:test';
import assert from 'node:assert/strict';
import { groundWallOf } from './rowSeries.ts';
import { rowDressOf } from './rowFront.ts';
import { groundWallBands, rowSashPieces, sashGrid } from '../facadeOrnaments.ts';

test('groundWallOf: material colour, named or hex colour, a ledge unless stated; unreadable draws nothing', () => {
  assert.deepEqual(groundWallOf({ material: 'stucco', colour: 'white', top: 'scrolled' }), { hex: '#ece8de', top: 'scrolled' });
  assert.deepEqual(groundWallOf({ material: 'stone' }), { hex: '#cdc4b0', top: 'ledge' });
  assert.deepEqual(groundWallOf({ material: 'stucco', colour: '#F0EEE0' }), { hex: '#f0eee0', top: 'ledge' });
  assert.equal(groundWallOf(undefined), null);
  assert.equal(groundWallOf({ material: 'marble' as never }), null);
});

test('rowDressOf: groundWalls and glazing add their extras only when stated', () => {
  const bare = rowDressOf({ id: 's', roofStorey: { kind: 'none', riseM: 0, dormers: [] } } as never);
  assert.equal(bare.groundWalls, undefined);
  assert.ok(!bare.extras?.includes('row-ground-wall'));
  const d = rowDressOf({ id: 's', roofStorey: { kind: 'none', riseM: 0, dormers: [] }, groundWalls: [{ a0: 0, a1: 1, hex: '#ece8de', top: 'scrolled' }], glazing: { kind: 'sash-8-over-8', frameM: 0.09, barM: 0.035 } } as never);
  assert.ok(d.extras?.includes('row-ground-wall') && d.extras.includes('row-sash'));
  assert.equal(d.groundWalls?.[0].top, 'scrolled');
});

test('groundWallBands: the plate stops at a window and a door, and covers the wall between and above them', () => {
  const bands = groundWallBands([[1, 2, 0.8, 2.6], [3, 4, 0, 2.8]], 0, 5, 0, 3.4);
  const area = bands.reduce((s, [za, zb, xs]) => s + (zb - za) * xs.reduce((t, [a, b]) => t + b - a, 0), 0);
  assert.ok(Math.abs(area - (5 * 3.4 - 1 * 1.8 - 1 * 2.8)) < 1e-9, `area ${area}`);
  for (const [za, zb, xs] of bands) for (const [a, b] of xs) assert.ok(!(a < 2 && b > 1 && za < 2.6 && zb > 0.8), 'over the window');
});

test('sash joinery: 8-over-8 is a 2x4 grid per sash; a sash window draws white frame, meeting rail and bars', () => {
  assert.deepEqual(sashGrid(8, 0.5, 1.0), [2, 4]);
  assert.deepEqual(sashGrid(8, 1.1, 0.5), [4, 2]);
  const ps = rowSashPieces({ kind: 'sash-8-over-8', frameM: 0.09, barM: 0.035 }, 0, 1.1, 0, 2.2);
  assert.ok(ps.length >= 12, `pieces ${ps.length}`);
  assert.equal(rowSashPieces({ kind: 'sash', frameM: 0.09, barM: 0.035 }, 0, 0.2, 0, 2).length, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wholeCellPieces, type CellPiece } from './partyWallStoreys.ts';

// A 3-storey 'upper' wall from 3.2 m to 12.2 m (3 m storeys), 10 m long.
const q: CellPiece = { kind: 'upper', layer: 7, z0: 3.2, z1: 12.2, v1: 3, u0: 0, u1: 4, along0: 0, along1: 1 };
const raised = (z0: number): CellPiece => ({ ...q, z0, v0: (z0 - 3.2) / 3 });

test('18a9d3: a lower neighbour cutting a window row part-way leaves plain wall up to the next whole row', () => {
  const out = wholeCellPieces(q, [raised(7.7)], 1, 10, [7.7]);
  assert.equal(out.length, 2);
  const [plain, rows] = out;
  assert.equal(plain.layer, 1); assert.equal(plain.kind, 'upper-wall');
  assert.equal(plain.z0, 7.7); assert.ok(Math.abs(plain.z1 - 9.2) < 1e-9);
  assert.equal(rows.layer, 7); assert.ok(Math.abs(rows.z0 - 9.2) < 1e-9); assert.equal(rows.v0, 2);
});

test('unchanged: no neighbour cut, a cut on a row line, a non-neighbour cut, no plain layer', () => {
  const p = [raised(7.7)];
  assert.equal(wholeCellPieces(q, [q], 1, 10, [7.7])[0], q);
  assert.deepEqual(wholeCellPieces(q, [raised(9.2)], 1, 10, [9.2]), [raised(9.2)]);
  assert.equal(wholeCellPieces(q, p, 1, 10, [5])[0], p[0]);
  assert.equal(wholeCellPieces(q, p, undefined, 10, [7.7]), p);
  assert.equal(wholeCellPieces({ ...q, kind: 'shell-wall' }, p, 1, 10, [7.7]), p);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aspect, auditCell } from './groundAudit.ts';
import type { BuiltCell, PackedMesh } from './groundCell.ts';

const quad = (x0: number, y0: number, x1: number, y1: number, z: number): PackedMesh => ({
  positions: new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z]), normals: new Float32Array(12), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
const cell = (layers: BuiltCell['layers']): BuiltCell => ({ key: 't', lod: 0, detail: 'full', rect: [0, 0, 20, 20], layers, mask: null, stats: {} as never });
const run = (layers: BuiltCell['layers'], dtm = 0) => auditCell({ cell: cell(layers), dtm: () => dtm, resM: 0.5, noTJunctions: true }).total.d;

test('aspect: a long thin triangle is a sliver, an equilateral one is not', () => {
  assert.ok(aspect(0, 0, 40, 0, 20, 1).aspect > 20);
  assert.ok(aspect(0, 0, 1, 0, 0.5, 0.866).aspect < 1.2);
});

test('a lower-precedence layer above a higher one is poke-through; below it is fine', () => {
  const bad = run({ land: quad(0, 0, 20, 20, 0.03), asphalt: quad(0, 0, 20, 20, 0) });
  assert.ok(bad.pokeM2 > 390 && bad.pokeM2 <= 400, `poke ${bad.pokeM2}`);
  const ok = run({ land: quad(0, 0, 20, 20, 0), asphalt: quad(0, 0, 20, 20, 0.03) });
  assert.equal(ok.pokeM2, 0);
});

test('coplanar layers z-fight; an uncovered patch is a crack when narrow and a void when wide', () => {
  assert.ok(run({ land: quad(0, 0, 20, 20, 0), asphalt: quad(0, 0, 20, 20, 0.002) }).zfightM2 > 390);
  const holes = run({ land: quad(0, 0, 10, 20, 0), asphalt: quad(12, 0, 20, 20, 0) });
  assert.ok(holes.crackM2 > 35 && holes.crackM2 < 45, `crack ${holes.crackM2}`);
  assert.equal(run({ land: quad(0, 0, 5, 20, 0), asphalt: quad(15, 0, 20, 20, 0) }).crackM2, 0);
});

test('natural ground more than 10 cm over the DTM floats', () => {
  assert.ok(run({ lawn: quad(0, 0, 20, 20, 0.5) }).floatM2 > 390);
  assert.equal(run({ lawn: quad(0, 0, 20, 20, 0.05) }).floatM2, 0);
});

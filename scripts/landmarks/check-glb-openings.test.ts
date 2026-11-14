import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import type {MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare';
import {GATED, lowered, measureModel, measureSoup, verdict} from './check-glb-openings';

const ZERO = {float: 0, poke: 0, outside: 0};

test('allow-list verdict: over fails, under is stale, no entry means zero', () => {
  assert.deepEqual(verdict({...ZERO, float: 2}, {float: 2}), {over: [], stale: []});
  assert.equal(verdict({...ZERO, float: 3}, {float: 2}).over.length, 1);
  assert.equal(verdict({...ZERO, float: 1}, {float: 2}).stale.length, 1);
  assert.equal(verdict({...ZERO, poke: 1}, undefined).over.length, 1);
  assert.deepEqual(verdict(ZERO, undefined), {over: [], stale: []});
});

test('--write only lowers entries and drops models at zero', () => {
  assert.deepEqual(lowered({float: 1, poke: 5, outside: 0}, {float: 3, poke: 2}), {float: 1, poke: 2});
  assert.equal(lowered(ZERO, {float: 3}), undefined);
  assert.equal(lowered({float: 4, poke: 0, outside: 0}, undefined), undefined, 'a model with no entry is never raised by --write');
  assert.deepEqual(GATED, ['float', 'poke', 'outside']);
});

/** A 10 x 6 m wall slab (z = 0, facing +z, 0.4 m thick) with one 1 x 1.5 m pane `standoff` metres in front of its face. */
function wallWithPane(standoff: number): MaterialSoup {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  const quad = (m: number, a: number[], b: number[], c: number[], d: number[]) => {
    const base = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    triMaterial.push(m, m);
  };
  const [x0, x1, y0, y1, z0, z1] = [-5, 5, 0, 6, -0.4, 0];
  quad(0, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // front
  quad(0, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]); // back
  quad(0, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // left
  quad(0, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); // right
  quad(0, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]); // top
  quad(0, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); // bottom
  // The pane is a closed 5 cm box whose back face stands `standoff` in front of the wall.
  const [px0, px1, py0, py1, pz0, pz1] = [-0.5, 0.5, 2, 3.5, standoff, standoff + 0.05];
  quad(1, [px0, py0, pz1], [px1, py0, pz1], [px1, py1, pz1], [px0, py1, pz1]);
  quad(1, [px1, py0, pz0], [px0, py0, pz0], [px0, py1, pz0], [px1, py1, pz0]);
  quad(1, [px0, py0, pz0], [px0, py0, pz1], [px0, py1, pz1], [px0, py1, pz0]);
  quad(1, [px1, py0, pz1], [px1, py0, pz0], [px1, py1, pz0], [px1, py1, pz1]);
  quad(1, [px0, py1, pz1], [px1, py1, pz1], [px1, py1, pz0], [px0, py1, pz0]);
  quad(1, [px0, py0, pz0], [px1, py0, pz0], [px1, py0, pz1], [px0, py0, pz1]);
  return {positions: new Float32Array(positions), indices: new Uint32Array(indices), triMaterial: Uint16Array.from(triMaterial), materials: [{name: 'brick', rgb: [150, 80, 60]}, {name: 'glass', rgb: [90, 110, 130]}]} as unknown as MaterialSoup;
}

test('a pane standing 0.5 m off its wall is a float; one on the wall is not', () => {
  assert.equal(measureSoup('synthetic-floating', wallWithPane(0.5)).counts.float, 1);
  assert.equal(measureSoup('synthetic-mounted', wallWithPane(0.04)).counts.float, 0);
});

test('liveness: De Hallen as exported before the R2-C fix fails the gate (panes up to 0.59 m off the stepped wall)', async () => {
  const r = await measureModel('de-hallen', path.join(import.meta.dirname, 'fixtures/de-hallen-before-r2c.glb'));
  assert.ok(r.counts.float >= 30, `float ${r.counts.float}`);
  assert.ok(r.worstGapM > 0.5, `worst gap ${r.worstGapM}`);
  assert.ok(verdict(r.counts, undefined).over.length > 0);
});

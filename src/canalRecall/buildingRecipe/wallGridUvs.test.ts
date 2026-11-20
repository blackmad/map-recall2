/** Wall-aligned window-grid UVs (export-glb.ts wallGridUvs; lane large-buildings-20261120, round 4). */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metreBoxUvs, wallGridUvs} from '../../../scripts/canalhouse-recipes/export-glb.ts';

/** A vertical wall quad (two triangles) from (x0,z0) to (x1,z1), 0..h high, wound to face `side` (+1 / -1). */
function wall(x0: number, z0: number, x1: number, z1: number, h: number, side = 1): number[] {
  const a = [x0, 0, z0], b = [x1, 0, z1], c = [x1, h, z1], d = [x0, h, z0];
  const tris = side > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
  return tris.flat();
}

test('wallGridUvs: u is metres along the wall at any bearing, v is the height', () => {
  for (const deg of [0, 20, 44, 45, 46, 70, 133]) {
    const r = deg * Math.PI / 180, L = 17.3, x1 = 5 + L * Math.cos(r), z1 = -3 + L * Math.sin(r);
    const p = wall(5, -3, x1, z1, 12), uv = wallGridUvs(p, 3);
    const us = [0, 1, 2, 3, 4, 5].map(k => uv[k * 2]), vs = [0, 1, 2, 3, 4, 5].map(k => uv[k * 2 + 1]);
    assert.ok(Math.abs(Math.max(...us) - Math.min(...us) - L) < 1e-6, `${deg}: u spans the wall length`);
    for (let k = 0; k < 6; k++) assert.ok(Math.abs(vs[k] - p[k * 3 + 1]) < 1e-9, `${deg}: v is height`);
    // whole 3 m bays centred: the margin at each end is (L mod 3) / 2
    assert.ok(Math.abs(Math.min(...us) + (L % 3) / 2) < 1e-6, `${deg}: centred bays`);
  }
});

test('wallGridUvs: one wall near 45 degrees keeps one projection (the box projection may split it)', () => {
  const p = [...wall(0, 0, 10, 10.02, 9), ...wall(10, 10.02, 20, 20.03, 9)], uv = wallGridUvs(p, 3);
  // u is continuous along the run: the shared edge at x = 10 gets the same u from both quads' triangles
  const at = (x: number) => { const o: number[] = []; for (let k = 0; k < p.length / 3; k++) if (Math.abs(p[k * 3] - x) < 1e-9) o.push(uv[k * 2]); return o; };
  const u10 = at(10); assert.ok(Math.max(...u10) - Math.min(...u10) < 0.05, `u at the shared edge: ${u10}`);
});

test('wallGridUvs: non-wall triangles keep the box projection', () => {
  const roof = [0, 5, 0, 4, 5, 0, 4, 5, 4];
  assert.deepEqual(wallGridUvs(roof, 3), metreBoxUvs(roof));
});

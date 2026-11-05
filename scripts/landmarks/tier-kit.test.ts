import assert from 'node:assert/strict';
import test from 'node:test';
import type * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {Acc, blockLetters, flatLetters, type C} from './tier-kit';
import type {Frame} from './nearbar-kit';

function run(draw: (acc: Acc) => void) {
  const out: {c: C; pos: number[]}[] = [];
  const acc = new Acc({add(g: T.BufferGeometry, c: C) { out.push({c, pos: Array.from(g.getAttribute('position').array as Float32Array)}); }} as unknown as BuildingTools);
  draw(acc); acc.flush();
  return out;
}
const tris = (pos: number[]) => { const r: number[][][] = []; for (let i = 0; i < pos.length; i += 9) r.push([pos.slice(i, i + 3), pos.slice(i + 3, i + 6), pos.slice(i + 6, i + 9)]); return r; };
const normal = ([a, b, d]: number[][]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
// frame facing -z (n), tangent +x... tangent = [n1, -n0] as frameFromBearing builds it
const F: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, -1]};

test('blockLetters: every glyph run is a closed box with every face wound outward', () => {
  const [{pos}] = run(acc => blockLetters(acc, F, 'I', 0, 10, 0.005, 0.15, 0.2, 'dark'));
  const ts = tris(pos);
  // 'I' in the pixel font: count its runs from flatLetters (2 triangles a run)
  const flat = tris(run(acc => flatLetters(acc, F, 'I', 0, 10, 0.005, 0.2, 'dark'))[0].pos);
  assert.equal(ts.length, flat.length * 6);
  // closed: the area-weighted normals sum to zero, and each triangle points away from its run's centre
  const sum = [0, 0, 0];
  for (const t of ts) { const n = normal(t); sum[0] += n[0]; sum[1] += n[1]; sum[2] += n[2]; }
  for (const s of sum) assert.ok(Math.abs(s) < 1e-6, `open box: ${sum}`);
  // front faces (z = -0.005) point toward the viewer (-z); back faces (z = 0.145) point into the building (+z)
  for (const t of ts) {
    const zs = t.map(p => p[2]), n = normal(t);
    if (zs.every(z => Math.abs(z + 0.005) < 1e-6)) assert.ok(n[2] < 0, 'front faces out');
    if (zs.every(z => Math.abs(z - 0.145) < 1e-6)) assert.ok(n[2] > 0, 'back faces in');
  }
});

test('blockLetters: the front faces are exactly flatLetters (same footprint on the street side)', () => {
  const flat = tris(run(acc => flatLetters(acc, F, 'HOTEL', 3, 20, 0.005, 0.2, 'dark'))[0].pos);
  const block = tris(run(acc => blockLetters(acc, F, 'HOTEL', 3, 20, 0.005, 0.15, 0.2, 'dark'))[0].pos);
  const key = (t: number[][]) => t.map(p => p.map(v => v.toFixed(4)).join(',')).sort().join(';');
  const fronts = new Set(block.filter(t => t.every(p => Math.abs(p[2] + 0.005) < 1e-6)).map(key));
  assert.equal(fronts.size, flat.length);
  for (const t of flat) assert.ok(fronts.has(key(t)));
});

test('blockLetters: depth must be positive; empty text and unknown glyphs draw nothing', () => {
  assert.throws(() => run(acc => blockLetters(acc, F, 'A', 0, 0, 0, 0, 0.2, 'dark')), /depth/);
  assert.equal(run(acc => blockLetters(acc, F, '', 0, 0, 0, 0.1, 0.2, 'dark')).length, 0);
  assert.equal(run(acc => blockLetters(acc, F, '~', 0, 0, 0, 0.1, 0.2, 'dark')).length, 0);
});

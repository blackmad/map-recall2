// Lane G1 (#376): the ground fixes' pure parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floatBoundGrid, gridHeight, reliefGrid } from './drape.js';
import { groundFixFlags, groundFixOptions } from './groundFixes.js';
import { parallelRuns, tunnelRuns, type CutWay } from './tunnels.js';

const slope = (x: number, y: number) => 0.01 * x - 0.02 * y;
const ditch = (x: number, y: number) => slope(x, y) - (Math.abs(x - 12.5) < 1.5 ? 0.6 : 0);

test('floatBoundGrid: byte-identical to the land grid where nothing floats', () => {
  const b = floatBoundGrid(slope, 5, 0.05), m = b.mesh(0, 0, 30, 30), r = reliefGrid(0, 0, 30, 30, 5, slope), g = gridHeight(slope, 5);
  assert.equal(b.splits(), 0);
  assert.deepEqual(m.positions, r.positions);
  assert.deepEqual(m.indices, r.indices);
  for (const [x, y] of [[1.3, 2.2], [17.9, 4.4], [29.1, 28.7]]) assert.equal(b.height(x, y), g(x, y));
});

test('floatBoundGrid: a ditch splits, the surface follows it, and the mesh is watertight', () => {
  const b = floatBoundGrid(ditch, 5, 0.05), m = b.mesh(0, 0, 30, 30);
  assert.ok(b.splits() > 0);
  assert.ok(gridHeight(ditch, 5)(12.5, 7.5) - ditch(12.5, 7.5) > 0.3, 'the plain grid floats over the ditch');
  assert.ok(b.height(12.5, 7.5) - ditch(12.5, 7.5) < 0.05, 'the bound grid does not');
  // Watertight: every edge is shared by two triangles, or lies on the outer boundary.
  const edges = new Map<string, number>(), p = m.positions;
  const key = (i: number) => `${p[i * 3]},${p[i * 3 + 1]}`;
  for (let t = 0; t < m.indices.length; t += 3) for (const [a, c] of [[0, 1], [1, 2], [2, 0]]) {
    const k = [key(m.indices[t + a]), key(m.indices[t + c])].sort().join('|');
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  for (const [k, n] of edges) {
    if (n === 2) continue;
    const [[ax, ay], [bx, by]] = k.split('|').map(s => s.split(',').map(Number));
    assert.ok((ax === bx && (ax === 0 || ax === 30)) || (ay === by && (ay === 0 || ay === 30)), `open edge ${k}`);
  }
  // The surface is the mesh: at every vertex the height function returns the vertex's z.
  for (let i = 0; i < p.length; i += 3) assert.ok(Math.abs(b.height(p[i], p[i + 1]) - p[i + 2]) < 1e-9);
});

test('groundFixFlags: on unless the URL says 0', () => {
  assert.deepEqual(groundFixFlags('?floatBound=0&portalSanity=off&x=1'), { floatBound: false, portalSanity: false });
  assert.deepEqual(groundFixFlags(''), {});
  assert.deepEqual(groundFixOptions({ deckCaps: false, floatBound: true }), { deckCaps: false });
});

test('parallelRuns: tunnel ways side by side are one slot', () => {
  const w = (id: number, tags: Record<string, string>, pts: [number, number][]): CutWay => ({ id, tags, points: pts, half: tags.highway === 'tertiary' ? 4 : 1.5, tunnel: !!tags.tunnel });
  const road = w(1, { highway: 'tertiary', tunnel: 'yes' }, [[0, 0], [80, 0]]), cycle = w(2, { highway: 'cycleway', tunnel: 'yes' }, [[0, 6], [80, 6]]), far = w(3, { highway: 'cycleway', tunnel: 'yes' }, [[0, 40], [80, 40]]);
  const groups = parallelRuns(tunnelRuns([road, cycle, far]));
  assert.equal(groups.length, 3 - 1);
  const g = groups.find(x => x.run.ways[0].id === 1)!;
  assert.deepEqual(g.others.map(r => r.ways[0].id), [2]);
});

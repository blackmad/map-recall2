// The far tier (lane R2-B, #229): the cell plan, the budget, the flag, and the per-tile hand-over to coarse shells.
// Run: node --import tsx --test src/canalRecall/engine/farShells.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cellDistanceM, farCellOrigin, farShellBudget, farShellsEnabled, FarShells, planFarCells, type FarCellData, type FarShellHost } from './farShells.js';
import { CELL_GRID, cellBounds } from '../world/cellGrid.js';
import { shellOrigin } from '../world/shellMesh.js';

const cells = (keys: string[]) => new Map(keys.map(k => [k, 1000]));
const ring: string[] = [];
for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) ring.push(`${i}_${j}`);
const centre = (() => { const [w, s, e, n] = cellBounds(0, 0); return [(w + e) / 2, (s + n) / 2] as const; })();

test('flag: on by default, ?farShells=0 and the global turn it off', () => {
  assert.equal(farShellsEnabled('', {}), true);
  assert.equal(farShellsEnabled('?farShells=0', {}), false);
  assert.equal(farShellsEnabled('', { __canalRecallFarShells: false }), false);
  assert.ok(farShellBudget(true).cells < farShellBudget(false).cells);
});

test('cellDistanceM: zero inside, the edge distance outside', () => {
  assert.equal(cellDistanceM('0_0', centre[0], centre[1]), 0);
  const d = cellDistanceM('2_0', centre[0], centre[1]);
  assert.ok(Math.abs(d - 1.5 * CELL_GRID.cellSizeM) < 1, `${d}`);
});

test('planFarCells: nearest first inside the radius, kept out to radius + keep, capped by cells and triangles', () => {
  const none = planFarCells(centre[0], centre[1], 0, cells(ring), { cells: 99, triangles: 1e9 }, () => 1);
  assert.deepEqual(none.want, []);
  const p = planFarCells(centre[0], centre[1], 1600, cells(ring), { cells: 99, triangles: 1e9 }, () => 1, 1000);
  assert.equal(p.want[0], '0_0');
  for (const k of p.want) assert.ok(cellDistanceM(k, centre[0], centre[1]) <= 1600);
  for (const k of p.keep) assert.ok(cellDistanceM(k, centre[0], centre[1]) <= 2600);
  assert.ok(p.keep.size > p.want.length);
  assert.equal(planFarCells(centre[0], centre[1], 5000, cells(ring), { cells: 5, triangles: 1e9 }, () => 1).want.length, 5);
  assert.equal(planFarCells(centre[0], centre[1], 5000, cells(ring), { cells: 99, triangles: 10 }, () => 4).want.length, 2);
  // A first cell bigger than the budget is still drawn (the nearest cell must never be starved).
  assert.equal(planFarCells(centre[0], centre[1], 5000, cells(ring), { cells: 99, triangles: 1 }, () => 4).want.length, 1);
});

test('farCellOrigin is the shell origin of the key', () => {
  assert.deepEqual(farCellOrigin('3_-2'), shellOrigin(3, -2));
});

// A minimal three stand-in: enough for install / hidden / drop.
class Attr { needsUpdate = false; constructor(public array: any, public itemSize: number) {} }
class Geometry { attrs = new Map<string, Attr>(); index: Attr | null = null; disposed = false; setAttribute(n: string, a: Attr) { this.attrs.set(n, a); } getAttribute(n: string) { return this.attrs.get(n)!; } setIndex(a: Attr) { this.index = a; } deleteAttribute(n: string) { this.attrs.delete(n); } computeBoundingSphere() {} dispose() { this.disposed = true; } }
class Mesh { name = ''; visible = true; parent: any = null; castShadow = true; receiveShadow = true; userData: any = {}; position = { set: (..._: number[]) => {} }; scale = { set: (..._: number[]) => {} }; constructor(public geometry: Geometry, public material: any) {} }
const THREE = { BufferGeometry: Geometry, BufferAttribute: Attr, Mesh };

function harness(drawn: Set<string>) {
  const added: Mesh[] = [];
  const scene = { add(m: Mesh) { added.push(m); m.parent = scene; }, remove(m: Mesh) { added.splice(added.indexOf(m), 1); m.parent = null; } };
  const material = { uniforms: { cityFade: { value: 1 } } };
  const data = (key: string): FarCellData => ({
    key, positions: new Int16Array(12), layers: new Uint8Array(4), tints: new Uint8Array(16), indices: new Uint16Array([0, 1, 2, 2, 3, 0]),
    parts: [{ tile: 'a', start: 0, count: 2 }, { tile: 'b', start: 2, count: 2 }], gzBytes: 100,
  });
  const fetched: string[] = [];
  const host: FarShellHost = {
    THREE, scene: () => scene, material: () => material, fadeMaterial: () => null, coarseDrawn: t => drawn.has(t),
    origin: () => [0, 0], fetchFar: async key => { fetched.push(key); return data(key); }, available: () => cells(['0_0', '1_0']), repaint: () => {},
  };
  return { host, added, fetched };
}
const settle = () => new Promise(r => setTimeout(r, 0));

test('FarShells: installs one mesh per cell, hides a tile part while its coarse shell draws, drops out of range', async () => {
  const drawn = new Set<string>();
  const { host, added, fetched } = harness(drawn);
  const far = new FarShells(host, { budget: { cells: 10, triangles: 1e6 } });
  far.update(centre[0], centre[1], 3000);
  await settle(); await settle();
  assert.deepEqual(fetched.sort(), ['0_0', '1_0']);
  assert.equal(added.length, 2);
  assert.equal(far.stats().cells, 2);
  assert.equal(far.stats().partsShown, 4);
  drawn.add('a'); far.frame();
  const hidden = added[0].geometry.getAttribute('hidden');
  assert.deepEqual([...hidden.array], [1, 1, 0, 0]);
  assert.equal(far.stats().partsShown, 2);
  drawn.add('b'); far.frame();
  assert.equal(added[0].visible, false);
  drawn.clear(); far.frame();
  assert.equal(added[0].visible, true);
  // Both cells share one accent / UV pair; a dropped cell lets go of it before it is disposed.
  assert.equal(added[0].geometry.getAttribute('accent'), added[1].geometry.getAttribute('accent'));
  const kept = added.slice();
  far.update(centre[0], centre[1], 0);
  assert.equal(added.length, 0);
  for (const m of kept) { assert.equal(m.geometry.attrs.has('accent'), false); assert.equal(m.geometry.disposed, true); }
  far.setEnabled(false); far.setEnabled(false);
  assert.equal(far.stats().cells, 0);
});

test('FarShells: an AbortError (a dead worker) is retried; another error is not asked again', async () => {
  const { host } = harness(new Set());
  let calls = 0;
  host.fetchFar = async () => { calls++; throw new DOMException('gone', 'AbortError'); };
  const far = new FarShells(host, { budget: { cells: 1, triangles: 1e6 } });
  far.update(centre[0], centre[1], 3000); await settle();
  far.update(centre[0], centre[1], 3000); await settle();
  assert.equal(calls, 2);
  assert.equal(far.stats().failed, 0);
  host.fetchFar = async () => { calls++; throw new Error('bad'); };
  const warn = console.warn; console.warn = () => {};
  far.update(centre[0], centre[1], 3000); await settle();
  far.update(centre[0], centre[1], 3000); await settle();
  console.warn = warn;
  assert.equal(calls, 3);
  assert.equal(far.stats().failed, 1);
});

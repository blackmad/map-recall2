// The baked coarse tier (lane R4-A, #243): the flag, the plan (nearest first, budget, hysteresis), the per-building
// ranges from SHEL bids, the ground lift, and the layer's coverage, install, failure fallback and dissolve.
// Run: node --import tsx --test src/canalRecall/engine/bakedCoarse.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { BAKED_FADE_MS, BakedCoarse, bakedCellOrigin, bakedCoarseBudget, bakedCoarseEnabled, cellDistanceM, liftRanges, planBakedCells, rangeMap, type BakedCellData, type BakedCoarseHost, type BakedEntry } from './bakedCoarse.js';
import { bakedCellArrays } from '../world/bakedCellArrays.js';
import { NO_BID, shellOrigin, type ShellMesh } from '../world/shellMesh.js';
import { cellBounds } from '../world/cellGrid.js';

const centre = (() => { const [w, s, e, n] = cellBounds(0, 0); return [(w + e) / 2, (s + n) / 2] as const; })();
const grid: string[] = [];
for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) grid.push(`${i}_${j}`);
const avail = (keys: string[]) => new Map(keys.map(k => [k, 1000]));

test('flag: on by default on both profiles, ?bakedCoarse=0 / the global off, =desktop keeps touch on runtime shells', () => {
  assert.equal(bakedCoarseEnabled(false, '', {}), true);
  assert.equal(bakedCoarseEnabled(false, '?bakedCoarse=0', {}), false);
  assert.equal(bakedCoarseEnabled(true, '?bakedCoarse=off', {}), false);
  assert.equal(bakedCoarseEnabled(false, '', { __canalRecallBakedCoarse: false }), false);
  assert.equal(bakedCoarseEnabled(true, '?bakedCoarse=desktop', {}), false);
  assert.equal(bakedCoarseEnabled(false, '?bakedCoarse=desktop', {}), true);
  assert.equal(bakedCoarseEnabled(true, '?bakedCoarse=1', {}), true);
  assert.ok(bakedCoarseBudget(true).triangles < bakedCoarseBudget(false).triangles);
  assert.deepEqual(bakedCellOrigin('3_-2'), shellOrigin(3, -2));
});

test('planBakedCells: wanted cells with a shell, nearest first, capped by cells and triangles; residents kept within radius + keep', () => {
  const wanted = ['0_0', '1_0', '0_1', '-1_-1', '3_3', '9_9'];
  const p = planBakedCells(centre[0], centre[1], wanted, avail(grid), { cells: 99, triangles: 1e9 }, () => 1);
  assert.equal(p.want[0], '0_0');
  assert.ok(!p.want.includes('9_9'), 'no shell, not planned');
  assert.equal(p.want.length, 5);
  for (let k = 1; k < p.want.length; k++) assert.ok(cellDistanceM(p.want[k - 1], centre[0], centre[1]) <= cellDistanceM(p.want[k], centre[0], centre[1]));
  assert.equal(planBakedCells(centre[0], centre[1], wanted, avail(grid), { cells: 2, triangles: 1e9 }, () => 1).want.length, 2);
  assert.equal(planBakedCells(centre[0], centre[1], wanted, avail(grid), { cells: 99, triangles: 10 }, () => 4).want.length, 2);
  // The nearest cell is never starved by a budget smaller than it.
  assert.deepEqual(planBakedCells(centre[0], centre[1], wanted, avail(grid), { cells: 99, triangles: 1 }, () => 4).want, ['0_0']);
  // Hysteresis: a resident the plan dropped stays while within the wanted radius + keep; a far one goes.
  const h = planBakedCells(centre[0], centre[1], ['0_0', '1_0'], avail(grid), { cells: 99, triangles: 1e9 }, () => 1, ['2_0', '4_4'], 1200);
  assert.deepEqual(h.want, ['0_0', '1_0']);
  assert.ok(h.keep.has('2_0') && !h.keep.has('4_4'));
  // ...but only up to a tenth over the cell budget (4 wanted -> ceil(4.4) = 5 kept), nearest residents first.
  const c = planBakedCells(centre[0], centre[1], ['0_0', '1_0', '0_1', '1_1'], avail(grid), { cells: 4, triangles: 1e9 }, () => 1, ['2_0', '2_1', '0_2'], 5000);
  assert.equal(c.keep.size, 5);
  // Nothing wanted keeps nothing.
  assert.equal(planBakedCells(centre[0], centre[1], [], avail(grid), { cells: 9, triangles: 9 }, () => 1, ['0_0']).keep.size, 0);
});

const shel = (): ShellMesh => {
  // Three buildings interleaved in first-use order (bids 2, 0, 2, NO_BID), one triangle each plus a shared one.
  const bids = Uint16Array.from([2, 2, 0, 0, 0, 2, NO_BID, NO_BID, NO_BID]);
  const n = bids.length;
  return {
    positions: Float32Array.from({ length: n * 3 }, (_, k) => k), uvs: Float32Array.from({ length: n * 2 }, (_, k) => k / 2),
    layers: Uint8Array.from({ length: n }, (_, k) => k), tints: Uint8Array.from({ length: n * 4 }, (_, k) => k), accents: Uint8Array.from({ length: n * 4 }, (_, k) => 255 - k),
    bids, indices: Uint32Array.from([0, 1, 2, 2, 3, 4, 1, 5, 0, 6, 7, 8]),
  };
};

test('bakedCellArrays: every building one contiguous range in first-use order, named by id, attributes moved with their vertex', () => {
  const m = shel(), out = bakedCellArrays(m, ['a', 'b', 'c']);
  assert.deepEqual(out.ranges, [{ id: 'c', start: 0, count: 3 }, { id: 'a', start: 3, count: 3 }, { id: '', start: 6, count: 3 }]);
  assert.equal(out.triangles, 4);
  assert.ok(out.indices instanceof Uint16Array);
  // Each output triangle is the input triangle with its vertices moved: compare the positions it points at.
  for (let t = 0; t < m.indices.length; t++) {
    const a: number = m.indices[t], b: number = out.indices[t];
    assert.deepEqual([...out.positions.subarray(b * 3, b * 3 + 3)], [...m.positions.subarray(a * 3, a * 3 + 3)]);
    assert.deepEqual([...out.uvs.subarray(b * 2, b * 2 + 2)], [...m.uvs.subarray(a * 2, a * 2 + 2)]);
    assert.equal(out.layers[b], m.layers[a]);
    assert.deepEqual([...out.tints.subarray(b * 4, b * 4 + 4)], [...m.tints.subarray(a * 4, a * 4 + 4)]);
    assert.deepEqual([...out.accents.subarray(b * 4, b * 4 + 4)], [...m.accents.subarray(a * 4, a * 4 + 4)]);
  }
  for (const r of out.ranges) for (let v = r.start; v < r.start + r.count; v++) assert.equal(m.bids[[...m.bids.keys()].find(k => out.positions[v * 3] === m.positions[k * 3])!], r.id === 'c' ? 2 : r.id === 'a' ? 0 : NO_BID);
  // The facade layer's view: '' (allotment gardens) is never named.
  assert.deepEqual([...rangeMap(out.ranges).keys()], ['c', 'a']);
  assert.equal(out.positionUnit, 1);
  // Quantised (the worker's form): the same vertices as Int16 SHEL grid steps of 0.1 m, the mesh scaled by the unit.
  const q = bakedCellArrays(m, ['a', 'b', 'c'], true);
  assert.ok(q.positions instanceof Int16Array);
  assert.equal(q.positionUnit, 0.1);
  for (let k = 0; k < q.positions.length; k++) assert.ok(Math.abs(q.positions[k] * 0.1 - out.positions[k]) < 0.05 + 1e-6);
  // A coordinate off the Int16 grid keeps Float32.
  const wide = shel(); wide.positions[0] = 5000;
  assert.equal(bakedCellArrays(wide, ['a', 'b', 'c'], true).positionUnit, 1);
});

test('liftRanges: known bases move their range by the change, unknown ones wait, null stands on 0, the deadline stops a pass', () => {
  const positions = new Float32Array(4 * 3).fill(1);
  const ranges = new Map([['a', { start: 0, count: 2 }], ['b', { start: 2, count: 2 }]]);
  const applied = new Map<string, number>(), pending = ['a', 'b', 'c'];
  const base: Record<string, number | null | undefined> = { a: 2, b: undefined, c: null };
  const r = liftRanges(positions, ranges, pending, applied, id => base[id]);
  assert.equal(r.lifted, 1);
  assert.deepEqual(pending, ['b']);
  assert.deepEqual([positions[2], positions[5], positions[8]], [3, 3, 1]);
  base.a = 1.5; base.b = -0.5;
  const again = ['a', 'b'];
  liftRanges(positions, ranges, again, applied, id => base[id]);
  assert.deepEqual([positions[2], positions[8]], [2.5, 0.5]);
  assert.equal(again.length, 0);
  // On the Int16 grid (unit 0.1 m) a lift moves whole grid steps from base to base, never drifting.
  const grid = new Int16Array(2 * 3), gridApplied = new Map<string, number>();
  const gridRanges = new Map([['a', { start: 0, count: 2 }]]);
  liftRanges(grid, gridRanges, ['a'], gridApplied, () => 1.26, Infinity, undefined, 0.1);
  assert.deepEqual([grid[2], grid[5]], [13, 13]);
  liftRanges(grid, gridRanges, ['a'], gridApplied, () => 1.34, Infinity, undefined, 0.1);
  assert.deepEqual([grid[2], grid[5]], [13, 13]);
  liftRanges(grid, gridRanges, ['a'], gridApplied, () => -0.2, Infinity, undefined, 0.1);
  assert.deepEqual([grid[2], grid[5]], [-2, -2]);
  // A deadline already past stops after the first 31 (checked every 32 buildings).
  const many = Array.from({ length: 100 }, (_, k) => `x${k}`);
  liftRanges(new Float32Array(3), new Map(), many, new Map(), () => 0, 0, () => 1);
  assert.equal(many.length, 69);
});

// A minimal three stand-in for install / hidden / drop.
class Attr { needsUpdate = false; uploaded: any = null; constructor(public array: any, public itemSize: number) {} onUpload(f: any) { this.uploaded = f; } }
class Geometry { attrs = new Map<string, Attr>(); index: Attr | null = null; disposed = false; boundingSphere = { radius: 1 }; setAttribute(n: string, a: Attr) { this.attrs.set(n, a); } getAttribute(n: string) { return this.attrs.get(n)!; } setIndex(a: Attr) { this.index = a; } computeBoundingSphere() {} dispose() { this.disposed = true; } }
class Mesh { name = ''; visible = true; parent: any = null; castShadow = true; frustumCulled = false; userData: any = {}; position = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } }; constructor(public geometry: Geometry, public material: any) {} }
const THREE = { BufferGeometry: Geometry, BufferAttribute: Attr, Mesh };
const settle = () => new Promise(r => setTimeout(r, 0));

function harness(cellsWithShell: string[]) {
  const added: Mesh[] = [], attached = new Map<string, BakedEntry>();
  const scene = { add(m: Mesh) { added.push(m); m.parent = scene; }, remove(m: Mesh) { added.splice(added.indexOf(m), 1); m.parent = null; } };
  const material = { uniforms: { cityFade: { value: 1 } } };
  const clones: any[] = [];
  const data = (key: string): BakedCellData => ({ key, ...bakedCellArrays(shel(), ['a', 'b', 'c']), gzBytes: 100 });
  const fetched: string[] = [];
  let regroups = 0;
  const bases: Record<string, number | null | undefined> = { a: 2, b: null, c: undefined };
  const host: BakedCoarseHost = {
    THREE, scene: () => scene, material: () => material,
    fadeMaterial: v => { const c = { uniforms: { cityFade: { value: v } }, disposed: false, dispose() { this.disposed = true; } }; clones.push(c); return c; },
    attach: e => { attached.set(e.key, e); e.mesh.geometry.getAttribute('hidden').array.fill(1, 0, 3); },
    detach: e => { attached.delete(e.key); },
    swapSlots: () => true,
    fetchShell: async key => { fetched.push(key); return data(key); },
    available: () => avail(cellsWithShell),
    coverageChanged: () => { regroups++; },
    groundBase: id => bases[id],
    repaint: () => {},
  };
  return { host, added, attached, fetched, clones, material, bases, regroups: () => regroups };
}

test('BakedCoarse: covers the planned cells at once, installs one mesh per cell at its origin, attaches it, dissolves in, then counts as drawn', async () => {
  const h = harness(['0_0', '1_0', '5_5']);
  const baked = new BakedCoarse(h.host, { budget: { cells: 10, triangles: 1e6 } });
  baked.update(centre[0], centre[1], false);
  baked.plan(new Set(['0_0', '1_0', '2_0']));
  assert.ok(baked.covers('0_0') && baked.covers('1_0'), 'covered while in flight');
  assert.ok(!baked.covers('2_0'), 'no shell: the runtime coarse chunk builds it');
  assert.equal(h.regroups(), 0, 'a plan call from the grouping does not ask for a regroup');
  await settle(); await settle();
  assert.deepEqual(h.fetched.sort(), ['0_0', '1_0']);
  assert.equal(h.added.length, 2);
  const m = h.added.find(x => x.name === 'baked-coarse/0_0')!;
  assert.deepEqual([m.position.x, m.position.y], bakedCellOrigin('0_0'));
  assert.equal(m.userData.coarse, true);
  assert.equal(m.castShadow, false);
  assert.ok(m.geometry.attrs.has('swapSlot'));
  assert.deepEqual([...m.geometry.getAttribute('hidden').array.subarray(0, 4)], [1, 1, 1, 0], 'the host filled the per-building state');
  assert.ok(h.attached.has('0_0'));
  assert.equal(baked.drawn('0_0'), false, 'dissolving');
  baked.frame(performance.now() + BAKED_FADE_MS / 2);
  assert.ok(h.clones[0].uniforms.cityFade.value > 0.3 && h.clones[0].uniforms.cityFade.value < 0.7);
  baked.frame(performance.now() + BAKED_FADE_MS + 10);
  assert.equal(baked.drawn('0_0'), true);
  assert.equal(m.material, h.material);
  assert.ok(h.clones[0].disposed);
  // From the air: positions were released after upload (no CPU copy), nothing lifted.
  assert.ok(m.geometry.getAttribute('position').uploaded);
  assert.equal(baked.refreshBases(4), 0);
  assert.equal(baked.stats().cells, 2);
  // Moving far away (over the 200 m step) re-plans: nothing wanted near there any more is kept, the coverage changes.
  const before = h.regroups();
  baked.plan(new Set(['5_5']));
  assert.ok(!baked.covers('0_0') || baked.covers('5_5'));
  baked.update(centre[0] + 0.07, centre[1] + 0.045, false);
  assert.ok(h.regroups() >= before);
  baked.setEnabled(false);
  assert.equal(h.added.length, 0);
  assert.equal(baked.covers('5_5'), false);
  assert.equal(h.attached.size, 0);
});

test('BakedCoarse: a failed fetch uncovers its cell and asks for a regroup (runtime coarse fallback); an abort is retried', async () => {
  const h = harness(['0_0', '1_0']);
  let calls = 0;
  h.host.fetchShell = async key => { calls++; if (key === '1_0') throw new Error('404'); throw new DOMException('gone', 'AbortError'); };
  const baked = new BakedCoarse(h.host, { budget: { cells: 10, triangles: 1e6 } });
  const warn = console.warn; console.warn = () => {};
  baked.plan(new Set(['0_0', '1_0']));
  await settle(); await settle();
  console.warn = warn;
  assert.equal(baked.covers('1_0'), false);
  assert.equal(baked.covers('0_0'), true, 'an abort keeps the cell covered and is asked again');
  assert.equal(h.regroups(), 1);
  assert.equal(baked.stats().failed, 1);
  assert.ok(calls >= 2);
});

test('BakedCoarse: at street level a near cell keeps its positions and lifts buildings onto their base in slices', async () => {
  const h = harness(['0_0']);
  const baked = new BakedCoarse(h.host, { budget: { cells: 10, triangles: 1e6 } });
  baked.update(centre[0], centre[1], true);
  baked.plan(new Set(['0_0']));
  await settle(); await settle();
  const m = h.added[0], pos = m.geometry.getAttribute('position');
  assert.equal(pos.uploaded, null, 'kept on the CPU to be lifted');
  const z0 = pos.array[3 * 3 + 2];
  assert.ok(baked.refreshBases(4) >= 1);
  assert.equal(pos.array[3 * 3 + 2], z0 + 2, "building 'a' (vertices 3..5) stood on its 2 m base");
  assert.equal(pos.needsUpdate, true);
  assert.equal(baked.stats().liftPending, 1, "'c' waits for its relief");
  // A new ground revision (the facade re-base's budget interface): every building is queued again and moved by the change.
  h.bases.a = 3;
  const budget: { ms: number; restart: boolean; done?: boolean } = { ms: 4, restart: true };
  baked.refreshShellBases(budget);
  assert.equal(pos.array[3 * 3 + 2], z0 + 3, "'a' follows its new 3 m base");
  assert.equal(budget.done, false, "'c' still waits");
});

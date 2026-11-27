// Hidden buildings skipped in the baked cells (lane cell-hidden-skip 2026-11-27, engine/cellSkip.ts): the flag, the
// index runs, the permutation (drawn runs first in their original order, nothing lost, the upload covers every change),
// the BakedCoarse wiring (synced just before the draw from the `hidden` bytes, `?cellSkip=0` as before) and the cost.
// Run: node --import tsx --test src/canalRecall/engine/cellSkip.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { HiddenRunSkip, cellSkipEnabled } from './cellSkip.js';
import { HIDDEN } from '../look/highlight.js';
import { MIXED_RUN, bakedCellArrays, indexRuns } from '../world/bakedCellArrays.js';
import { NO_BID, type ShellMesh } from '../world/shellMesh.js';
import { decodeShellCell } from '../world/cellFormat.js';
import { BakedCoarse, type BakedCellData, type BakedCoarseHost } from './bakedCoarse.js';
import { cellBounds } from '../world/cellGrid.js';

test('flag: on by default; ?cellSkip=0 or the global off', () => {
  assert.equal(cellSkipEnabled('', {}), true);
  assert.equal(cellSkipEnabled('?cellSkip=0', {}), false);
  assert.equal(cellSkipEnabled('?cellSkip=off', {}), false);
  assert.equal(cellSkipEnabled('', { __canalRecallCellSkip: false }), false);
  assert.equal(cellSkipEnabled('?cellSkip=1', { __canalRecallCellSkip: false }), true, 'the query wins');
});

/** A random cell: `b` buildings, each drawn in `passes` separate runs of 1–6 triangles (walls, then roofs). */
function randomCell(b: number, passes: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const vertsPer = Array.from({ length: b }, () => 3 + Math.floor(rnd() * 8));
  const starts: number[] = [], counts: number[] = [];
  let v = 0;
  for (const c of vertsPer) { starts.push(v); counts.push(c); v += c; }
  const tris: number[] = [];
  for (let p = 0; p < passes; p++) for (let k = 0; k < b; k++) {
    const t = 1 + Math.floor(rnd() * 6);
    for (let i = 0; i < t; i++) for (let c = 0; c < 3; c++) tris.push(starts[k] + Math.floor(rnd() * counts[k]));
  }
  const indices = v <= 65536 ? Uint16Array.from(tris) : Uint32Array.from(tris);
  return { indices, starts, counts, vertices: v, rnd };
}

/** The triangles a full draw keeps after the shader collapses hidden ones, in draw order, as vertex triples. */
function expected(original: ArrayLike<number>, rangeOfVertex: Uint32Array, off: Uint8Array): number[] {
  const out: number[] = [];
  for (let k = 0; k < original.length; k += 3) if (!off[rangeOfVertex[original[k]]]) out.push(original[k], original[k + 1], original[k + 2]);
  return out;
}

test('indexRuns: maximal runs of one building in index order, covering the index; a triangle across buildings is MIXED', () => {
  const { indices, starts, counts, vertices } = randomCell(40, 2, 7);
  const runs = indexRuns(indices, starts, counts, vertices);
  let at = 0, prev = -1;
  for (let r = 0; r < runs.length; r += 3) {
    assert.equal(runs[r], at); assert.ok(runs[r + 1] > 0 && runs[r + 1] % 3 === 0);
    const g = runs[r + 2];
    assert.notEqual(g, prev, 'maximal');
    for (let k = runs[r]; k < runs[r] + runs[r + 1]; k++) assert.ok(indices[k] >= starts[g] && indices[k] < starts[g] + counts[g]);
    at += runs[r + 1]; prev = g;
  }
  assert.equal(at, indices.length);
  // The unit fixture's shared triangle (bids 2, 2, 0).
  const mixed = indexRuns([0, 1, 3, 0, 1, 2], [0, 3], [3, 3], 6);
  assert.deepEqual([...mixed], [0, 3, MIXED_RUN, 3, 3, 0]);
});

test('bakedCellArrays carries the runs (a SHEL lists walls and roofs in two passes: ~2 runs a building)', () => {
  const bids = Uint16Array.from([0, 0, 0, 1, 1, 1, NO_BID, NO_BID, NO_BID]), n = bids.length;
  const m: ShellMesh = { positions: new Float32Array(n * 3), uvs: new Float32Array(n * 2), layers: new Uint8Array(n), tints: new Uint8Array(n * 4), accents: new Uint8Array(n * 4), bids,
    indices: Uint32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 2, 1, 0, 5, 4, 3]) };
  const out = bakedCellArrays(m, ['a', 'b']);
  assert.deepEqual([...out.runs], [0, 3, 0, 3, 3, 1, 6, 3, 2, 9, 3, 0, 12, 3, 1]);
});

test('HiddenRunSkip: drawn runs first in original order (the same triangles in the same order as drawing all and collapsing the hidden), nothing lost, the upload covers every change', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { indices, starts, counts, vertices, rnd } = randomCell(120, 2, seed);
    const original = indices.slice(), runs = indexRuns(indices, starts, counts, vertices);
    const rangeOfVertex = new Uint32Array(vertices);
    starts.forEach((s, r) => rangeOfVertex.fill(r, s, s + counts[r]));
    const skip = new HiddenRunSkip(indices, runs, starts.length);
    const gpu = indices.slice(); // what the GPU buffer holds: updated only over [from, to)
    const off = new Uint8Array(starts.length);
    assert.equal(skip.sync(off), null, 'nothing hidden: no change');
    for (let step = 0; step < 60; step++) {
      // Hide or show a few buildings (a detail chunk's block, a landmark), sometimes nothing.
      const flips = Math.floor(rnd() * 6);
      for (let f = 0; f < flips; f++) { const r = Math.floor(rnd() * starts.length); off[r] ^= 1; }
      const change = skip.sync(off);
      if (change) { assert.ok(change.from <= change.to && change.to <= indices.length); gpu.set(indices.subarray(change.from, change.to), change.from); }
      const want = expected(original, rangeOfVertex, off);
      assert.equal(skip.drawCount, want.length, `seed ${seed} step ${step}`);
      assert.deepEqual([...gpu.subarray(0, skip.drawCount)], want, 'the drawn prefix on the GPU is exactly the kept triangles in draw order');
      assert.deepEqual([...indices].sort((a, b) => a - b), [...original].sort((a, b) => a - b), 'a permutation');
    }
    off.fill(0);
    skip.sync(off);
    assert.deepEqual([...indices], [...original], 'all shown again: the original index');
  }
});

test('HiddenRunSkip: MIXED runs and ranges past the table are never skipped', () => {
  const indices = Uint16Array.from([0, 1, 3, 0, 1, 2, 3, 4, 5]);
  const skip = new HiddenRunSkip(indices, Uint32Array.from([0, 3, MIXED_RUN, 3, 3, 0, 6, 3, 1]), 2);
  const c = skip.sync(Uint8Array.from([1, 1]));
  assert.deepEqual(c, { from: 3, to: 3, drawCount: 3 });
  assert.deepEqual([...indices.subarray(0, 3)], [0, 1, 3]);
  assert.throws(() => new HiddenRunSkip(new Uint16Array(6), Uint32Array.from([0, 3, 0]), 1), /cover/);
});

test('HiddenRunSkip.syncHidden reads one byte a range: only HIDDEN.hide is skipped (ghost, highlight, dim draw)', () => {
  const indices = Uint16Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const skip = new HiddenRunSkip(indices, Uint32Array.from([0, 3, 0, 3, 3, 1, 6, 3, 2, 9, 3, 3]), 4);
  const hidden = new Uint8Array(12), starts = [0, 3, 6, 9];
  hidden.fill(HIDDEN.ghost, 0, 3); hidden.fill(HIDDEN.hide, 3, 6); hidden.fill(HIDDEN.highlight, 6, 9); hidden.fill(HIDDEN.dim, 9, 12);
  skip.syncHidden(hidden, starts);
  assert.equal(skip.drawCount, 9);
  assert.deepEqual([...indices.subarray(0, 9)], [0, 1, 2, 6, 7, 8, 9, 10, 11]);
  assert.equal(HIDDEN.hide, 1, 'the shader collapses hidden == 1 (cityLook VERTEX_HIDE)');
});

test('HiddenRunSkip cost: a 200 k-triangle cell of 2,000 buildings, one block of 40 swapping in and out', () => {
  const { indices, starts, counts, vertices } = randomCell(2000, 2, 11);
  // Pad to ~200 k triangles by repeating the passes.
  const reps = Math.ceil(600_000 / indices.length), big = new Uint32Array(indices.length * reps);
  for (let r = 0; r < reps; r++) big.set(indices, r * indices.length);
  const runs = indexRuns(big, starts, counts, vertices), skip = new HiddenRunSkip(big, runs, starts.length);
  const off = new Uint8Array(starts.length);
  const ms: number[] = [];
  for (let i = 0; i < 20; i++) {
    const block = (i * 97) % (starts.length - 40);
    off.fill(0); off.fill(1, block, block + 40);
    const t0 = performance.now(); skip.sync(off); ms.push(performance.now() - t0);
  }
  ms.sort((a, b) => a - b);
  console.log(`  cellSkip sync: ${(big.length / 3 / 1000).toFixed(0)} k triangles, ${runs.length / 3} runs: median ${ms[10].toFixed(2)} ms, max ${ms[19].toFixed(2)} ms`);
  assert.ok(ms[10] < 25, `median ${ms[10]} ms`);
});

// The BakedCoarse wiring, on a minimal three stand-in.
class Attr {
  needsUpdate_ = 0; version = 0; uploaded: any = null; ranges: { start: number; count: number }[] = [];
  constructor(public array: any, public itemSize: number) {}
  set needsUpdate(v: boolean) { if (v) this.version++; }
  onUpload(f: any) { this.uploaded = f; }
  addUpdateRange(start: number, count: number) { this.ranges.push({ start, count }); }
}
class Geometry {
  attrs = new Map<string, Attr>(); index: Attr | null = null; boundingSphere = { radius: 1 }; drawRange = { start: 0, count: Infinity };
  setAttribute(n: string, a: Attr) { this.attrs.set(n, a); } getAttribute(n: string) { return this.attrs.get(n)!; } setIndex(a: Attr) { this.index = a; }
  setDrawRange(start: number, count: number) { this.drawRange = { start, count }; } computeBoundingSphere() {} dispose() {}
}
class Mesh { name = ''; visible = true; parent: any = null; castShadow = true; frustumCulled = false; userData: any = {}; onBeforeRender: any = () => {}; position = { set() {} }; scale = { setScalar() {} }; constructor(public geometry: Geometry, public material: any) {} }
const THREE = { BufferGeometry: Geometry, BufferAttribute: Attr, Mesh };
const settle = () => new Promise(r => setTimeout(r, 0));

async function installOne(cellSkip: boolean) {
  // Buildings a, b, c: walls pass then roofs pass.
  const bids = Uint16Array.from([0, 0, 0, 1, 1, 1, 2, 2, 2]), n = bids.length;
  const m: ShellMesh = { positions: new Float32Array(n * 3), uvs: new Float32Array(n * 2), layers: new Uint8Array(n), tints: new Uint8Array(n * 4), accents: new Uint8Array(n * 4), bids,
    indices: Uint32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 2, 1, 0, 5, 4, 3, 8, 7, 6]) };
  const added: Mesh[] = [], scene = { add(x: Mesh) { added.push(x); }, remove() {} };
  const host: BakedCoarseHost = {
    THREE, scene: () => scene, material: () => ({ uniforms: { cityFade: { value: 1 } } }), fadeMaterial: () => null,
    attach: () => {}, detach: () => {}, swapSlots: () => true,
    fetchShell: async key => ({ key, ...bakedCellArrays(m, ['a', 'b', 'c']), gzBytes: 10 }) as BakedCellData,
    available: () => new Map([['0_0', 100]]), coverageChanged: () => {}, groundBase: () => 0, repaint: () => {},
  };
  const [w, s, e, nn] = cellBounds(0, 0);
  const baked = new BakedCoarse(host, { now: () => 0, budget: { cells: 4, triangles: 1e6 }, cellSkip });
  baked.update((w + e) / 2 + 0.05, (s + nn) / 2 + 0.05, false);
  baked.plan(new Set(['0_0']));
  await settle(); await settle();
  return { baked, mesh: added[0] };
}

test('BakedCoarse + cellSkip: the cell syncs just before it draws, from its hidden bytes; a fade-in shows it again; ?cellSkip=0 keeps the whole index', async () => {
  const { baked, mesh } = await installOne(true);
  const g = mesh.geometry, hidden = g.getAttribute('hidden'), index = g.index!;
  assert.equal(index.uploaded, null, 'the index stays on the CPU');
  mesh.onBeforeRender();
  assert.equal(g.drawRange.count, Infinity, 'nothing hidden: untouched');
  // The facade layer hides b (detail installed over it): applyHidden fills its range and bumps the version.
  hidden.array.fill(HIDDEN.hide, 3, 6); hidden.needsUpdate = true;
  mesh.onBeforeRender();
  assert.equal(g.drawRange.count, 12);
  assert.deepEqual([...index.array.subarray(0, 12)], [0, 1, 2, 6, 7, 8, 2, 1, 0, 8, 7, 6]);
  assert.deepEqual(index.ranges, [{ start: 3, count: 9 }], 'only the changed drawn tail is uploaded');
  assert.equal(index.version, 1);
  // Same version: no work.
  mesh.onBeforeRender();
  assert.equal(index.version, 1);
  // A detail chunk leaving: b comes back at once (drawn, yielding through its swap slot), so it is drawn on this draw.
  hidden.array.fill(HIDDEN.drawn, 3, 6); hidden.needsUpdate = true;
  mesh.onBeforeRender();
  assert.equal(g.drawRange.count, 18);
  assert.deepEqual([...index.array], [0, 1, 2, 3, 4, 5, 6, 7, 8, 2, 1, 0, 5, 4, 3, 8, 7, 6]);
  const st = baked.skipStats();
  assert.equal(st.on, true); assert.equal(st.syncs, 2); assert.equal(st.skippedTriangles, 0);

  const off = await installOne(false);
  assert.ok(off.mesh.geometry.index!.uploaded, 'released after upload, as before');
  off.mesh.onBeforeRender();
  assert.equal(off.mesh.geometry.drawRange.count, Infinity);
  assert.equal(off.baked.skipStats().on, false);
});

test('the compiled SHELs: no triangle spans two buildings, and a building is at most a few runs', () => {
  const dir = new URL('../../../public/data/extracts/amsterdam/world-v1/shells/', import.meta.url).pathname;
  if (!existsSync(dir)) return;
  let buildings = 0, runCount = 0, mixed = 0;
  for (const f of readdirSync(dir).slice(0, 40)) {
    const shel = decodeShellCell(gunzipSync(readFileSync(dir + f)), f).shel;
    if (!shel) continue;
    const out = bakedCellArrays(shel, [], true, true);
    buildings += out.ranges.length; runCount += out.runs.length / 3;
    for (let r = 2; r < out.runs.length; r += 3) if (out.runs[r] === MIXED_RUN) mixed++;
  }
  assert.equal(mixed, 0);
  assert.ok(runCount <= buildings * 3, `${runCount} runs for ${buildings} buildings`);
});

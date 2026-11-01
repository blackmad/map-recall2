// #129: facade chunk tiles are cut in the pool worker (cellTiles.ts planTiles: the x/y partition) and finished on the
// main thread after the ground lift (finishTiles: the heights). Exact: byte-identical to splitIntoTiles on the lifted
// positions, which is what cutMesh computed on the main thread before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { finishTiles, planTiles, plannedTransferables, splitIntoTiles, type CellTile } from '../ownGround/cellTiles';
import { buildFeatureChunk, type Feature } from '../threeBuildingFeatures';

const TILES = 'public/data/extracts/amsterdam/building-tiles/14';
const have = fs.existsSync(`${TILES}/8414/5384.geojson.gz`);

function same(a: CellTile[] | null, b: CellTile[] | null, what: string): void {
  if (!a || !b) { assert.equal(a, b, what); return; }
  assert.equal(a.length, b.length, `${what}: tiles`);
  a.forEach((t, i) => {
    const u = b[i];
    assert.equal(t.cell, u.cell, `${what}: tile ${i} cell`);
    assert.deepEqual(t.center, u.center, `${what}: tile ${i} centre`);
    assert.equal(t.radius, u.radius, `${what}: tile ${i} radius`);
    assert.equal(t.indices.constructor, u.indices.constructor);
    assert.ok(Buffer.from(t.indices.buffer, t.indices.byteOffset, t.indices.byteLength).equals(Buffer.from(u.indices.buffer, u.indices.byteOffset, u.indices.byteLength)), `${what}: tile ${i} indices`);
  });
}

/** threeBuildingsBrowser applyGroundLift: each building's vertices move by its base, z only, in float32. */
function lift(positions: Float32Array, ranges: readonly { start: number; count: number }[], seed: number): void {
  let s = seed;
  for (const r of ranges) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const delta = (s / 2 ** 32) * 6 - 2;
    for (let v = r.start; v < r.start + r.count; v++) positions[v * 3 + 2] += delta;
  }
}

test('facade tiles planned in the worker and finished after the lift equal the main-thread cut (real Jordaan chunks)', { skip: !have }, () => {
  let chunks = 0, cut = 0;
  for (const key of ['8414/5384', '8414/5383', '8413/5384', '8415/5384']) {
    const file = `${TILES}/${key}.geojson.gz`;
    if (!fs.existsSync(file)) continue;
    const features = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features as Feature[];
    // Chunks of the sizes the layer groups (whole tile and halves), so both sides of the 4000-triangle minimum occur.
    for (const group of [features, features.slice(0, features.length >> 1), features.slice(0, 3)]) {
      const chunk = buildFeatureChunk(group, 'photo');
      if (!chunk.vertexCount) continue;
      for (const n of [2, 3, 4]) {
        // Worker: the chunk as built (before the lift).
        const plan = planTiles(chunk.positions, chunk.indices, n, 4000, 3, chunk.ranges);
        assert.equal(plannedTransferables(plan).length, plan?.length ?? 0);
        // Main: the lift, then the heights.
        const positions = chunk.positions.slice();
        lift(positions, chunk.ranges, chunks * 7 + n);
        same(plan && finishTiles(positions, plan), splitIntoTiles(positions, chunk.indices, n, 4000, 3, chunk.ranges), `${key}/${group.length}/${n}`);
        if (plan) cut++;
      }
      chunks++;
    }
  }
  assert.ok(chunks >= 6 && cut >= 6, `${chunks} chunks, ${cut} cut`);
});

// Lane R5-A #260 step 4: the banded water test (groundStore.ts bandedWaterTest) answers exactly as the plain one, and a
// cell built with it (`planShare`, default on) is byte-identical to one built with `?groundPlanShare=0`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GroundStore, WATER_BAND_M, waterTest } from './groundStore';
import { buildCell, type BuiltCell } from './groundCell';
import type { Vec2 } from './surface';

const ROOT = 'public/data/extracts/amsterdam';
const haveCells = existsSync(`${ROOT}/roads-v1/cells.json`) && existsSync(`${ROOT}/own-ground-osm-v1/cells.json`);
const read = async (path: string) => { const b = readFileSync(`${ROOT}/${path}`); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

test('banded water test: same answer as the plain test on a ring with a hole, at vertices and on band lines', () => {
  const outer: Vec2[] = [[0, 0], [40, 3], [37, 33.5], [20, 24], [2, 40]], hole: Vec2[] = [[10, 8], [24, 8], [16, 16]];
  const polys = [[outer, hole], [[[50, -5], [60, -5], [60, 70], [50, 70]] as Vec2[]]];
  const plain = waterTest(polys, false), banded = waterTest(polys, true);
  const ys = [...outer, ...hole].map(p => p[1]).concat([0, WATER_BAND_M, 2 * WATER_BAND_M, 3 * WATER_BAND_M, 4 * WATER_BAND_M, 40, -5, 70]);
  let n = 0;
  for (let x = -2; x <= 62; x += 0.37) for (const y of [...ys, ...Array.from({ length: 90 }, (_, i) => -6 + i * 0.83)]) { assert.equal(banded(x, y), plain(x, y), `${x},${y}`); n++; }
  assert.ok(n > 10_000);
});

test('banded water test: same answer on a real canal cell', { skip: !haveCells }, async () => {
  const store = new GroundStore(read, { roads: true });
  await store.init();
  const geo = await store.waterCell('-1_0');
  assert.ok(geo && geo.polygons.length);
  const plain = waterTest(geo.polygons, false), banded = waterTest(geo.polygons, true), [x0, y0, x1, y1] = store.cellRect('-1_0');
  let wet = 0;
  for (let x = x0; x < x1; x += 3.1) for (let y = y0; y < y1; y += 2.9) { const b = banded(x, y); assert.equal(b, plain(x, y)); if (b) wet++; }
  assert.ok(wet > 100, `wet samples ${wet}`);
});

const hashCell = (c: BuiltCell): string => {
  const h = createHash('sha256');
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (ArrayBuffer.isView(v)) { h.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { for (const k of Object.keys(v).sort()) { if (k === 'stats') continue; h.update(k); walk((v as Record<string, unknown>)[k]); } return; }
    h.update(String(v));
  };
  walk(c);
  return h.digest('hex');
};

// The -1_0 start (4 LOD 0 cells in its block, the hardest start on #260): its own cell and a neighbour built after it.
test('planShare: cells byte-identical with ?groundPlanShare=0', { skip: !haveCells, timeout: 240_000 }, async () => {
  const builds = async (planShare: boolean) => {
    const store = new GroundStore(read, { roads: true, planShare });
    await store.init();
    return [hashCell(buildCell(await store.cellInput('-1_0', 0))), hashCell(buildCell(await store.cellInput('0_0', 0)))];
  };
  assert.deepEqual(await builds(true), await builds(false));
});

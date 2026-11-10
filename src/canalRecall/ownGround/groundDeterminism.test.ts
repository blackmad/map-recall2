// Ground determinism (#260 follow-up): a cell's mesh does not depend on which cells its GroundStore prepared before it.
// -1_1 was the probe's cut case (scripts/own-ground/probe-cell-determinism.ts): after its neighbours in reverse order
// the ramp cuts of ways 312974660 and 67498388 went to whichever plan reached them first, and the cell hashed
// differently from a fresh store's (`deterministic: false` still does). Deterministic (the default) it is byte-identical.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GroundStore } from './groundStore';
import { buildCell, type BuiltCell } from './groundCell';

const ROOT = 'public/data/extracts/amsterdam';
const haveCells = existsSync(`${ROOT}/roads-v1/cells.json`) && existsSync(`${ROOT}/own-ground-osm-v1/cells.json`);
const read = async (path: string) => { const b = readFileSync(`${ROOT}/${path}`); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

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

test('ground determinism: a cell built by a fresh store and after its neighbours hashes the same', { skip: !haveCells, timeout: 300_000 }, async () => {
  const build = async (before: string[], deterministic = true) => {
    const store = new GroundStore(read, { parks: true, roads: true, rails: true, deterministic });
    await store.init();
    for (const n of before) await store.cellInput(n, 0);
    return hashCell(buildCell(await store.cellInput('-1_1', 0)));
  };
  const reverse = GroundStore.neighbours('-1_1').filter(k => k !== '-1_1').reverse();
  const fresh = await build([]);
  assert.equal(await build(reverse), fresh);
  // The pin bites: first-arrival planning (`?groundDeterministic=0`) differs after the same history.
  assert.notEqual(await build(reverse, false), await build([], false));
});

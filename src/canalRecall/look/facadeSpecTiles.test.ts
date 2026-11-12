// F1 S4b (#380): the worker's spec table hands the record packer what the world compiler's does (shellBake.ts
// loadHouseSpecTable), so a near chunk and the baked tier pack one record per pand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SpecTileTable, packChunkRecords, specTilesOf } from './facadeSpecTiles.ts';
import { FACADE_RECORD_BYTES, packFacadeRecordFor } from './facadeRecord.ts';
import { loadHouseSpecTable } from '../../../scripts/world/shellBake.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const tileCentre = (x: number, y: number, z = 14): [number, number] => {
  const n = 2 ** z, lng = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return [lng, lat];
};
const fileFetch = (async (url: string) => {
  const p = String(url).replace(/^file:\/\//, '');
  return fs.existsSync(p) ? new Response(fs.readFileSync(p)) : new Response(null, { status: 404 });
}) as unknown as typeof fetch;

test('tiles a footprint touches: one inside a tile, two across an edge', () => {
  const [lng, lat] = tileCentre(8414, 5384);
  assert.deepEqual(specTilesOf([{ geometry: { type: 'Polygon', coordinates: [[[lng, lat], [lng + 1e-5, lat], [lng, lat + 1e-5], [lng, lat]]] } }]), ['8414/5384']);
  const edge = ((8415 / 2 ** 14) * 360) - 180;
  assert.deepEqual(specTilesOf([{ geometry: { type: 'Polygon', coordinates: [[[edge - 1e-5, lat], [edge + 1e-5, lat], [edge, lat + 1e-5], [edge - 1e-5, lat]]] } }]), ['8414/5384', '8415/5384']);
  assert.deepEqual(specTilesOf([{ geometry: null }]), []);
});

test('the worker table equals the compiler table on every published pand', async () => {
  const compiled = loadHouseSpecTable(EXTRACT, 'house-specs');
  assert.ok(compiled.size > 1000, `spec table ${compiled.size}`);
  const table = new SpecTileTable(`file://${path.resolve(EXTRACT, 'house-specs')}`, fileFetch);
  let checked = 0;
  for (const x of fs.readdirSync(path.join(EXTRACT, 'house-specs/14'))) for (const f of fs.readdirSync(path.join(EXTRACT, 'house-specs/14', x))) {
    const y = Number(f.split('.')[0]);
    const specFor = await table.specFor([{ geometry: { type: 'Point', coordinates: tileCentre(Number(x), y) } }]);
    const ids = Object.keys((JSON.parse((await import('node:zlib')).gunzipSync(fs.readFileSync(path.join(EXTRACT, 'house-specs/14', x, f))).toString()) as { buildings: object }).buildings);
    for (const id of ids) { assert.deepEqual(specFor(id), compiled.get(id), id); checked++; }
  }
  assert.ok(checked >= compiled.size, `${checked} checked`);
});

test('chunk records: record k is inputs[k] packed', () => {
  const inputs = [{ id: 'a', style: 'canal', wallHex: '#8a4b3a', heightM: 12 }, { id: 'b', style: 'c19', wallHex: '#b5a58a', heightM: 15 }] as never[];
  const set = packChunkRecords(inputs);
  assert.equal(set.count, 2);
  assert.deepEqual(set.bytes.subarray(FACADE_RECORD_BYTES), packFacadeRecordFor(inputs[1]));
});

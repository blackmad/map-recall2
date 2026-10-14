// Houseboats under land: build the own-ground cells (the worker's code path) and
// report every houseboat footprint where the top visible ground layer at a
// sample point inside it is not water (land, a quay band, a path ...).
//
//   npx tsx scripts/own-ground/check-houseboat-land.ts [cell ...]   # default: Frederik Hendrik- and Spaarndammerbuurt
//
// Exit code 1 when any boat in the checked cells is covered.
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { houseboatsOnLand, HOUSEBOAT_LAND_CELLS } from '../../src/canalRecall/ownGround/houseboatLand.ts';

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
};

// MOORINGS=0: without the berths (moorings.ts), to see what they fix.
const store = new GroundStore(readExtract, { moorings: process.env.MOORINGS !== '0' });
await store.init();
const boats = (JSON.parse(readFileSync(join(ROOT, 'houseboats.json'), 'utf8')).boats as { id: string; ring: [number, number][] }[])
  .map(b => ({ id: b.id, ring: b.ring.map(([lng, lat]) => toLocal(lng, lat)) }));
const cells = process.argv.slice(2).length ? process.argv.slice(2) : HOUSEBOAT_LAND_CELLS;
let covered = 0, total = 0;
for (const key of cells) {
  const cell = buildCell(await store.cellInput(key, 0));
  const r = houseboatsOnLand(cell, boats);
  total += r.boats; covered += r.covered.length;
  console.log(JSON.stringify({ cell: key, boats: r.boats, covered: r.covered.length }));
  for (const c of r.covered) console.log('  ', JSON.stringify(c));
}
console.log(JSON.stringify({ cells: cells.length, boats: total, covered }));
process.exit(covered ? 1 : 0);

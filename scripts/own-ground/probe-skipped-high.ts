// roads-v1 deck polygons (h ≥ 1) that no deck or water carries, per cell: the count the
// `check-ground-cells` roads pin caps, plus where each skipped polygon lies.
//
//   node --import tsx scripts/own-ground/probe-skipped-high.ts [key,key…] [--list]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const s = new GroundStore(readExtract, { roads: true });
await s.init();
const arg = process.argv.slice(2).find(a => !a.startsWith('--'));
const keys = arg ? arg.split(',') : [[...s.roadCells].sort()[0]];
// --before=k,k… builds those cells first (the store places decks as cells are prepared: an order-dependence probe).
const before = process.argv.find(a => a.startsWith('--before='))?.slice(9).split(',') ?? [];
for (const k of before) if (s.covers(k)) buildCell(await s.cellInput(k, 0));
// --reinit: init() again after those builds (check-ground-cells re-inits the roads store before each regression group).
if (process.argv.includes('--reinit')) await s.init();
for (const key of keys) {
  const c = buildCell(await s.cellInput(key, 0));
  const r = c.stats.roads;
  console.log(key, JSON.stringify({ skippedHigh: r?.skippedHigh, onDeck: r?.onDeck, decks: c.stats.decks, flatDecks: c.stats.flatDecks }));
}

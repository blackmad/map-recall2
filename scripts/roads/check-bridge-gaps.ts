// Named bridge road-gap regressions (roadRegressions BRIDGE_GAPS; lane road-bridge-gaps 2026-11-01, issue #178): each
// way probed as scripts/roads/probe-bridge-gaps.ts does, with the fix (at most maxGapM2 of carriageway off the road)
// and without it (`bridgeGaps: false`, at least pinMin: the pin is live). Exit 1 on a failed check.
//
//   npx tsx scripts/roads/check-bridge-gaps.ts [--only=id,id]
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { BRIDGE_GAPS } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { probeCell } from './probe-bridge-gaps.ts';

const ROOT = 'public/data/extracts/amsterdam';
const read = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const b = readFileSync(file);
  return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b);
};
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');

const cached = (store: GroundStore) => {
  const cache = new Map<string, BuiltCell>();
  return async (k: string) => { let c = cache.get(k); if (!c) { c = buildCell(await store.cellInput(k, 0)); cache.set(k, c); } return c; };
};
// The before also keeps the railing stubs the plein rule took off (groundCell `plein`, lane fb-bridges 2026-11-13): over
// BRU0007 they stood across the carriageway, and the pins' before measured part of its gap through them.
const on = new GroundStore(read, { roads: true }), dryOn = new GroundStore(read, { roads: true, dryWayDecks: true }), off = new GroundStore(read, { roads: true, bridgeGaps: false, pleinRails: false });
await on.init(); await dryOn.init(); await off.init();
const cellOn = cached(on), cellDry = cached(dryOn), cellOff = cached(off);
let failed = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
for (const reg of BRIDGE_GAPS) {
  if (only && !only.includes(reg.id)) continue;
  const [x, y] = toLocal(reg.at[0], reg.at[1]), key = on.cellAt(x, y), ids = new Set([reg.way]);
  const [a] = reg.dry ? await probeCell(dryOn, key, cellDry, ids) : await probeCell(on, key, cellOn, ids), [b] = await probeCell(off, key, cellOff, ids);
  if (!a || !b) { check(false, `${reg.id}: way ${reg.way} not found as a bridge way in cell ${key}`); continue; }
  check(a.bandGapM2 <= reg.maxGapM2, `${reg.id}${reg.dry ? ' [dryWayDecks on]' : ''} (${reg.label}): ${a.bandGapM2} m² of carriageway off the road, centreline ${a.centreGapM} m (≤ ${reg.maxGapM2} m²; shows ${JSON.stringify(a.shows)})`);
  check(b.bandGapM2 >= reg.pinMin, `${reg.id}: without the fix ${b.bandGapM2} m² (≥ ${reg.pinMin}, the pin is live)`);
}
console.log(failed ? `${failed} failed` : 'all bridge-gap regressions pass');
if (failed) process.exitCode = 1;

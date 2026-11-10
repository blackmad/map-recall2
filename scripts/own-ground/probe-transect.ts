// Layer heights along a straight transect (lane rails-class 2026-11-10): which ground layers stand where, top first.
//   npx tsx scripts/own-ground/probe-transect.ts <lng0> <lat0> <lng1> <lat1> [stepM=4] [--roads=0]
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { readExtract } from './probe-rails.ts';
import { triIndex, hitsAt } from './probe-rails-class.ts';
import { GROUND_LAYERS } from '../../src/canalRecall/ownGround/groundCell.ts';

const [lng0, lat0, lng1, lat1, step] = process.argv.slice(2, 7).map(Number);
const store = new GroundStore(readExtract, { roads: !process.argv.includes('--roads=0') });
await store.init();
const [x0, y0] = toLocal(lng0, lat0), [x1, y1] = toLocal(lng1, lat1), len = Math.hypot(x1 - x0, y1 - y0);
const keys = new Set<string>();
for (let s = 0; s <= len; s += 40) keys.add(store.cellAt(x0 + (x1 - x0) * s / len, y0 + (y1 - y0) * s / len));
const ixs = [];
for (const k of keys) if (store.covers(k)) ixs.push(triIndex(buildCell(await store.cellInput(k, 0)), new Set(GROUND_LAYERS)));
for (let s = 0; s <= len; s += step || 4) {
  const x = x0 + (x1 - x0) * s / len, y = y0 + (y1 - y0) * s / len;
  const hits = ixs.flatMap(ix => hitsAt(ix, x, y)).filter(h => h.layer !== 'water' || true).sort((a, b) => b.z - a.z);
  console.log(`${s.toFixed(0).padStart(4)} m `, hits.slice(0, 5).map(h => `${h.layer}@${h.z.toFixed(2)}`).join('  '));
}

// Top surface at lng/lat points in the streamed cells (named-regression helper).
//
//   npx tsx scripts/own-ground/probe-top.ts <lng,lat> [<lng,lat> ...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
for (const arg of process.argv.slice(2)) {
  const [lng, lat] = arg.split(',').map(Number), [x, y] = toLocal(lng, lat);
  const cells: BuiltCell[] = [];
  for (const k of GroundStore.neighbours(store.cellAt(x, y))) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
  const hits = cells.flatMap(c => layersAt(c, x, y).hits).sort((a, b) => b.z - a.z);
  console.log(arg, 'top', cells.map(c => layersAt(c, x, y)).find(h => h.top)?.top, JSON.stringify(hits.slice(0, 5)));
}

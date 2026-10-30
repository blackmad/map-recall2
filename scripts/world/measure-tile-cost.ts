/** Before/after per z14 tile, Node desktop CPU: the default path's main-thread work (gunzip, JSON.parse,
 *  clone, dropNestedDuplicates, facts + roof-facts parse and stamp, decorator chain) against world-v1's
 *  (inflate + decode of the tile's cells, assembly). Run on the same tiles:
 *   node --import tsx scripts/world/measure-tile-cost.ts [artifacts/world/staging] [tile,tile,...] */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { gameChain, loadTile } from './pipeline.js';
import { decodeCell, rawFeature, styledFeature } from '../../src/canalRecall/world/cellFormat.js';
const dir = path.resolve(process.argv[2] ?? 'artifacts/world/staging');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const tiles = process.argv[3]?.split(',') ?? ['8414/5384', '8413/5384', '8415/5384', '8414/5385', '8420/5385', '8416/5383'];
const chain = gameChain();
for (const t of tiles) await loadTile(t, chain); // warm
console.log('| tile | buildings | default ms (parse+clone+nest+enrich+decorate) | world ms (inflate+decode cells+assemble) | world cells |\n|---|---:|---:|---:|---:|');
for (const t of tiles) {
  let t0 = performance.now(); const rows = await loadTile(t, chain); const before = performance.now() - t0;
  t0 = performance.now(); let n = 0;
  for (const key of index.tileCells[t] ?? []) { const cell = decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'cells', `${key}.bin`)))); for (const b of cell.buildings) if (b.tile === t) { styledFeature(b, rawFeature(b)); n++; } }
  const after = performance.now() - t0;
  console.log(`| ${t} | ${rows.length}${n !== rows.length ? ` (world ${n})` : ''} | ${before.toFixed(1)} | ${after.toFixed(1)} | ${(index.tileCells[t] ?? []).length} |`);
}

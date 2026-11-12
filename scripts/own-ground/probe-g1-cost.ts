// Lane G1: triangles and build time per cell with a fix on and off (the cost side of the A/B).
//   node --import tsx scripts/own-ground/probe-g1-cost.ts <fix> [cells]      e.g. floatBound -4_-3,-5_1
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib'; import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
const read = async (p: string) => { const b = readFileSync(join('public/data/extracts/amsterdam', p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
async function main() {
  const fix = process.argv[2], keys = (process.argv[3] ?? '-4_-3,-5_1,0_0').split(',');
  for (const on of [false, true]) {
    const s = new GroundStore(read, { parks: true, roads: true, rails: true, [fix]: on } as never); await s.init();
    for (const key of keys) {
      const input = await s.cellInput(key, 0);
      buildCell(input);
      const t0 = performance.now(), cell = buildCell(input), ms = performance.now() - t0;
      console.log(JSON.stringify({ fix, on, key, triangles: cell.stats.triangles, land: cell.stats.byLayer.land, ms: Math.round(ms) }));
      s.forgetCells(new Set(GroundStore.neighbours(key)));
    }
  }
}
void main();

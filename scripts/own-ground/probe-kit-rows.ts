// Dump the bridge kit's input rows (stations, edges, water flags) for one bridge as the cell builds it.
//
//   npx tsx scripts/own-ground/probe-kit-rows.ts <BRUxxxx> [--roads]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { kitTrace } from '../../src/canalRecall/ownGround/bridgeKit.ts';

const ROOT = 'public/data/extracts/amsterdam';
const id = process.argv[2];
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, process.argv.includes('--roads') ? { roads: true } as never : undefined);
await store.init();
for (const k of [...store.osmCells]) {
  await store.prepareCell(k);
  const deck = store.decks(k).find(d => d.profile.id === id);
  if (!deck) continue;
  const p = deck.profile;
  console.log(id, 'cell', k, 'deck', p.deck, 'water', p.water, 'sides', p.sides, 'span', deck.span);
  kitTrace.input = input => {
    if (input.id !== id) return;
    console.log('kind', input.kind, 'material', input.material, 'parapet', input.parapet.map(v => v.toFixed(1)), 'spans', JSON.stringify(input.spans), 'flush', input.flush, 'lod', input.lod);
    const c0 = input.rows[0].c;
    for (const r of input.rows) {
      const hl = Math.hypot(r.L[0] - r.c[0], r.L[1] - r.c[1]), hr = Math.hypot(r.R[0] - r.c[0], r.R[1] - r.c[1]);
      console.log(`s=${r.s.toFixed(1)} c=[${(r.c[0] - c0[0]).toFixed(1)},${(r.c[1] - c0[1]).toFixed(1)}] hl=${hl.toFixed(1)} hr=${hr.toFixed(1)} z=${r.z.toFixed(2)} zL=${r.zL.toFixed(2)} zR=${r.zR.toFixed(2)} w=${+r.water}${+r.wL}${+r.wR} gL=${r.gL.toFixed(2)} gR=${r.gR.toFixed(2)}`);
    }
    kitTrace.input = null;
  };
  buildCell(await store.cellInput(k, 0));
  break;
}

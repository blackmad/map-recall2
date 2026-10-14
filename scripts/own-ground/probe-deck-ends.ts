// Deck ends against the banks for measured decks in a box (lane bridge-fidelity 2026-10-14): the measured span's ends
// on water (before the reach), the reach to the bank, and what still floats.
//   npx tsx scripts/own-ground/probe-deck-ends.ts --box=4.865,52.385,4.89,52.40 [--ids=BRU2433]
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { deckReach, floatingEnds } from '../../src/canalRecall/ownGround/decks.ts';
import { buildWaterMask, maskDistance, type WaterGeometry } from '../../src/canalRecall/ownGround/water.ts';
import { CANAL_WATER_Z } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [W, S, E, N] = (flag('box') ?? '4.855,52.355,4.915,52.385').split(',').map(Number);
const only = flag('ids')?.split(',');
const store = new GroundStore(async path => { const file = join(ROOT, path); if (!existsSync(file)) throw new Error(path); const b = readFileSync(file); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const inBox = (x: number, y: number) => { const [lng, lat] = fromLocal(x, y); return lng >= W && lng <= E && lat >= S && lat <= N; };
const seen = new Set<string>();
let measured = 0, unlanded = 0, reached = 0, still = 0;
for (const k of [...store.osmCells].filter(c => store.covers(c)).sort()) {
  const [x0, y0, x1, y1] = store.cellRect(k);
  if (!inBox((x0 + x1) / 2, (y0 + y1) / 2)) continue;
  await store.prepareCell(k);
  const input = await store.cellInput(k, 0), around = input.waterAround;
  const geo: WaterGeometry = { polygons: around.flatMap(g => g.polygons), shores: around.flatMap(g => g.shores), levels: around.flatMap(g => g.levels ?? g.polygons.map(() => CANAL_WATER_Z)) };
  if (!geo.polygons.length) continue;
  const mask = buildWaterMask(geo, x0 - 150, y0 - 150, x1 + 150, y1 + 150, 1, 4, input.deckRingsAround);
  const overWater = (x: number, y: number) => maskDistance(mask, x, y) < 0;
  for (const deck of input.decks) {
    const id = deck.profile.id;
    if (seen.has(id) || (only && !only.includes(id))) continue;
    seen.add(id); measured++;
    const r = deckReach(deck, overWater), f = floatingEnds(deck, overWater, input.surface.height, input.surface.ground);
    const moved = r.reach[0] !== deck.profile.deck[0] || r.reach[1] !== deck.profile.deck[1];
    if (moved || f.length) {
      unlanded++; if (moved && !f.length) reached++; if (f.length) still++;
      console.log(id, `deck ${deck.profile.deck.map(v => v.toFixed(1))} reach ${r.reach.map(v => v.toFixed(1))}`, f.map(e => `${e.end}:${e.reason}`).join(' '));
    }
  }
}
console.log(JSON.stringify({ measured, endsOffTheBank: unlanded, reachedTheBank: reached, stillFloating: still }));

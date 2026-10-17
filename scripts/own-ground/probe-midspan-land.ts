// Land strips under a measured deck's span (lane prinsengracht-bridge 2026-10-16, the Angenietje Swarthofbrug
// BRU0067 at the Prinsengracht/Leidsegracht: two water polygons meet under the bridge with a 2 m gap, so a land strip
// with quay walls crossed the canal under the deck, the kit's side faces zigzagged between their water and land
// bottoms and abutment walls stood in the canal). Lists every deck whose centreline, inside the deck span, crosses a
// land run with water on both sides along the axis, after the openings (water.ts openUnderFootbridges).
//   npx tsx scripts/own-ground/probe-midspan-land.ts [--openings=0] [--box=W,S,E,N]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { midSpanLand } from '../../src/canalRecall/ownGround/water.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [W, S, E, N] = (flag('box') ?? '-180,-90,180,90').split(',').map(Number);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { openings: flag('openings') !== '0' });
await store.init();
const seen = new Set<string>();
let n = 0, wide = 0;
for (const k of [...store.osmCells].sort()) {
  const [x0, y0, x1, y1] = store.cellRect(k), [lng, lat] = fromLocal((x0 + x1) / 2, (y0 + y1) / 2);
  if (lng < W - 0.01 || lng > E + 0.01 || lat < S - 0.01 || lat > N + 0.01) continue;
  await store.prepareCell(k);
  for (const d of store.decks(k)) {
    const p = d.profile;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const m = p.x.length >> 1, [mlng, mlat] = fromLocal(p.x[m], p.y[m]);
    if (mlng < W || mlng > E || mlat < S || mlat > N) continue;
    const key = store.cellAt(p.x[m], p.y[m]);
    const geos = (await Promise.all(GroundStore.neighbours(key).map(c => store.waterCell(c)))).filter(g => !!g);
    const runs = midSpanLand(p, geos.flatMap(g => g!.polygons));
    if (!runs.length) continue;
    n++;
    const widths = [...p.halfWidth].map(v => 2 * v).sort((a, b) => a - b), w = widths[widths.length >> 1];
    if (w > 6) wide++;
    console.log(`${p.id} ${JSON.stringify(p.name)} ${p.family} width=${w.toFixed(1)} at ${mlng.toFixed(5)},${mlat.toFixed(5)} land ${runs.map(r => `${r[0].toFixed(1)}..${r[1].toFixed(1)}`).join(' ')} deck=${p.deck.map(v => v.toFixed(1))}`);
  }
}
console.log(`${n} decks with a land strip under the span (${wide} wider than 6 m), of ${seen.size}`);

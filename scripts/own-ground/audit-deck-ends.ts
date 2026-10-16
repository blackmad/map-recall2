// Measured deck ends that do not read as road (lane prinsengracht-bridge 2026-10-16; roadRegressions deckEndMisses):
// for every measured deck in the roads-v1 cells, probes along its ends at the road centre and ±0.2–0.8 of its half-width,
// 3 m outside each span end to 2 m inside; a deck fails when at least 3 probes show the deck top, water or nothing.
// With `--pin` the same with the deck-end fix off (GroundStore deckEnds: false).
//
//   npx tsx scripts/own-ground/audit-deck-ends.ts [--pin] [--cells=-2_0,-2_-1] [--json=out.json] [--list]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { deckEndMisses } from '../../src/canalRecall/ownGround/roadRegressions.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const read = async (path: string) => { const f = join(ROOT, path); if (!existsSync(f)) throw new Error(path); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

export interface DeckEndAudit { decks: number; failing: { id: string; name: string; lng: number; lat: number; misses: number; probes: number; tops: string }[] }

export async function auditDeckEnds(store: GroundStore, keys: string[], minMisses = 3): Promise<DeckEndAudit> {
  const cache = new Map<string, BuiltCell>();
  const cell = async (k: string) => {
    let c = cache.get(k);
    if (!c) { c = buildCell(await store.cellInput(k, 0)); cache.set(k, c); if (cache.size > 24) cache.delete(cache.keys().next().value!); }
    return c;
  };
  const failing: DeckEndAudit['failing'] = [];
  let decks = 0;
  for (const key of keys) {
    if (!store.covers(key)) continue;
    await store.prepareCell(key);
    for (const d of store.decks(key)) {
      const p = d.profile;
      if (p.family === 'way-deck') continue;
      decks++;
      const cells: BuiltCell[] = [];
      for (const k of GroundStore.neighbours(key)) if (store.covers(k)) cells.push(await cell(k));
      const r = deckEndMisses(cells, d);
      if (r.misses.length >= minMisses) {
        const m = p.x.length >> 1, [lng, lat] = fromLocal(p.x[m], p.y[m]), tops = new Map<string, number>();
        for (const q of r.misses) tops.set(q.top, (tops.get(q.top) ?? 0) + 1);
        failing.push({ id: p.id, name: p.name, lng: +lng.toFixed(5), lat: +lat.toFixed(5), misses: r.misses.length, probes: r.probes, tops: [...tops].map(([k, v]) => `${k}:${v}`).join(' ') });
      }
    }
  }
  return { decks, failing };
}

async function main(): Promise<void> {
  const pin = process.argv.includes('--pin');
  const store = new GroundStore(read, { roads: true, ...(pin ? { deckEnds: false } : {}) });
  await store.init();
  const keys = flag('cells')?.split(',') ?? [...store.roadCells].sort();
  const r = await auditDeckEnds(store, keys);
  console.log(`${pin ? 'deck-end fix off' : 'default'}: ${r.failing.length} of ${r.decks} measured decks with ≥ 3 end probes off the road`);
  if (process.argv.includes('--list')) for (const f of r.failing) console.log(`  ${f.id} ${JSON.stringify(f.name)} ${f.lng},${f.lat} ${f.misses}/${f.probes} (${f.tops})`);
  if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(r, null, 1));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();

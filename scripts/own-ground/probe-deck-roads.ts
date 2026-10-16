// The BGT road polygons on and around a measured deck (lane prinsengracht-bridge 2026-10-16): per polygon its class,
// mesh, level (h), area and extent along / across the deck axis, so a bridge's survey can be read against its deck.
//   npx tsx scripts/own-ground/probe-deck-roads.ts BRU0064 [BRU0065 ...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeRoadLine } from '../../src/canalRecall/ownGround/roadCells.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const ids = process.argv.slice(2);
for (const k of [...store.osmCells].sort()) {
  await store.prepareCell(k);
}
for (const id of ids) {
  const deck = store.surface.decks.find(d => d.profile.id === id);
  if (!deck) { console.log(id, 'not placed'); continue; }
  const p = deck.profile, n = p.x.length, m = n >> 1;
  const ux = p.x[n - 1] - p.x[0], uy = p.y[n - 1] - p.y[0], l = Math.hypot(ux, uy), u = [ux / l, uy / l], nn = [-u[1], u[0]];
  // s of the deck's middle station along the chord, so `along` reads against p.deck.
  const s0 = p.s[m] - ((p.x[m] - p.x[0]) * u[0] + (p.y[m] - p.y[0]) * u[1]);
  console.log(`${id} ${p.name} deck=${p.deck.map(v => v.toFixed(1))} water=${p.water?.map(v => v.toFixed(1))} hw=${p.halfWidth[m].toFixed(2)} sides=${p.sides?.map(v => v.toFixed(1))}`);
  const key = store.cellAt(p.x[m], p.y[m]);
  for (const c of GroundStore.neighbours(key)) {
    const rc = await store.roadCell(c);
    for (const sf of rc?.surfaces ?? []) {
      const ring = decodeRoadLine(sf.r[0]);
      let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity, area = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x, y] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
        area += x * y2 - x2 * y;
        const al = s0 + (x - p.x[0]) * u[0] + (y - p.y[0]) * u[1], ac = (x - p.x[m]) * nn[0] + (y - p.y[m]) * nn[1];
        a0 = Math.min(a0, al); a1 = Math.max(a1, al); c0 = Math.min(c0, ac); c1 = Math.max(c1, ac);
      }
      if (a1 < p.deck[0] - 3 || a0 > p.deck[1] + 3 || c1 < -15 || c0 > 15) continue;
      console.log(`  ${sf.h >= 1 ? 'DECK' : 'grnd'} h=${sf.h} ${sf.c}/${sf.k} area=${Math.abs(area / 2).toFixed(1)} along=${a0.toFixed(1)}..${a1.toFixed(1)} across=${c0.toFixed(1)}..${c1.toFixed(1)} verts=${ring.length} holes=${sf.r.length - 1} cell=${c}`);
    }
  }
}

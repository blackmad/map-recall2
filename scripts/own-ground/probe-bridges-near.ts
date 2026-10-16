// List the measured decks and flat footprints within a radius of a point, with the register hint and the facts.
//
//   npx tsx scripts/own-ground/probe-bridges-near.ts <lng> <lat> [radiusM=120]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { bridgeFacts, registerHint, flatHintAt } from '../../src/canalRecall/ownGround/bridgeKit.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [lng, lat, rad] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 120)];
const [x, y] = toLocal(lng, lat);
for (const k of [...store.osmCells]) {
  const [x0, y0, x1, y1] = store.cellRect(k);
  if (x < x0 - rad || x > x1 + rad || y < y0 - rad || y > y1 + rad) continue;
  await store.prepareCell(k);
  for (const d of store.decks(k)) {
    const p = d.profile, n = p.x.length, m = n >> 1, dist = Math.hypot(p.x[m] - x, p.y[m] - y);
    if (dist > rad) continue;
    const hw = [...p.halfWidth], ll = fromLocal(p.x[m], p.y[m]);
    console.log('deck', p.id, JSON.stringify(p.name), p.family, `cell ${k} at ${ll[0].toFixed(5)},${ll[1].toFixed(5)} d=${dist.toFixed(0)}m len=${(p.s[n - 1] - p.s[0]).toFixed(1)} deck=${p.deck.map(v => v.toFixed(1))} water=${p.water?.map(v => v.toFixed(1))} hw=${Math.min(...hw).toFixed(1)}..${Math.max(...hw).toFixed(1)} sides=${p.sides} hump=${(Math.max(...p.h) - Math.min(...p.h)).toFixed(2)}`, 'hint', JSON.stringify(registerHint(p.id)), 'facts', JSON.stringify(bridgeFacts(p.id)));
  }
  const meta = store.flatDeckMeta(k);
  store.flatDecks(k).forEach((ring, i) => {
    const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length, dist = Math.hypot(cx - x, cy - y);
    if (dist > rad) return;
    const ll = fromLocal(cx, cy);
    console.log('flat', meta[i]?.id, `cell ${k} at ${ll[0].toFixed(5)},${ll[1].toFixed(5)} d=${dist.toFixed(0)}m`, 'hint', JSON.stringify(flatHintAt(cx, cy)));
  });
}

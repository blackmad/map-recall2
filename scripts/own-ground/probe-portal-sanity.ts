// Closed tunnel mouths with and without portal sanity (lane G1 item C): per G0 cell, cuts, slots, closed mouths and the
// mouths with no tunnel-tagged way vertex within 25 m (G0 audit-ground portals()). node --import tsx scripts/own-ground/probe-portal-sanity.ts
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
const ROOT = 'public/data/extracts/amsterdam';
const read = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
async function main() {
for (const sane of [false, true]) {
  const s = new GroundStore(read, { parks: true, roads: true, rails: true, portalSanity: sane } as never); await s.init();
  let closed = 0, unsupported = 0, cuts = 0, slots = 0;
  for (const key of ['2_3', '-3_4', '-4_-4', '-4_-3', '-5_-3']) {
    const input = await s.cellInput(key, 0);
    const pts: [number, number][] = [];
    for (const o of [input.osm, ...input.osmAround]) for (const w of o?.ways ?? []) if (w.tags.tunnel && w.tags.tunnel !== 'no') for (const g of w.g) pts.push(toLocal(g[0], g[1]));
    const [x0, y0, x1, y1] = input.rect;
    for (const c of input.cuts ?? []) { const cx = (c.bbox[0] + c.bbox[2]) / 2, cy = (c.bbox[1] + c.bbox[3]) / 2; if (cx < x0 || cx >= x1 || cy < y0 || cy >= y1) continue; cuts++; if (c.kind === 'slot') slots++;
      for (const p of c.portals) if (!p.open) { closed++; console.log(sane, key, c.id, "closed", c.motor); if (!pts.some(q => Math.hypot(q[0] - c.x[p.at], q[1] - c.y[p.at]) <= 25)) { unsupported++; console.log(sane, key, c.id, 'unsupported'); } } }
  }
  console.log({ sane, cuts, slots, closed, unsupported });
}
}
void main();

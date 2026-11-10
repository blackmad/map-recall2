// Named ways near a point (lane R5-C1 2026-11-08): id, highway, name, bridge/tunnel, nearest distance.
//   npx tsx scripts/own-ground/probe-named-ways.ts <lng> <lat> [radiusM=80]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays } from '../../src/canalRecall/ownGround/streets.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [lng, lat, rad] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 80)];
const [x, y] = toLocal(lng, lat);
const input = await store.cellInput(store.cellAt(x, y), 0);
const seen = new Set<number>();
for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) {
  if (seen.has(w.id) || !w.tags.highway) continue; seen.add(w.id);
  let best = Infinity, at = w.points[0];
  for (const p of w.points) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < best) { best = d; at = p; } }
  if (best > rad) continue;
  const ll = fromLocal(at[0], at[1]);
  console.log(w.id, w.tags.highway, JSON.stringify(w.tags.name ?? ''), w.tags.bridge ? `bridge=${w.tags.bridge}` : '', w.tags.tunnel ? `tunnel=${w.tags.tunnel}` : '', w.tags['bridge:name'] ?? '', `d=${best.toFixed(0)} near ${ll[0].toFixed(5)},${ll[1].toFixed(5)}`);
}

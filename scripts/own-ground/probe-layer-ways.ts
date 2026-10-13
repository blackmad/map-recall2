// Which ways draw a layer near a point (debugging a stray patch of a surface).
//
//   npx tsx scripts/own-ground/probe-layer-ways.ts <lng> <lat> <radiusM> <layer>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays, resolvePriorSidewalks, buildStreets, type LocalWay } from '../../src/canalRecall/ownGround/streets.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [lng, lat, radius, layer] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const [x, y] = toLocal(lng, lat);
const input = await store.cellInput(store.cellAt(x, y), 0);
const seen = new Set<number>(), all: LocalWay[] = [];
for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) if (!seen.has(w.id)) { seen.add(w.id); all.push(w); }
const ways = resolvePriorSidewalks(all);
for (const w of ways) {
  if (!w.points.some(q => Math.hypot(q[0] - x, q[1] - y) < radius + 30)) continue;
  const m = (buildStreets(ways, () => 0, { step: 3, only: q => q.id === w.id }) as unknown as Record<string, { positions: number[]; indices: number[] }>)[layer];
  let n = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (let t = 0; t < m.indices.length; t += 3) {
    const i = m.indices[t] * 3, cx = m.positions[i], cy = m.positions[i + 1];
    if (Math.hypot(cx - x, cy - y) > radius) continue;
    n++; minx = Math.min(minx, cx - x); maxx = Math.max(maxx, cx - x); miny = Math.min(miny, cy - y); maxy = Math.max(maxy, cy - y);
  }
  if (n) console.log(`${layer} way ${w.id} ${w.tags.highway} "${w.tags.name ?? ''}" tags=${JSON.stringify(w.tags)} tris~${n} bbox [${minx.toFixed(1)},${miny.toFixed(1)}]..[${maxx.toFixed(1)},${maxy.toFixed(1)}] bands=${w.section.bands.map(b => b.kind + ':' + b.surface).join(',')}`);
}

// Evidence for the slot length cap (tunnels.ts SLOT_MAX_M): every rideable tunnel run in the OSM extract with a portal
// at both ends, its length, and how far its relief rises over the line between its portal levels (the climb a rider
// on the relief would make). Lists runs longer than the cap that would qualify as slots.
//
//   npx tsx scripts/own-ground/probe-slot-lengths.ts
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { cutWays, isTunnelTags, rideableTags, tunnelRuns, SLOT_MAX_M, SLOT_MIN_EXCESS_M } from '../../src/canalRecall/ownGround/tunnels.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const keys = readdirSync(join(ROOT, 'own-ground-osm-v1/cells')).map(f => f.replace('.json.gz', ''));
const seen = new Set<number>();
const bins = new Map<string, { n: number; climb: number }>();
const long: string[] = [];
for (const k of keys) {
  const o = await store.osmCell(k);
  if (!o?.ways.some(w => isTunnelTags(w.tags))) continue;
  const around = await Promise.all(GroundStore.neighbours(k).map(n => store.osmCell(n)));
  const ways = cutWays(around.flatMap(q => q?.ways ?? []), q => toLocal(q[0], q[1]));
  const own = new Set(o.ways.map(w => w.id));
  for (const run of tunnelRuns(ways)) {
    if (!own.has(run.ways[0].id) || run.ways.some(w => seen.has(w.id))) continue;
    run.ways.forEach(w => seen.add(w.id));
    if (!run.ends[0] || !run.ends[1] || !run.ways.every(w => rideableTags(w.tags))) continue;
    const pts = run.points, L = pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    await store.ensureRelief([Math.min(...xs) - 30, Math.min(...ys) - 30, Math.max(...xs) + 30, Math.max(...ys) + 30]);
    const g = store.surface.relief, za = g(pts[0][0], pts[0][1]), zb = g(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    let climb = -Infinity, acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      for (let t = 0; t < l; t += 2) climb = Math.max(climb, g(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t / l, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t / l) - (za + (zb - za) * (acc + t) / L));
      acc += l;
    }
    const bin = L <= 50 ? '0-50' : L <= 100 ? '50-100' : L <= 150 ? '100-150' : L <= 250 ? '150-250' : L <= 400 ? '250-400' : '400+';
    const b = bins.get(bin) ?? { n: 0, climb: 0 }; b.n++; if (climb >= SLOT_MIN_EXCESS_M) b.climb++; bins.set(bin, b);
    if (L > SLOT_MAX_M && climb >= SLOT_MIN_EXCESS_M) { const [lng, lat] = fromLocal(pts[0][0], pts[0][1]); long.push(`  ${run.ways.map(w => w.id).join('+')} ${run.ways[0].tags.highway} ${run.ways[0].tags.name ?? ''} L=${L.toFixed(0)} climb ${climb.toFixed(1)} at ${lat.toFixed(5)},${lng.toFixed(5)}`); }
  }
}
console.log('rideable tunnel runs (both ends portals) by length: count, of which the relief rises >= SLOT_MIN_EXCESS_M over the portal line');
for (const k of ['0-50', '50-100', '100-150', '150-250', '250-400', '400+']) console.log(`  ${k.padEnd(8)} ${bins.get(k)?.n ?? 0} / ${bins.get(k)?.climb ?? 0}`);
console.log(`over the cap (${SLOT_MAX_M} m) and rising:`);
console.log(long.join('\n'));

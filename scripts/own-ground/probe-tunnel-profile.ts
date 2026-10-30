// Relief profile (scene z) along an OSM tunnel way and 30 m past each end: does the ground the rider follows
// pass under (low and level) or climb over the embankment / roof above the tunnel?
//
//   npx tsx scripts/own-ground/probe-tunnel-profile.ts <wayId> [<wayId> ...]
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';

const ROOT = 'public/data/extracts/amsterdam';
const ids = new Set(process.argv.slice(2).map(Number));
const ways = new Map<number, { tags: Record<string, string>; g: [number, number][] }>();
for (const f of readdirSync(join(ROOT, 'own-ground-osm-v1/cells'))) {
  const cell = JSON.parse(gunzipSync(readFileSync(join(ROOT, 'own-ground-osm-v1/cells', f))).toString());
  for (const w of cell.ways) if (ids.has(w.id) && !ways.has(w.id)) ways.set(w.id, w);
}
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
for (const [id, w] of ways) {
  const pts = w.g.map(([lng, lat]) => toLocal(lng, lat));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  await store.ensureRelief([Math.min(...xs) - 60, Math.min(...ys) - 60, Math.max(...xs) + 60, Math.max(...ys) + 60]);
  if (process.env.RIDE) await store.prepareCell(store.cellAt(pts[0][0], pts[0][1]));
  const at = (p: [number, number], q: [number, number], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const out: string[] = [];
  const a = pts[0], b = pts[1], c = pts[pts.length - 2], d = pts[pts.length - 1];
  const ua = Math.hypot(b[0] - a[0], b[1] - a[1]), ud = Math.hypot(d[0] - c[0], d[1] - c[1]);
  for (const s of [-30, -20, -10, -5]) { const p = at(a, b, s / ua); out.push(`${s}:${(process.env.RIDE ? store.surface.height : store.surface.ground)(p[0], p[1]).toFixed(1)}`); }
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    for (let s = 0; s < seg; s += 5) { const p = at(pts[i], pts[i + 1], s / seg); out.push(`|${(L + s).toFixed(0)}:${(process.env.RIDE ? store.surface.height : store.surface.ground)(p[0], p[1]).toFixed(1)}`); }
    L += seg;
  }
  out.push(`|${L.toFixed(0)}:${(process.env.RIDE ? store.surface.height : store.surface.ground)(d[0], d[1]).toFixed(1)}`);
  for (const s of [5, 10, 20, 30]) { const p = at(c, d, 1 + s / ud); out.push(`+${s}:${(process.env.RIDE ? store.surface.height : store.surface.ground)(p[0], p[1]).toFixed(1)}`); }
  console.log(`${id} ${w.tags.highway} ${w.tags.name ?? ''} layer=${w.tags.layer ?? ''} L=${L.toFixed(0)}\n  ${out.join(' ')}`);
}

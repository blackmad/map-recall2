// City-wide coverage of the tunnel cuts (tunnels.ts): every tunnel portal in the OSM extract, whether a cut reaches
// it, by class (motor-only / rideable / other), and whether its approach is sunken at all (the road 15 m outside the
// portal lies at least SUNK_M under the relief 15 m to either side). A sunken motor approach without a cut is a miss.
//
//   npx tsx scripts/own-ground/check-tunnels-coverage.ts [--list] [--json out.json]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { cutWays, findPortals, isTunnelTags, motorOnlyTags, rideableTags, insideCut, locateCut } from '../../src/canalRecall/ownGround/tunnels.ts';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';

const ROOT = 'public/data/extracts/amsterdam';
const SUNK_M = 1.5;
const args = process.argv.slice(2), list = args.includes('--list'), jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const keys = readdirSync(join(ROOT, 'own-ground-osm-v1/cells')).map(f => f.replace('.json.gz', ''));
const withTunnels: string[] = [];
for (const k of keys) { const o = await store.osmCell(k); if (o?.ways.some(w => isTunnelTags(w.tags))) withTunnels.push(k); }
const t0 = performance.now();
for (const k of withTunnels) await store.planCutsFor(k);
const planMs = performance.now() - t0;
const s = store.surface;
type Row = { cls: string; sunk: boolean; cut: boolean; portal: boolean; way: number; name: string; at: [number, number]; depth: number };
const rows: Row[] = [], seen = new Set<string>();
for (const k of withTunnels) {
  const [x0, y0, x1, y1] = store.cellRect(k);
  const around = await Promise.all(GroundStore.neighbours(k).map(n => store.osmCell(n)));
  const ways = cutWays(around.flatMap(o => o?.ways ?? []), q => toLocal(q[0], q[1]));
  for (const p of findPortals(ways)) {
    if (p.at[0] < x0 || p.at[0] >= x1 || p.at[1] < y0 || p.at[1] >= y1) continue;
    const key = `${p.tunnel.id}:${p.at[0].toFixed(1)}:${p.at[1].toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = motorOnlyTags(p.tunnel.tags) ? 'motor' : rideableTags(p.tunnel.tags) ? 'rideable' : 'other';
    // The approach: 15 m outside the portal, the road against the relief 15 m to either side.
    const ox = p.at[0] - p.dir[0] * 15, oy = p.at[1] - p.dir[1] * 15, nx = -p.dir[1], ny = p.dir[0];
    const road = s.relief(ox, oy), side = Math.max(s.relief(ox + nx * 15, oy + ny * 15), s.relief(ox - nx * 15, oy - ny * 15));
    const depth = side - road;
    // A cut reaches it: one whose strip holds a point 4, 8 or 12 m outside the portal (OSM often puts the portal a few
    // metres inside, under a ventilation building or the headwall), or 4 m inside (a slot).
    const probes: [number, number][] = [-4, -8, -12, 4].map(m => [p.at[0] + p.dir[0] * m, p.at[1] + p.dir[1] * m]);
    const hits = s.cuts.filter(c => probes.some(([x, y]) => x >= c.bbox[0] && x <= c.bbox[2] && y >= c.bbox[1] && y <= c.bbox[3] && (() => { const h = locateCut(c, x, y); return !!h && insideCut(c, h); })()));
    const portal = s.cuts.some(c => c.portals.some(q => Math.hypot(c.x[q.at] - p.at[0], c.y[q.at] - p.at[1]) < 15));
    rows.push({ cls, sunk: depth >= SUNK_M, cut: hits.length > 0, portal, way: p.tunnel.id, name: p.tunnel.tags.name ?? p.tunnel.tags.highway, at: fromLocal(p.at[0], p.at[1]) as [number, number], depth });
  }
}
const count = (f: (r: Row) => boolean) => rows.filter(f).length;
const rampM = s.cuts.filter(c => c.kind === 'ramp').reduce((a, c) => a + c.s[c.s.length - 1], 0);
const shallowM = s.cuts.filter(c => c.kind === 'ramp').reduce((a, c) => a + c.s.reduce((b, v, i) => b + (i && Math.max(c.rimL[i] - c.floor[i], c.rimR[i] - c.floor[i]) < 0.45 ? v - c.s[i - 1] : 0), 0), 0);
console.log(`cells with tunnels ${withTunnels.length}, cuts ${s.cuts.length} (ramps ${s.cuts.filter(c => c.kind === 'ramp').length}, ${(rampM / 1000).toFixed(2)} km, of it under 0.45 m deep ${(shallowM / 1000).toFixed(2)} km; slots ${s.cuts.filter(c => c.kind === 'slot').length}), planned in ${(planMs / 1000).toFixed(1)} s`);
for (const cls of ['motor', 'rideable', 'other']) {
  const all = count(r => r.cls === cls), sunk = count(r => r.cls === cls && r.sunk);
  console.log(`${cls.padEnd(8)} portals ${String(all).padStart(4)}: with a cut ${count(r => r.cls === cls && r.cut)}; sunken approach ${sunk}, of which cut ${count(r => r.cls === cls && r.sunk && r.cut)}; with a portal mouth ${count(r => r.cls === cls && r.portal)}`);
}
if (list) for (const r of rows.filter(r => (r.cls === 'motor' || r.cls === 'rideable') && r.sunk && !r.cut).sort((a, b) => b.depth - a.depth)) console.log(`  miss ${r.cls} ${r.way} ${r.name} depth ${r.depth.toFixed(1)} at ${r.at[1].toFixed(5)},${r.at[0].toFixed(5)}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ portals: rows, cuts: s.cuts.map(c => ({ id: c.id, way: c.way, kind: c.kind, motor: c.motor, len: c.s[c.s.length - 1], at: fromLocal(c.x[c.x.length >> 1], c.y[c.x.length >> 1]) })) }));

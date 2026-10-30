// Why a sunken portal got no cut: for each portal the coverage check lists as a miss (check-tunnels-coverage.ts
// --json), the relief along the approach (the open road, 0-80 m out from the portal) and across it 20 and 40 m out,
// with the cuts near it.
//
//   npx tsx scripts/own-ground/check-tunnels-coverage.ts --json /tmp/cov.json
//   npx tsx scripts/own-ground/probe-portal-misses.ts /tmp/cov.json [motor|rideable]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { cutWays, findPortals } from '../../src/canalRecall/ownGround/tunnels.ts';

const ROOT = 'public/data/extracts/amsterdam';
const [file, cls = 'motor'] = process.argv.slice(2);
const rows = (JSON.parse(readFileSync(file, 'utf8')).portals as { cls: string; sunk: boolean; cut: boolean; way: number; name: string; at: [number, number]; depth: number }[])
  .filter(r => r.cls === cls && r.sunk && !r.cut);
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
for (const r of rows) {
  const [x, y] = toLocal(r.at[0], r.at[1]), key = store.cellAt(x, y);
  await store.prepareCell(key);
  const around = await Promise.all(GroundStore.neighbours(key).map(n => store.osmCell(n)));
  const ways = cutWays(around.flatMap(o => o?.ways ?? []), q => toLocal(q[0], q[1]));
  const p = findPortals(ways).find(q => q.tunnel.id === r.way && Math.hypot(q.at[0] - x, q.at[1] - y) < 1);
  if (!p) { console.log(`${r.way} ${r.name}: portal not found`); continue; }
  const g = store.surface.relief, d = p.dir, n = [-d[1], d[0]];
  const along = [0, 10, 20, 30, 40, 60, 80].map(m => `${m}:${g(x - d[0] * m, y - d[1] * m).toFixed(1)}`).join(' ');
  const across = (m: number) => [-20, -15, -10, -6, -3, 0, 3, 6, 10, 15, 20].map(t => g(x - d[0] * m + n[0] * t, y - d[1] * m + n[1] * t).toFixed(1)).join(' ');
  const open = ways.filter(w => !w.tunnel && w.points.some(q => Math.hypot(q[0] - x, q[1] - y) < 0.2));
  const near = store.surface.cuts.filter(c => c.x.some((cx, i) => Math.hypot(cx - x, c.y[i] - y) < 60));
  console.log(`${r.way} ${r.name} (${r.at[1].toFixed(5)},${r.at[0].toFixed(5)}) depth ${r.depth.toFixed(1)} tags ${JSON.stringify(p.tunnel.tags)}`);
  console.log(`  open ways at the portal: ${open.map(w => `${w.id} ${w.tags.highway}${w.tags.covered ? ' covered=' + w.tags.covered : ''}`).join(', ') || 'none'}`);
  console.log(`  along (m out: z): ${along}`);
  console.log(`  across 20 m out (-20..20): ${across(20)}`);
  console.log(`  across 40 m out (-20..20): ${across(40)}`);
  console.log(`  cuts within 60 m: ${near.map(c => `${c.id} (${c.kind}${c.motor ? ' motor' : ''}, L ${c.s[c.s.length - 1].toFixed(0)})`).join(', ') || 'none'}`);
}

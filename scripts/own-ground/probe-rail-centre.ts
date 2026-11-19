// Tram rails against the carriageway they run in (lane fb-bridges-20261119, feedback 62d5a35f "why are the rails
// slightly off-center?", Vijzelstraat). Per road way with embedded tram rails near a point: every 2 m, the BGT
// carriageway's extent across the way (the dark rijbaan, red cycle strips left out, and with them) and the rails' centre
// (crossSection rails offsets), so `off` = rails centre − carriageway centre.
//
//   node --import tsx scripts/own-ground/probe-rail-centre.ts <lng,lat> [--half=60] [--step=2]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays, isBridgeWay } from '../../src/canalRecall/ownGround/streets.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { carriagewaySpan } from '../../src/canalRecall/ownGround/railCentre.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const [lng, lat] = process.argv[2].split(',').map(Number), [cx, cy] = toLocal(lng, lat);
const half = Number(flag('half') ?? 60), step = Number(flag('step') ?? 2);
const key = store.cellAt(cx, cy);
await store.prepareCell(key);
const input = await store.cellInput(key, 0);
const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])]);
const ways = prepareWays([...(input.osm?.ways ?? []), ...input.osmAround.flatMap(o => o?.ways ?? [])], input.project);
const seen = new Set<number>();
for (const w of ways) {
  if (seen.has(w.id) || !w.section.rails.length) continue;
  seen.add(w.id);
  if (!w.points.some(p => Math.abs(p[0] - cx) < half && Math.abs(p[1] - cy) < half)) continue;
  const mid = w.section.rails.reduce((a, b) => a + b, 0) / w.section.rails.length;
  const offs: number[] = [];
  const rows: string[] = [];
  for (let i = 0; i + 1 < w.points.length; i++) {
    const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], l = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < l; s += step) {
      const x = ax + (bx - ax) * s / l, y = ay + (by - ay) * s / l;
      if (Math.abs(x - cx) > half || Math.abs(y - cy) > half) continue;
      const nx = -(by - ay) / l, ny = (bx - ax) / l;
      const dark = carriagewaySpan(index, x, y, nx, ny, mid, isBridgeWay(w), false), all = carriagewaySpan(index, x, y, nx, ny, mid, isBridgeWay(w), true);
      if (!dark) continue;
      const off = mid - (dark[0] + dark[1]) / 2;
      offs.push(off);
      rows.push(`  s=${(s + (i ? 0 : 0)).toFixed(0)}@${i} dark ${dark[0].toFixed(2)}..${dark[1].toFixed(2)} (w ${(dark[1] - dark[0]).toFixed(1)}) all ${all ? `${all[0].toFixed(2)}..${all[1].toFixed(2)}` : '-'} rails ${w.section.rails.map(r => r.toFixed(2)).join(';')} off ${off.toFixed(2)}`);
    }
  }
  if (!offs.length) continue;
  const sorted = [...offs].sort((a, b) => a - b);
  console.log(`way ${w.id} ${w.tags.name ?? ''} ${w.tags.highway} offsets=${w.tags['embedded_rails:offsets'] ?? '(default)'} bridge=${isBridgeWay(w)} n=${offs.length} off median ${sorted[sorted.length >> 1].toFixed(2)} min ${sorted[0].toFixed(2)} max ${sorted[sorted.length - 1].toFixed(2)}`);
  if (process.argv.includes('--rows')) console.log(rows.join('\n'));
}

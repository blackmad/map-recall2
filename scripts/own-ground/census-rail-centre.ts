// City-wide census for railCentre (lane fb-bridges-20261119, Vijzelstraat 62d5a35f). Per cell, the plan its build makes
// (railCentre.ts planRailCentres over the cell's own rail ways and the ones sharing a node with them): the ways moved,
// their middle shift (measured offsets vs the default), and the rails' end positions at every shared node as each cell
// draws them, so a step between two ways (drawn by one cell or by two) shows.
//
//   node --import tsx scripts/own-ground/census-rail-centre.ts [--cells=a,b] [--json=out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays, isBridgeWay } from '../../src/canalRecall/ownGround/streets.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { planRailCentres, shiftAt, RAIL_CENTRE_TOL_M } from '../../src/canalRecall/ownGround/railCentre.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const keys = flag('cells')?.split(',') ?? [...store.osmCells].filter(k => store.covers(k)).sort();
const key = (p: readonly number[]) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
const mids = new Map<number, { mid: number; measured: boolean; name: string }>();
// node|rails -> the shift each (cell, way) draws there
const atNode = new Map<string, { cell: string; way: number; shift: number }[]>();
for (const k of keys) {
  const osm = await store.osmCell(k);
  if (!osm?.ways.some(w => (w.tags.embedded_rails ?? '').includes('tram'))) continue;
  await store.prepareCell(k);
  const input = await store.cellInput(k, 0);
  if (!input.roads?.surfaces.length) continue;
  const ownIds = new Set((input.osm?.ways ?? []).map(w => w.id));
  const all = prepareWays([...(input.osm?.ways ?? []), ...input.osmAround.flatMap(o => o?.ways ?? [])], input.project);
  // The game's index box (groundCell `rb`): the cell, and its own ways' points ±10 m.
  let rb = [...store.cellRect(k)] as [number, number, number, number];
  for (const w of all) if (ownIds.has(w.id)) for (const p of w.points) rb = [Math.min(rb[0], p[0] - 10), Math.min(rb[1], p[1] - 10), Math.max(rb[2], p[0] + 10), Math.max(rb[3], p[1] + 10)];
  const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])], rb);
  const ways = all.filter(w => w.section.rails.length);
  const mine = ways.filter(w => ownIds.has(w.id)), ends = new Set(mine.flatMap(w => [key(w.points[0]), key(w.points[w.points.length - 1])]));
  const seen = new Set<number>();
  const plan = ways.filter(w => (ownIds.has(w.id) || ends.has(key(w.points[0])) || ends.has(key(w.points[w.points.length - 1]))) && !seen.has(w.id) && seen.add(w.id));
  const shifts = planRailCentres(index, plan.map(w => ({ id: w.id, points: w.points, rails: w.section.rails, bridge: isBridgeWay(w), measured: !!w.tags['embedded_rails:offsets'] })));
  for (const w of mine) {
    const sh = shifts.get(w.id);
    if (!mids.has(w.id)) mids.set(w.id, { mid: sh?.mid ?? 0, measured: !!w.tags['embedded_rails:offsets'], name: w.tags.name ?? '' });
    for (const end of [0, 1] as const) {
      const n = `${key(end ? w.points[w.points.length - 1] : w.points[0])}|${w.section.rails.join(';')}`;
      (atNode.get(n) ?? atNode.set(n, []).get(n)!).push({ cell: k, way: w.id, shift: sh ? +shiftAt(sh, end ? sh.length : 0).toFixed(3) : 0 });
    }
  }
}
const all = [...mids.values()], moved = all.filter(s => s.mid !== 0);
const hist = (xs: number[]) => { const b = new Map<string, number>(); for (const x of xs) { const k = (Math.floor(Math.abs(x) * 4) / 4).toFixed(2); b.set(k, (b.get(k) ?? 0) + 1); } return [...b.entries()].sort().map(([k, n]) => `${k}+:${n}`).join(' '); };
console.log(`rail ways ${all.length}; moved ${moved.length} (measured ${moved.filter(s => s.measured).length}, default ${moved.filter(s => !s.measured).length}); default tol ${RAIL_CENTRE_TOL_M} m`);
console.log('|middle shift| histogram (m):', hist(moved.map(s => s.mid)));
const steps = [...atNode.entries()].filter(([, l]) => l.length > 1).map(([n, l]) => ({ node: n, step: +(Math.max(...l.map(e => e.shift)) - Math.min(...l.map(e => e.shift))).toFixed(3), ways: l }));
steps.sort((a, b) => b.step - a.step);
console.log(`shared nodes ${steps.length}; step > 0.02 m: ${steps.filter(s => s.step > 0.02).length}, > 0.1 m: ${steps.filter(s => s.step > 0.1).length}; worst`, JSON.stringify(steps.slice(0, 5)));
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify({ mids: Object.fromEntries(mids), steps }, null, 1));

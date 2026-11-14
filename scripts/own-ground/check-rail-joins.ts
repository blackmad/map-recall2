// City-wide rail join check (lane R2-A 2026-11-13; player notes bc28e25e "rails don't connect to bridges" at the
// Cornelis Lelylaan tram viaduct and 3997ffb6 "do we need a bigger regression check?" at the Zaanstraat rail viaduct).
// Builds every rail-v1 cell as the game does (LOD 0, default flags) and checks, from railJoins.ts:
//
//   join      every bridge-to-ground join: ballast every 0.5 m over ±8 m, no gap, no step over 0.15 m, no slope over
//             1.5 × RAIL_GRADE;
//   free      every free bridge end meets land or another bed;
//   crossing  every road bridge over a track and rail bridge over a road: the upper one at least 3 m over the lower.
//
//   npx tsx scripts/own-ground/check-rail-joins.ts                 (exit 1 on a failure not in the allow-list, or an
//                                                                    allow-list entry that now passes: shrink it)
//   npx tsx scripts/own-ground/check-rail-joins.ts --print         (counts and the worst 20, never fails)
//   npx tsx scripts/own-ground/check-rail-joins.ts --at=lng,lat,halfM   (the cells around a spot only)
//   npx tsx scripts/own-ground/check-rail-joins.ts --json=out.json --shard=i/n --write-allow
//
// The allow-list (scripts/own-ground/rail-joins-allow.json) is a ratchet: failures it lists pass, entries that pass
// must be removed (the check fails until they are), and nothing new may be added except with an ortho verdict.
// Named pins (RAIL_JOIN_PINS) must be found at their spot; they guard the check's liveness.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RAIL_SECTION, type RailWay } from '../../src/canalRecall/ownGround/railTracks.ts';
import { joinSites, judgeCrossing, judgeFree, judgeJoin, measureJoin, railRoadCrossings, ratchet, uniqueWays, type JoinFailure, type RailJoinAllow, type RoadLine } from '../../src/canalRecall/ownGround/railJoins.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';
import { hitsAt, triIndex, type TriIndex } from './probe-rails-class.ts';
import { readExtract } from './probe-rails.ts';

export const ALLOW_FILE = 'scripts/own-ground/rail-joins-allow.json';

/**
 * Named spots that must be in the run's failures before their fix and out of them after (lane R2-A): `live` the
 * baseline failure count within radiusM at main 61f08cf3e, `maxAfter` after the lane's fix.
 */
export interface RailJoinPin { id: string; note: string; at: [number, number]; radiusM: number; liveBefore: number; maxAfter: number }
export const RAIL_JOIN_PINS: readonly RailJoinPin[] = [
  { id: 'lelylaan-tram-decks', note: 'bc28e25e "rails don\'t connect to bridges" (build 4bbff45, 2026-11-13): the tram decks on the Cornelis Lelylaan viaduct over the Ringweg-West', at: [4.8425, 52.35798], radiusM: 60, liveBefore: 3, maxAfter: 0 },
  { id: 'zaanstraat-rail-yard-viaduct', note: '3997ffb6 "I thought we fixed rails & overpasses everywhere?" (build 4bbff45, 2026-11-13): the Haarlem line viaduct over the Zaanstraat', at: [4.88147, 52.38644], radiusM: 60, liveBefore: 57, maxAfter: 1 },
  // maxAfter 1 at the Zaanstraat: the footway under the viaduct's west end measures 2.96 m of the 3 m clearance (allow-listed).
];

const BED = new Set<GroundLayer>(['ballast']);
const ROAD = new Set<GroundLayer>(['asphalt', 'klinker', 'brick', 'cycle', 'paving', 'deckTop', 'tram']);
const LAND = new Set<GroundLayer>([...ROAD, 'land', 'park', 'wood', 'square', 'parking', 'lawn', 'garden', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'gravel', 'quay', 'bare', 'hedge']);
const ALL = new Set<GroundLayer>([...BED, ...LAND]);

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);

export interface RunResult { cells: number; sites: { join: number; free: number; crossing: number }; failures: JoinFailure[] }

export async function run(opts: { /** GroundStore options (A/B of a flag). */ store?: Record<string, unknown>; keys?: string[]; shard?: [number, number]; log?: (s: string) => void; /** Print the samples of the joins within 25 m of this point (game frame). */ trace?: Vec2 } = {}): Promise<RunResult> {
  const store = new GroundStore(readExtract, { roads: true, ...opts.store });
  await store.init();
  let keys = opts.keys ?? [...store.railCells].filter(k => store.covers(k)).sort();
  if (opts.shard) keys = keys.filter((_, i) => i % opts.shard![1] === opts.shard![0]);
  // Built cells as tri indexes (bed, roads, land), least recently used dropped past CACHE.
  const CACHE = 24, cache = new Map<string, TriIndex | null>();
  const cell = async (k: string): Promise<TriIndex | null> => {
    if (cache.has(k)) { const v = cache.get(k)!; cache.delete(k); cache.set(k, v); return v; }
    let v: TriIndex | null = null;
    if (store.covers(k)) v = triIndex(buildCell(await store.cellInput(k, 0)), ALL);
    cache.set(k, v);
    if (cache.size > CACHE) cache.delete(cache.keys().next().value!);
    return v;
  };
  // Cells near a set of points (a piece is drawn by the cell owning its middle: a seam's samples need both).
  const cellsNear = async (pts: readonly Vec2[]): Promise<TriIndex[]> => {
    const ks = new Set<string>();
    for (const [x, y] of pts) for (const dx of [-4, 4]) for (const dy of [-4, 4]) ks.add(store.cellAt(x + dx, y + dy));
    return (await Promise.all([...ks].sort().map(cell))).filter((c): c is TriIndex => !!c);
  };
  // A point exactly on a shared mesh vertex or edge can miss both triangles in float32: nudge 5 cm when nothing is hit.
  const sampler = (ixs: TriIndex[], layers: ReadonlySet<GroundLayer>) => (x: number, y: number) => {
    for (const [dx, dy] of [[0, 0], [0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) {
      const zs = ixs.flatMap(ix => hitsAt(ix, x + dx, y + dy)).filter(h => layers.has(h.layer)).map(h => h.z);
      if (zs.length) return zs;
    }
    return [];
  };
  const failures: JoinFailure[] = [], sites = { join: 0, free: 0, crossing: 0 };
  let n = 0;
  for (const k of keys) {
    const [x0, y0, x1, y1] = store.cellRect(k), inside = (p: Vec2) => p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1;
    const around = GroundStore.neighbours(k);
    const rails = uniqueWays((await Promise.all(around.map(c => store.railCell(c).catch(() => [] as RailWay[])))).flat());
    const own = joinSites(rails, inside);
    const osm = (await Promise.all([store.osmCell(k)])).flat();
    const seen = new Set<number>(), roads: RoadLine[] = [];
    for (const o of osm) for (const w of o?.ways ?? []) {
      const t = w.tags;
      if (!t.highway || seen.has(w.id)) continue;
      seen.add(w.id);
      const bridge = !!t.bridge && t.bridge !== 'no', tunnel = !!t.tunnel && t.tunnel !== 'no';
      roads.push({ id: String(w.id), highway: t.highway, bridge, tunnel, layer: Number((t.layer ?? '0').split(';')[0]) || 0, name: t.name, points: w.g.map(p => toLocal(p[0], p[1])) });
    }
    const crossings = railRoadCrossings(rails, roads, inside);
    if (!own.length && !crossings.length) continue;
    n++;
    for (const s of own) {
      const ixs = await cellsNear(s.path), bed = sampler(ixs, BED);
      if (s.cls === 'join') {
        sites.join++;
        const m = measureJoin(s.path, s.join, bed), f = judgeJoin(s, m);
        if (opts.trace && Math.hypot(s.at[0] - opts.trace[0], s.at[1] - opts.trace[1]) < 25) opts.log?.(`trace ${s.id} gap ${s.gap} join@${s.join}: ${m.zs.map(z => (Number.isFinite(z) ? z.toFixed(2) : '--')).join(' ')}`);
        if (f) failures.push(f);
      } else {
        sites.free++;
        const tops = bed(s.at[0], s.at[1]);
        const f = judgeFree(s, tops.length ? Math.max(...tops) : NaN, RAIL_SECTION.topLift, sampler(ixs, LAND), (x, y) => bed(x, y));
        if (f) failures.push(f);
      }
    }
    for (const c of crossings) {
      sites.crossing++;
      const ixs = await cellsNear([c.at]), [x, y] = c.at;
      const f = judgeCrossing(c, sampler(ixs, BED)(x, y), sampler(ixs, ROAD)(x, y), store.surface.height(x, y));
      if (f) failures.push(f);
    }
    if (n % 10 === 0) opts.log?.(`${n} cells, ${failures.length} failures so far`);
  }
  for (const f of failures) (f.detail ??= {}).lngLat = fromLocal(f.at[0], f.at[1]).map(v => v.toFixed(5)).join(',');
  failures.sort((a, b) => b.score - a.score);
  return { cells: n, sites, failures };
}

export function loadAllow(): RailJoinAllow[] { return existsSync(ALLOW_FILE) ? (JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) as { allow: RailJoinAllow[] }).allow : []; }

/** Failures within a pin's radius. */
export function pinCount(failures: readonly JoinFailure[], pin: RailJoinPin): number {
  const [x, y] = toLocal(...pin.at);
  return failures.filter(f => Math.hypot(f.at[0] - x, f.at[1] - y) <= pin.radiusM).length;
}

async function main(): Promise<void> {
  const print = process.argv.includes('--print'), t0 = performance.now();
  const shardArg = arg('shard'), shard = shardArg ? (shardArg.split('/').map(Number) as [number, number]) : undefined;
  let keys: string[] | undefined;
  const at = arg('at');
  if (at) {
    const [lng, lat, half] = at.split(',').map(Number), store = new GroundStore(readExtract, { roads: true });
    await store.init();
    const [x, y] = toLocal(lng, lat), set = new Set<string>();
    for (let dx = -half; dx <= half; dx += 25) for (let dy = -half; dy <= half; dy += 25) set.add(store.cellAt(x + dx, y + dy));
    keys = [...set].filter(k => store.railCells.has(k) && store.covers(k)).sort();
  }
  const tr = arg('trace')?.split(',').map(Number), flags = Object.fromEntries((arg('flags') ?? '').split(',').filter(Boolean).map(f => f.split('=')).map(([k, v]) => [k, v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : Number(v)])), r = await run({ store: flags, keys, shard, log: s => console.error(s), ...(tr ? { trace: toLocal(tr[0], tr[1]) } : {}) });
  const byCls = (c: string) => r.failures.filter(f => f.cls === c).length;
  console.log(`rail joins: ${r.cells} cells, ${r.sites.join} joins, ${r.sites.free} free ends, ${r.sites.crossing} road/rail crossings; failures ${r.failures.length} (join ${byCls('join')}, free ${byCls('free')}, crossing ${byCls('crossing')}) in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  const byKind: Record<string, number> = {};
  for (const f of r.failures) byKind[`${f.cls}/${f.kind}`] = (byKind[`${f.cls}/${f.kind}`] ?? 0) + 1;
  console.log(`  by class/kind: ${JSON.stringify(byKind)}`);
  console.log('  worst 20:');
  for (const f of r.failures.slice(0, 20)) console.log(`    ${f.cls.padEnd(8)} ${String(f.kind).padEnd(7)} ${f.detail?.lngLat}  ${f.reasons.join('; ')}${f.detail?.road ? `  (${f.detail.road})` : ''}`);
  const json = arg('json');
  if (json) writeFileSync(json, JSON.stringify(r, null, 1));
  let failed = false;
  const whole = !keys && !shard;
  const [aLng, aLat, aHalf] = (at ?? '').split(',').map(Number);
  for (const pin of RAIL_JOIN_PINS) {
    // A focused run (--at) judges only the pins inside its square; a shard judges none (its cells are partial).
    if (shard || (at && Math.max(Math.abs(toLocal(...pin.at)[0] - toLocal(aLng, aLat)[0]), Math.abs(toLocal(...pin.at)[1] - toLocal(aLng, aLat)[1])) > aHalf)) continue;
    const c = pinCount(r.failures, pin), ok = c <= pin.maxAfter;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'} pin ${pin.id}: ${c} failures within ${pin.radiusM} m (pin <= ${pin.maxAfter}; ${pin.liveBefore} before the fix)`);
  }
  if (process.argv.includes('--write-allow')) {
    const allow = r.failures.map(f => ({ id: f.id, reason: `baseline ${f.detail?.lngLat}: ${f.reasons.join('; ')}` }));
    writeFileSync(ALLOW_FILE, `${JSON.stringify({ note: 'check:rail-joins ratchet (lane R2-A 2026-11-13). May only shrink: fix a join and delete its line; add one only with an orthophoto verdict in its reason.', allow }, null, 1)}\n`);
    console.log(`wrote ${allow.length} entries to ${ALLOW_FILE}`);
    return;
  }
  if (whole || shard) {
    const allow = loadAllow(), { fresh, fixed } = ratchet(r.failures, allow);
    // A shard sees only its cells: an allowed id it did not visit is not "fixed".
    const fixedHere = shard ? [] : fixed;
    console.log(`allow-list ${allow.length}: ${fresh.length} new failures, ${fixedHere.length} allowed ids now pass (remove them)`);
    for (const f of fresh.slice(0, 40)) console.log(`  NEW ${f.id} ${f.detail?.lngLat} ${f.reasons.join('; ')}`);
    for (const id of fixedHere.slice(0, 40)) console.log(`  PASSES (remove from allow-list) ${id}`);
    if (fresh.length || fixedHere.length) failed = true;
  }
  if (failed && !print) process.exit(1);
}
if (process.argv[1]?.endsWith('check-rail-joins.ts')) main().catch(e => { console.error(e); process.exit(1); });

// railJoins.ts (lane R2-A 2026-11-13): the city-wide rail join check's geometry and verdicts, and the profile rules it
// drove (railProfile.ts islands and abutments, railTracks.ts UNDER_STREET_M).
import test from 'node:test';
import assert from 'node:assert/strict';
import { joinSites, judgeCrossing, judgeFree, judgeJoin, measureJoin, railRoadCrossings, ratchet, resample, SAMPLE_M, JOIN_REACH_M, STEP_MAX_M, type RoadLine } from './railJoins.ts';
import { railLevels, levelAt, ISLAND_M } from './railProfile.ts';
import { crossingTest, onStreetTest, UNDER_STREET_M, type RailWay } from './railTracks.ts';
import type { Vec2 } from './surface.ts';

const way = (points: Vec2[], bridge = false, kind: RailWay['kind'] = 'rail'): RailWay => ({ kind, bridge, service: false, points });

test('join sites: both ends of a bridge between two approaches, ±8 m every 0.5 m; a free end; a split gap snaps', () => {
  const ways = [way([[-50, 0], [0, 0]]), way([[0, 0], [30, 0]], true), way([[30, 0], [80, 0]])];
  const sites = joinSites(ways);
  assert.equal(sites.length, 2);
  for (const s of sites) {
    assert.equal(s.cls, 'join');
    assert.equal(s.path.length, 2 * JOIN_REACH_M / SAMPLE_M + 1);
    assert.deepEqual(s.path[s.join], s.at);
  }
  // A bridge whose far end meets nothing: one join, one free end.
  const free = joinSites([way([[-50, 0], [0, 0]]), way([[0, 0], [30, 0]], true)]);
  assert.deepEqual(free.map(s => s.cls).sort(), ['free', 'join']);
  // OSM split 2 m short of the approach: snapped (railProfile SNAP_M), the gap recorded.
  const gap = joinSites([way([[-50, 0], [-2, 0]]), way([[0, 0], [30, 0]], true)]).filter(s => s.cls === 'join');
  assert.equal(gap.length, 1);
  assert.equal(gap[0].gap, 2);
  // Short interleaved chain: bridge 23 m, ground 10 m, bridge 23 m: the ground side walks on through the next bridge.
  const chain = joinSites([way([[-50, 0], [0, 0]]), way([[0, 0], [23, 0]], true), way([[23, 0], [33, 0]]), way([[33, 0], [56, 0]], true), way([[56, 0], [90, 0]])]);
  assert.equal(chain.length, 4);
  // The partition: only the sites whose join point a cell accepts.
  assert.equal(joinSites(ways, p => p[0] < 10).length, 1);
});

test('measureJoin: continuity picks the bed of this track over one under it; steps, gaps and slopes are judged', () => {
  const path = resample([[-8, 0], [8, 0]], SAMPLE_M), join = 16;
  // A bed at +4 with another bed at 0 under the bridge's half: the path keeps to +4.
  const smooth = measureJoin(path, join, x => (x > 0 ? [0, 4] : [4]));
  assert.equal(smooth.missing, 0);
  assert.equal(smooth.maxStep, 0);
  const site = joinSites([way([[-50, 0], [0, 0]]), way([[0, 0], [30, 0]], true)])[0];
  assert.equal(judgeJoin(site, smooth), null);
  // The Lelylaan step: the approach falls 1.5 m at the deck's end.
  const step = measureJoin(path, join, x => [x < 0 ? 2.4 : 3.9]);
  const f = judgeJoin(site, step);
  assert.ok(f && f.reasons.some(r => r.startsWith('step')), JSON.stringify(f));
  assert.ok(step.maxStep > STEP_MAX_M);
  // A hole in the bed at the join.
  const hole = measureJoin(path, join, x => (Math.abs(x) < 0.3 ? [] : [3]));
  assert.ok(judgeJoin(site, hole)?.reasons[0].includes('without ballast'));
  // A ramp at 3 % on a main line passes (cap 4.5 %); at 6 % it fails.
  assert.equal(judgeJoin(site, measureJoin(path, join, x => [0.03 * x])), null);
  assert.ok(judgeJoin(site, measureJoin(path, join, x => [0.06 * x]))?.reasons[0].startsWith('slope'));
});

test('free ends: the floor meets land within 3 m, or it floats', () => {
  const [site] = joinSites([way([[0, 0], [30, 0]], true)]).filter(s => s.at[0] === 0);
  assert.equal(judgeFree(site, 0.32, 0.32, () => [0], () => []), null);
  const f = judgeFree(site, 4.32, 0.32, () => [0], () => []);
  assert.ok(f && f.reasons[0].startsWith('floats 4.00'));
  assert.ok(judgeFree(site, NaN, 0.32, () => [0], () => [])?.reasons[0].includes('no ballast'));
});

test('road/rail crossings: which is on top, and the 3 m clearance', () => {
  const rails = [way([[-50, 0], [50, 0]], true), way([[-50, 100], [50, 100]])];
  const road = (bridge: boolean, x: number, extra: Partial<RoadLine> = {}): RoadLine => ({ id: 'r', highway: 'secondary', bridge, tunnel: false, layer: bridge ? 1 : 0, points: [[x, -200], [x, 200]], ...extra });
  const cs = railRoadCrossings(rails, [road(false, 0), road(true, 10)]);
  // The road off the bridges under the rail bridge; the road bridge over the track at grade; the at-grade crossing and
  // the bridge over the bridge (same layer: unknown) are left out.
  assert.deepEqual(cs.map(c => `${c.upper}@${c.at.join(',')}`).sort(), ['rail@0,0', 'road@10,100']);
  const under = cs.find(c => c.upper === 'rail')!, over = cs.find(c => c.upper === 'road')!;
  assert.equal(judgeCrossing(under, [4.3], [0], 0), null);
  assert.ok(judgeCrossing(under, [0.3], [0], 0)?.reasons[0].startsWith('ballast 0.30'));
  assert.equal(judgeCrossing(over, [0.3], [5], 0), null);
  assert.ok(judgeCrossing(over, [0.3], [], 0)?.reasons[0].includes('no road deck'));
  // Steps are skipped; a road on layer 2 over a rail bridge counts.
  assert.equal(railRoadCrossings(rails, [road(false, 0, { highway: 'steps' })]).length, 0);
  assert.equal(railRoadCrossings(rails, [road(true, 0, { layer: 2 })]).filter(c => c.upper === 'road').length, 2);
});

test('ratchet: new failures and allowed ids that now pass', () => {
  const f = (id: string) => ({ id, cls: 'join' as const, kind: 'rail', at: [0, 0] as Vec2, reasons: ['x'], score: 1 });
  const r = ratchet([f('a'), f('b')], [{ id: 'a', reason: '' }, { id: 'c', reason: '' }]);
  assert.deepEqual(r.fresh.map(x => x.id), ['b']);
  assert.deepEqual(r.fixed, ['c']);
});

test('islands (railProfile): a short run between two bridges is levelled with them, not anchored on the fill', () => {
  // The Zaanstraat: embankment at +4.7 west, a 23 m bridge, a 60 m run whose relief is the +0.3 fill, a long viaduct
  // landing on an embankment at +4.7 east.
  const relief = (x: number) => (x < 0 || x > 400 ? 4.7 : 0.3);
  const ways = [way([[-100, 0], [0, 0]]), way([[0, 0], [23, 0]], true), way([[23, 0], [83, 0]]), way([[83, 0], [400, 0]], true), way([[400, 0], [500, 0]])];
  const on = railLevels(ways, ways, relief), off = railLevels(ways, ways, relief, undefined, undefined, undefined, [], { islands: false });
  const mid = (r: typeof on) => levelAt(r.levels.get(ways[2])!, 30);
  assert.equal(on.stats.islands, 1);
  assert.ok(mid(on) > 4.5, `island at ${mid(on)}`);
  assert.ok(mid(off) < 1, `before: island at ${mid(off)}`);
  // A run longer than ISLAND_M keeps its own relief.
  const long = [way([[-100, 0], [0, 0]]), way([[0, 0], [23, 0]], true), way([[23, 0], [23 + ISLAND_M + 20, 0]]), way([[23 + ISLAND_M + 20, 0], [400, 0]], true), way([[400, 0], [500, 0]])];
  assert.equal(railLevels(long, long, relief).stats.islands ?? 0, 0);
  // A run with a dead end (a buffer stop) is no island.
  const spur = [...ways, way([[43, 0], [43, 30]])];
  assert.equal(railLevels(spur, spur, relief).stats.islands ?? 0, 0);
});

test('abutments (railProfile): the fill dip at a deck end does not drag the deck down', () => {
  // Embankment at +3.8 whose relief dips to +0.2 over the last 6 m before the deck (AHN fill under the deck).
  const relief = (x: number) => (x >= 0 && x <= 50 ? -1.2 : x > -6 && x < 0 ? 0.2 : x > 50 && x < 56 ? 0.2 : 3.8);
  const ways = [way([[-80, 0], [0, 0]], false, 'tram'), way([[0, 0], [50, 0]], true, 'tram'), way([[50, 0], [130, 0]], false, 'tram')];
  const on = railLevels(ways, ways, relief), off = railLevels(ways, ways, relief, undefined, undefined, undefined, [], { abutments: false });
  const deck = (r: typeof on) => levelAt(r.levels.get(ways[1])!, 25);
  assert.ok(deck(on) > 3.7, `deck ${deck(on)}`);
  assert.ok(deck(off) < 3.4, `before: deck ${deck(off)}`);
});

test('UNDER_STREET_M: a street far under the bed passes under it; one at its level is a crossing (its level returned)', () => {
  const street: [Vec2, Vec2][] = [[[50, -20], [50, 20]]];
  const z = (_x: number, _y: number) => 0;
  const cross = crossingTest(street, 32, z), along = onStreetTest([[[0, 3], [100, 3], 3]], undefined, 32, z);
  assert.equal(cross([40, 0], [60, 0], 0.1, 0.1), 0);
  assert.equal(cross([40, 0], [60, 0], UNDER_STREET_M + 0.5, UNDER_STREET_M + 0.5), false);
  assert.equal(along([40, 0], [60, 0], 4, 4), false);
  assert.equal(along([40, 0], [60, 0], 0.3, 0.3), 0);
  // Without a street height the tests stay boolean (the builds before the lane).
  assert.equal(crossingTest(street)([40, 0], [60, 0]), true);
});

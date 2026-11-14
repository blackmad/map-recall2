// Tunnel cuts (tunnels.ts): wall detection, ramps from portals, slots through embankments, the surface overlay and
// the cut's meshes, on synthetic relief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GroundField, type LocalToRd } from './heightField';
import { GroundSurface, type Vec2 } from './surface';
import { BANK_GAP_STATIONS, BANK_SPAN_SCALE, MIN_RISE_M, WALL_REACH_MOTOR_M, bridgeBankGaps, cutMeshes, type SideScan, cutRelief, mergeNeighbours, insideCut, locateCut, planCuts, scanSide, slotCut, splitAtCrossings, tunnelRuns, findPortals, type Cut, type CutWay } from './tunnels';
import { buildCell } from './groundCell';

const IDENTITY: LocalToRd = { cx: 0, cy: 0, r: 1, a: [0, 1, 0, 0, 0, 0], b: [0, 0, 1, 0, 0, 0] };
/** A 2 m field over [-200, 200]² from `h`, as the relief extract samples it. */
function field(h: (x: number, y: number) => number): GroundField {
  const step = 2, tile = 100, n = tile / step, f = new GroundField(step, tile);
  for (let ty = -2; ty < 2; ty++) for (let tx = -2; tx < 2; tx++) {
    const d = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) d[j * n + i] = h(tx * tile + (i + 0.5) * step, ty * tile + (j + 0.5) * step);
    f.addTile(tx, ty, d);
  }
  return f;
}
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const way = (id: number, tags: Record<string, string>, points: Vec2[], half = 3.5): CutWay => ({ id, tags, points, half, tunnel: !!tags.tunnel });

test('scanSide finds a smeared vertical wall, its top and its half-height line', () => {
  // Floor 0 out to 5 m, a wall smeared over 5..7 m up to 4 m.
  const g = (t: number) => 4 * smooth((t - 5) / 2);
  const s = scanSide(g, 0, 3, () => false)!;
  assert.ok(s && s.wall, 'a wall');
  assert.ok(Math.abs(s.reach - 6) < 0.6, `at the half-height line (${s.reach})`);
  assert.ok(Math.abs(s.rim - 4) < 0.1 && Math.abs(s.depth - 4) < 0.1, `rim ${s.rim}`);
});

test('scanSide: flat land, a far-off dike and a long bank are no wall; a sunken neighbour road is shared', () => {
  assert.equal(scanSide(() => 0.1, 0, 3, () => false), null, 'flat');
  assert.equal(scanSide(t => 3 * smooth((t - 15) / 2), 0, 3, () => false), null, 'a dike 15 m off');
  assert.equal(scanSide(t => 3 * smooth((t - 4) / 16), 0, 3, () => false), null, 'a 1:5 bank');
  const shared = scanSide(t => (t > 12 ? 4 : 0), 0, 3, t => Math.abs(t - 8) < 0.3)!;
  assert.ok(shared && !shared.wall && Math.abs(shared.reach - 8) < 0.6, 'the other carriageway at 8 m on the floor');
});

// A motor ramp along +y into a portal at y = 100: the road sinks from 0 at y = 0 to −5 at the portal between walls at
// x = ±6; past the portal the ground over the tunnel is at 0 (a plaza).
const rampRelief = (x: number, y: number): number => {
  if (y >= 100) return 0;
  const depth = 5 * Math.max(0, Math.min(1, y / 100));
  return -depth * (1 - smooth((Math.abs(x) - 5.5) / 1.5));
};

test('planCuts: a motor ramp into a portal gets walls both sides and a portal, the ground over the tunnel stays', () => {
  const ways = [
    way(1, { highway: 'trunk', oneway: 'yes' }, [[0, -20], [0, 100]]),
    way(2, { highway: 'trunk', oneway: 'yes', tunnel: 'yes', layer: '-1' }, [[0, 100], [0, 300]]),
  ];
  const surface = new GroundSurface(field(rampRelief), IDENTITY, 0);
  const cuts = planCuts(ways, surface.relief, () => true);
  const ramp = cuts.find(c => c.kind === 'ramp')!;
  assert.ok(ramp, `a ramp (${cuts.map(c => c.id).join(', ')})`);
  assert.equal(ramp.motor, true);
  const mid = ramp.x.length >> 1;
  assert.ok(ramp.wallL[mid] && ramp.wallR[mid], 'walls both sides');
  assert.ok(Math.abs(ramp.left[mid] - 6) < 1 && Math.abs(ramp.right[mid] - 6) < 1, `walls at ±6 m (${ramp.left[mid]}, ${ramp.right[mid]})`);
  assert.equal(ramp.portals.length, 1, 'one portal');
  const p = ramp.portals[0];
  assert.ok(Math.abs(ramp.y[p.at] - 100) < 3 && p.dir[1] > 0.9 && Math.abs(p.top) < 0.3, `portal at the roof, facing in (${ramp.y[p.at]}, top ${p.top})`);
  for (const c of cuts) surface.addCut(c);
  // In the strip: the riding floor; the relief there is the wall top (the land is cut by the mask).
  assert.ok(Math.abs(surface.height(0, 80) - rampRelief(0, 80)) < 0.3, `floor ${surface.height(0, 80)}`);
  assert.ok(Math.abs(surface.ground(3, 80) - 0) < 0.3, 'lid at the wall top');
  // Behind the wall the DTM's smear is lifted to the wall top.
  assert.ok(surface.ground(6.5, 80) > -0.3, `behind the wall ${surface.ground(6.5, 80)} (relief ${surface.relief(6.5, 80)})`);
  // Over the tunnel past the lid, and far off, the relief is untouched.
  for (const [x, y] of [[0, 120], [0, 200], [30, 50]] as Vec2[]) assert.equal(surface.ground(x, y), surface.relief(x, y), `untouched at ${x},${y}`);
  const m = cutMeshes(ramp, () => true);
  assert.ok(m.walled > 0 && m.portals === 1 && m.floor.indices.length > 0, 'walls, a portal and a floor are drawn');
});

test('planCuts: a road at grade into a tunnel under a flat plaza gets no cut', () => {
  const ways = [
    way(1, { highway: 'trunk' }, [[0, -20], [0, 100]]),
    way(2, { highway: 'trunk', tunnel: 'yes', layer: '-1' }, [[0, 100], [0, 300]]),
  ];
  assert.deepEqual(planCuts(ways, () => 0, () => true), []);
});

test('a slot through a rail embankment: the floor is the line between the portals, the ride does not climb', () => {
  // A cycle tunnel along +x from x = -20 to 20 under an embankment 4 m high (|x| < 15, smeared over 5 m).
  const relief = (x: number) => 4 * (1 - smooth((Math.abs(x) - 15) / 5));
  const ways = [
    way(10, { highway: 'cycleway' }, [[-60, 0], [-20, 0]], 1.1),
    way(11, { highway: 'cycleway', tunnel: 'yes', layer: '-1' }, [[-20, 0], [20, 0]], 1.1),
    way(12, { highway: 'cycleway' }, [[20, 0], [60, 0]], 1.1),
  ];
  const runs = tunnelRuns(ways);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].ends, [true, true]);
  const slot = slotCut(runs[0], (x) => relief(x))!;
  assert.ok(slot && slot.kind === 'slot' && !slot.motor, 'a slot');
  const surface = new GroundSurface(field(x => relief(x)), IDENTITY, 0);
  surface.addCut(slot);
  for (let x = -40; x <= 40; x += 1) assert.ok(surface.height(x, 0) < 0.6, `no climb at x = ${x}: ${surface.height(x, 0)}`);
  assert.ok(Math.abs(surface.ground(0, 0) - 4) < 0.2, 'the embankment stays over the slot (its land is cut by the mask)');
  // A motor tunnel is never a slot; nor is a long one.
  assert.equal(slotCut({ ...runs[0], ways: [way(11, { highway: 'trunk', tunnel: 'yes' }, runs[0].points)] }, x => relief(x)), null);
});

test('findPortals: tunnel ends at an open road', () => {
  const ways = [way(1, { highway: 'primary' }, [[0, 0], [0, 50]]), way(2, { highway: 'primary', tunnel: 'yes' }, [[0, 50], [0, 90]]), way(3, { highway: 'primary', tunnel: 'yes' }, [[5, 0], [5, 40]])];
  const p = findPortals(ways);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].at, [0, 50]);
  assert.ok(p[0].dir[1] > 0.99, 'facing into the tunnel');
});

test('splitAtCrossings: a street at grade over a ramp breaks the strip and marks the ends under it', () => {
  const surface = new GroundSurface(field(rampRelief), IDENTITY, 0);
  const ramp = planCuts([way(1, { highway: 'trunk' }, [[0, -20], [0, 100]]), way(2, { highway: 'trunk', tunnel: 'yes' }, [[0, 100], [0, 300]])], surface.relief, () => true)[0];
  const pieces = splitAtCrossings(ramp, [way(9, { highway: 'secondary' }, [[-30, 50], [30, 50]], 4)]);
  assert.equal(pieces.length, 2);
  assert.deepEqual(pieces[0].crossed, [false, true]);
  assert.deepEqual(pieces[1].crossed, [true, false]);
  assert.ok(pieces.every(p => p.cut.y.every(y => Math.abs(y - 50) > 4)), 'nothing left under the street');
});

test('scanSide steps past a low island the relief falls back from, to the wall behind it (motor reach)', () => {
  // A 0.5 m island at 4-8 m, the floor again to 12 m, then an 8 m wall smeared over 12-16 m.
  const g = (t: number) => (t > 4 && t < 8 ? 0.5 : 0) + 8 * smooth((t - 12) / 4);
  const s = scanSide(g, 0, 3.3, null, MIN_RISE_M, WALL_REACH_MOTOR_M)!;
  assert.ok(s && s.wall && s.depth > 7 && Math.abs(s.reach - 14) < 1, `the wall behind (${JSON.stringify(s)})`);
  // The low rise alone with nothing behind (a taper's end): it is the side's wall after all.
  const lone = scanSide(t => (t > 4 && t < 8 ? 0.5 : 0), 0, 3.3, null)!;
  assert.ok(lone && lone.wall && Math.abs(lone.depth - 0.5) < 0.05 && Math.abs(lone.reach - 4.5) < 1, `the low rise (${JSON.stringify(lone)})`);
});

test('mergeNeighbours: two carriageways with a median between are one trench, the median on the floor', () => {
  const mk = (id: string, x: number, f = 0): Cut => {
    const n = 11, ys = Array.from({ length: n }, (_, i) => i * 2);
    return { id, way: 1, kind: 'ramp', motor: true, x: ys.map(() => x), y: ys, s: ys, floor: ys.map(() => f), left: ys.map(() => 2), right: ys.map(() => 2), wallL: ys.map(() => 1), wallR: ys.map(() => 1), rimL: ys.map(() => 3), rimR: ys.map(() => 3), portals: [], bbox: [x - 10, -10, x + 10, 30] };
  };
  // Touching strips (the old shared-wall case).
  {
    const a = mk('a', 0), b = mk('b', 3.8);
    mergeNeighbours([a, b]);
    // Along +y the left normal points to −x: a's left wall is its outer one, its right wall faces b.
    assert.ok(a.wallL.every(Boolean) && a.wallR.every(w => !w), 'a keeps its outer wall');
    assert.ok(b.wallR.every(Boolean) && b.wallL.every(w => !w), 'b keeps its outer wall');
  }
  // A 5 m median island 1 m high between them: merged, and the relief over the median lies on the floor.
  {
    const a = mk('a', 0), b = mk('b', 9), relief = (x: number) => (x > 2 && x < 7 ? 1 : 0);
    mergeNeighbours([a, b], relief);
    assert.ok(a.wallR.every(w => !w) && b.wallL.every(w => !w), 'no wall across the median');
    assert.ok(a.gapR!.every(g => Math.abs(g - 5) < 0.6), `gap ${a.gapR}`);
    const surface = new GroundSurface(field((x, y) => relief(x) + 0 * y), IDENTITY, 0);
    surface.addCut(a); surface.addCut(b);
    for (const x of [2.5, 4.5, 6.5]) assert.ok(Math.abs(surface.ground(x, 10)) < 0.05, `median at the floor at x = ${x}: ${surface.ground(x, 10)}`);
    assert.ok(Math.abs(surface.ground(-2.5, 10) - 3) < 0.05, 'the outer side keeps its wall top behind it');
  }
  // A real berm (3 m) or a floor 2 m apart: two trenches, walls kept.
  for (const [b, relief] of [[mk('b', 9), (x: number) => (x > 2 && x < 7 ? 3 : 0)], [mk('b', 9, -2), () => 0]] as [Cut, (x: number) => number][]) {
    const a = mk('a', 0);
    mergeNeighbours([a, b], relief);
    assert.ok(a.wallR.every(Boolean) && b.wallL.every(Boolean), 'walls kept');
  }
});

test('scanWay carries a deep ramp on through its shallow taper, and starts no cut from a shallow dip', () => {
  // The ramp sinks 0 → −5 m over y 0..100 between walls at ±6; the first 20 m are under 0.45 m deep.
  const surface = new GroundSurface(field(rampRelief), IDENTITY, 0);
  const ramp = planCuts([way(1, { highway: 'trunk' }, [[0, -20], [0, 100]]), way(2, { highway: 'trunk', tunnel: 'yes' }, [[0, 100], [0, 300]])], surface.relief, () => true)[0];
  const startY = Math.min(...ramp.y);
  assert.ok(startY < 8, `the cut reaches back into the taper (starts at y = ${startY.toFixed(1)})`);
  // A 0.3 m dip alone, 60 m long: no cut.
  const dip = (x: number, y: number) => (y > 0 && y < 60 ? -0.3 * (1 - smooth((Math.abs(x) - 5.5) / 1.5)) : 0);
  const s2 = new GroundSurface(field(dip), IDENTITY, 0);
  assert.deepEqual(planCuts([way(1, { highway: 'trunk' }, [[0, -20], [0, 100]]), way(2, { highway: 'trunk', tunnel: 'yes' }, [[0, 100], [0, 300]])], s2.relief, () => true), []);
});

test('a slot under a high embankment gets open lintels at the tunnel ends, and they are drawn', () => {
  const relief = (x: number) => 5 * (1 - smooth((Math.abs(x) - 15) / 5));
  const run = tunnelRuns([way(10, { highway: 'cycleway' }, [[-60, 0], [-20, 0]], 1.1), way(11, { highway: 'cycleway', tunnel: 'yes' }, [[-20, 0], [20, 0]], 1.1), way(12, { highway: 'cycleway' }, [[20, 0], [60, 0]], 1.1)])[0];
  const slot = slotCut(run, x => relief(x))!;
  assert.equal(slot.portals.length, 2);
  assert.ok(slot.portals.every(p => p.open && Math.abs(Math.abs(slot.x[p.at]) - 20) < 2.1), 'at the tunnel ends, open');
  assert.equal(cutMeshes(slot, () => true).portals, 2);
  // A low embankment (2 m): no lintel.
  const low = slotCut(run, x => 2 * (1 - smooth((Math.abs(x) - 15) / 5)))!;
  assert.equal(low.portals.length, 0);
});

test('locateCut / cutRelief: inside the strip the nearer wall top, behind a wall at least its top, outside nothing', () => {
  const n = 11, ys = Array.from({ length: n }, (_, i) => i * 2);
  const c: Cut = { id: 'c', way: 1, kind: 'ramp', motor: true, x: ys.map(() => 0), y: ys, s: ys, floor: ys.map(() => -4), left: ys.map(() => 5), right: ys.map(() => 5), wallL: ys.map(() => 1), wallR: ys.map(() => 0), rimL: ys.map(() => 0.5), rimR: ys.map(() => -4), portals: [], bbox: [-20, -10, 20, 30] };
  const h = locateCut(c, -2, 10)!;
  assert.ok(insideCut(c, h) && h.lateral > 0, 'left of +y is −x');
  assert.equal(cutRelief(c, h, -3), 0.5);
  const behind = locateCut(c, -7, 10)!;
  assert.ok(!insideCut(c, behind));
  assert.equal(cutRelief(c, behind, -1), 0.5, 'lifted to the wall top');
  assert.ok(Number.isNaN(cutRelief(c, locateCut(c, 2, 10)!, -3)), 'no wall on the right: the relief stands');
  assert.ok(Number.isNaN(cutRelief(c, locateCut(c, -20, 10)!, 0)), 'far off');
});

test('buildCell without cuts is unchanged by the tunnel code (no cuts: no mask, same layers)', () => {
  const surface = new GroundSurface(field(() => 0), IDENTITY, 0);
  const base = { key: '0_0', lod: 0 as const, rect: [0, 0, 100, 100] as [number, number, number, number], surface, water: null, waterAround: [], decks: [], deckRingsAround: [], flatDecks: [], osm: null, osmAround: [], project: (p: [number, number]) => p as Vec2 };
  const a = buildCell(base), b = buildCell({ ...base, cuts: [] });
  assert.equal(a.mask, null);
  assert.equal(b.mask, null);
  assert.deepEqual(Object.keys(a.layers), Object.keys(b.layers));
  assert.deepEqual([...a.layers.land!.positions], [...b.layers.land!.positions]);
});

test('scanSide spanScale: a bank smeared over 10 m is no wall at the plain span test and a wall at BANK_SPAN_SCALE (#270)', () => {
  // The IJ-tunnel west ramp's east bank: foot 2.5 m past the edge, 3.3 m up 10 m further (a 9.5 m span; limit 4 + 1.5 * 3.3 = 8.95 m).
  const g = (t: number) => 3.3 * Math.max(0, Math.min(1, (t - 5.5) / 10));
  assert.equal(scanSide(g, 0, 3.3, null, MIN_RISE_M, WALL_REACH_MOTOR_M), null, 'no wall at the plain span');
  const s = scanSide(g, 0, 3.3, null, MIN_RISE_M, WALL_REACH_MOTOR_M, true, BANK_SPAN_SCALE);
  assert.ok(s?.wall && s.depth > 3, `a wall at the wider span (${JSON.stringify(s)})`);
});

test('bridgeBankGaps: a long gap between two wall runs takes the re-scans only when every station is a deep wall', () => {
  const W = (rim: number): SideScan => ({ reach: 6, wall: true, rim, depth: rim + 3 });
  const make = (gap: number, anchor = 3) => {
    const sides: [SideScan | null, SideScan | null][] = [];
    for (let i = 0; i < anchor; i++) sides.push([null, W(0.5)]);
    for (let i = 0; i < gap; i++) sides.push([null, null]);
    for (let i = 0; i < anchor; i++) sides.push([null, W(0.4)]);
    return { sides, floor: sides.map(() => -3) };
  };
  // 20 stations, every re-scan a wall: bridged with the re-scans, the other side untouched.
  let t = make(20);
  bridgeBankGaps(t.sides, t.floor, (i, k) => (k === 1 ? W(0.2) : null));
  assert.ok(t.sides.every(sd => sd[1]?.wall) && t.sides.every(sd => sd[0] === null), 'bridged on the right only');
  assert.equal(t.sides[10][1]!.rim, 0.2, 'the re-scan, not an interpolation');
  // One station without a rise (a slip road's mouth): left open.
  t = make(20);
  bridgeBankGaps(t.sides, t.floor, i => (i === 12 ? null : W(0.2)));
  assert.equal(t.sides.filter(sd => sd[1]?.wall).length, 6, 'a real opening stays open');
  // A shallow bank (under MIN_RUN_DEPTH_M): left open.
  t = make(20);
  bridgeBankGaps(t.sides, t.floor, () => ({ reach: 6, wall: true, rim: -2.2, depth: 0.8 }));
  assert.equal(t.sides.filter(sd => sd[1]?.wall).length, 6, 'a shallow bank stays open');
  // A one-station blip at an end is no anchor.
  t = make(20, 1);
  bridgeBankGaps(t.sides, t.floor, () => W(0.2));
  assert.equal(t.sides.filter(sd => sd[1]?.wall).length, 2, 'blips are no anchors');
  // Longer than BANK_GAP_STATIONS: left open.
  t = make(BANK_GAP_STATIONS + 1);
  bridgeBankGaps(t.sides, t.floor, () => W(0.2));
  assert.equal(t.sides.filter(sd => sd[1]?.wall).length, 6, 'too long');
});

test('planCuts rampGaps: a motor ramp whose wall turns into a smeared bank for 40 m stays one cut; off, it splits (#270)', () => {
  // Floor −3 m left of the centreline and out to the right wall; the right wall steep at 5.5-7 m, except y 80..120
  // where it is a bank rising over 10 m. Over the tunnel (y > 200) the land is at 0.
  const relief = (x: number, y: number) => {
    if (y > 200) return 0;
    if (x <= 0) return -3;
    return -3 + 3 * (y > 80 && y < 120 ? Math.max(0, Math.min(1, (x - 5.5) / 10)) : smooth((x - 5.5) / 1.5));
  };
  const surface = new GroundSurface(field(relief), IDENTITY, 0);
  const ways = [way(1, { highway: 'trunk' }, [[0, -20], [0, 200]], 3.3), way(2, { highway: 'trunk', tunnel: 'yes' }, [[0, 200], [0, 300]], 3.3)];
  const on = planCuts(ways, surface.relief, () => true, new Set(), undefined, { rampGaps: true }).filter(c => c.way === 1);
  const off = planCuts(ways, surface.relief, () => true).filter(c => c.way === 1);
  assert.equal(off.length, 2, `off: split at the bank (${off.map(c => c.id).join(' ')})`);
  assert.equal(on.length, 1, `on: one cut (${on.map(c => c.id).join(' ')})`);
  const c = on[0], mid = c.y.findIndex(y => y > 100);
  assert.ok(c.wallR[mid] === 1 && c.rimR[mid] - c.floor[mid] > 2, `walled through the bank (rim ${(c.rimR[mid] - c.floor[mid]).toFixed(2)})`);
});

// Lane LS (2026-11-13): scanSide without its per-probe closure and spread-map minimum gives the same scan. The
// reference is the bc4ad8a body, frozen; the relief profiles are random walls, low bumps (some with a wall behind),
// plateaus, NaN holes and neighbouring roads.
test('scanSide equals the bc4ad8a scan on 5,000 random relief profiles', async () => {
  const { scanSide, SCAN_M, MIN_RISE_M, WALL_REACH_M, BUMP_MAX_M, WALL_SPAN_M, WALL_SPAN_PER_M } = await import('./tunnels');
  const STEP = 0.5;
  const med = (v: number[]): number => { const s = v.filter(x => x === x).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
  type Scan = { reach: number; wall: boolean; rim: number; depth: number } | null;
  function ref(g: (t: number) => number, floor: number, half: number, shared: ((t: number) => boolean) | null, minRise = MIN_RISE_M, wallReach = WALL_REACH_M, skipBumps = true, spanScale = 1): Scan {
    let foot = 0, skipped = false;
    const none = (): Scan => (skipped ? ref(g, floor, half, shared, minRise, wallReach, false, spanScale) : null);
    for (let t = STEP; t <= SCAN_M; t += STEP) {
      const z = g(t);
      if (z === z && z - floor <= (minRise >= MIN_RISE_M ? 0.25 : minRise * 0.5)) { foot = t; if (!shared && foot > half + wallReach) return none(); }
      if (t > 1 && shared && shared(t) && Math.abs(z - floor) < 0.5) return skipped ? none() : { reach: t, wall: false, rim: z, depth: 0 };
      if (!(z - floor >= minRise)) continue;
      if (foot > half + wallReach) return none();
      let top = t, zt = z;
      for (let u = t + STEP; u <= Math.min(SCAN_M + 6, t + 8); u += STEP) { const zu = g(u); if (!(zu > zt + 0.04)) break; top = u; zt = zu; }
      const depth = zt - floor;
      if (skipBumps && depth < BUMP_MAX_M && Math.min(...[2, 3, 4, 5, 6].map(m => g(top + m))) - floor < depth * 0.8) {
        let back = top + 2;
        while (back < top + 6 && g(back) - floor >= depth * 0.8) back += STEP;
        foot = back; t = foot - STEP; skipped = true; continue;
      }
      if (top - foot > (WALL_SPAN_M + WALL_SPAN_PER_M * depth) * spanScale) return none();
      const mid = floor + depth / 2;
      let at = foot;
      for (let u = foot; u <= top; u += STEP) { if (g(u) >= mid) { const z0 = g(u - STEP); at = u - STEP + STEP * Math.max(0, Math.min(1, (mid - z0) / ((g(u) - z0) || 1))); break; } }
      const rim = med([0, 1, 2, 3].map(k => g(top + k * STEP)));
      return { reach: Math.max(Math.min(half, 1), at), wall: true, rim: Math.max(rim, mid), depth: Math.max(rim, mid) - floor };
    }
    return none();
  }
  let s = 11;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  let walls = 0, rescans = 0;
  for (let trial = 0; trial < 5000; trial++) {
    // Piecewise relief: up to 3 steps (a bump 0.3-0.9 m, or a wall 0.5-8 m) with ramps, noise, and maybe a NaN hole.
    const floor = rnd() * 2;
    const steps = Array.from({ length: Math.floor(rnd() * 4) }, () => ({ at: rnd() * 26, rise: rnd() < 0.5 ? 0.3 + rnd() * 0.6 : 0.5 + rnd() * 7.5, width: rnd() * 5, fall: rnd() < 0.4 ? 1 + rnd() * 5 : Infinity }));
    const hole = rnd() < 0.15 ? [rnd() * 20, 0.5 + rnd() * 2] : null;
    const g = (t: number) => {
      if (hole && t >= hole[0] && t < hole[0] + hole[1]) return NaN;
      let z = floor + Math.sin(t * 7.3 + trial) * 0.03;
      for (const st of steps) {
        const up = Math.max(0, Math.min(1, (t - st.at) / Math.max(0.01, st.width)));
        const down = st.fall === Infinity ? 0 : Math.max(0, Math.min(1, (t - st.at - st.width - st.fall) / 1));
        z += st.rise * (up - down);
      }
      return z;
    };
    const sharedAt = rnd() < 0.3 ? 3 + rnd() * 15 : null;
    const shared = sharedAt == null ? null : (t: number) => t >= sharedAt;
    const half = 1 + rnd() * 6, minRise = rnd() < 0.2 ? 0.3 : MIN_RISE_M, reach = rnd() < 0.3 ? 10 : WALL_REACH_M, skip = rnd() < 0.9, span = rnd() < 0.2 ? 1.5 : 1;
    let calls = 0, refCalls = 0;
    const got = scanSide(t => { calls++; return g(t); }, floor, half, shared, minRise, reach, skip, span);
    const want = ref(t => { refCalls++; return g(t); }, floor, half, shared, minRise, reach, skip, span);
    assert.deepStrictEqual(got, want, `trial ${trial}`);
    assert.equal(calls, refCalls, `trial ${trial}: the relief is sampled the same number of times`);
    if (want?.wall) walls++;
    if (refCalls > 60) rescans++;
  }
  assert.ok(walls > 500, `walls found (${walls})`);
});

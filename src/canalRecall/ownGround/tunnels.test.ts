// Tunnel cuts (tunnels.ts): wall detection, ramps from portals, slots through embankments, the surface overlay and
// the cut's meshes, on synthetic relief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GroundField, type LocalToRd } from './heightField';
import { GroundSurface, type Vec2 } from './surface';
import { cutMeshes, cutRelief, dropSharedWalls, insideCut, locateCut, planCuts, scanSide, slotCut, splitAtCrossings, tunnelRuns, findPortals, type Cut, type CutWay } from './tunnels';
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

test('dropSharedWalls: two cuts side by side keep only their outer walls', () => {
  const mk = (id: string, x: number): Cut => {
    const n = 11, ys = Array.from({ length: n }, (_, i) => i * 2);
    return { id, way: 1, kind: 'slot', motor: false, x: ys.map(() => x), y: ys, s: ys, floor: ys.map(() => 0), left: ys.map(() => 2), right: ys.map(() => 2), wallL: ys.map(() => 1), wallR: ys.map(() => 1), rimL: ys.map(() => 3), rimR: ys.map(() => 3), portals: [], bbox: [x - 10, -10, x + 10, 30] };
  };
  const a = mk('a', 0), b = mk('b', 3.8);
  dropSharedWalls([a, b]);
  // Along +y the left normal points to −x: a's left wall is its outer one, its right wall faces b.
  assert.ok(a.wallL.every(Boolean) && a.wallR.every(w => !w), 'a keeps its outer wall');
  assert.ok(b.wallR.every(Boolean) && b.wallL.every(w => !w), 'b keeps its outer wall');
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

// Lane R5-C1 (issue #262): road surfaces carried across bridges and one red owner per mouth.
//   node --import tsx --test src/canalRecall/ownGround/deckCarry.test.ts
//
// The synthetic bridge mirrors the Kattenburgerbrug west abutment as measured on main ff96ebd7f: a quay footway on the
// ground (h = 0) runs under the bridge's deck polygons (h = 1: carriageway and fietspad), on a flat footprint whose
// riding surface is the land. Before the carry the footway (sidewalk top, +0.14 m) drew over the deck (+0.03 / +0.04 m):
// the pale band across the road and the red at each abutment in the user's shots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeLine } from './parks';
import { emptyMesh, type MeshArrays } from './drape';
import { buildRoadSurfaces, kerbEdges, RoadIndex, RED_CYCLE_LIFT, ROAD_LIFT, SIDEWALK_TOP } from './roadSurfaces';
import { CARRY_RISE_M, cutUnderDecks, deckDecision, nearWater, runsOutside } from './deckCarry';
import { cycleThrough, fietspadWidthAt, meshCover, THROUGH_WIDTH_M } from './cycleThrough';
import { prepareWays } from './streets';
import type { RoadCell, RoadClass, RoadMesh } from './roadCells';
import type { Vec2 } from './surface';

type Poly = { c: RoadClass; k: RoadMesh; h?: number; ring: Vec2[] };
function cellOf(polys: readonly Poly[], key = '0_0'): RoadCell {
  const kerbs = kerbEdges(polys.map(p => ({ c: p.c, h: p.h ?? 0, rings: [p.ring] })));
  return { version: 1, key, surfaces: polys.map(p => ({ k: p.k, c: p.c, h: p.h ?? 0, r: [encodeLine(p.ring)] })), kerbs: kerbs.map(encodeLine), coverWays: [] };
}
const zero = () => 0;
/** Triangle centroids (x, y, z) of a mesh. */
function centroids(m: MeshArrays | undefined): [number, number, number][] {
  if (!m) return [];
  const p = m.positions, out: [number, number, number][] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i] * 3, m.indices[i + 1] * 3, m.indices[i + 2] * 3];
    out.push([(p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3]);
  }
  return out;
}
/** Does a triangle of `m` cover (x, y) in plan? Its z there, else null. */
function zAt(m: MeshArrays | undefined, x: number, y: number): number | null {
  if (!m) return null;
  const p = m.positions, idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
    const d = (p[B + 1] - p[C + 1]) * (p[A] - p[C]) + (p[C] - p[B]) * (p[A + 1] - p[C + 1]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((p[B + 1] - p[C + 1]) * (x - p[C]) + (p[C] - p[B]) * (y - p[C + 1])) / d, v = ((p[C + 1] - p[A + 1]) * (x - p[C]) + (p[A] - p[C]) * (y - p[C + 1])) / d;
    if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) return u * p[A + 2] + v * p[B + 2] + (1 - u - v) * p[C + 2];
  }
  return null;
}
const UNDER: Vec2[] = [[3, 1], [4, 3], [5, 5], [3.5, 7], [4.5, 7.5]];
const area = (m: MeshArrays | undefined, inside: (x: number, y: number) => boolean = () => true): number => {
  if (!m) return 0;
  const p = m.positions;
  let s = 0;
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i] * 3, m.indices[i + 1] * 3, m.indices[i + 2] * 3];
    if (!inside((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3)) continue;
    s += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (p[b + 1] - p[a + 1])) / 2;
  }
  return s;
};

// A road running east over a bridge from x = 0 to x = 20: the ground carriageway and fietspad west of it, the deck's
// carriageway (y 0..6) and fietspad (y 6..8) over it, and a quay footway (x 2..6) under the bridge running north-south.
const BRIDGE: Poly[] = [
  { c: 'carriage', k: 'asphalt', ring: [[-20, 0], [0, 0], [0, 6], [-20, 6]] },
  { c: 'cycle', k: 'cycle', ring: [[-20, 6], [0, 6], [0, 8], [-20, 8]] },
  { c: 'carriage', k: 'asphalt', h: 1, ring: [[0, 0], [20, 0], [20, 6], [0, 6]] },
  { c: 'cycle', k: 'cycle', h: 1, ring: [[0, 6], [20, 6], [20, 8], [0, 8]] },
  { c: 'foot', k: 'paving', ring: [[2, -10], [6, -10], [6, 18], [2, 18]] },
];
const underDeck = (x: number, y: number) => x > 2 && x < 6 && y > 0 && y < 8;
const deckInput = (extra: Record<string, unknown> = {}) => ({ height: zero, deckHeight: zero, deckWeight: () => 0, overWater: () => false, onFlatDeck: (x: number, y: number) => x >= 0 && x <= 20 && y >= 0 && y <= 8, bridgeGaps: true, lod: 0 as const, ...extra });

test('cutUnderDecks: a ground polygon loses the part a deck covers; untouched: null', () => {
  const sq: Vec2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const pieces = cutUnderDecks([sq], [[[[4, -1], [6, -1], [6, 11], [4, 11]]]])!;
  assert.equal(pieces.length, 2);
  const a = pieces.reduce((s, p) => s + Math.abs(p[0].reduce((t, q, i) => { const r = p[0][(i + 1) % p[0].length]; return t + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2, 0);
  assert.ok(Math.abs(a - 80) < 1e-6, `area ${a}`);
  assert.equal(cutUnderDecks([sq], [[[[20, 20], [30, 20], [30, 30]]]]), null);
  assert.deepEqual(cutUnderDecks([sq], [[[[-1, -1], [11, -1], [11, 11], [-1, 11]]]]), []);
});

test('runsOutside: a kerb run is split where it passes under the deck; a run clear of it keeps its vertices', () => {
  const run: Vec2[] = [[0, -5], [0, 5], [0, 15]];
  const parts = runsOutside(run, (x, y) => y > 0 && y < 8);
  assert.equal(parts.length, 2);
  assert.ok(parts[0].every(p => p[1] <= 0) && parts[1].every(p => p[1] >= 8));
  assert.deepEqual(runsOutside(run, () => false), [run]);
});

test('deckDecision: low over the ground → whole and low; a real overpass keeps the old rule; skipped → carried at a bridge only', () => {
  const index = new RoadIndex([cellOf(BRIDGE)]);
  const deckK = index.records.findIndex(r => r.h === 1);
  const flatIn = { land: zero, deck: zero, overWater: () => false, carried: () => true };
  assert.deepEqual(deckDecision(index, deckK, flatIn, true), { draw: true, whole: true, low: true, carriedOnly: false });
  const high = { ...flatIn, deck: () => CARRY_RISE_M + 3 };
  assert.deepEqual(deckDecision(index, deckK, high, true), { draw: true, whole: false, low: false, carriedOnly: false });
  assert.deepEqual(deckDecision(index, deckK, high, false), { draw: false, whole: false, low: false, carriedOnly: false });
  assert.equal(deckDecision(index, deckK, { ...high, overWater: (x: number) => x > 25 }, false).draw, true, 'water 5 m past the deck: carried');
  assert.equal(nearWater([[0, 0], [1, 0], [1, 1]], () => false), false);
});

test('buildRoadSurfaces bridgeCarry: the deck shows over the quay footway, its kerbs go; off: byte-identical to before', () => {
  const cell = cellOf(BRIDGE), off = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput());
  const offAgain = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput({ bridgeCarry: false }));
  assert.deepEqual(offAgain.layers, off.layers, 'bridgeCarry false is the build before');
  // Before: the footway is drawn whole under the deck at the sidewalk top, over the deck's carriageway and fietspad.
  for (const [x, y] of UNDER) assert.ok(Math.abs(zAt(off.layers.paving, x, y)! - SIDEWALK_TOP) < 0.01, `before: footway over the deck at ${x},${y}`);
  const on = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput({ bridgeCarry: true }));
  for (const [x, y] of UNDER) assert.equal(zAt(on.layers.paving, x, y), null, `after: no footway at ${x},${y}`);
  assert.equal(area(on.layers.paving, underDeck), 0, 'after: no footway under the deck');
  assert.ok(area(on.layers.paving, (x, y) => x > 2 && x < 6 && (y < 0 || y > 8)) > 4 * 17.5, 'the footway either side stays');
  assert.ok(Math.abs(area(on.layers.asphalt, (x, y) => x > 0 && y > 0 && y < 6) - 120) < 0.5, 'the deck carriageway whole');
  assert.ok(Math.abs(area(on.layers.cycle, (x, y) => x > 0 && y > 6 && y < 8) - 40) < 0.5, 'the deck fietspad whole');
  assert.equal(on.stats.groundCut, 1);
  // No kerb of the footway's edges inside the deck (the footway / carriageway kerbs under the bridge).
  assert.ok(!centroids(on.layers.kerb).some(([x, y]) => x > 2.3 && x < 5.7 && y > 0.3 && y < 7.7), 'no kerb under the deck');
});

test('buildRoadSurfaces redDedupe: the fietspad on its own plane over the carriageway; off: as before', () => {
  const cell = cellOf(BRIDGE.slice(0, 2));
  const off = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput());
  const on = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput({ redDedupe: true }));
  assert.deepEqual(buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput({ redDedupe: false })).layers, off.layers);
  assert.ok(centroids(off.layers.cycle).every(([, , z]) => Math.abs(z - ROAD_LIFT.cycle) < 1e-9));
  assert.ok(centroids(on.layers.cycle).every(([, , z]) => Math.abs(z - RED_CYCLE_LIFT) < 1e-9));
  assert.ok(RED_CYCLE_LIFT - ROAD_LIFT.carriage >= 0.06 - 1e-9, 'red ≥ 6 cm over the carriageway');
});

// A two-way fietspad (x < 0 and x > 10, 3.2 m wide at y 0..3.2) crossing a side street's mouth (x 0..10, carriageway),
// and an OSM cycleway along it (no width tag: the cycleway prior, 2.5 m).
const MOUTH: Poly[] = [
  { c: 'cycle', k: 'cycle', ring: [[-20, 0], [0, 0], [0, 3.2], [-20, 3.2]] },
  { c: 'carriage', k: 'asphalt', ring: [[0, -20], [10, -20], [10, 20], [0, 20]] },
  { c: 'cycle', k: 'cycle', ring: [[10, 0], [30, 0], [30, 3.2], [10, 3.2]] },
];
const lngLat = (p: Vec2): [number, number] => p;
const cycleway = prepareWays([{ id: 1, tags: { highway: 'cycleway' }, g: [[-20, 1.6], [30, 1.6]] } as never], lngLat);

test('cycleThrough redDedupe: the band takes the BGT fietspad width; a run on the survey crossing red is not drawn twice', () => {
  const index = new RoadIndex([cellOf(MOUTH)]);
  assert.ok(Math.abs(fietspadWidthAt(index, [-5, 1.6], [1, 0])! - 3.2) < 0.15);
  const before = emptyMesh(), s0 = cycleThrough(before, cycleway, () => true, index, zero);
  assert.equal(s0.drawn, 1);
  const widthOf = (m: MeshArrays) => { const ys = m.positions.filter((_, i) => i % 3 === 1); return Math.max(...ys) - Math.min(...ys); };
  const bgt = emptyMesh(), s1 = cycleThrough(bgt, cycleway, () => true, index, zero, { bgtWidth: true });
  assert.equal(s1.bgtWidth, 1);
  assert.ok(Math.abs(widthOf(bgt) - 3.2) < 0.1 && Math.abs(widthOf(before) - 2.5) < 0.1, `widths ${widthOf(bgt)} ${widthOf(before)}`);
  assert.ok(THROUGH_WIDTH_M < 2.5);
  // The survey's cycle crossing already covers the mouth: one owner.
  const crossing = emptyMesh();
  crossing.positions.push(-1, -1, 0, 11, -1, 0, 11, 4.2, 0, -1, 4.2, 0); crossing.indices.push(0, 1, 2, 0, 2, 3);
  const deduped = emptyMesh(), s2 = cycleThrough(deduped, cycleway, () => true, index, zero, { owned: meshCover(crossing) });
  assert.equal(s2.drawn, 0); assert.equal(s2.skipped.owned, 1); assert.equal(deduped.indices.length, 0); assert.equal(deduped.positions.length, 0);
});

test('cycleThrough bridgeCarry: a cycleway tagged bridge draws only with `bridges`', () => {
  const index = new RoadIndex([cellOf(MOUTH)]);
  const bridgeWay = prepareWays([{ id: 2, tags: { highway: 'cycleway', bridge: 'yes' }, g: [[-20, 1.6], [30, 1.6]] } as never], lngLat);
  assert.equal(cycleThrough(emptyMesh(), bridgeWay, () => true, index, zero).drawn, 0);
  const m = emptyMesh(), s = cycleThrough(m, bridgeWay, () => true, index, zero, { bridges: true, deckHeight: () => 1 });
  assert.equal(s.drawn, 1); assert.equal(s.bridges, 1);
  assert.ok(centroids(m).every(([, , z]) => z > 1), 'on the deck surface');
});

test('buildRoadSurfaces redDedupe: a berm the survey overlaps with the fietspad gives way to the red (the Beltbrug)', () => {
  const polys: Poly[] = [
    { c: 'cycle', k: 'cycle', ring: [[0, 0], [20, 0], [20, 3], [0, 3]] },
    { c: 'berm', k: 'paving', ring: [[0, 2], [20, 2], [20, 6], [0, 6]] },
  ];
  const cell = cellOf(polys);
  const off = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput());
  assert.ok(zAt(off.layers.paving, 10, 2.5)! > zAt(off.layers.cycle, 10, 2.5)!, 'before: the berm over the red');
  const on = buildRoadSurfaces(cell, new RoadIndex([cell]), deckInput({ redDedupe: true }));
  assert.equal(zAt(on.layers.paving, 10, 2.5), null, 'after: the red alone');
  assert.ok(zAt(on.layers.paving, 10, 4) !== null, 'the berm beside it stays');
  assert.equal(on.stats.redCut, 1);
});

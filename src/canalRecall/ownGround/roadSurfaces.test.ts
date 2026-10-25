// roads-v1 runtime (roadSurfaces.ts + the roads option of streets.ts) on a synthetic cross:
//   node --import tsx --test src/canalRecall/ownGround/roadSurfaces.test.ts
//
// Two carriageway strips meeting at a junction (the N–S one whole, the E–W one in two pieces), four pavement
// corners and one fietspad along the north arm's east side: a proper partition (shared edges share vertices).
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeLine } from './parks';
import { densifyOnRelief, emptyMesh, type MeshArrays } from './drape';
import { buildRoadSurfaces, coveredShare, drapeAdaptive, kerbEdges, kerbShadowTint, RoadIndex, ROAD_LIFT, SIDEWALK_TOP, simplifyLine, simplifyRing } from './roadSurfaces';
import { buildStreets, carriageGrid, crossCuts, junctionGeometry, prepareWays, LIFT, PAINT_ON_SURVEY, ROAD_MARK_LIFT, type LocalWay } from './streets';
import { stations } from './drape';
import type { RoadCell, RoadClass, RoadMesh } from './roadCells';
import type { Vec2 } from './surface';

type Poly = { c: RoadClass; k: RoadMesh; h?: number; ring: Vec2[] };
const CROSS: Poly[] = [
  { c: 'carriage', k: 'asphalt', ring: [[-4, -50], [4, -50], [4, -4], [4, 4], [4, 50], [-4, 50], [-4, 4], [-4, -4]] },
  { c: 'carriage', k: 'asphalt', ring: [[-50, -4], [-4, -4], [-4, 4], [-50, 4]] },
  { c: 'carriage', k: 'klinker', ring: [[4, -4], [50, -4], [50, 4], [6, 4], [4, 4]] },
  { c: 'cycle', k: 'cycle', ring: [[4, 4], [6, 4], [6, 50], [4, 50]] },
  { c: 'foot', k: 'paving', ring: [[6, 4], [50, 4], [50, 50], [6, 50]] },
  { c: 'foot', k: 'paving', ring: [[-50, 4], [-4, 4], [-4, 50], [-50, 50]] },
  { c: 'foot', k: 'paving', ring: [[-50, -50], [-4, -50], [-4, -4], [-50, -4]] },
  { c: 'foot', k: 'paving', ring: [[4, -50], [50, -50], [50, -4], [4, -4]] },
];
function cellOf(polys: readonly Poly[], key = '0_0', coverWays: number[] = []): RoadCell {
  const kerbs = kerbEdges(polys.map(p => ({ c: p.c, h: p.h ?? 0, rings: [p.ring] })));
  return { version: 1, key, surfaces: polys.map(p => ({ k: p.k, c: p.c, h: p.h ?? 0, r: [encodeLine(p.ring)] })), kerbs: kerbs.map(encodeLine), coverWays };
}
const flat = () => 0;
const ll = (p: Vec2): [number, number] => p;
function centroids(m: MeshArrays): [number, number, number][] {
  const p = m.positions, out: [number, number, number][] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
    out.push([(p[a * 3] + p[b * 3] + p[c * 3]) / 3, (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3]);
  }
  return out;
}
/** Centroids of `a` lying inside a triangle of `b` within 2 cm of its plane (what probe-junction-overlap --pairs counts). */
function overlaps(a: MeshArrays, b: MeshArrays): number {
  const p = b.positions, idx = b.indices;
  let n = 0;
  for (const [x, y, z] of centroids(a)) {
    for (let t = 0; t < idx.length; t += 3) {
      const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
      const d = (p[B + 1] - p[C + 1]) * (p[A] - p[C]) + (p[C] - p[B]) * (p[A + 1] - p[C + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((p[B + 1] - p[C + 1]) * (x - p[C]) + (p[C] - p[B]) * (y - p[C + 1])) / d, v = ((p[C + 1] - p[A + 1]) * (x - p[C]) + (p[A] - p[C]) * (y - p[C + 1])) / d;
      if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
      const zb = u * p[A + 2] + v * p[B + 2] + (1 - u - v) * p[C + 2];
      if (Math.abs(zb - z) < 0.02) { n++; break; }
    }
  }
  return n;
}
const input = { height: flat, deckHeight: flat, deckWeight: () => 0, overWater: () => false, lod: 0 as const };

test('road surfaces: the partition drapes without coplanar overlaps, at the class lifts, and the kerbs face the carriageway', () => {
  const cell = cellOf(CROSS), index = new RoadIndex([cell]);
  const { layers, stats, skipped } = buildRoadSurfaces(cell, index, input);
  assert.equal(skipped.size, 0);
  assert.deepEqual(stats.drawn, { carriage: 3, foot: 4, cycle: 1, pedestrian: 0, parking: 0, driveway: 0, island: 0, berm: 0, verge: 0, square: 0 });
  const road = ['asphalt', 'klinker', 'cycle', 'paving'] as const;
  for (const a of road) for (const b of road) if (a !== b) assert.equal(overlaps(layers[a] ?? emptyMesh(), layers[b] ?? emptyMesh()), 0, `${a} centroids inside ${b} triangles`);
  for (const c of centroids(layers.asphalt!)) assert.ok(Math.abs(c[2] - ROAD_LIFT.carriage) < 1e-6);
  for (const c of centroids(layers.cycle!)) assert.ok(Math.abs(c[2] - ROAD_LIFT.cycle) < 1e-6);
  for (const c of centroids(layers.paving!)) assert.ok(Math.abs(c[2] - SIDEWALK_TOP) < 1e-6);
  // Kerbs only on carriage|foot and cycle|foot edges: 8 edges, 366 m; none along the carriage|cycle or carriage|carriage joins.
  const kerbs = kerbEdges(CROSS.map(p => ({ c: p.c, h: 0, rings: [p.ring] })));
  const total = kerbs.reduce((s, run) => s + stations(run)[run.length - 1], 0);
  assert.ok(Math.abs(total - 366) < 0.01, `kerb length ${total}`);
  for (const run of kerbs) for (const [x, y] of run) assert.ok(Math.abs(x) >= 4 || Math.abs(y) >= 4, `kerb vertex inside the junction ${x},${y}`);
  assert.ok(!kerbs.some(run => run.every(([x]) => Math.abs(x - 4) < 1e-9) && run.every(([, y]) => y >= 4)), 'no kerb between the carriageway and the fietspad');
  assert.equal(stats.kerbUnsided, 0);
  assert.ok(stats.kerbs >= 4 && (layers.kerb?.indices.length ?? 0) > 0);
  // The kerb faces stand on the carriageway side: every kerb-wall vertex is within 0.16 m of a kerb line (the 0.15 m granite line lies on the pavement side).
  const kp = layers.kerb!.positions;
  for (let i = 0; i < kp.length; i += 3) assert.ok(Math.abs(Math.abs(kp[i]) - 4) < 0.16 || Math.abs(Math.abs(kp[i + 1]) - 4) < 0.16 || Math.abs(kp[i] - 6) < 0.16, `kerb vertex off the kerb lines ${kp[i]},${kp[i + 1]}`);
  // The kerb's shadow line (issue #52): kerb vertices tinted to the dark groove, on the low side of every kerb within
  // KERB_SHADOW_M, at the rails' lift, never on the pavement; the rest of the kerb is untinted (the kerb tone).
  const kc = layers.kerb!.colors!, tint = kerbShadowTint();
  assert.ok(tint.every(v => v < 0.6), `tint ${tint}`);
  let tinted = 0;
  for (let i = 0; i < kp.length; i += 3) {
    const t = [kc[i], kc[i + 1], kc[i + 2]];
    if (t.every(v => v === 1)) continue;
    assert.deepEqual(t, tint);
    tinted++;
    const [x, y, z] = [kp[i], kp[i + 1], kp[i + 2]];
    assert.ok(Math.abs(z - ROAD_MARK_LIFT.rail) < 1e-6, `shadow line at z=${z}`);
    const cls = index.classAt(x + Math.sign(x) * -0.01, y + Math.sign(y) * -0.01);
    assert.ok(cls !== 'foot', `shadow line vertex on the pavement at ${x.toFixed(2)},${y.toFixed(2)}`);
  }
  assert.ok(tinted >= 8, `tinted vertices ${tinted}`);
  // The index answers class, mesh, height and the road test.
  assert.equal(index.classAt(0, 20), 'carriage'); assert.equal(index.classAt(5, 20), 'cycle'); assert.equal(index.classAt(-20, 20), 'foot'); assert.equal(index.classAt(80, 80), null);
  assert.equal(index.meshAt(20, 0), 'klinker'); assert.equal(index.heightAt(0, 0), 0);
  assert.ok(index.onRoad(0, 0) && index.onRoad(80, 80) && !index.onRoad(5, 20) && !index.onRoad(-20, 20));
  assert.ok(index.coversBand(5, 20, 'cycle') && !index.coversBand(0, 20, 'cycle') && index.coversBand(-20, 20, 'paving') && index.coversBand(0, 20, 'paving') && index.coversBand(0, 20, 'asphalt') && index.coversBand(5, 20, 'asphalt') && !index.coversBand(80, 80, 'asphalt'));
});

test('road surfaces: a deck polygon over no deck and no water is skipped and counted; over water it is drawn on the deck surface', () => {
  const high: Poly = { c: 'carriage', k: 'asphalt', h: 1, ring: [[100, 100], [110, 100], [110, 110], [100, 110]] };
  const cell = cellOf([high]), index = new RoadIndex([cell]);
  const dry = buildRoadSurfaces(cell, index, input);
  assert.equal(dry.stats.skippedHigh, 1); assert.deepEqual([...dry.skipped], [0]); assert.equal(dry.layers.asphalt, undefined);
  const wet = buildRoadSurfaces(cell, index, { ...input, overWater: () => true, deckHeight: () => 2 });
  assert.equal(wet.stats.onDeck, 1); assert.equal(wet.stats.skippedHigh, 0);
  for (const c of centroids(wet.layers.asphalt!)) assert.ok(Math.abs(c[2] - (2 + ROAD_LIFT.carriage)) < 1e-6, 'drawn on the deck surface');
  const deckIndex = new RoadIndex([cellOf([high, { c: 'foot', k: 'paving', ring: [[100, 100], [110, 100], [110, 110], [100, 110]] }])]);
  assert.equal(deckIndex.classAt(105, 105, true), 'carriage'); assert.equal(deckIndex.classAt(105, 105, false), 'foot'); assert.ok(deckIndex.onDeck(105, 105) && deckIndex.hasDecks);
});

test('streets with roads: covered ways emit no bands but keep their junction marks; the zebra, the rails and the lane ribbon stop at the carriageway polygons', () => {
  const ways = prepareWays([
    // The N–S tertiary with painted lanes and tram rails (covered), the E–W residential pieces (covered), a zebra across the north arm.
    { id: 1, tags: { highway: 'tertiary', 'cycleway:both': 'lane', sidewalk: 'both', embedded_rails: 'tram', lanes: '2' }, g: [[0, -50], [0, 0], [0, 50]] },
    { id: 2, tags: { highway: 'residential', sidewalk: 'both' }, g: [[-50, 0], [0, 0]] },
    { id: 3, tags: { highway: 'residential', sidewalk: 'both' }, g: [[0, 0], [50, 0]] },
    { id: 4, tags: { highway: 'footway', footway: 'crossing', crossing: 'zebra' }, g: [[-12, 20], [12, 20]] },
    // A footway along y = 30 over the pavements, crossing the north arm: its band is kept only off the foot polygons.
    { id: 5, tags: { highway: 'footway' }, g: [[-40, 30], [40, 30]] },
  ], p => ll(p as Vec2));
  const cell = cellOf(CROSS, '0_0', [1, 2, 3]), index = new RoadIndex([cell]);
  // `plain` is the band model with its priors (guessedPaint: the teeth it is compared on; off in the game since issue #63).
  const plain = buildStreets(ways, flat, { guessedPaint: true }), s = buildStreets(ways, flat, { roads: { index, covered: new Set(cell.coverWays) } });
  const c = s.stats.markings.clipped!;
  assert.equal(c.coveredWays, 3);
  // No bands from the covered ways: the asphalt is empty (the plain build fills the junction and the arms with it); the side streets give way with teeth.
  assert.equal(s.asphalt.indices.length, 0, 'no asphalt bands or junction fill');
  assert.equal(s.klinker.indices.length, 0, 'no klinker bands');
  assert.ok(plain.asphalt.indices.length > 0 && plain.stats.markings.teeth > 0);
  // Since 2026-10-16 surveyed ground draws no procedural paint (PAINT_ON_SURVEY; user: "maybe we just stop showing
  // dashes for now"): no paint at all on the survey; with it back on, the teeth and the zebra stay on the carriageway.
  if (!PAINT_ON_SURVEY) assert.equal(s.paint.indices.length, 0, 'no procedural paint on surveyed ground');
  else assert.ok(s.stats.markings.teeth > 0 && s.stats.markings.giveWays === 2, `teeth ${s.stats.markings.teeth} on ${s.stats.markings.giveWays} arms`);
  assert.equal(c.fills, 1, 'the junction fill is skipped: the node lies in a polygon');
  assert.equal(s.stats.corners, 0, 'no corner patches inside the polygons');
  // The zebra (way 4, dashes at y = 20): every dash on the carriageway polygon, none on the pavements.
  const zebra = centroids(s.paint).filter(q => Math.abs(q[1] - 20) < 1.6);
  if (PAINT_ON_SURVEY) assert.ok(zebra.length >= 6, `zebra dashes ${zebra.length}`);
  for (const q of zebra) assert.ok(Math.abs(q[0]) <= 4.3, `zebra dash on the pavement at x=${q[0].toFixed(2)}`);
  assert.ok(centroids(plain.paint).some(q => Math.abs(q[1] - 20) < 1.6 && Math.abs(q[0]) > 5), 'the band model ran the zebra onto the pavement');
  // Rails: on the N–S carriageway only (the polygon runs the whole way), none dropped there.
  assert.ok(s.tram.indices.length > 0 && c.rails === 0);
  // The painted lane ribbon: west lane drawn (pavement beyond), east lane dropped north of the junction where the fietspad polygon lies a metre outward.
  const red = centroids(s.cycle);
  assert.ok(red.some(q => q[0] < -3 && q[1] > 6), 'west lane ribbon drawn');
  assert.equal(red.filter(q => q[0] > 3 && q[1] > 6).length, 0, 'east lane ribbon dropped beside the fietspad');
  assert.ok(red.some(q => q[0] > 3 && q[1] < -6), 'east lane ribbon drawn south of the junction (pavement beyond)');
  for (const q of red) assert.ok(Math.abs(q[2] - ROAD_MARK_LIFT.lane) < 1e-6, 'lane ribbons at the roads-mode lift');
  assert.ok(ROAD_MARK_LIFT.lane > LIFT.cycleLane);
  // The footway along y = 30 lies on surveyed polygons for its whole length (pavements, carriageway, fietspad): no band at all.
  const foot = centroids(s.paving).filter(q => Math.abs(q[1] - 30) < 1.2);
  assert.equal(foot.length, 0, `footway band pieces left on the survey: ${JSON.stringify(foot.slice(0, 3))}`);
  assert.ok(centroids(plain.paving).some(q => Math.abs(q[1] - 30) < 1.2), 'the band model drew it');
  assert.ok(c.bandStations >= 80, `${c.bandStations} band stations dropped`);
});

test('streets with roads: crossCuts cut carriageway paint where another carriageway crosses without a shared node', () => {
  const ways = prepareWays([
    { id: 1, tags: { highway: 'tertiary', lanes: '2' }, g: [[0, -50], [0, 50]] },
    // Crosses the first at y = 20 without a node; both carry centre dashes.
    { id: 2, tags: { highway: 'tertiary', lanes: '2' }, g: [[-50, 20], [50, 20]] },
    // A parallel neighbour 4 m off never cuts.
    { id: 3, tags: { highway: 'residential' }, g: [[4.5, -50], [4.5, 50]] },
  ], p => ll(p as Vec2)) as LocalWay[];
  const nodes = junctionGeometry(ways), grid = carriageGrid(ways);
  const cuts1 = crossCuts(ways[0], nodes, stations(ways[0].points), grid);
  assert.ok(cuts1.length >= 5 && cuts1.length <= 10, `${cuts1.length} cut stations on way 1`);
  assert.ok(cuts1.every(([a, b]: [number, number]) => a >= 70 - 5 && b <= 70 + 5), 'the cuts lie around station 70 (y = 20)');
  assert.equal(crossCuts(ways[2], nodes, stations(ways[2].points), grid).filter(([a]: [number, number]) => a < 60 || a > 80).length, 0, 'the parallel way is not cut by way 1');
  const cell = cellOf([{ c: 'carriage', k: 'asphalt', ring: [[-60, -60], [60, -60], [60, 60], [-60, 60]] }]), index = new RoadIndex([cell]);
  // guessedPaint: the centre dashes are class priors (off in the game since issue #63); this tests how crossCuts cut them.
  const s = buildStreets(ways, flat, { roads: { index, covered: new Set() }, guessedPaint: true });
  // Way 1's centre dashes (x = 0); way 2's own run along y = 20 and are left out by the y test.
  const dashes = centroids(s.paint).filter(q => Math.abs(q[0]) < 0.3 && Math.abs(q[1] - 20) > 0.3);
  assert.ok((!PAINT_ON_SURVEY || dashes.length > 0) && dashes.every(q => Math.abs(q[1] - 20) > 4.4), 'no centre dash of way 1 within the crossing');
  assert.ok(s.stats.markings.clipped!.crossCuts > 0);
});

test('road surfaces: cover share, ring simplification and the line simplifier', () => {
  const inside = (x: number, y: number) => Math.abs(x) <= 4 && Math.abs(y) <= 50;
  assert.equal(coveredShare([[0, -40], [0, 40]], inside), 1);
  assert.ok(Math.abs(coveredShare([[0, 0], [0, 100]], inside) - 0.51) < 0.02);
  const ring = simplifyRing([[0, 0], [5, 0.02], [10, 0], [10, 5], [10.03, 10], [10, 10], [0, 10], [0, 0]], 0.1);
  assert.deepEqual(ring, [[0, 0], [10, 0], [10.03, 10], [0, 10]], 'the collinear-within-tolerance vertices go, the corners stay');
  assert.deepEqual(simplifyLine([[0, 0], [1, 0.01], [2, 0], [3, 1]], 0.05), [[0, 0], [2, 0], [3, 1]]);
});

// User 2026-10-16, Prinsengracht by the Pulitzer: "I don't think we need to draw parking spots". The small footway
// islands between parking bays draw as part of the street (the bays' mesh, road height, no kerbs).
test('parkingIslands: a small footway between two parking bays draws as street; a long pavement does not', () => {
  const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const enc = (r: [number, number][]) => encodeLine([...r, r[0]]);
  const cell = { version: 1, key: '0_0', surfaces: [
    { k: 'klinker', c: 'parking', h: 0, r: [enc(sq(0, 0, 5, 2))] },
    { k: 'paving', c: 'foot', h: 0, r: [enc(sq(5, 0, 6.5, 2))] },
    { k: 'klinker', c: 'parking', h: 0, r: [enc(sq(6.5, 0, 11.5, 2))] },
    { k: 'paving', c: 'foot', h: 0, r: [enc(sq(0, 2, 60, 5))] },
  ], kerbs: [], coverWays: [] } as any;
  const index = new RoadIndex([cell]);
  assert.equal(index.parkingIslands(), 1);
  assert.equal(index.classAt(5.75, 1), 'parking');
  assert.equal(index.meshAt(5.75, 1), 'klinker');
  assert.equal(index.classAt(30, 3.5), 'foot');
});

test('roads R1 triangles: kerb stations follow the relief, coarse relief caps the drape, posts stay off the planted berms', () => {
  // A graded street's 46 m kerb is its own two corners split at DRAPE_MAX_EDGE_M; a 0.3 m hump gets stations no closer than minStep.
  const run: Vec2[] = [[4, 4], [50, 4]];
  assert.equal(densifyOnRelief(run, flat, 0.02, 2, 24).length, 3);
  const hump = (x: number) => 0.3 * Math.max(0, 1 - Math.abs(x - 27) / 6);
  const humped = densifyOnRelief(run, (x) => hump(x), 0.02, 2, 24);
  assert.ok(humped.length > 4, `hump stations ${humped.length}`);
  for (let i = 1; i < humped.length; i++) assert.ok(humped[i][0] - humped[i - 1][0] >= 2 - 1e-9 || humped[i][0] === 50, 'no station closer than minStep');
  // A 40 × 0.5 m sliver on a 4 m-period ripple: the area floor stops the splits a data step cannot resolve.
  const coords = [0, 0, 40, 0, 40, 0.5, 0, 0.5], tris = [0, 1, 2, 0, 2, 3];
  const ripple = (x: number, y: number) => 0.2 * Math.sin(x * Math.PI / 2) + 0 * y;
  const fine = emptyMesh(), capped = emptyMesh();
  drapeAdaptive(fine, coords, tris, ripple, 0, 24, 0.05, 4);
  drapeAdaptive(capped, coords, tris, ripple, 0, 24, 0.05, 4, 0.05, 8);
  assert.ok(capped.indices.length < fine.indices.length, `capped ${capped.indices.length / 3} < ${fine.indices.length / 3}`);
  const byLength = emptyMesh(); drapeAdaptive(byLength, coords, tris, flat, 0, 24, 0.05, 4);
  assert.equal(capped.indices.length, byLength.indices.length, 'split by maxEdge alone');
  // Posts along the pavement's kerb, not along the berm's: a street between a footway (y > 4) and a berm (y < -4).
  const polys: Poly[] = [
    { c: 'carriage', k: 'asphalt', ring: [[0, -4], [40, -4], [40, 4], [0, 4]] },
    { c: 'foot', k: 'paving', ring: [[0, 4], [40, 4], [40, 8], [0, 8]] },
    { c: 'berm', k: 'grass', ring: [[0, -8], [40, -8], [40, -4], [0, -4]] },
  ];
  const cell = cellOf(polys), built = buildRoadSurfaces(cell, new RoadIndex([cell]), { ...input, canalSide: () => true });
  assert.ok(built.stats.kerbs === 2 && built.stats.bollards > 0, `kerbs ${built.stats.kerbs}, bollards ${built.stats.bollards}`);
  const bp = built.layers.bollard!.positions;
  for (let i = 1; i < bp.length; i += 3) assert.ok(bp[i] > 0, `post at y ${bp[i]} by the berm`);
});

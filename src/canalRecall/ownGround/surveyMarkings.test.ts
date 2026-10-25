// Survey-aware road markings (surveyMarkings.ts), road-marks-v1 nodes (roadMarks.ts) and the inrit brick layer
// (roadSurfaces surfaceLayer), on a synthetic cross:
//   node --import tsx --test src/canalRecall/ownGround/surveyMarkings.test.ts
//
// An 8 m N–S tertiary through a junction with two residential side arms (asphalt west, klinker east), pavements in
// the four corners and a fietspad along the north arm's east side (the roadSurfaces.test.ts partition).
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeLine } from './parks';
import type { MeshArrays } from './drape';
import { kerbEdges, RoadIndex, surfaceLayer } from './roadSurfaces';
import { prepareWays, ROAD_MARK_LIFT } from './streets';
import { alignCycleCrossing, ALIGN_GAP_M, buildSurveyMarkings, CENTRE_CUT_M, crossingPaint, ZEBRA } from './surveyMarkings';
import { decodeMarks, encodeMarks, isRoadMarksCell, markOf, type RoadMark } from './roadMarks';
import type { RoadCell, RoadClass, RoadMesh } from './roadCells';
import type { Vec2 } from './surface';

type Poly = { c: RoadClass; k: RoadMesh; ring: Vec2[] };
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
const cell: RoadCell = { version: 1, key: '0_0', surfaces: CROSS.map(p => ({ k: p.k, c: p.c, h: 0, r: [encodeLine(p.ring)] })), kerbs: kerbEdges(CROSS.map(p => ({ c: p.c, h: 0, rings: [p.ring] }))).map(encodeLine), coverWays: [] };
const index = new RoadIndex([cell]);
const WAYS = prepareWays([
  { id: 1, tags: { highway: 'tertiary' }, g: [[0, -50], [0, 0], [0, 50]] },
  { id: 2, tags: { highway: 'residential' }, g: [[-50, 0], [0, 0]] },
  { id: 3, tags: { highway: 'residential' }, g: [[0, 0], [50, 0]] },
], p => p as Vec2);

function centroids(m: MeshArrays): [number, number, number][] {
  const p = m.positions, out: [number, number, number][] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
    out.push([(p[a * 3] + p[b * 3] + p[c * 3]) / 3, (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3]);
  }
  return out;
}
const build = (marks: RoadMark[], ways = WAYS) => buildSurveyMarkings({ ways, marks, ownsWay: () => true, ownsPoint: () => true, index, height: () => 0, lift: { paint: ROAD_MARK_LIFT.paint, red: ROAD_MARK_LIFT.lane } });
const onCarriage = (x: number, y: number) => index.classAt(x, y) === 'carriage';

test('inrit and parking klinker draw as the muted brick layer; carriageway klinker and the rest keep their mesh', () => {
  assert.equal(surfaceLayer('driveway', 'klinker'), 'brick');
  assert.equal(surfaceLayer('parking', 'klinker'), 'brick');
  assert.equal(surfaceLayer('carriage', 'klinker'), 'klinker');
  assert.equal(surfaceLayer('parking', 'asphalt'), 'asphalt');
  assert.equal(surfaceLayer('driveway', 'paving'), 'paving');
  // Issue #52: an asphalt traffic island is raised paving in the pavement tone (the photo reads it light, luma 214).
  assert.equal(surfaceLayer('island', 'asphalt'), 'paving');
  assert.equal(surfaceLayer('berm', 'asphalt'), 'asphalt');
});

test('road-marks-v1: node tags → marks, and the cell encoding round-trips', () => {
  assert.deepEqual(markOf({ highway: 'crossing', crossing: 'marked', 'crossing:markings': 'zebra' }), { kind: 'zebra', signalised: false, dir: 0 });
  assert.deepEqual(markOf({ highway: 'crossing', 'crossing:markings': 'zebra', 'crossing:signals': 'yes' }), { kind: 'zebra', signalised: true, dir: 0 });
  assert.equal(markOf({ highway: 'crossing', crossing: 'traffic_signals', 'crossing:markings': 'dots' })?.kind, 'blocks');
  assert.equal(markOf({ highway: 'crossing', crossing: 'unmarked' }), null);
  assert.equal(markOf({ highway: 'crossing' }), null, 'a crossing that says nothing paints nothing');
  assert.deepEqual(markOf({ highway: 'give_way', direction: 'backward' }), { kind: 'giveWay', signalised: false, dir: -1 });
  assert.deepEqual(markOf({ highway: 'traffic_signals', 'traffic_signals:direction': 'forward' }), { kind: 'signals', signalised: true, dir: 1 });
  const marks: RoadMark[] = [{ p: [1.2, -3.4], kind: 'zebra', signalised: true, dir: 0 }, { p: [10, 20], kind: 'giveWay', signalised: false, dir: -1 }];
  const c = { version: 1 as const, key: '0_0', n: encodeMarks(marks) };
  assert.ok(isRoadMarksCell(c));
  assert.deepEqual(decodeMarks(c), marks);
  assert.equal(crossingPaint({ highway: 'footway', footway: 'crossing', crossing: 'uncontrolled', 'crossing:markings': 'dashes' }), 'blocks');
  assert.equal(crossingPaint({ highway: 'footway', footway: 'crossing', crossing: 'unmarked' }), null);
});

test('a zebra at a crossing node: stripes across the whole carriageway, clipped to it, ZEBRA.len along the road', () => {
  const { paint, stats } = build([{ p: [0, 20], kind: 'zebra', signalised: false, dir: 0 }]);
  assert.equal(stats.zebras, 1);
  assert.ok(stats.stripes >= 7, `stripes ${stats.stripes}`);
  const zebra = centroids(paint).filter(c => Math.abs(c[1] - 20) <= ZEBRA.len / 2 + 0.01);
  assert.ok(zebra.length >= 14);
  for (const c of zebra) assert.ok(Math.abs(c[0]) <= 4, `stripe off the carriageway at x=${c[0].toFixed(2)}`);
  assert.ok(Math.min(...zebra.map(c => c[0])) < -2.5 && Math.max(...zebra.map(c => c[0])) > 2.5, 'kerb to kerb');
});

test('unsignalised junction: the side arms give way with teeth across their inbound half; centre dashes stop before the mouth', () => {
  const { paint, stats } = build([]);
  assert.equal(stats.giveWays, 2, 'both residential arms');
  const all = centroids(paint);
  for (const c of all) assert.ok(onCarriage(c[0], c[1]), `paint off the carriageway at ${c[0].toFixed(2)},${c[1].toFixed(2)}`);
  // West arm: traffic comes in eastbound, its right is south (y < 0); east arm: westbound, right is north.
  const west = all.filter(c => c[0] < -4 && c[0] > -8), east = all.filter(c => c[0] > 4 && c[0] < 8);
  assert.ok(west.length > 0 && west.every(c => c[1] < 0.1), 'west teeth on the south half');
  assert.ok(east.length > 0 && east.every(c => c[1] > -0.1), 'east teeth on the north half');
  // Centre line on the 8 m two-way tertiary, none within the mouth + CENTRE_CUT_M of the node.
  assert.ok(stats.centreDashes >= 4, `dashes ${stats.centreDashes}`);
  const centre = all.filter(c => Math.abs(c[0]) < 0.2);
  assert.ok(centre.length > 0 && centre.every(c => Math.abs(c[1]) > 4 + CENTRE_CUT_M - 0.5), 'no centre dash at the junction');
});

test('signals: a stop line on the inbound half before a signalised zebra, and no teeth', () => {
  const { paint, stats } = build([{ p: [0, 20], kind: 'zebra', signalised: true, dir: 0 }]);
  assert.equal(stats.giveWays, 0, 'a signalised junction has no teeth');
  assert.equal(stats.stopLines, 1, 'only the approach toward the junction (southbound) stops here');
  // Southbound traffic stops north of the zebra, on its right (west) half.
  const line = centroids(paint).filter(c => c[1] > 20 + ZEBRA.len / 2 + 0.5 && c[1] < 24);
  assert.ok(line.length >= 2 && line.every(c => c[0] < 0.2 && c[0] > -4), `stop line ${JSON.stringify(line.map(c => c[0].toFixed(1)))}`);
});

test('a cycle path across a side street: red under its width with blocks, clipped to the carriageway', () => {
  const ways = [...WAYS, ...prepareWays([{ id: 9, tags: { highway: 'cycleway' }, g: [[-30, -10], [-30, 10]] }], p => p as Vec2)];
  // Node-backed only (lane roads-lanes 2026-10-23, R3): a cycleway merely passing over the carriageway is not marked;
  // the crossing node on it (OSM highway=crossing, crossing=marked/dashes) is.
  const bare = build([], ways);
  assert.equal(bare.stats.cycleCrossings, 0);
  assert.equal(bare.stats.cycleUnbacked, 1);
  const { paint, red, stats } = build([{ p: [-30, 0], kind: 'blocks', signalised: false, dir: 0 }], ways);
  assert.equal(stats.cycleCrossings, 1);
  const r = centroids(red);
  assert.ok(r.length > 0 && r.every(c => Math.abs(c[1]) <= 4 && Math.abs(c[0] + 30) <= 1.01));
  assert.ok(centroids(paint).filter(c => Math.abs(c[0] + 30) < 1.3 && Math.abs(c[1]) <= 4).length >= 10, 'block lines along both edges');
});

test('a red cycle crossing beside a zebra is laid parallel to it and abutting it (issue #52, Haarlemmerplein)', () => {
  const zebra = { kind: 'zebra' as const, centre: [0, 20] as Vec2, r: [0, 1] as Vec2, from: -4, to: 4 };
  // The cycle path's line runs 6° off the zebra's walking line and 1 m too far north of its edge.
  const got = alignCycleCrossing([zebra], [-4, 23.6], [4, 22.8], 2)!;
  const y = 20 + ZEBRA.len / 2 + ALIGN_GAP_M + 1;
  assert.ok(got && Math.abs(got[0][1] - y) < 1e-9 && Math.abs(got[1][1] - y) < 1e-9, `aligned ${JSON.stringify(got)}`);
  assert.ok(Math.abs(got[0][0] + 4) < 1e-9 && Math.abs(got[1][0] - 4) < 1e-9, 'its own extent across the road kept');
  // South of the zebra it goes to the south edge; too far away, or crossing the zebra's line, it stays where it is.
  assert.ok(Math.abs(alignCycleCrossing([zebra], [-4, 16.8], [4, 16.8], 2)![0][1] - (40 - y)) < 1e-9);
  assert.equal(alignCycleCrossing([zebra], [-4, 30], [4, 30], 2), null);
  assert.equal(alignCycleCrossing([zebra], [0, 15], [0, 25], 2), null);
  // On the synthetic cross: a blocks node on a cycleway 1 m off a zebra node draws its red parallel to the zebra.
  const ways = [...WAYS, ...prepareWays([{ id: 9, tags: { highway: 'cycleway' }, g: [[-10, 23.4], [10, 22.6]] }], p => p as Vec2)];
  const { red, stats } = build([{ p: [0, 20], kind: 'zebra', signalised: false, dir: 0 }, { p: [0, 23], kind: 'blocks', signalised: false, dir: 0 }], ways);
  assert.equal(stats.cycleAligned, 1);
  const ys = centroids(red).map(c => c[1]);
  assert.ok(ys.length > 0 && Math.max(...ys) - Math.min(...ys) < 2.01 && Math.min(...ys) > 20 + ZEBRA.len / 2, `red rows ${Math.min(...ys).toFixed(2)}..${Math.max(...ys).toFixed(2)}`);
});

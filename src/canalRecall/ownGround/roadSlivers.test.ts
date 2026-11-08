// Junction slivers, seams and kerb stubs (engine round 5, R5-C2 #263) and the tunnel wall clip.
//   node --import tsx --test src/canalRecall/ownGround/roadSlivers.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeRoadCell, roadCellDir, roadCellProblems, ROAD_CELLS_V3_DIR, type RoadCell, type RoadSurface } from './roadCells';
import { dissolveSlivers, isSliver, polygonShape, sliverStats, KERB_MIN_M } from './roadSlivers';
import { clipMeshAtCuts, cutMargin, type Cut } from './tunnels';
import { emptyMesh, vertex } from './drape';

/** A surface from integer-decimetre rings (open), delta-encoded. */
const surface = (c: RoadSurface['c'], k: RoadSurface['k'], ring: [number, number][], h = 0): RoadSurface => {
  const r: number[] = []; let x = 0, y = 0;
  for (const [px, py] of ring) { r.push(px - x, py - y); x = px; y = py; }
  return { c, k, h, r: [r] };
};
const line = (pts: [number, number][]) => { const r: number[] = []; let x = 0, y = 0; for (const [px, py] of pts) { r.push(px - x, py - y); x = px; y = py; } return r; };

test('polygonShape: a 10 m × 0.3 m strip is a thin sliver, a 1 m² square a tiny one, a 3 m square neither', () => {
  assert.ok(isSliver(polygonShape([[[0, 0], [10, 0], [10, 0.3], [0, 0.3]]])));
  assert.ok(isSliver(polygonShape([[[0, 0], [1, 0], [1, 1], [0, 1]]])));
  assert.ok(!isSliver(polygonShape([[[0, 0], [3, 0], [3, 3], [0, 3]]])));
});

test('dissolveSlivers: a footway sliver beside a carriageway joins it, its kerb goes, the cell stays valid', () => {
  // Carriageway 0..100 dm × 0..100 dm; a 0.3 m footway strip along its east side (x 100..103); a big footway beyond.
  const cell: RoadCell = {
    version: 2, key: '0_0', coverWays: [],
    surfaces: [
      surface('carriage', 'asphalt', [[0, 0], [100, 0], [100, 100], [0, 100]]),
      surface('foot', 'paving', [[100, 0], [103, 0], [103, 100], [100, 100]]),
      surface('foot', 'paving', [[103, 0], [200, 0], [200, 100], [103, 100]]),
    ],
    // The kerb along the sliver's carriageway edge, and a 1 m stub elsewhere.
    kerbs: [line([[100, 0], [100, 100]]), line([[0, 200], [10, 200]])],
  };
  const { cell: out, stats } = dissolveSlivers(cell);
  assert.deepEqual(roadCellProblems(out), []);
  assert.equal(out.version, 3);
  assert.equal(stats.sliversMerged, 1);
  assert.equal(out.surfaces.length, 2);
  assert.ok(stats.movedM2['foot>foot'] === undefined, 'the sliver joins its longest neighbour');
  const d = decodeRoadCell(out);
  // The sliver (shares 10 m with both) went to one of them; whichever, the kerb on an inner edge is gone or still sided.
  const s = sliverStats(d.surfaces.map(x => ({ c: x.c, k: x.k, h: x.h, rings: x.rings })), d.kerbs);
  assert.equal(s.slivers, 0);
  assert.ok(d.kerbs.every(k => k.length >= 2));
  assert.equal(stats.kerbStubsDropped >= 1, true, `the ${KERB_MIN_M} m rule drops the 1 m stub`);
});

test('dissolveSlivers: same-class carriageway neighbours dissolve, footways do not; the union keeps the area', () => {
  const cell: RoadCell = {
    version: 2, key: '0_0', coverWays: [], kerbs: [],
    surfaces: [
      surface('carriage', 'asphalt', [[0, 0], [100, 0], [100, 100], [0, 100]]),
      surface('carriage', 'asphalt', [[100, 0], [200, 0], [200, 100], [100, 100]]),
      surface('foot', 'paving', [[0, 100], [100, 100], [100, 200], [0, 200]]),
      surface('foot', 'paving', [[100, 100], [200, 100], [200, 200], [100, 200]]),
    ],
  };
  const { cell: out, stats } = dissolveSlivers(cell, { seams: true });
  assert.equal(stats.seamsDissolved, 1);
  assert.equal(out.surfaces.filter(s => s.c === 'carriage').length, 1);
  assert.equal(out.surfaces.filter(s => s.c === 'foot').length, 2);
  const area = decodeRoadCell(out).surfaces.filter(s => s.c === 'carriage').reduce((a, s) => a + polygonShape(s.rings).area, 0);
  assert.ok(Math.abs(area - 200) < 1e-6, `area ${area}`);
  assert.equal(dissolveSlivers(cell).stats.seamsDissolved, 0, 'seams are opt-in');
});

test('dissolveSlivers: a deck sliver is left to the deck path; an untouched cell keeps its polygons', () => {
  const cell: RoadCell = { version: 2, key: '0_0', coverWays: [], kerbs: [], surfaces: [surface('foot', 'paving', [[0, 0], [5, 0], [5, 5], [0, 5]], 1), surface('foot', 'paving', [[5, 0], [100, 0], [100, 5], [5, 5]], 1)] };
  const { cell: out, stats } = dissolveSlivers(cell);
  assert.equal(stats.sliversMerged, 0);
  assert.deepEqual(out.surfaces, cell.surfaces);
});

test('roadCellDir: version-3 cells only where the manifest publishes them', () => {
  assert.equal(roadCellDir({}), 'cells');
  assert.equal(roadCellDir({ v3: true }), ROAD_CELLS_V3_DIR);
});

/** A straight cut along +x, 4 m each side, walls both sides, floor 2 m under the rim. */
const straightCut = (): Cut => ({
  id: 't', way: 1, kind: 'ramp', motor: true,
  x: [0, 10, 20, 30, 40], y: [0, 0, 0, 0, 0], s: [0, 10, 20, 30, 40],
  floor: [-2, -2, -2, -2, -2], left: [4, 4, 4, 4, 4], right: [4, 4, 4, 4, 4],
  wallL: [1, 1, 1, 1, 1], wallR: [1, 1, 1, 1, 1], rimL: [0, 0, 0, 0, 0], rimR: [0, 0, 0, 0, 0],
  portals: [], bbox: [0, 0, 40, 0],
});

test('clipMeshAtCuts: a triangle hanging from the rim to the floor across a wall is cut at the wall line', () => {
  const c = straightCut();
  const m = emptyMesh();
  // Outside (y 6, at the rim) to inside (y 2, on the floor), across the left wall at y 4.
  const a = vertex(m, 15, 6, 0.14), b = vertex(m, 25, 6, 0.14), k = vertex(m, 20, 2, -1.86);
  m.indices.push(a, k, b);
  const out = clipMeshAtCuts(m, [c], () => 0, true);
  assert.notEqual(out, m);
  const p = out.positions;
  let crossing = 0;
  for (let t = 0; t < out.indices.length; t += 3) {
    const v = [out.indices[t], out.indices[t + 1], out.indices[t + 2]];
    const ys = v.map(i => p[i * 3 + 1]), zs = v.map(i => p[i * 3 + 2]);
    if (Math.min(...ys) < 3.95 && Math.max(...ys) > 4.05) crossing++;
    // Each piece is level: on the floor (+ its 14 cm) inside, at the rim (+ 14 cm) outside.
    assert.ok(Math.max(...zs) - Math.min(...zs) < 1e-6, `piece spans ${Math.max(...zs) - Math.min(...zs)}`);
    const mid = ys.reduce((s, y) => s + y, 0) / 3;
    assert.ok(Math.abs(zs[0] - (mid > 4 ? 0.14 : -1.86)) < 1e-6);
  }
  assert.equal(crossing, 0);
  // keepInside false (the land, the green fills): the inside piece goes.
  const land = clipMeshAtCuts(m, [c], () => 0, false);
  for (let t = 0; t < land.indices.length; t += 3) assert.ok([0, 1, 2].every(j => land.positions[land.indices[t + j] * 3 + 1] >= 4 - 1e-6));
});

test('clipMeshAtCuts: level triangles, open ends and unwalled sides are left alone (byte-identical)', () => {
  const c = straightCut();
  const m = emptyMesh();
  m.indices.push(vertex(m, 15, 6, 0.1), vertex(m, 20, 2, 0.0), vertex(m, 25, 6, 0.1)); // spans 0.1 m: no step
  assert.equal(clipMeshAtCuts(m, [c], () => 0, true), m);
  const open = { ...c, wallL: [0, 0, 0, 0, 0] };
  const n = emptyMesh();
  n.indices.push(vertex(n, 15, 6, 0.14), vertex(n, 20, 2, -1.86), vertex(n, 25, 6, 0.14));
  assert.equal(clipMeshAtCuts(n, [open], () => 0, true), n);
  const end = emptyMesh(); // across the strip's start (x 0): no wall there
  end.indices.push(vertex(end, -3, 1, 0.14), vertex(end, 2, 1, -1.86), vertex(end, -3, -1, 0.14));
  assert.equal(clipMeshAtCuts(end, [c], () => 0, true), end);
  assert.ok(cutMargin([c], 20, 2).margin > 0 && cutMargin([c], 20, 6).margin < 0);
});

test('the staged version-3 extract, when present: valid cells, no ground sliver merged into a missing neighbour', { skip: !existsSync('artifacts/roads-v1-staging/cells.json') }, () => {
  const man = JSON.parse(readFileSync('artifacts/roads-v1-staging/cells.json', 'utf8')) as { cells: string[]; v3?: boolean };
  assert.equal(man.v3, true);
  for (const key of man.cells.slice(0, 20)) {
    const f = `artifacts/roads-v1-staging/${ROAD_CELLS_V3_DIR}/${key}.json.gz`;
    if (!existsSync(f)) continue;
    assert.deepEqual(roadCellProblems(JSON.parse(gunzipSync(readFileSync(f)).toString())), [], key);
  }
});

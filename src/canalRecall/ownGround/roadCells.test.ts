// roads-v1 cell schema: classification, decoding, validation, and the staged / published extract when present.
//   node --import tsx --test src/canalRecall/ownGround/roadCells.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { encodeLine } from './parks';
import {
  KERB_HIGH_CLASSES, KERB_LOW_CLASSES, ROAD_CELL_BUDGET_GZ, ROAD_CLASSES, ROAD_MESHES, ROADS_ATTRIBUTION,
  FIETSSTRAAT_RAIL_MAX_M, decodeRoadCell, decodeRoadLine, fietsstraatSection, isRoadCell, kerbBetween, roadCellProblems, roadMesh, roadsManifestProblems, type RoadCell,
} from './roadCells';

const sample = (): RoadCell => ({
  version: 1, key: '-2_0',
  surfaces: [
    { k: 'klinker', c: 'carriage', h: 0, r: [encodeLine([[0, 0], [20, 0], [20, 6], [0, 6]])] },
    { k: 'paving', c: 'foot', h: 0, r: [encodeLine([[0, 6], [20, 6], [20, 8.5], [0, 8.5]]), encodeLine([[5, 6.5], [6, 6.5], [6, 7.5], [5, 7.5]])] },
    { k: 'asphalt', c: 'carriage', h: 1, r: [encodeLine([[20, 0], [40, 0], [40, 6], [20, 6]])] },
  ],
  kerbs: [encodeLine([[0, 6], [20, 6]])],
  coverWays: [7372572, 1239242881],
});

test('fietsstraatSection: red per section; a junction polygon at its end and a rijbaan with tram track stay grey', () => {
  // A plain fietsstraat section: only the fietsstraat runs along it.
  assert.equal(fietsstraatSection({ fiets: 60, other: 0, rails: 0 }), true);
  // Through a junction the cross street measures less than the fietsstraat: still red.
  assert.equal(fietsstraatSection({ fiets: 14, other: 10, rails: 0 }), true);
  // The junction polygon at a fietsstraat's end: 6 m of it against the cross street's 20 m: grey.
  assert.equal(fietsstraatSection({ fiets: 6, other: 20, rails: 0 }), false);
  // The Marnixstraat busway by the Tweede Marnixplantsoen: the fietsstraat on the polygon, and tram track along it.
  assert.equal(fietsstraatSection({ fiets: 40, other: 40, rails: 40 }), false);
  // A tram line only crossing a fietsstraat leaves it red.
  assert.equal(fietsstraatSection({ fiets: 60, other: 8, rails: 8 }), true);
  assert.equal(fietsstraatSection({ fiets: 60, other: 0, rails: FIETSSTRAAT_RAIL_MAX_M }), false);
  // A sliver touched by the fietsstraat's end is not painted.
  assert.equal(fietsstraatSection({ fiets: 2, other: 0, rails: 0 }), false);
});

test('roadMesh: surface by class and fysiek_voorkomen; a fietsstraat turns only a carriageway red', () => {
  assert.equal(roadMesh('carriage', 'gesloten verharding'), 'asphalt');
  assert.equal(roadMesh('carriage', 'open verharding'), 'klinker');
  assert.equal(roadMesh('parking', 'open verharding'), 'klinker');
  assert.equal(roadMesh('carriage', 'half verhard'), 'gravel');
  assert.equal(roadMesh('parking', 'onverhard'), 'gravel');
  assert.equal(roadMesh('carriage', null), 'asphalt');
  assert.equal(roadMesh('carriage', 'transitie'), 'asphalt');
  assert.equal(roadMesh('foot', 'gesloten verharding'), 'paving');
  assert.equal(roadMesh('pedestrian', 'open verharding'), 'paving');
  assert.equal(roadMesh('driveway', 'open verharding'), 'klinker');
  assert.equal(roadMesh('driveway', 'gesloten verharding'), 'asphalt');
  assert.equal(roadMesh('driveway', null), 'paving');
  assert.equal(roadMesh('cycle', 'open verharding'), 'cycle');
  assert.equal(roadMesh('carriage', 'gesloten verharding', true), 'cycle');
  assert.equal(roadMesh('parking', 'gesloten verharding', true), 'asphalt');
  assert.equal(roadMesh('foot', 'gesloten verharding', true), 'paving');
  for (const c of ROAD_CLASSES) for (const fv of ['gesloten verharding', 'open verharding', 'half verhard', 'onverhard', null]) assert.ok(ROAD_MESHES.includes(roadMesh(c, fv)));
});

test('kerbBetween: a road-level and a pavement-level polygon at the same height, nothing else', () => {
  for (const low of KERB_LOW_CLASSES) for (const high of KERB_HIGH_CLASSES) {
    assert.ok(kerbBetween({ c: low, h: 0 }, { c: high, h: 0 }), `${low}/${high}`);
    assert.ok(kerbBetween({ c: high, h: 1 }, { c: low, h: 1 }), `${high}/${low} on a deck`);
    assert.ok(!kerbBetween({ c: low, h: 0 }, { c: high, h: 1 }), `${low}/${high} across heights`);
  }
  assert.ok(!kerbBetween({ c: 'carriage', h: 0 }, { c: 'cycle', h: 0 }));
  assert.ok(!kerbBetween({ c: 'carriage', h: 0 }, { c: 'parking', h: 0 }));
  assert.ok(!kerbBetween({ c: 'foot', h: 0 }, { c: 'pedestrian', h: 0 }));
  assert.ok(!kerbBetween({ c: 'foot', h: 0 }, { c: 'driveway', h: 0 }));
  assert.ok(new Set([...KERB_LOW_CLASSES, ...KERB_HIGH_CLASSES]).size === ROAD_CLASSES.length, 'every class is on one side of a kerb');
});

test('decodeRoadLine is the inverse of parks encodeLine at decimetre precision', () => {
  const pts: [number, number][] = [[-123.46, 45.67], [-123.46, 45.67], [0.04, -0.04], [1000.5, -2000.25]];
  const back = decodeRoadLine(encodeLine(pts));
  assert.equal(back.length, 3, 'consecutive duplicates collapse');
  for (let i = 0; i < back.length; i++) {
    const p = [pts[0], pts[2], pts[3]][i];
    assert.ok(Math.abs(back[i][0] - p[0]) <= 0.05 && Math.abs(back[i][1] - p[1]) <= 0.05, `${i}: ${back[i]} vs ${p}`);
  }
  assert.deepEqual(decodeRoadLine([]), []);
  assert.deepEqual(decodeRoadLine([5]), []);
});

test('decodeRoadCell: metres, holes kept, degenerate rings dropped, cover set', () => {
  const cell = sample();
  cell.surfaces.push({ k: 'paving', c: 'foot', h: 0, r: [[0, 0, 10, 0]] }); // two points: dropped
  cell.surfaces.push({ k: 'paving', c: 'foot', h: 0, r: [encodeLine([[0, 0], [1, 0], [2, 0]]), [0, 0, 1, 1]] }); // bad hole dropped, outer kept
  const d = decodeRoadCell(cell);
  assert.equal(d.key, '-2_0');
  assert.equal(d.surfaces.length, 4);
  assert.deepEqual(d.surfaces[0].rings[0], [[0, 0], [20, 0], [20, 6], [0, 6]]);
  assert.equal(d.surfaces[1].rings.length, 2, 'hole kept');
  assert.equal(d.surfaces[2].h, 1);
  assert.equal(d.surfaces[3].rings.length, 1, 'bad hole dropped');
  assert.deepEqual(d.kerbs, [[[0, 6], [20, 6]]]);
  assert.ok(d.coverWays.has(7372572) && d.coverWays.size === 2);
});

test('roadCellProblems: the sample is valid and each schema breach is named', () => {
  assert.deepEqual(roadCellProblems(sample()), []);
  assert.ok(isRoadCell(sample()));
  const breach = (mutate: (c: any) => void, expect: RegExp) => {
    const c: any = sample(); mutate(c);
    const problems = roadCellProblems(c);
    assert.ok(problems.length > 0 && problems.some(p => expect.test(p)), `${expect}: ${problems.join('; ') || 'no problem found'}`);
    assert.ok(!isRoadCell(c));
  };
  breach(c => { c.version = 2; }, /version/);
  breach(c => { c.key = 'abc'; }, /key/);
  breach(c => { c.surfaces[0].k = 'tarmac'; }, /\.k/);
  breach(c => { c.surfaces[0].c = 'other'; }, /\.c/);
  breach(c => { c.surfaces[0].h = -1; }, /\.h/);
  breach(c => { c.surfaces[0].h = 0.5; }, /\.h/);
  breach(c => { c.surfaces[0].r = []; }, /no rings/);
  breach(c => { c.surfaces[0].r = [[0, 0, 1, 1]]; }, /≥ 3 points/);
  breach(c => { c.surfaces[0].r = [[0, 0, 1.5, 1, 2, 2]]; }, /non-integer/);
  breach(c => { c.kerbs = [[0, 0]]; }, /kerbs\[0\]/);
  breach(c => { c.coverWays = [1, 1]; }, /duplicate/);
  breach(c => { c.coverWays = [0]; }, /positive integer/);
  breach(c => { delete c.surfaces; }, /surfaces/);
  assert.deepEqual(roadCellProblems(null), ['not an object']);
  assert.equal(roadCellProblems({ version: 1, key: 'x', surfaces: Array.from({ length: 50 }, () => ({ k: 'x' })), kerbs: [], coverWays: [] }, 5).length, 5, 'limit');
});

test('roadsManifestProblems', () => {
  assert.deepEqual(roadsManifestProblems({ version: 1, cells: ['-2_0', '-3_-1'], fetched: '2026-10-16T00:00:00Z', attribution: ROADS_ATTRIBUTION }), []);
  assert.ok(roadsManifestProblems({ version: 1, cells: ['-2_0', '-2_0'], fetched: '2026-10-16T00:00:00Z', attribution: ROADS_ATTRIBUTION }).some(p => /duplicates/.test(p)));
  assert.ok(roadsManifestProblems({ version: 1, cells: [], fetched: 'yesterday', attribution: 'BGT' }).length === 2);
});

// The extract itself, when this checkout has it (published cells first, else the staged build).
const EXTRACT = ['public/data/extracts/amsterdam/roads-v1', 'artifacts/own-ground/staging/roads-v1'].find(d => existsSync(`${d}/cells.json`));

test('roads-v1 extract: every listed cell file is a valid cell within budget, one partition per height', { skip: EXTRACT ? false : 'no roads-v1 extract in this checkout' }, () => {
  const manifest = JSON.parse(readFileSync(`${EXTRACT}/cells.json`, 'utf8'));
  assert.deepEqual(roadsManifestProblems(manifest), []);
  const files = readdirSync(`${EXTRACT}/cells`).filter(f => f.endsWith('.json.gz')).map(f => f.slice(0, -8));
  assert.deepEqual([...manifest.cells].sort(), files.sort(), 'manifest lists exactly the cell files');
  for (const key of manifest.cells) {
    const gz = readFileSync(`${EXTRACT}/cells/${key}.json.gz`);
    assert.ok(gz.length <= ROAD_CELL_BUDGET_GZ, `${key}: ${gz.length} bytes over the ${ROAD_CELL_BUDGET_GZ} budget`);
    const cell = JSON.parse(gunzipSync(gz).toString());
    assert.deepEqual(roadCellProblems(cell), [], key);
    assert.equal(cell.key, key);
    const d = decodeRoadCell(cell);
    assert.ok(d.surfaces.length > 0, `${key}: no surfaces`);
    // Mesh follows class where the class fixes it.
    for (const s of d.surfaces) {
      if (s.c === 'foot' || s.c === 'pedestrian') assert.equal(s.k, 'paving', `${key}: ${s.c} drawn as ${s.k}`);
      if (s.c === 'cycle') assert.equal(s.k, 'cycle');
      if (s.c === 'parking') assert.notEqual(s.k, 'cycle');
    }
    // Every kerb vertex lies on some polygon boundary: runs and rings are simplified independently, so they
    // share vertices only sometimes, but both stay within the 0.15 m lever tolerance plus decimetre rounding.
    const segs = new Map<string, [number, number, number, number][]>();
    const G = 10;
    for (const s of d.surfaces) for (const r of s.rings) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) {
        const k = `${gx},${gy}`; (segs.get(k) ?? segs.set(k, []).get(k)!).push([a[0], a[1], b[0], b[1]]);
      }
    }
    const nearBoundary = (x: number, y: number, tol: number): boolean => {
      for (let gx = Math.floor((x - tol) / G); gx <= Math.floor((x + tol) / G); gx++) for (let gy = Math.floor((y - tol) / G); gy <= Math.floor((y + tol) / G); gy++) {
        for (const [ax, ay, bx, by] of segs.get(`${gx},${gy}`) ?? []) {
          const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
          if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= tol) return true;
        }
      }
      return false;
    };
    let near = 0, total = 0;
    for (const k of d.kerbs) for (const [x, y] of k) { total++; if (nearBoundary(x, y, 0.3)) near++; }
    // Kerbs at the cell edge follow polygons the neighbour cell owns, so a few vertices have no boundary here.
    assert.ok(total === 0 || near / total > 0.97, `${key}: only ${near}/${total} kerb vertices lie on a polygon boundary`);
  }
});

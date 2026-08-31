/**
 * The arithmetic that turns OSM ways into the world the game drives on.
 *
 * Two kinds of check here. The unit checks pin the properties each function
 * promises. The last one runs the new Douglas-Peucker against the recursive
 * one it replaced, over real Amsterdam geometry, because that replacement is
 * the one place this migration deliberately changed behaviour and "it should
 * be the same" is not evidence.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  METRES_PER_DEGREE_LAT,
  PIXELS_PER_METER,
  WORLD_ORIGIN,
  buildRoadSegments,
  centringOffset,
  closestPointOnSegment,
  findStartFinish,
  haversineMetres,
  latToTileY,
  lngToTileX,
  metresPerDegreeLng,
  projectToWorld,
  segmentBounds,
  simplifyPath,
  snapToRoad,
  tileXToLng,
  tileYToLat,
  type WorldPoint,
} from '../src/canalRecall/osm/roadProjection.ts';

let checks = 0;
const check = (label: string, run: () => void) => { run(); checks++; void label; };

const AMSTERDAM = { lat: 52.3676, lon: 4.9041 };

// --- The projection --------------------------------------------------------
check('north is up and east is right', () => {
  const north = projectToWorld({ lat: AMSTERDAM.lat + 0.01, lon: AMSTERDAM.lon }, AMSTERDAM);
  const east = projectToWorld({ lat: AMSTERDAM.lat, lon: AMSTERDAM.lon + 0.01 }, AMSTERDAM);
  assert.ok(north.y < 0, 'latitude increases northward, world y increases downward');
  assert.ok(east.x > 0);
  assert.deepEqual(projectToWorld(AMSTERDAM, AMSTERDAM), { x: 0, y: -0 },
    'the centre projects to the origin');
});

check('a degree of longitude shrinks with latitude', () => {
  assert.equal(metresPerDegreeLng(0), METRES_PER_DEGREE_LAT, 'at the equator they agree');
  assert.ok(metresPerDegreeLng(52.37) < METRES_PER_DEGREE_LAT * 0.62);
  assert.ok(metresPerDegreeLng(52.37) > METRES_PER_DEGREE_LAT * 0.60);
  // Amsterdam: one degree of latitude is about 111 km, one of longitude ~68 km.
  const oneDegreeNorth = projectToWorld({ lat: AMSTERDAM.lat + 1, lon: AMSTERDAM.lon }, AMSTERDAM);
  const oneDegreeEast = projectToWorld({ lat: AMSTERDAM.lat, lon: AMSTERDAM.lon + 1 }, AMSTERDAM);
  assert.ok(Math.abs(oneDegreeNorth.y) > oneDegreeEast.x * 1.6);
});

// --- Closest point on a segment --------------------------------------------
check('a point projects onto a segment, and clamps to its ends', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  assert.deepEqual(closestPointOnSegment({ x: 5, y: 3 }, a, b), { x: 5, y: 0, distance: 3 });
  // Past the end, the nearest point is the end itself, not the infinite line.
  const past = closestPointOnSegment({ x: 20, y: 0 }, a, b);
  assert.deepEqual({ x: past.x, y: past.y }, { x: 10, y: 0 });
  assert.equal(past.distance, 10);
  // A zero-length segment is a point, not a division by zero.
  const degenerate = closestPointOnSegment({ x: 3, y: 4 }, a, a);
  assert.equal(degenerate.distance, 5);
});

// --- Douglas-Peucker -------------------------------------------------------
check('a straight run collapses; a corner survives', () => {
  const straight = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
  assert.deepEqual(simplifyPath(straight, 1), [{ x: 0, y: 0 }, { x: 10, y: 0 }]);

  const corner = [{ x: 0, y: 0 }, { x: 5, y: 40 }, { x: 10, y: 0 }];
  assert.equal(simplifyPath(corner, 1).length, 3, 'a 40-unit deviation is not noise');

  assert.deepEqual(simplifyPath([{ x: 1, y: 2 }], 1), [{ x: 1, y: 2 }], 'one point survives');
  assert.deepEqual(simplifyPath([], 1), []);
});

check('simplification keeps the endpoints and the order', () => {
  const path: WorldPoint[] = Array.from({ length: 200 }, (_, i) => ({
    x: i, y: Math.sin(i / 9) * 30,
  }));
  const simplified = simplifyPath(path, 2);
  assert.deepEqual(simplified[0], path[0]);
  assert.deepEqual(simplified.at(-1), path.at(-1));
  assert.ok(simplified.length < path.length, 'it actually simplifies');
  for (let i = 1; i < simplified.length; i++) {
    assert.ok(simplified[i].x > simplified[i - 1].x, 'points stay in path order');
  }
});

// --- Recentring ------------------------------------------------------------
check('the network is translated onto the world origin', () => {
  const segments = [{ points: [{ x: 100, y: 200 }, { x: 300, y: 600 }] }];
  assert.deepEqual(segmentBounds(segments), { minX: 100, minY: 200, maxX: 300, maxY: 600 });
  const offset = centringOffset(segments);
  const centreX = (100 + 300) / 2 + offset.x;
  const centreY = (200 + 600) / 2 + offset.y;
  assert.deepEqual({ x: centreX, y: centreY }, WORLD_ORIGIN);
  assert.deepEqual(centringOffset([]), { x: 0, y: 0 }, 'an empty network needs no offset');
  assert.equal(segmentBounds([]), null);
});

// --- The whole pipeline ----------------------------------------------------
const way = (name: string, nodes: Array<[number, number]>, highway = 'residential') => ({
  nodes: nodes.map(([lat, lon]) => ({ lat, lon })),
  highway,
  tags: { name },
});

check('ways become recentred, widened, named segments', () => {
  const { segments, offset } = buildRoadSegments(
    [
      way('Nes', [[52.3700, 4.8950], [52.3705, 4.8955], [52.3710, 4.8960]]),
      way('Ringweg', [[52.3600, 4.9100], [52.3650, 4.9150]], 'motorway'),
      way('too short', [[52.3700, 4.8950]]),
    ],
    AMSTERDAM,
    { simplificationToleranceDegrees: 0.00003, roadWidths: { motorway: 90 }, defaultRoadWidth: 32 },
  );
  assert.equal(segments.length, 2, 'a one-node way cannot be a carriageway');
  assert.deepEqual(segments.map(s => s.name), ['Nes', 'Ringweg']);
  assert.equal(segments[0].width, 32, 'an unlisted highway type gets the default');
  assert.equal(segments[1].width, 90, 'a listed one gets its own');
  assert.equal(segments[0].oneway, false);

  // The offset it reports is the one it applied — this is what lets a POI
  // projected later land on the road it belongs to.
  const bounds = segmentBounds(segments)!;
  assert.ok(Math.abs((bounds.minX + bounds.maxX) / 2 - WORLD_ORIGIN.x) < 1e-6);
  assert.ok(Math.abs((bounds.minY + bounds.maxY) / 2 - WORLD_ORIGIN.y) < 1e-6);
  assert.ok(Number.isFinite(offset.x) && Number.isFinite(offset.y));
});

check('oneway is only the OSM value that means it', () => {
  const build = (oneway: string) => buildRoadSegments(
    [{ nodes: [{ lat: 52.37, lon: 4.89 }, { lat: 52.371, lon: 4.891 }], highway: 'residential', tags: { oneway } }],
    AMSTERDAM, { simplificationToleranceDegrees: 0.00003, roadWidths: {}, defaultRoadWidth: 32 },
  ).segments[0].oneway;
  assert.equal(build('yes'), true);
  // `-1` means one-way against the drawing direction. Treating it as two-way
  // is the existing behaviour and is wrong, but it is wrong in road-network's
  // graph too; changing it here alone would only disagree with the router.
  assert.equal(build('-1'), false);
  assert.equal(build('no'), false);
});

// --- Snapping --------------------------------------------------------------
check('a point snaps onto the nearest carriageway', () => {
  const { segments, offset } = buildRoadSegments(
    [way('Nes', [[52.3700, 4.8950], [52.3700, 4.9050]])],
    AMSTERDAM,
    { simplificationToleranceDegrees: 0.00003, roadWidths: {}, defaultRoadWidth: 32 },
  );
  // A point a little north of the middle of that east-west way.
  const on = snapToRoad({ lat: 52.3702, lon: 4.9000 }, AMSTERDAM, offset, segments, 800);
  assert.ok(on, 'a point beside the road snaps to it');
  assert.ok(on!.snapDistance > 0 && on!.snapDistance < 800);

  // Far away, and a limit that rejects it.
  assert.equal(snapToRoad({ lat: 52.4200, lon: 4.9000 }, AMSTERDAM, offset, segments, 800), null);
});

check('a false limit means no limit, not a limit of zero', () => {
  const { segments, offset } = buildRoadSegments(
    [way('Nes', [[52.3700, 4.8950], [52.3700, 4.9050]])],
    AMSTERDAM,
    { simplificationToleranceDegrees: 0.00003, roadWidths: {}, defaultRoadWidth: 32 },
  );
  const far = { lat: 52.4200, lon: 4.9000 };
  assert.equal(snapToRoad(far, AMSTERDAM, offset, segments, 800), null);
  const unlimited = snapToRoad(far, AMSTERDAM, offset, segments, false);
  assert.ok(unlimited, 'false must not coerce to 0 and reject everything');
  assert.ok(unlimited!.snapDistance > 800);
  assert.equal(snapToRoad({ lat: 52.37, lon: 4.9 }, AMSTERDAM, offset, [], false), null,
    'nothing to snap to is null, not a crash');
});

// --- Start and finish ------------------------------------------------------
check('a route starts near the city centre, not at an extreme', () => {
  const near: WorldPoint = { x: WORLD_ORIGIN.x + 10, y: WORLD_ORIGIN.y + 10 };
  const far: WorldPoint = { x: WORLD_ORIGIN.x + 9000, y: WORLD_ORIGIN.y + 9000 };
  const chosen = findStartFinish([
    { points: [far, { x: 5000, y: 5000 }] },
    { points: [near, { x: WORLD_ORIGIN.x + 400, y: WORLD_ORIGIN.y }] },
  ])!;
  assert.deepEqual(chosen.start, near, 'start is the endpoint nearest the world origin');
  assert.deepEqual(chosen.finish, far, 'finish is the far orientation aid');
  assert.ok(Math.abs(chosen.distance - Math.hypot(far.x - near.x, far.y - near.y)) < 1e-9);
  assert.equal(findStartFinish([]), null);
  assert.equal(findStartFinish([{ points: [] }]), null, 'an empty way contributes no endpoint');
});

// --- Haversine and tiles ---------------------------------------------------
check('haversine measures real ground distance', () => {
  // Amsterdam Centraal to the Rijksmuseum is about 2.1 km.
  const metres = haversineMetres({ lat: 52.3791, lon: 4.9003 }, { lat: 52.3600, lon: 4.8852 });
  assert.ok(metres > 2000 && metres < 2500, `expected ~2.2 km, got ${Math.round(metres)} m`);
  assert.equal(haversineMetres(AMSTERDAM, AMSTERDAM), 0);
});

check('slippy tile numbering round-trips', () => {
  for (const zoom of [10, 14, 16]) {
    const x = lngToTileX(AMSTERDAM.lon, zoom);
    const y = latToTileY(AMSTERDAM.lat, zoom);
    assert.ok(Math.abs(tileXToLng(x, zoom) - AMSTERDAM.lon) < 1e-9, `lng at z${zoom}`);
    assert.ok(Math.abs(tileYToLat(y, zoom) - AMSTERDAM.lat) < 1e-9, `lat at z${zoom}`);
  }
  // Amsterdam is in the northern hemisphere and east of Greenwich.
  assert.ok(lngToTileX(AMSTERDAM.lon, 14) > 2 ** 13);
  assert.ok(latToTileY(AMSTERDAM.lat, 14) < 2 ** 13);
});

// --- The one deliberate behaviour change, measured on real geometry --------
/** The recursive Douglas-Peucker this replaced, depth cap and all. */
function legacySimplify(points: WorldPoint[], tolerance: number, depth = 0): WorldPoint[] {
  if (points.length <= 2 || depth > 50) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = closestPointOnSegment(points[i], first, last).distance;
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tolerance) {
    return legacySimplify(points.slice(0, maxIdx + 1), tolerance, depth + 1).slice(0, -1)
      .concat(legacySimplify(points.slice(maxIdx), tolerance, depth + 1));
  }
  return [first, last];
}

/** The extract stores linework as `path` (one line) or `paths` (several), each
 *  a list of `[lat, lng]` — note the order, which is the opposite of GeoJSON. */
interface ExtractFeature { path?: Array<[number, number]>; paths?: Array<Array<[number, number]>> }

const paths: WorldPoint[][] = [];
for (const file of ['all.json', 'streets.json', 'water.json']) {
  const rows = JSON.parse(
    await readFile(`public/data/extracts/amsterdam/${file}`, 'utf8'),
  ) as ExtractFeature[];
  for (const feature of rows) {
    for (const line of [...(feature.path ? [feature.path] : []), ...(feature.paths ?? [])]) {
      if (line.length > 2) {
        paths.push(line.map(([lat, lon]) => projectToWorld({ lat, lon }, AMSTERDAM)));
      }
    }
  }
}
assert.ok(paths.length > 100, `expected real geometry to compare, found ${paths.length} paths`);

const tolerance = 0.00003 * METRES_PER_DEGREE_LAT * PIXELS_PER_METER;
let differing = 0;
let longest = 0;
for (const path of paths) {
  longest = Math.max(longest, path.length);
  const mine = simplifyPath(path, tolerance);
  const legacy = legacySimplify(path, tolerance);
  if (mine.length !== legacy.length
    || mine.some((point, i) => point.x !== legacy[i].x || point.y !== legacy[i].y)) {
    differing++;
  }
}
checks++;
assert.equal(differing, 0,
  `the iterative simplifier must agree with the recursive one it replaced; `
  + `${differing} of ${paths.length} real Amsterdam paths differ`);

process.stdout.write(
  `Road projection checks passed (${checks} checks; the iterative simplifier agrees with the `
  + `recursive one on all ${paths.length} real Amsterdam paths, longest ${longest} points).\n`);

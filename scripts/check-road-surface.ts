/**
 * The road-surface and same-name-run decisions, checked on synthetic geometry
 * for the rules and on the real Amsterdam extract for the cases that motivated
 * them.
 *
 * Run: npm run test:road-surface
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ALIGNMENT_DISTANCE_SLACK,
  buildRoadSpatialIndex,
  classifySurface,
  connectedNamedSegments,
  contactsAt,
  filletedExcess,
  headingDifference,
  pickNearestRoadContactForName,
  pickGuardContact,
  pickRoadContact,
  pickRoadContactPreferName,
  roadNameAt,
  roadsNear,
  ROAD_GRID_CELL,
  type RoadSegmentLike,
} from '../src/canalRecall/routing/roadSurface.ts';

let checks = 0;
const check = (label: string, run: () => void) => { run(); checks++; void label; };

const horizontal = (y: number, fromX: number, toX: number, width = 32, name?: string): RoadSegmentLike =>
  ({ points: [{ x: fromX, y }, { x: toX, y }], width, name });
const vertical = (x: number, fromY: number, toY: number, width = 32, name?: string): RoadSegmentLike =>
  ({ points: [{ x, y: fromY }, { x, y: toY }], width, name });

// --- Surface bands ----------------------------------------------------------
check('the bands run asphalt, curb, then off-road', () => {
  assert.equal(classifySurface(0, 32), 'asphalt', 'the centreline is road');
  assert.equal(classifySurface(25, 32), 'asphalt', 'just inside the edge is road');
  assert.equal(classifySurface(26, 32), 'curb', 'the last few px inside the edge are curb');
  assert.equal(classifySurface(33, 32), 'curb', 'and it extends slightly past the edge');
  assert.equal(classifySurface(34, 32), 'grass');
  assert.equal(classifySurface(500, 32), 'grass');
});

check('nothing nearby is off-road, not a road of unknown width', () => {
  assert.equal(classifySurface(Infinity, 32), 'grass');
});

check('a narrow way has a narrower asphalt band', () => {
  // The margins are absolute, not proportional, so a narrow cycle path is
  // mostly curb — which is the intent: there is less of it to be on.
  assert.equal(classifySurface(5, 12), 'asphalt');
  assert.equal(classifySurface(10, 12), 'curb');
  assert.equal(classifySurface(15, 12), 'grass');
  assert.equal(classifySurface(10, 32), 'asphalt', 'the same distance on a wide road is road');
});

// --- The spatial index finds what a query needs ------------------------------
check('a road is findable from every cell it passes through', () => {
  const road = horizontal(50, 0, 1000);
  const index = buildRoadSpatialIndex([road]);
  for (let x = 20; x < 1000; x += ROAD_GRID_CELL) {
    assert.ok(roadsNear(index, x, 50).length > 0, `nothing found at x=${x}`);
  }
});

check('a wide road is findable from its own edge without a wider query ring', () => {
  // The span is padded by its width when indexed, which is what lets a query
  // from the cell the player is standing in still see the road they are on.
  const index = buildRoadSpatialIndex([horizontal(0, 0, 400, 90)]);
  assert.ok(roadsNear(index, 200, 85).length > 0, 'the edge of a wide road');
});

check('an empty network answers rather than throwing', () => {
  const index = buildRoadSpatialIndex([]);
  assert.deepEqual(roadsNear(index, 0, 0), []);
  assert.equal(pickRoadContact(contactsAt(roadsNear(index, 0, 0), 0, 0)), null);
  assert.equal(roadNameAt([], null), '');
});

check('a one-point way contributes no spans', () => {
  const index = buildRoadSpatialIndex([{ points: [{ x: 0, y: 0 }], width: 32 }]);
  assert.equal(index.cells.size, 0);
});

// --- Which road am I on? ----------------------------------------------------
check('with no heading, the nearest road wins', () => {
  const segments = [horizontal(0, -500, 500, 32, 'Through Street'), vertical(0, -500, 500, 32, 'Side Street')];
  const index = buildRoadSpatialIndex(segments);
  // Directly north of the crossing: the vertical way is nearer.
  const contacts = contactsAt(roadsNear(index, 0, 40), 0, 40);
  const best = pickRoadContact(contacts);
  assert.equal(roadNameAt(segments, best), 'Side Street');
});

check('driving straight through a junction keeps the street being driven', () => {
  // This is the case the heading rule exists for. Sitting a few px off the
  // through street's centreline, the cross street's centreline is nearer — so
  // the nearest-road answer names the street the player is only crossing.
  const segments = [horizontal(0, -500, 500, 32, 'Through Street'), vertical(0, -500, 500, 32, 'Side Street')];
  const index = buildRoadSpatialIndex(segments);
  const contacts = contactsAt(roadsNear(index, 4, 6), 4, 6);

  assert.equal(roadNameAt(segments, pickRoadContact(contacts)), 'Side Street',
    'without a heading the nearest centreline is the cross street');
  assert.equal(roadNameAt(segments, pickRoadContact(contacts, 0)), 'Through Street',
    'driving east, the street being driven wins');
  assert.equal(roadNameAt(segments, pickRoadContact(contacts, Math.PI / 2)), 'Side Street',
    'and driving north it is the other one');
});

check('a preferred corridor name wins over a nearer cross line', () => {
  const segments = [
    horizontal(0, -500, 500, 38, 'Tram 2'),
    vertical(0, -500, 500, 38, 'Metro 52'),
  ];
  const index = buildRoadSpatialIndex(segments);
  const contacts = contactsAt(roadsNear(index, 4, 6), 4, 6);
  assert.equal(roadNameAt(segments, pickRoadContact(contacts)), 'Metro 52',
    'nearest without prefer is the cross metro');
  assert.equal(
    roadNameAt(segments, pickRoadContactPreferName(
      contacts,
      (segIdx) => segments[segIdx]?.name || '',
      'Tram 2',
      0,
    )),
    'Tram 2',
    'transit leg lock keeps the player on Tram 2',
  );
});

check('a settled name highlights its closest parallel centreline', () => {
  const segments = [
    horizontal(0, -500, 500, 32, 'Marnixstraat'),
    {
      points: [{ x: -500, y: 8 }, { x: 500, y: 18 }],
      width: 32,
      name: 'Marnixstraat',
    },
  ];
  const index = buildRoadSpatialIndex(segments);
  const contacts = contactsAt(roadsNear(index, 0, 7), 0, 7);
  const segmentNameAt = (segIdx: number) => segments[segIdx]?.name || '';

  assert.equal(pickRoadContact(contacts, 0)?.segIdx, 0,
    'heading alone prefers the straighter but more distant parallel span');
  assert.equal(pickNearestRoadContactForName(
    contacts, segmentNameAt, 'Marnixstraat',
  )?.segIdx, 1, 'the answer overlay starts on the same-name span under the rider');
  assert.equal(pickNearestRoadContactForName(
    contacts, segmentNameAt, 'Other street',
  ), null, 'a missing name cannot seed an unrelated highlight');
});

check('a way digitised the opposite way round is still the same alignment', () => {
  const eastward = horizontal(0, -500, 500, 32, 'Through Street');
  const westward: RoadSegmentLike = { points: [{ x: 500, y: 0 }, { x: -500, y: 0 }], width: 32, name: 'Through Street' };
  const index = buildRoadSpatialIndex([vertical(0, -500, 500, 32, 'Side Street'), westward]);
  const contacts = contactsAt(roadsNear(index, 4, 6), 4, 6);
  assert.equal(roadNameAt([vertical(0, -500, 500, 32, 'Side Street'), westward], pickRoadContact(contacts, 0)),
    'Through Street', 'heading east still matches a way drawn westward');
  void eastward;
  assert.ok(headingDifference(Math.PI, 0) < 1e-9, 'opposite headings are the same alignment');
  assert.ok(Math.abs(headingDifference(Math.PI / 2, 0) - Math.PI / 2) < 1e-9);
});

check('a road too far to be plausible is not chosen just for being aligned', () => {
  // A perfectly aligned road far away must not beat the one under the player.
  const segments = [
    horizontal(0, -500, 500, 32, 'Under Me'),
    horizontal(ALIGNMENT_DISTANCE_SLACK + 400, -500, 500, 32, 'Aligned But Far'),
  ];
  const index = buildRoadSpatialIndex(segments);
  const contacts = contactsAt(roadsNear(index, 0, 0), 0, 0);
  assert.equal(roadNameAt(segments, pickRoadContact(contacts, 0)), 'Under Me');
});

check('a name is not claimed from far off the road', () => {
  const segments = [horizontal(0, -500, 500, 32, 'Somewhere')];
  const index = buildRoadSpatialIndex(segments);
  const near = pickRoadContact(contactsAt(roadsNear(index, 0, 40), 0, 40));
  const far = pickRoadContact(contactsAt(roadsNear(index, 0, 90), 0, 90));
  assert.equal(roadNameAt(segments, near), 'Somewhere');
  assert.equal(roadNameAt(segments, far), '', 'past the width plus slack, it is nobody\'s street');
});

check('an unnamed way under the player yields no name, not undefined', () => {
  const segments = [horizontal(0, -500, 500, 32)];
  const index = buildRoadSpatialIndex(segments);
  assert.equal(roadNameAt(segments, pickRoadContact(contactsAt(roadsNear(index, 0, 0), 0, 0))), '');
});

// --- One named feature out of several OSM ways ------------------------------
check('ways laid end to end become one run', () => {
  const segments = [
    horizontal(0, 0, 100, 20, 'Grimburgwal'),
    horizontal(0, 100, 200, 20, 'Grimburgwal'),
    horizontal(0, 200, 300, 20, 'Grimburgwal'),
  ];
  assert.equal(connectedNamedSegments(segments, 1).length, 3, 'reached from the middle');
  assert.equal(connectedNamedSegments(segments, 0).length, 3, 'and from an end');
});

check('the same name far away is a different feature, not one long chord', () => {
  const segments = [
    horizontal(0, 0, 100, 20, 'Prinsengracht'),
    horizontal(0, 100, 200, 20, 'Prinsengracht'),
    horizontal(50_000, 0, 100, 20, 'Prinsengracht'),
  ];
  const run = connectedNamedSegments(segments, 0);
  assert.equal(run.length, 2, 'the far stretch stays separate');
  assert.ok(!run.includes(segments[2]));
});

check('a different name is never joined, however close', () => {
  const segments = [
    horizontal(0, 0, 100, 20, 'Grimburgwal'),
    horizontal(0, 100, 200, 20, 'Oudezijds Achterburgwal'),
  ];
  assert.equal(connectedNamedSegments(segments, 0).length, 1);
});

check('an unnamed seed has no run', () => {
  assert.deepEqual(connectedNamedSegments([horizontal(0, 0, 100, 20)], 0), []);
  assert.deepEqual(connectedNamedSegments([], 0), []);
  assert.deepEqual(connectedNamedSegments([horizontal(0, 0, 100, 20, 'X')], 5), []);
});

check('endpoints within the merge slack still join', () => {
  // Two ways storing the same junction node with different rounding.
  const segments = [
    horizontal(0, 0, 100, 20, 'Singel'),
    { points: [{ x: 100.9, y: 0.9 }, { x: 200, y: 0 }], width: 20, name: 'Singel' },
  ];
  assert.equal(connectedNamedSegments(segments, 0).length, 2);
});

check('a way meeting another mid-span is not joined by this rule', () => {
  // This joins endpoints to endpoints, not endpoints to spans. A branch whose
  // end lands on the *middle* of a same-name way is a T-junction, and stitching
  // those is `roadGraph.ts`'s job for routing — here it would let a highlight
  // grow sideways down a tributary the player never asked about.
  const branchesMidSpan = [
    horizontal(0, 0, 200, 20, 'Singel'),
    vertical(100, 0, 200, 20, 'Singel'), // starts at (100,0), the main way's midpoint
  ];
  assert.equal(connectedNamedSegments(branchesMidSpan, 0).length, 1);

  // Meeting at an endpoint is a different matter, and does join.
  const meetsAtEnd = [
    horizontal(0, 0, 200, 20, 'Singel'),
    vertical(200, 0, 200, 20, 'Singel'), // starts at (200,0), the main way's end
  ];
  assert.equal(connectedNamedSegments(meetsAtEnd, 0).length, 2);
});

// --- The real extract -------------------------------------------------------
// Grimburgwal is the case that motivated the canal-stitching fix: one visible
// waterway stored as several OSM ways, which used to be drawn with seams.
{
  const directory = path.resolve('public/data/extracts/amsterdam');
  const water = JSON.parse(await readFile(path.join(directory, 'water.json'), 'utf8')) as
    { name?: string; path?: [number, number][]; paths?: [number, number][][] }[];

  const centreLat = 52.372851;
  const centreLng = 4.8936;
  const metresPerDegreeLat = 111320;
  const metresPerDegreeLng = 111320 * Math.cos((centreLat * Math.PI) / 180);
  const project = ([lat, lon]: [number, number]) => ({
    x: (lon - centreLng) * metresPerDegreeLng * 3,
    y: -(lat - centreLat) * metresPerDegreeLat * 3,
  });

  const segments: RoadSegmentLike[] = [];
  for (const feature of water) {
    const paths = feature.paths || (feature.path ? [feature.path] : []);
    for (const line of paths) {
      if (!line || line.length < 2) continue;
      segments.push({ name: feature.name || '', width: 20, points: line.map(project) });
    }
  }

  check('the extract still holds a multi-way Grimburgwal', () => {
    const pieces = segments.filter((segment) => segment.name === 'Grimburgwal');
    assert.ok(pieces.length >= 2,
      `expected Grimburgwal to still be split across ways, found ${pieces.length}`);
    const seed = segments.indexOf(pieces[0]);
    const run = connectedNamedSegments(segments, seed);
    assert.equal(run.length, pieces.length,
      `the run found ${run.length} of ${pieces.length} Grimburgwal ways`);
  });

  check('a long canal mapped in many pieces comes back as one run', () => {
    const counts = new Map<string, number>();
    for (const segment of segments) {
      if (segment.name) counts.set(segment.name, (counts.get(segment.name) || 0) + 1);
    }
    const [name, pieces] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const seed = segments.findIndex((segment) => segment.name === name);
    const run = connectedNamedSegments(segments, seed);
    assert.ok(run.length > 1, `${name} is ${pieces} ways but the run found ${run.length}`);
    assert.ok(run.length <= pieces, 'a run never returns more ways than carry the name');
    process.stdout.write(`  most-split waterway: ${name}, ${pieces} ways, longest run ${run.length}\n`);
  });

  check('every run is a subset of the ways carrying that name', () => {
    let checked = 0;
    for (let index = 0; index < segments.length && checked < 250; index++) {
      if (!segments[index].name) continue;
      checked++;
      const run = connectedNamedSegments(segments, index);
      assert.ok(run.includes(segments[index]), 'the seed is always in its own run');
      for (const member of run) {
        assert.equal(member.name, segments[index].name, 'a run never mixes names');
      }
    }
    assert.ok(checked > 200, `only checked ${checked} named ways`);
  });

  check('the index answers a query anywhere along a real canal', () => {
    const index = buildRoadSpatialIndex(segments);
    const grimburgwal = segments.find((segment) => segment.name === 'Grimburgwal')!;
    for (const point of grimburgwal.points) {
      const contacts = contactsAt(roadsNear(index, point.x, point.y), point.x, point.y);
      const best = pickRoadContact(contacts);
      assert.ok(best, 'a point on a canal finds a road');
      assert.ok(best!.dist < 1, `nearest span was ${best!.dist.toFixed(2)} px from a vertex on it`);
    }
  });

  process.stdout.write(`  real extract: ${segments.length} waterway ways\n`);
}

check('the road guard counts any containing corridor, not only the heading pick', () => {
  // Bullebakssluis shape: riding south down Marnixstraat (x = 0) and turning
  // east into Westerkade, which starts 27 px east of it. Just off
  // Marnixstraat's asphalt and on Westerkade's, heading still picks
  // Marnixstraat (within the alignment slack of the nearer Westerkade).
  const base = { angle: Math.PI / 2, width: 27, segIdx: 0, ptIdx: 0, nx: 1, ny: 0 };
  const marnix = { ...base, x: 0, y: 0, dist: 32 };
  const westerkade = { ...base, x: 30, y: 0, dist: 24, angle: 0, segIdx: 1, nx: 0, ny: 1 };
  const heading = Math.PI / 2;
  assert.equal(pickRoadContact([marnix, westerkade], heading), marnix, 'naming still follows the heading');
  assert.equal(pickGuardContact([marnix, westerkade], heading), westerkade, 'a cross street that contains the bike wins');
  const shoulder = { ...marnix, dist: 29 };
  assert.equal(pickGuardContact([shoulder, westerkade], heading), westerkade, 'including on the heading road\'s soft shoulder');
  const busway = { ...marnix, width: 54, dist: 29, segIdx: 2 };
  assert.equal(pickGuardContact([shoulder, busway], heading), shoulder, 'a wider parallel duplicate does not widen the corridor');
  const inside = { ...marnix, dist: 10 };
  assert.equal(pickGuardContact([inside, westerkade], heading), inside, 'the heading pick wins while the bike is on its asphalt');
});

check('the inside of a corner is filleted so a rider can cut it (Oosterdokskade, LOT 61)', () => {
  // An L: one road arrives from the west and the other leaves south, both 18 wide.
  const spans = [
    { a: { x: -200, y: 0 }, b: { x: 0, y: 0 }, width: 18, segIdx: 0, ptIdx: 0 },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 200 }, width: 18, segIdx: 1, ptIdx: 0 },
  ];
  const at = (x: number, y: number) => filletedExcess(contactsAt(spans, x, y), x, y);
  assert.ok(at(-24, 24) < 0, `a diagonal cut 6 past both edges is asphalt (${at(-24, 24).toFixed(1)})`);
  assert.ok(at(-40, 40) > 10, 'cutting straight across the block is still off the road');
  assert.ok(Math.abs(at(20, -20) - (Math.hypot(20, 20) - 18)) < 1e-9, 'the outer corner is not filleted');
  assert.equal(at(-100, 10), -8, 'on a road the plain edge distance stands');
  const parallel = [
    { a: { x: -200, y: 0 }, b: { x: 200, y: 0 }, width: 18, segIdx: 0, ptIdx: 0 },
    { a: { x: -200, y: 60 }, b: { x: 200, y: 60 }, width: 18, segIdx: 1, ptIdx: 0 },
  ];
  assert.equal(filletedExcess(contactsAt(parallel, 0, 30), 0, 30), 12, 'two parallel roads leave the gap between them');
  // The guard reports the filleted distance, so the cut is ridden, not rolled back.
  const contacts = contactsAt(spans, -24, 24);
  const picked = pickGuardContact(contacts, 0, { x: -24, y: 24 })!;
  assert.ok(picked.dist <= picked.width, 'the guard sees asphalt in the fillet');
  assert.ok(pickGuardContact(contacts, 0)!.dist > pickGuardContact(contacts, 0)!.width, 'without the point it is the old edge test');
});

check('off every corridor, the guard judges the cross street it is least outside of (Solitudobrug → Weesperzijde)', () => {
  // Named regression (driving harness, 2026-09-29, 52.34088, 4.92546). The
  // Solitudobrug ends on Weesperzijde, one straight 640 m span with no vertex
  // there. Turning right off the bridge, the bike drifted 1.4 px past
  // Weesperzijde's edge while still pointing roughly along the bridge; the
  // guard kept judging it against the bridge's end, and the shoulder ease
  // turned it back along the bridge against full lock, for good.
  const spans = [
    { a: { x: -83, y: 100 }, b: { x: -14, y: 9 }, width: 9, segIdx: 0, ptIdx: 0 },
    { a: { x: -918, y: -663 }, b: { x: 622, y: 482 }, width: 9, segIdx: 1, ptIdx: 0 },
  ];
  const point = { x: -2, y: 5 };
  const heading = -0.42;
  const contacts = contactsAt(spans, point.x, point.y);
  assert.equal(pickRoadContact(contacts, heading)!.segIdx, 0, 'naming still follows the heading onto the bridge');
  const guard = pickGuardContact(contacts, heading, point)!;
  assert.equal(guard.segIdx, 1, 'the guard judges Weesperzijde, whose shoulder the bike is on');
  assert.ok(Math.abs(guard.angle - 0.64) < 0.01 || Math.abs(guard.angle + 2.5) < 0.01, 'so the shoulder ease turns it along Weesperzijde');
});

process.stdout.write(`Road surface and named-run checks passed (${checks} checks).\n`);

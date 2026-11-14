// The scratch road queries (roadSurface.ts RoadQueryScratch, lane LS 2026-11-13) give the same answers as the
// allocating ones they replace on the per-frame paths, at every point and heading of a real Amsterdam network, and
// after warm-up a query writes into the same array and the same contact objects (no array or object per query).
// The reference pickers below are the bc4ad8a versions, frozen: the road guard's physics must not move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoadSpatialIndex, contactsAt, copyContact, filletedExcess, headingDifference, nearbyContacts, pickGuardContact,
  pickRoadContact, roadsNear, roadsNearInto, contactsInto, RoadQueryScratch, ALIGNMENT_DISTANCE_SLACK, ALIGNMENT_WIDTH_SLACK,
  CORNER_FILLET_RADIUS, GUARD_CROSS_ANGLE, type RoadContact, type RoadPoint,
} from './roadSurface';
import { buildRoadSegments, type OsmWay } from '../osm/roadProjection';
import { loadRoutingFeatures } from '../../../scripts/lib/routingFeatures';

// ---- bc4ad8a reference (frozen) ----
function refPickRoadContact(contacts: readonly RoadContact[], preferredAngle: number | null = null): RoadContact | null {
  let nearest: RoadContact | null = null;
  for (const contact of contacts) if (!nearest || contact.dist < nearest.dist) nearest = contact;
  if (preferredAngle == null || !nearest) return nearest;
  const plausible = contacts.filter(c => c.dist <= nearest!.dist + ALIGNMENT_DISTANCE_SLACK && c.dist <= c.width + ALIGNMENT_WIDTH_SLACK);
  let aligned: RoadContact | null = null;
  for (const contact of plausible) {
    if (!aligned) { aligned = contact; continue; }
    const delta = headingDifference(contact.angle, preferredAngle) - headingDifference(aligned.angle, preferredAngle);
    if (delta < 0 || (delta === 0 && contact.dist < aligned.dist)) aligned = contact;
  }
  return aligned ?? nearest;
}
function refPerpendicular(c: RoadContact, x: number, y: number): boolean {
  return Math.abs((x - c.x) * c.ny - (y - c.y) * c.nx) <= 0.2 * c.dist + 0.5;
}
function refFilletedEdge(contacts: readonly RoadContact[], x: number, y: number, radius: number) {
  let best = Infinity; let outward: { x: number; y: number } | null = null;
  for (const c of contacts) best = Math.min(best, c.dist - c.width);
  if (best <= 0) return { excess: best, outward };
  const inCorner = contacts.filter(c => { const e = c.dist - c.width; return e > 0 && e <= radius && refPerpendicular(c, x, y); });
  for (let i = 0; i < inCorner.length; i++) for (let j = i + 1; j < inCorner.length; j++) {
    const a = inCorner[i], b = inCorner[j];
    if (headingDifference(a.angle, b.angle) <= GUARD_CROSS_ANGLE) continue;
    const ea = a.dist - a.width, eb = b.dist - b.width;
    const excess = radius - Math.hypot(radius - ea, radius - eb);
    if (excess >= best) continue;
    best = excess;
    const ox = (radius - ea) * (x - a.x) / (a.dist || 1) + (radius - eb) * (x - b.x) / (b.dist || 1);
    const oy = (radius - ea) * (y - a.y) / (a.dist || 1) + (radius - eb) * (y - b.y) / (b.dist || 1);
    const length = Math.hypot(ox, oy) || 1;
    outward = { x: ox / length, y: oy / length };
  }
  return { excess: best, outward };
}
function refPickGuardContact(contacts: readonly RoadContact[], preferredAngle: number | null = null, point: RoadPoint | null = null): RoadContact | null {
  const containing = contacts.filter(c => c.dist <= c.width);
  if (containing.length) return refPickRoadContact(containing, preferredAngle);
  if (!contacts.length) return null;
  const aligned = refPickRoadContact(contacts, preferredAngle)!;
  let chosen = aligned;
  for (const c of contacts) if (c.dist - c.width < chosen.dist - chosen.width - 0.25) chosen = c;
  if (point) {
    const { excess, outward } = refFilletedEdge(contacts, point.x, point.y, CORNER_FILLET_RADIUS);
    if (excess < chosen.dist - chosen.width) {
      const dist = chosen.width + Math.max(0, excess);
      if (!outward || excess <= 0) return { ...chosen, dist };
      return { ...chosen, dist, x: point.x - outward.x * dist, y: point.y - outward.y * dist };
    }
  }
  return chosen;
}

// ---- a real network: the canal belt round the Westerkerk and the Bullebakssluis junction ----
type Street = { name?: string; highway?: string; path?: [number, number][]; paths?: [number, number][][] };
const WIDTHS: Record<string, number> = { primary: 30, secondary: 26, tertiary: 21, residential: 18, unclassified: 17, living_street: 16, service: 13, busway: 18, cycleway: 9, pedestrian: 14, footway: 7, path: 8 };
async function network(centre: [number, number], radiusDeg = 0.008) {
  const streets = await loadRoutingFeatures<Street>();
  const ways: OsmWay[] = [];
  streets.forEach((st, si) => (st.paths ?? (st.path ? [st.path] : [])).forEach((p, pi) => {
    if (p.length < 2 || !p.some(q => Math.abs(q[0] - centre[0]) < radiusDeg && Math.abs(q[1] - centre[1]) < radiusDeg * 1.6)) return;
    const highway = st.highway || 'residential';
    ways.push({ id: `${si}:${pi}`, nodes: p.map(([lat, lon]) => ({ lat, lon })), tags: { name: st.name, highway }, highway } as unknown as OsmWay);
  }));
  const built = buildRoadSegments(ways, { lat: centre[0], lon: centre[1] }, { simplificationToleranceDegrees: 0.00003, roadWidths: WIDTHS, defaultRoadWidth: 32 });
  return { segments: built.segments, index: buildRoadSpatialIndex(built.segments, 100) };
}
// Deterministic points: near the network (a segment vertex plus up to ±60 px), and some anywhere in its box.
function* probes(segments: { points: RoadPoint[] }[], n: number) {
  let s = 0x5eed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const pts = segments.flatMap(g => g.points);
  for (let i = 0; i < n; i++) {
    const p = pts[Math.floor(rnd() * pts.length)];
    const angle = rnd() < 0.2 ? null : (rnd() * 2 - 1) * Math.PI;
    yield { x: p.x + (rnd() * 2 - 1) * 60, y: p.y + (rnd() * 2 - 1) * 60, angle };
  }
}

for (const [label, centre] of [['Westerkerk', [52.3745, 4.8840]], ['Bullebakssluis', [52.3830, 4.8790]]] as const) {
  test(`scratch road queries equal the allocating ones at 20,000 points round the ${label}`, async () => {
    const { segments, index } = await network(centre as [number, number]);
    assert.ok(segments.length > 50, `network built (${segments.length} segments)`);
    const scratch = new RoadQueryScratch();
    let filleted = 0, guardChecked = 0;
    for (const { x, y, angle } of probes(segments, 20_000)) {
      for (const ring of [1, 2, 4]) {
        const ref = contactsAt(roadsNear(index, x, y, ring), x, y);
        const n = nearbyContacts(index, x, y, ring, scratch);
        assert.equal(n, ref.length);
        assert.deepStrictEqual(scratch.contacts.slice(0, n), ref);
        assert.deepStrictEqual(copyContact(pickRoadContact(scratch.contacts, angle, n)), refPickRoadContact(ref, angle));
        assert.deepStrictEqual(copyContact(pickGuardContact(scratch.contacts, angle, { x, y }, n)), refPickGuardContact(ref, angle, { x, y }));
        assert.deepStrictEqual(copyContact(pickGuardContact(scratch.contacts, angle, null, n)), refPickGuardContact(ref, angle, null));
        const fe = filletedExcess(scratch.contacts, x, y, undefined, n);
        assert.ok(Object.is(fe, refFilletedEdge(ref, x, y, CORNER_FILLET_RADIUS).excess));
        if (fe > 0 && fe < (ref.reduce((m, c) => Math.min(m, c.dist - c.width), Infinity))) filleted++;
        guardChecked++;
      }
    }
    assert.ok(filleted > 50, `the corner fillet was exercised (${filleted} points)`);
    assert.equal(guardChecked, 60_000);
  });
}

test('after warm-up a scratch query writes into the same array and the same contact objects', async () => {
  const { segments, index } = await network([52.3745, 4.8840]);
  const scratch = new RoadQueryScratch();
  const points = [...probes(segments, 2000)];
  for (const p of points) nearbyContacts(index, p.x, p.y, 4, scratch); // warm-up: the pools reach their high-water mark
  const spans = scratch.spans, contacts = scratch.contacts, spanCap = spans.length, objects = contacts.slice();
  for (const p of points) {
    const n = nearbyContacts(index, p.x, p.y, 2, scratch);
    pickGuardContact(scratch.contacts, p.angle, null, n);
    pickRoadContact(scratch.contacts, p.angle, n);
    filletedExcess(scratch.contacts, p.x, p.y, undefined, n);
  }
  // 0 arrays: the same arrays, never grown past the warm-up; 0 contact objects: every slot the same object.
  assert.equal(scratch.spans, spans);
  assert.equal(scratch.contacts, contacts);
  assert.equal(scratch.spans.length, spanCap);
  assert.equal(contacts.length, objects.length);
  contacts.forEach((c, i) => assert.equal(c, objects[i]));
  // roadsNearInto / contactsInto are the two halves of nearbyContacts.
  const p = points[0];
  assert.equal(roadsNearInto(index, p.x, p.y, 2, scratch), roadsNear(index, p.x, p.y, 2).length);
  assert.equal(contactsInto(scratch, p.x, p.y), scratch.spanCount);
});

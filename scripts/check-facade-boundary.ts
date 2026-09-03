/**
 * Named regression locations for the pilot boundary.
 *
 * Per the working agreement, a geographic claim becomes a pinned location
 * before it counts as settled. These 36 addresses encode the build prompt's
 * boundary — Brouwersgracht, Leidsegracht, Singel, Prinsengracht and the first
 * Jordaan row — as assertions that survive any later change to how the ring is
 * built. Every hero building is in the inside set; the Gouden Bocht is in the
 * outside set because it is the stretch sector, not the core.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPilotBoundary, containsRd, intersectsBoundary, signedAreaM2, type CanalCentreline } from '../src/canalRecall/facade/pilotBoundary.ts';
import { lngLatToRd, type LngLat, type RdPoint } from '../src/canalRecall/facade/rdNew.ts';
import { loadBoundaryCanals } from './facade-twin/fetch-boundary-canals.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(here, '../src/canalRecall/facade/fixtures/boundary-locations.json'), 'utf8')) as {
  locations: Array<{ address: string; expect: 'inside' | 'outside'; why: string; rd: RdPoint; pandId: string; footprintLngLat: LngLat[] }>;
};

const ways = await loadBoundaryCanals();
const centrelines: CanalCentreline[] = ways.map(way => ({ name: way.name, points: way.points }));
const boundary = buildPilotBoundary(centrelines);

const failures: string[] = [];
let checks = 0;
const check = (label: string, condition: boolean, detail: string) => {
  checks++;
  if (!condition) failures.push(`${label} — ${detail}`);
  if (!condition || process.env.VERBOSE) console.log(`${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
};

/**
 * Membership is footprint intersection, so that is what is tested. Testing the
 * BAG address point instead would be testing the wrong thing: it sits inside
 * the building and, on a 50 m deep canal plot, can be tens of metres behind the
 * façade — Singel 411's address point is 79 m from the Singel centreline while
 * its façade is on the water.
 */
for (const location of fixture.locations) {
  const footprint = location.footprintLngLat.map(lngLatToRd);
  const inside = intersectsBoundary(boundary.ringRd, footprint);
  check(
    `${location.address} (${location.pandId}) expected ${location.expect}`,
    inside === (location.expect === 'inside'),
    `${inside ? 'inside' : 'outside'}; ${location.why}`,
  );
}

// The two rules must not be confused for one another: a containment test on
// address points alone would pass most of the suite and quietly drop far-bank
// buildings, so pin the case that distinguishes them.
const singel411 = fixture.locations.find(l => l.address.startsWith('Singel 411'))!;
check(
  'far-bank membership needs footprint intersection, not the address point',
  intersectsBoundary(boundary.ringRd, singel411.footprintLngLat.map(lngLatToRd)) && !containsRd(boundary.ringRd, singel411.rd),
  'Singel 411 intersects the boundary while its address point does not',
);

// Structural invariants of the ring itself.
check('every boundary canal contributes a leg', boundary.edges.every(e => e.vertexCount >= 2), boundary.edges.map(e => `${e.edge.canal}:${e.vertexCount}`).join(' '));
check('Singel runs the length of the east edge', boundary.edges.find(e => e.edge.canal === 'Singel')!.lengthM > 1000, `${Math.round(boundary.edges.find(e => e.edge.canal === 'Singel')!.lengthM)} m`);
check('Prinsengracht runs the length of the west edge', boundary.edges.find(e => e.edge.canal === 'Prinsengracht')!.lengthM > 1400, `${Math.round(boundary.edges.find(e => e.edge.canal === 'Prinsengracht')!.lengthM)} m`);
check('canal junctions are shared nodes', boundary.junctions.filter(j => !j.name.includes('south end')).every(j => j.gapM < 1), boundary.junctions.map(j => j.gapM.toFixed(1)).join(' '));
check('offsetting the ring grows it', Math.abs(signedAreaM2(boundary.ringRd)) > Math.abs(signedAreaM2(boundary.centrelineRd)), `${boundary.centrelineAreaKm2.toFixed(3)} → ${boundary.areaKm2.toFixed(3)} km²`);
check('boundary area is plausible for the district', boundary.areaKm2 > 0.6 && boundary.areaKm2 < 1.4, `${boundary.areaKm2.toFixed(3)} km²`);

// A self-intersecting ring silently mis-classifies buildings, and the west
// edge's larger offset is exactly the kind of thing that causes one.
const segmentsCross = (a: RdPoint, b: RdPoint, c: RdPoint, d: RdPoint) => {
  const side = (p: RdPoint, q: RdPoint, r: RdPoint) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
};
let crossings = 0;
const ring = boundary.ringRd;
for (let i = 0; i < ring.length; i++) {
  for (let j = i + 2; j < ring.length; j++) {
    if (i === 0 && j === ring.length - 1) continue;
    if (segmentsCross(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) crossings++;
  }
}
check('boundary ring is simple', crossings === 0, `${crossings} self-intersections`);

const inside = fixture.locations.filter(l => l.expect === 'inside').length;
console.log(`Boundary: ${boundary.areaKm2.toFixed(3)} km², ${ring.length} vertices, ${boundary.edges.length} canal legs.`);
console.log(`Named locations: ${inside} inside, ${fixture.locations.length - inside} outside.`);

if (failures.length) {
  console.error(`\n${failures.length} of ${checks} boundary checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`All ${checks} boundary checks passed.`);

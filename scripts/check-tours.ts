// Themed tour data check (npm run test:tours).
//
// Asserts that public/data/extracts/amsterdam/tours.json is fresh against
// scripts/tours/amsterdam-tours.json, and that every tour has 4-7 stops, every
// stop resolves to a coordinate within 4 km of the centre with a why and an
// https source, every leg is between MIN_TOUR_LEG_KM (0.3 km, so the game's
// start/finish gate never refuses it) and the 2.5 km detour cap, and every stop is
// within 60 m of a way the cycling router can use (motor-only ways are dropped
// exactly as the reachability harness drops them). Prints a table.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMotorOnlyHighway, motorOnlyNames } from '../src/canalRecall/routing/bikeAccess.ts';
import {
  MAX_TOUR_LEG_KM, MAX_TOUR_STOPS, MIN_TOUR_LEG_KM, MIN_TOUR_STOPS, legKm, tourLegs, type LngLat, type Tour,
} from '../src/canalRecall/game/tourRoute.ts';
import { readSource, resolveTours, routingWays } from './tours/resolveTours.ts';

const CENTRE: LngLat = [4.8936, 52.372851];
const MAX_KM_FROM_CENTRE = 4;
const SNAP_M = 60;

const built = JSON.parse(readFileSync('public/data/extracts/amsterdam/tours.json', 'utf8')) as { tours: Tour[] };
const fresh = resolveTours(readSource()).tours;
assert.deepEqual(built.tours, fresh, 'tours.json is stale: run npm run build:tours');

// Routable segments in a 0.005-degree grid, for the snap check.
type Seg = { a: LngLat; b: LngLat; name: string };
const grid = new Map<string, Seg[]>();
const cell = (lng: number, lat: number) => `${Math.floor(lng / 0.005)}:${Math.floor(lat / 0.005)}`;
const ways = routingWays() as Array<{ name?: string; highway?: string; path?: [number, number][]; paths?: [number, number][][] }>;
const motorNames = motorOnlyNames(ways as Parameters<typeof motorOnlyNames>[0]);
for (const way of ways) {
  if (isMotorOnlyHighway(way.highway) || (way.name !== undefined && motorNames.has(way.name))) continue;
  for (const line of way.paths || (way.path ? [way.path] : [])) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a: LngLat = [line[i][1], line[i][0]];
      const b: LngLat = [line[i + 1][1], line[i + 1][0]];
      if (legKm(a, CENTRE) > MAX_KM_FROM_CENTRE + 1) continue;
      const seg = { a, b, name: way.name || `(${way.highway ?? 'unnamed'})` };
      for (const key of new Set([cell(...a), cell(...b)])) {
        const list = grid.get(key) ?? [];
        list.push(seg);
        grid.set(key, list);
      }
    }
  }
}
function metresToSegment(p: LngLat, s: Seg): number {
  const k = Math.cos(p[1] * Math.PI / 180);
  const ax = (s.a[0] - p[0]) * k, ay = s.a[1] - p[1], bx = (s.b[0] - p[0]) * k, by = s.b[1] - p[1];
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111_320;
}
function nearestWay(p: LngLat): { m: number; name: string } {
  let best = { m: Infinity, name: '' };
  const cx = Math.floor(p[0] / 0.005), cy = Math.floor(p[1] / 0.005);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const seg of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
      const m = metresToSegment(p, seg);
      if (m < best.m) best = { m, name: seg.name };
    }
  }
  return best;
}

const failures: string[] = [];
const rows: string[][] = [];
const ids = new Set<string>();
for (const tour of built.tours) {
  if (ids.has(tour.id)) failures.push(`${tour.id}: duplicate tour id`);
  ids.add(tour.id);
  if (tour.stops.length < MIN_TOUR_STOPS || tour.stops.length > MAX_TOUR_STOPS) failures.push(`${tour.id}: ${tour.stops.length} stops (want ${MIN_TOUR_STOPS}-${MAX_TOUR_STOPS})`);
  if (!tour.title || !tour.blurb || !tour.theme) failures.push(`${tour.id}: title, theme and blurb are required`);
  if (tour.volatile && !/^\d{4}-\d{2}-\d{2}$/.test(tour.checkedAt ?? '')) failures.push(`${tour.id}: volatile tour needs checkedAt`);
  if (tour.theme === 'food' || tour.theme === 'cafes') {
    if (!tour.volatile) failures.push(`${tour.id}: shop tours must be volatile`);
    for (const stop of tour.stops) if (!stop.osm) failures.push(`${tour.id}/${stop.name}: a shop stop must name its OSM element`);
  }
  const legs = tourLegs(tour);
  tour.stops.forEach((stop, i) => {
    const fromCentre = legKm(stop.lngLat, CENTRE);
    const snap = nearestWay(stop.lngLat);
    const leg = legs[i - 1];
    const problems: string[] = [];
    if (!Array.isArray(stop.lngLat) || stop.lngLat.length !== 2 || !stop.lngLat.every(Number.isFinite)) problems.push('no coordinate');
    if (fromCentre > MAX_KM_FROM_CENTRE) problems.push(`${fromCentre.toFixed(2)} km from centre`);
    if (!/^https:\/\/\S+$/.test(stop.source ?? '')) problems.push('no https source');
    if (!stop.why || stop.why.length < 20 || !/[.!?]$/.test(stop.why)) problems.push('why is not a sentence');
    if (/\bbest\b/i.test(stop.why) && !/(Time Out|I amsterdam|Little Black Book)/.test(stop.why)) problems.push('unattributed "best"');
    if (leg && leg.km > MAX_TOUR_LEG_KM) problems.push(`leg ${leg.km.toFixed(2)} km over cap`);
    // Named regression (user, 2026-10-17): Jewish Amsterdam's De Dokwerker ->
    // Portugese Synagoge leg (0.04 km) failed with "Start and finish are too close".
    if (leg && leg.km < MIN_TOUR_LEG_KM) problems.push(`leg ${leg.km.toFixed(2)} km under the ${MIN_TOUR_LEG_KM} km minimum`);
    if (snap.m > SNAP_M) problems.push(`${Math.round(snap.m)} m from a routable way`);
    for (const p of problems) failures.push(`${tour.id}/${stop.name}: ${p}`);
    rows.push([
      i === 0 ? tour.id : '', String(i + 1), stop.name, stop.landmarkId ? 'landmark' : stop.osm ?? 'extract',
      fromCentre.toFixed(2), leg ? leg.km.toFixed(2) : '-', `${Math.round(snap.m)} m ${snap.name}`, problems.length ? 'FAIL' : 'ok',
    ]);
  });
}

// Named regressions: street-resolved stops must land on the stretch they name.
// Golden Bend = Herengracht between the Leidsestraat (4.88801) and Vijzelstraat
// (4.892877) junctions in streets-routing.json; the first hint sat on the
// Vijzelstraat corner.
const goldenBend = built.tours.find(t => t.id === 'golden-age-canal-ring')?.stops.find(s => s.name === 'Golden Bend');
if (!goldenBend || goldenBend.lngLat[0] < 4.8885 || goldenBend.lngLat[0] > 4.8925) failures.push(`Golden Bend at ${goldenBend?.lngLat} is not between Leidsestraat and Vijzelstraat`);
const jodenbree = built.tours.find(t => t.id === 'jewish-amsterdam')?.stops.find(s => s.name === 'Jodenbreestraat');
if (!jodenbree || nearestWay(jodenbree.lngLat).name !== 'Jodenbreestraat') failures.push('Jodenbreestraat stop is not on Jodenbreestraat');

const header = ['tour', '#', 'stop', 'resolved by', 'km ctr', 'leg km', 'nearest routable way', ''];
const widths = header.map((h, c) => Math.max(h.length, ...rows.map(r => r[c].length)));
const line = (r: string[]) => r.map((v, c) => v.padEnd(widths[c])).join('  ');
console.log(line(header));
console.log(widths.map(w => '-'.repeat(w)).join('  '));
for (const r of rows) console.log(line(r));
const stops = built.tours.reduce((n, t) => n + t.stops.length, 0);
if (failures.length) {
  console.error(`\n${failures.length} tour problem(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nTours: ${built.tours.length} tours, ${stops} stops; all resolve within ${MAX_KM_FROM_CENTRE} km, legs ${MIN_TOUR_LEG_KM}-${MAX_TOUR_LEG_KM} km, stops within ${SNAP_M} m of a routable way.`);

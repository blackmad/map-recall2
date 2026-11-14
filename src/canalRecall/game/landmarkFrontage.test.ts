import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceToFootprint, FRONTAGE_M, footprintFromGeoJson, frontageAlong } from './landmarkFrontage.ts';
import { landmarkApproachAlong, pickDriveBy } from './driveByTrigger.ts';
import { besideLandmark } from './landmarkQuestion.ts';
import type { WorldPoint } from './worldTypes';

const PX = 3;
const DIR = new URL('../../../public/data/extracts/amsterdam/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));
// Local equirectangular world: x east, y south, 3 px per metre.
const LAT0 = 52.37, LNG0 = 4.9;
const toWorld = ([lng, lat]: [number, number]): WorldPoint => ({
  x: (lng - LNG0) * 111320 * Math.cos(LAT0 * Math.PI / 180) * PX, y: -(lat - LAT0) * 110540 * PX,
});

interface Extract { name: string; center: [number, number]; path?: number[][]; paths?: number[][][] }
const landmarks = read('landmarks.json') as Extract[];
function landmark(name: string) {
  const feature = landmarks.find(item => item.name === name)!;
  const rings = footprintFromGeoJson((feature.paths || (feature.path ? [feature.path] : []))
    .map(path => ({ geometry: { type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) } })), toWorld);
  const own = toWorld([feature.center[1], feature.center[0]]);
  return { feature, ownX: own.x, ownY: own.y, footprint: rings.length ? rings : undefined };
}

interface Street { name: string; highway?: string; path?: number[][]; paths?: number[][][] }
const streets = read('streets-routing.json') as Street[];
/** The point of the named street (a residential way) nearest `to`, plus the street's direction there. */
function streetNear(name: string, to: WorldPoint, minHeading = 0): { at: WorldPoint; dir: WorldPoint } {
  let best: { at: WorldPoint; dir: WorldPoint; d: number } | null = null;
  for (const street of streets) {
    if (street.name !== name || street.highway !== 'residential') continue;
    for (const path of street.paths || [street.path!]) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = toWorld([path[i][1], path[i][0]]), b = toWorld([path[i + 1][1], path[i + 1][0]]);
        for (let k = 0; k <= 10; k++) {
          const at = { x: a.x + (b.x - a.x) * k / 10, y: a.y + (b.y - a.y) * k / 10 };
          const d = Math.hypot(at.x - to.x, at.y - to.y);
          if (!best || d < best.d) { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; best = { at, dir: { x: (b.x - a.x) / l, y: (b.y - a.y) / l }, d }; }
        }
      }
    }
  }
  void minHeading;
  return best!;
}
/** A rider on `street` beside `landmark`, heading along it, and the 60 m of path ahead of a point 40 m before. */
function rideAlong(street: string, target: WorldPoint) {
  const { at, dir } = streetNear(street, target);
  const rider = { x: at.x - dir.x * 40 * PX, y: at.y - dir.y * 40 * PX, angle: Math.atan2(dir.y, dir.x), speed: 5 * PX };
  const path = [{ x: rider.x, y: rider.y }, { x: rider.x + dir.x * 135, y: rider.y + dir.y * 135 }];
  return { at, rider, path };
}

test('Krijtberg: its front is on the Singel (4 m), not the Herengracht (26 m)', () => {
  const k = landmark('Sint-Franciscus Xaveriuskerk');
  assert.ok(k.footprint);
  const singel = streetNear('Singel', toWorld([4.8878, 52.3677]));
  const herengracht = streetNear('Herengracht', toWorld([4.8878, 52.3677]));
  assert.ok(distanceToFootprint(singel.at, k.footprint) <= FRONTAGE_M * PX, 'Singel');
  assert.ok(distanceToFootprint(herengracht.at, k.footprint) > FRONTAGE_M * PX, 'Herengracht');
});

test('Krijtberg from the Herengracht: no drive-by card and no question; from the Singel: both', () => {
  const k = landmark('Sint-Franciscus Xaveriuskerk');
  // The extract snaps the church onto the Herengracht (user 2026-11-13).
  const snapped = streetNear('Herengracht', { x: k.ownX, y: k.ownY });
  const item = { ...k, x: snapped.at.x, y: snapped.at.y };
  const herengracht = rideAlong('Herengracht', { x: k.ownX, y: k.ownY });
  assert.equal(landmarkApproachAlong(herengracht.path, item, PX), null);
  assert.equal(besideLandmark({ ...herengracht.rider, x: herengracht.at.x, y: herengracht.at.y }, item, PX), false);
  const singel = rideAlong('Singel', { x: k.ownX, y: k.ownY });
  assert.notEqual(landmarkApproachAlong(singel.path, item, PX), null);
  assert.equal(pickDriveBy([item], singel.path, c => landmarkApproachAlong(singel.path, c, PX)), item);
  assert.equal(besideLandmark({ ...singel.rider, x: singel.at.x, y: singel.at.y }, item, PX), true);
});

test('Westerkerk from the Prinsengracht: card and question', () => {
  const w = landmark('Westerkerk');
  const ride = rideAlong('Prinsengracht', { x: w.ownX, y: w.ownY });
  const item = { ...w, x: ride.at.x, y: ride.at.y };
  assert.notEqual(landmarkApproachAlong(ride.path, item, PX), null);
  assert.equal(besideLandmark({ ...ride.rider, x: ride.at.x, y: ride.at.y }, item, PX), true);
});

test('FOAM (a point-only house) from Vijzelstraat: no question; from the Keizersgracht in front: question', () => {
  const f = landmark('Foam');
  assert.equal(f.footprint, undefined);
  const keizers = streetNear('Keizersgracht', { x: f.ownX, y: f.ownY });
  const item = { ...f, x: keizers.at.x, y: keizers.at.y };
  const vijzel = streetNear('Vijzelstraat', { x: f.ownX, y: f.ownY });
  const heading = Math.atan2(f.ownY - vijzel.at.y, f.ownX - vijzel.at.x);
  assert.equal(besideLandmark({ x: vijzel.at.x, y: vijzel.at.y, angle: heading, speed: 5 * PX }, item, PX), false);
  // A few metres before the house, heading toward it along the street.
  const before = { x: keizers.at.x - keizers.dir.x * 5 * PX, y: keizers.at.y - keizers.dir.y * 5 * PX };
  assert.equal(besideLandmark({ ...before, angle: Math.atan2(keizers.dir.y, keizers.dir.x), speed: 5 * PX }, item, PX), true);
});

test('frontageAlong: sampled from the path start, null when the path never reaches the front', () => {
  const ring = [{ x: 0, y: 0 }, { x: 30 * PX, y: 0 }, { x: 30 * PX, y: 20 * PX }, { x: 0, y: 20 * PX }, { x: 0, y: 0 }];
  const house = { x: 0, y: 0, footprint: [ring] };
  const along = frontageAlong([{ x: -100 * PX, y: -10 * PX }, { x: 100 * PX, y: -10 * PX }], house, PX)!;
  assert.ok(Math.abs(along / PX - (100 - Math.sqrt(FRONTAGE_M ** 2 - 10 ** 2))) < 2, `first within ${FRONTAGE_M} m at ${along / PX} m`);
  assert.equal(frontageAlong([{ x: -100 * PX, y: -40 * PX }, { x: 100 * PX, y: -40 * PX }], house, PX), null);
});

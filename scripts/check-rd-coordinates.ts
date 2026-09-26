/**
 * Does RD New still convert correctly?
 *
 * Every Dutch government dataset this project reads is published in
 * Rijksdriehoek, and a wrong conversion here does not fail loudly: the 3DBAG
 * API answers an out-of-range bounding box with zero features rather than an
 * error, and a subtly wrong one returns the wrong neighbourhood's buildings.
 * A transposed digit in one of the forty polynomial coefficients would be
 * invisible until a city came out shifted.
 *
 * Checking against remembered landmark coordinates is worse than useless —
 * doing exactly that during development produced 116 m of "error" that turned
 * out to be the landmark, not the code. So this checks properties that follow
 * from what RD *is*, and needs no external truth:
 *
 *   - RD is conformal, so its scale factor at a point must be the same in
 *     every direction. A corrupted coefficient breaks isotropy immediately.
 *   - It is an oblique stereographic projection with scale 0.9999079 at
 *     Amersfoort, growing away from it. That fixes the absolute scale.
 *   - The origin is exact by construction.
 *   - Forward and inverse are independent approximations, so their agreement
 *     is a real check on both.
 */

import assert from 'node:assert/strict';
import { NSGI_ALIGNMENT_M } from '../src/canalRecall/facade/rdNew.js';
import { lngLatBboxToRd, lngLatToRd, rdToLngLat } from '../src/canalRecall/rdCoordinates.js';

const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;
const METRES_PER_DEGREE_LATITUDE = 111_320;

/** Ellipsoidal distance, accurate well past what a 1 km probe needs. */
function geodesicM([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const phi = (((lat1 + lat2) / 2) * Math.PI) / 180;
  const w = Math.sqrt(1 - WGS84_E2 * Math.sin(phi) ** 2);
  const meridional = (WGS84_A * (1 - WGS84_E2)) / w ** 3;
  const primeVertical = WGS84_A / w;
  return Math.hypot(
    (meridional * (lat2 - lat1) * Math.PI) / 180,
    (primeVertical * Math.cos(phi) * (lng2 - lng1) * Math.PI) / 180
  );
}

/** Grid distance over true distance, for a 1 km step in one direction. */
const scaleAt = (x: number, y: number, dx: number, dy: number): number =>
  Math.hypot(dx, dy) / geodesicM(rdToLngLat(x, y), rdToLngLat(x + dx, y + dy));

// --- the origin is Amersfoort, after the measured NSGI datum offset ----------
const [originLng, originLat] = rdToLngLat(155000, 463000);
const expectedOriginLat = 52.15517440 - NSGI_ALIGNMENT_M.north / METRES_PER_DEGREE_LATITUDE;
const expectedOriginLng = 5.38720621
  - NSGI_ALIGNMENT_M.east / (METRES_PER_DEGREE_LATITUDE * Math.cos((expectedOriginLat * Math.PI) / 180));
assert.ok(Math.abs(originLat - expectedOriginLat) < 1e-7, 'RD origin returns the aligned Amersfoort latitude');
assert.ok(Math.abs(originLng - expectedOriginLng) < 1e-7, 'RD origin returns the aligned Amersfoort longitude');

// --- conformality, across the country and in every direction ----------------
const places: [string, number, number][] = [
  ['Amersfoort', 155000, 463000], ['Amsterdam', 121000, 487000],
  ['Rotterdam', 92000, 437000], ['Groningen', 233000, 582000],
  ['Maastricht', 176000, 318000], ['Vlissingen', 30000, 385000]
];
let worstAnisotropy = 0;
let worstScaleError = 0;
for (const [place, x, y] of places) {
  const east = scaleAt(x, y, 1000, 0);
  const north = scaleAt(x, y, 0, 1000);
  const diagonal = scaleAt(x, y, 707, 707);
  const anisotropy = Math.max(east, north, diagonal) - Math.min(east, north, diagonal);
  assert.ok(anisotropy < 5e-6, `${place}: RD scale is the same in every direction (spread ${(anisotropy * 1e6).toFixed(1)} ppm)`);
  // The projection plane cuts the ellipsoid, so scale runs from 0.99991 at
  // Amersfoort out to about 1.00005 at the corners of the country.
  assert.ok(east > 0.99985 && east < 1.00015, `${place}: scale factor stays near unity (${east.toFixed(7)})`);
  worstAnisotropy = Math.max(worstAnisotropy, anisotropy);
  worstScaleError = Math.max(worstScaleError, Math.abs(east - 1));
}
assert.ok(scaleAt(155000, 463000, 1000, 0) < 1, 'Amersfoort sits inside the standard circle, so scale there is below 1');

// --- forward and inverse agree over the whole national grid ------------------
let worstRoundTrip = 0;
for (let x = 10000; x <= 280000; x += 5000) {
  for (let y = 300000; y <= 620000; y += 5000) {
    const [lng, lat] = rdToLngLat(x, y);
    const [backX, backY] = lngLatToRd(lng, lat);
    worstRoundTrip = Math.max(worstRoundTrip, Math.hypot(backX - x, backY - y));
  }
}
assert.ok(worstRoundTrip < 0.5, `forward and inverse agree to well under a metre (worst ${worstRoundTrip.toFixed(3)} m)`);

// --- a bounding box has to grow to cover a rotated grid ----------------------
// RD's grid north is not true north, so a WGS84 box maps to a rotated
// quadrilateral. Taking only two corners silently clips the buildings at the
// margins; the box must contain all four.
const [west, south, east, north] = [4.72, 52.28, 5.08, 52.43];
const box = lngLatBboxToRd(west, south, east, north);
for (const [cornerLng, cornerLat] of [[west, south], [east, south], [west, north], [east, north]] as const) {
  const [x, y] = lngLatToRd(cornerLng, cornerLat);
  assert.ok(x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3], `RD box contains the corner ${cornerLng},${cornerLat}`);
}
const twoCornerHeight = lngLatToRd(east, north)[1] - lngLatToRd(west, south)[1];
assert.ok(box[3] - box[1] > twoCornerHeight, 'the four-corner box is taller than a two-corner box would be');

process.stdout.write(
  `RD coordinate checks passed (conformal to ${(worstAnisotropy * 1e6).toFixed(1)} ppm, ` +
  `scale within ${(worstScaleError * 1e6).toFixed(0)} ppm of unity, ` +
  `round-trip ${(worstRoundTrip * 1000).toFixed(0)} mm over the national grid)\n`
);

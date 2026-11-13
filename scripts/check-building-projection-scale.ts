import assert from 'node:assert/strict';
import {buildingProjectionScale} from '../src/canalRecall/buildingProjectionScale';

// Compare the adapter's local north coordinates with independent spherical
// Mercator positions. This catches the ~5m drift that moved the preserved
// house beside the Tulip Museum across the museum's custom facade.
const originLatitude = 52.37;
const radius = 6_378_137;
const metresPerDegree = Math.PI * radius / 180;
const cosine = Math.cos(originLatitude * Math.PI / 180);
const mercatorNorth = (latitude: number) => radius * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
const originNorth = mercatorNorth(originLatitude);
const scale = 1 / (2 * Math.PI * radius * cosine);
const [east, north, up] = buildingProjectionScale(scale);
assert.equal(east, scale, 'east coordinates stay unchanged');
assert.equal(up, scale, 'building heights stay unchanged');
assert.ok(north < 0, 'north retains MapLibre’s reversed Y axis');

for (const [name, latitude, tolerance] of [
  ['Pinto', 52.370126, .001],
  ['Tulip Museum', 52.376328, .06],
  ['preserved Tulip neighbor', 52.376374, .06],
  ['Silodam', 52.392741, .7],
  ['Willet-Holthuysen', 52.365687, .03],
  // The origin-based mesh projection remains linear, so Mercator curvature
  // has a small residual at the city bounds. Do not assert centimetres there.
  ['northern city bound', 52.42, 3.2],
  ['southern city bound', 52.30, 6.3],
] as const) {
  const localNorth = (latitude - originLatitude) * 110_540;
  const exactNorth = (mercatorNorth(latitude) - originNorth) * cosine;
  const correctedNorth = localNorth * -north / scale;
  const error = Math.abs(correctedNorth - exactNorth);
  assert.ok(error < tolerance, `${name}: corrected displacement ${error}m exceeds ${tolerance}m`);
  assert.ok(error < Math.abs(localNorth - exactNorth) / 5, `${name}: drift must shrink substantially`);
}
assert.ok(Math.abs((52.376328 - originLatitude) * 110_540 - (mercatorNorth(52.376328) - originNorth) * cosine) > 4.9);
assert.ok(Math.abs(-north / scale - metresPerDegree / 110_540) < 1e-12);
console.log('Generic building north scale aligns Tulip/Pinto and preserves east/height; city-bound curvature remains bounded.');

// Lane BA 2026-11-13: Haarlemmerdijk 29 (0363100012167795), a generic house, was drawn ~1.6 m off its BAG plot
// (over no. 31's front, 167794, a GLB), on the own engine and in the baked world. The facade layer took MapLibre's
// metre (mean-radius sphere, 6,371,008.8 m) for meshes stored in equatorial metres: 0.112 % of the distance from
// ORIGIN. Its front corners must land on their exact Web Mercator positions through the layer's transform.
{
  const { buildingMercatorFromLocal } = await import('../src/canalRecall/buildingProjectionScale');
  const { mercatorOfLngLat, mercatorUnitsPerMetre } = await import('../src/canalRecall/rendererShared/frameMath');
  const ORIGIN = { lng: 4.9, lat: 52.37 }, KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
  const apply = (m: number[], p: [number, number]) => [m[0] * p[0] + m[12], m[5] * p[1] + m[13]];
  const offM = (m: number[], lngLat: [number, number]) => {
    const got = apply(m, [(lngLat[0] - ORIGIN.lng) * KX, (lngLat[1] - ORIGIN.lat) * KY]), want = mercatorOfLngLat(lngLat[0], lngLat[1]);
    return Math.hypot(got[0] - want[0], got[1] - want[1]) / mercatorUnitsPerMetre(want[1]);
  };
  const corners: [string, [number, number]][] = [['167795 front west', [4.888342, 52.381953]], ['167795 front east (167794 party wall)', [4.888304, 52.381978]]];
  const layer = buildingMercatorFromLocal(ORIGIN);
  // MapLibre's metre, as the layer used it before (the bug): the corners land > 1.2 m off.
  const mapMetre = 1 / (2 * Math.PI * 6_371_008.8 * Math.cos(ORIGIN.lat * Math.PI / 180));
  const buggy = [mapMetre, -mapMetre * (Math.PI * 6_378_137 / 180) / 110_540, mapMetre];
  const before = [buggy[0], 0, 0, 0, 0, buggy[1], 0, 0, 0, 0, buggy[2], 0, layer[12], layer[13], 0, 1];
  for (const [name, ll] of corners) {
    assert.ok(offM(before, ll) > 1.2, `${name}: the mean-radius metre should reproduce the 1.6 m shift (${offM(before, ll).toFixed(2)} m)`);
    assert.ok(offM(layer, ll) < 0.25, `${name}: the facade layer draws it ${offM(layer, ll).toFixed(2)} m off its plot (linear-origin curvature allows 0.25 m here)`);
  }
  console.log(`167795 (Haarlemmerdijk 29) corners on their plot: ${corners.map(([, ll]) => offM(layer, ll).toFixed(2)).join(', ')} m (mean-radius metre: ${corners.map(([, ll]) => offM(before, ll).toFixed(2)).join(', ')} m).`);
}

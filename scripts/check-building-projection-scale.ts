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

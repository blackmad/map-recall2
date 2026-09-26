import assert from 'node:assert/strict';
import { boresightPriorDeg, trackPriorFor, type PanoFix } from './panoTrackPrior.ts';

const R = 6371000;
const lat0 = 52.37;
const lng0 = 4.9;
const origin: [number, number] = [lng0, lat0];

const offset = (point: [number, number], bearingDeg: number, distanceM: number): [number, number] => {
  const north = distanceM * Math.cos((bearingDeg * Math.PI) / 180);
  const east = distanceM * Math.sin((bearingDeg * Math.PI) / 180);
  const lat = point[1] + (north / R) * (180 / Math.PI);
  const lng = point[0] + (east / (R * Math.cos((point[1] * Math.PI) / 180))) * (180 / Math.PI);
  return [lng, lat];
};

const fix = (panoramaId: string, lngLat: [number, number], headingDeg: number): PanoFix => ({ panoramaId, lngLat, headingDeg });

const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 0.5, `${label}: got ${actual}, expected ~${expected}`);

// --- Straight north-heading track, stored heading 0 -> prior ~0, high confidence.
const north1 = origin;
const north2 = offset(north1, 0, 5);
const north3 = offset(north2, 0, 5);
const northTrack = [
  fix('TMX_TEST_pano_0001_10', north1, 0),
  fix('TMX_TEST_pano_0001_11', north2, 0),
  fix('TMX_TEST_pano_0001_12', north3, 0),
];
const north = trackPriorFor('TMX_TEST_pano_0001_11', northTrack);
assert.equal(north.confidence, 'high');
assert.equal(north.neighbours, 2);
close(north.trackBearingDeg!, 0, 'north bearing');
close(north.priorYawDeg, 0, 'north prior');

// --- Track heading east (bearing 90) with stored heading 90 -> prior ~0.
const east1 = origin;
const east2 = offset(east1, 90, 5);
const east3 = offset(east2, 90, 5);
const eastTrack = [
  fix('TMX_TEST_pano_0002_20', east1, 90),
  fix('TMX_TEST_pano_0002_21', east2, 90),
  fix('TMX_TEST_pano_0002_22', east3, 90),
];
const east = trackPriorFor('TMX_TEST_pano_0002_21', eastTrack);
assert.equal(east.confidence, 'high');
close(east.trackBearingDeg!, 90, 'east bearing');
close(east.priorYawDeg, 0, 'east prior');

// --- 180 degree flip: stored heading 190 but track bearing 7 -> prior near +3.
const flip1 = origin;
const flip2 = offset(flip1, 7, 10);
const flipTrack = [
  fix('TMX_TEST_pano_0003_30', flip1, 190),
  fix('TMX_TEST_pano_0003_31', offset(flip1, 7, 5), 190),
  fix('TMX_TEST_pano_0003_32', flip2, 190),
];
const flip = trackPriorFor('TMX_TEST_pano_0003_31', flipTrack);
assert.equal(flip.confidence, 'high');
close(flip.trackBearingDeg!, 7, 'flip bearing');
close(flip.priorYawDeg, 3, 'flip prior');
assert.ok(flip.priorYawDeg > -90 && flip.priorYawDeg <= 90, 'prior must be wrapped into (-90, 90]');

// --- Target with no same-prefix neighbour -> confidence none, prior 0.
const lonely = trackPriorFor('TMX_OTHER_pano_9999_5', northTrack);
assert.equal(lonely.confidence, 'none');
assert.equal(lonely.neighbours, 0);
assert.equal(lonely.trackBearingDeg, null);
assert.equal(lonely.priorYawDeg, 0);

// --- Single neighbour only (one available side) -> low confidence, finite prior.
const oneSide = trackPriorFor('TMX_TEST_pano_0001_10', northTrack);
assert.equal(oneSide.confidence, 'low');
assert.equal(oneSide.neighbours, 1);
assert.ok(Number.isFinite(oneSide.priorYawDeg), 'one-sided prior must be finite');

// --- Curved track (turning between panoramas) still returns a finite prior.
const curve1 = origin;
const curve2 = offset(curve1, 0, 5);
const curve3 = offset(curve2, 45, 5);
const curveTrack = [
  fix('TMX_TEST_pano_0004_40', curve1, 0),
  fix('TMX_TEST_pano_0004_41', curve2, 0),
  fix('TMX_TEST_pano_0004_42', curve3, 0),
];
const curve = trackPriorFor('TMX_TEST_pano_0004_41', curveTrack);
assert.equal(curve.confidence, 'high');
assert.ok(Number.isFinite(curve.priorYawDeg), 'curved prior must be finite');
assert.ok(curve.trackBearingDeg !== null && curve.trackBearingDeg > 0 && curve.trackBearingDeg < 45, 'curve bearing sits between the two legs');

// --- Convenience wrapper.
assert.equal(boresightPriorDeg(flipTrack, 'TMX_TEST_pano_0003_31'), flip.priorYawDeg);

console.log(`pano track prior: north prior ${north.priorYawDeg}°, east prior ${east.priorYawDeg}°, flip prior ${flip.priorYawDeg}° (bearing ${flip.trackBearingDeg}°).`);

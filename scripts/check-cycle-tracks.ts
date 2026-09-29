// Named regression: user report 2026-09-29 (Nassaukade), the route on the
// separated cycleway looked off the drawn street because the basemap barely
// draws cycle tracks.
import assert from 'node:assert/strict';
import { cycleTrackFeatures, isCycleTrack } from '../src/canalRecall/cycleTracks';

const track = { highway: 'cycleway', nodes: [{ lat: 52.37, lon: 4.87 }, { lat: 52.371, lon: 4.871 }] };
assert.equal(isCycleTrack(track), true);
assert.equal(isCycleTrack({ highway: 'residential', nodes: track.nodes }), false, 'a road with a painted lane is drawn as the road');
const collection = cycleTrackFeatures([track, { highway: 'residential', nodes: track.nodes }, { highway: 'cycleway', nodes: [track.nodes[0]] }]);
assert.equal(collection.features.length, 1, 'only separated tracks with a line');
assert.deepEqual(collection.features[0].geometry.coordinates[0], [4.87, 52.37], 'GeoJSON is lng, lat');
process.stdout.write('Cycle track checks passed\n');

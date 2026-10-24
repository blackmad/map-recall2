import assert from 'node:assert/strict';
import type { Terminal } from './network';
import { edgeCoordinates, meanAngle, nearCluster, nearestBerth, onPierEdge, PIER_EDGE_EXTENSION, pierClusters, pierEdge } from './pierEdge';

const t = (id: string, x: number, y: number): Terminal => ({ id, name: id, x, y, land: { x, y: y + 30 } });
const close = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

// Stops on one quay cluster; a stop 470 m away (Centraal F2) is its own pier.
const P = t('P', 0, 0), Q = t('Q', 120, 0), far = t('far', 1410, 0);
const clusters = pierClusters([P, far, Q]);
assert.equal(clusters.length, 2);
assert.deepEqual(clusters.find(c => c.includes(P))!.map(x => x.id).sort(), ['P', 'Q']);
// Single linkage: a chain of stops joins even when its ends are far apart.
assert.equal(pierClusters([t('a', 0, 0), t('b', 200, 0), t('c', 400, 0)]).length, 1);

close(meanAngle([0, Math.PI / 2, null])!, Math.PI / 4, 'circular mean');
assert.equal(meanAngle([null, undefined]), null);
assert.equal(pierEdge([P, Q], null), null, 'no edge without a known shore');

// Water north (-y): the edge runs along the stops, normal towards the water,
// extended past the outer stops.
const edge = pierEdge([P, Q], -Math.PI / 2 + 0.3)!;
close(Math.abs(edge.tangent.x), 1, 'tangent along the stop line, not the noisy shore normal');
close(edge.normal.y, -1, 'normal towards the water');
close(edge.max - edge.min, 120 + 2 * PIER_EDGE_EXTENSION, 'extent');
assert.ok(onPierEdge(edge, { x: 60, y: 6 }), 'between the stops');
assert.ok(onPierEdge(edge, { x: 120 + PIER_EDGE_EXTENSION - 3, y: -6 }), 'just beyond a stop');
assert.ok(!onPierEdge(edge, { x: 120 + PIER_EDGE_EXTENSION + 6, y: 0 }), 'past the extension');
assert.ok(!onPierEdge(edge, { x: 60, y: 30 }), 'inland of the edge');
assert.equal(nearestBerth(edge, { x: 80, y: 0 }).id, 'Q');
assert.equal(nearestBerth(edge, { x: -20, y: 0 }).id, 'P');
assert.ok(nearCluster([P, Q], { x: 60, y: 10 }));
assert.ok(!nearCluster([P, Q], { x: 60, y: 400 }));

// One stop: the shoreline is perpendicular to the shore normal.
const single = pierEdge([far], 0)!;
close(Math.abs(single.tangent.y), 1, 'single stop: tangent perpendicular to the shore');
close(single.normal.x, 1, 'single stop: normal is the shore direction');

// Stops on either side of a jetty, lined up along the shore normal: not a shoreline.
const jetty = pierEdge([t('j1', 0, 0), t('j2', 0, -90)], -Math.PI / 2)!;
close(Math.abs(jetty.tangent.x), 1, 'jetty: axis along the normal is rejected');

// Centraal F3/F4 (streets-routing extract, metres east/north of 52.38071, 4.8994;
// game y points south). Every berth ramp end, including the two middle ones
// the user rode to, lies on the edge; the Pontplein path inland does not.
const m = (e: number, n: number) => ({ x: e * 3, y: -n * 3 });
const F3 = { ...t('F3', 0, 0), ...m(16.5, -11.6) }, F4 = { ...t('F4', 0, 0), ...m(-16.6, 12.2) };
// Shore normal 25 degrees off the true one, as the ring search can be.
const centraal = pierEdge([F3, F4], Math.atan2(-0.811, 0.583) + 0.45)!;
for (const [e, n] of [[20, -12], [7, -2], [-2, 5], [-14, 15]]) {
  assert.ok(onPierEdge(centraal, m(e, n)), `Centraal ramp end ${e},${n} on the edge (${JSON.stringify(edgeCoordinates(centraal, m(e, n)))})`);
}
assert.equal(nearestBerth(centraal, m(7, -2)).id, 'F3');
assert.equal(nearestBerth(centraal, m(-2, 5)).id, 'F4');
assert.ok(!onPierEdge(centraal, m(-40, -2)), 'De Ruijterkade footway behind the pier');
assert.ok(!onPierEdge(centraal, m(-3, -37)), 'De Ruijterkade cycleway');
assert.ok(centraal.normal.y < 0, 'Centraal: water to the north');

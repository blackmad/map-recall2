// Unit checks for the BGT plaza rule, its geometry helpers, the plaza index with holes, and the URL flag
// (lane bgt-plazas-20261110). The ride pins at named places are in scripts/check-canal-car.ts.
//
//   npx tsx scripts/routing/check-bgt-plazas.ts
import assert from 'node:assert/strict';
import {
  BGT_PLAZAS_DEFAULT, bgtPlazasDefault, RIDEABLE_PLAZA_CLASSES, bgtPlazasEnabled, isPlazaReachSurface, isRideablePlazaSurface,
  type BgtSurfaceAttributes,
} from '../../src/canalRecall/routing/bgtPlazas.ts';
import { buildPlazaIndex, plazaAt, type PlazaFeature } from '../../src/canalRecall/routing/pedestrianAreas.ts';
import {
  Raster, components, distanceFrom, fillPolygon, grow, markSegment, multiArea, polygonArea, segmentPolygonDistance,
  simplifyRing, strips, toLonLat, toMetres, traceLabel,
} from './bgtPlazaGeometry.ts';
import polygonClipping from 'polygon-clipping';

const at = (over: Partial<BgtSurfaceAttributes>): BgtSurfaceAttributes => ({
  collection: 'wegdeel', functie: 'voetgangersgebied', fv: 'open verharding', h: 0, status: 'bestaand', eind: null, ...over,
});

// The rule.
assert.ok(isRideablePlazaSurface(at({})), 'a paved voetgangersgebied is plaza');
assert.ok(isRideablePlazaSurface(at({ fv: 'gesloten verharding' })), 'closed paving too');
assert.ok(isRideablePlazaSurface(at({ functie: 'woonerf' })), 'a woonerf');
assert.ok(isRideablePlazaSurface(at({ functie: 'voetpad' })), 'a voetpad (the build keeps only its parts at least 8 m across)');
assert.ok(!isRideablePlazaSurface(at({ collection: 'onbegroeidterreindeel', functie: '' })), 'paved terrain outside the road partition is not (terminal aprons, courtyards)');
assert.ok(!isRideablePlazaSurface(at({ collection: 'onbegroeidterreindeel', functie: '', fv: 'erf' })), 'erf (a private yard) is not');
assert.ok(!isRideablePlazaSurface(at({ fv: 'half verhard' })), 'half paved is not');
assert.ok(!isRideablePlazaSurface(at({ fv: 'onverhard' })), 'unpaved is not');
for (const functie of ['parkeervlak', 'inrit', 'spoorbaan', 'OV-baan', 'rijbaan lokale weg']) {
  assert.ok(!isRideablePlazaSurface(at({ functie })), `${functie} is not plaza`);
}
assert.ok(!isRideablePlazaSurface(at({ h: 1 })), 'a deck is not');
assert.ok(!isRideablePlazaSurface(at({ h: -1 })), 'a tunnel floor is not');
assert.ok(!isRideablePlazaSurface(at({ eind: '2024-01-01' })), 'an ended registration is not');
assert.ok(!isRideablePlazaSurface(at({ status: 'plan' })), 'a planned one is not');
assert.ok(isPlazaReachSurface(at({ functie: 'voetpad' })), 'a plaza reaches into the sidewalk beside it');
assert.ok(isPlazaReachSurface(at({ functie: 'rijbaan lokale weg', fv: 'gesloten verharding' })), 'and the street');
assert.ok(!isPlazaReachSurface(at({ functie: 'spoorbaan' })), 'never into track');
assert.ok(!isPlazaReachSurface(at({ functie: 'OV-baan' })), 'nor tram/bus track');
assert.ok(!isPlazaReachSurface(at({ collection: 'onbegroeidterreindeel', functie: '', fv: 'erf' })), 'nor a yard');
assert.ok(RIDEABLE_PLAZA_CLASSES.every(c => !c.fysiek.includes('erf') && !c.fysiek.includes('onverhard')), 'the exported list holds paved classes only');

// The flag.
assert.equal(BGT_PLAZAS_DEFAULT, false, 'off when no device is known (Node, tests)');
assert.equal(bgtPlazasEnabled(''), BGT_PLAZAS_DEFAULT);
assert.equal(bgtPlazasDefault(false), true, 'desktop default on (integrator 2026-11-10)');
assert.equal(bgtPlazasDefault(true), false, 'touch default off until the extract is split per cell');
assert.equal(bgtPlazasEnabled('?bgtPlazas=0', bgtPlazasDefault(false)), false);
assert.equal(bgtPlazasEnabled('?bgtPlazas=1'), true);
assert.equal(bgtPlazasEnabled('?x=2&bgtPlazas=on'), true);
assert.equal(bgtPlazasEnabled('?bgtPlazas=0', true), false);
assert.equal(bgtPlazasEnabled('?bgtPlazas=maybe', true), true);

// Geometry.
const [x, y] = toMetres(4.9, 52.37);
assert.ok(Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6, 'frame origin');
const back = toLonLat(...toMetres(4.83250, 52.38597));
assert.ok(Math.abs(back[0] - 4.8325) < 1e-9 && Math.abs(back[1] - 52.38597) < 1e-9, 'frame round trip');
const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const grown = grow([[square]], 3);
const grownArea = multiArea(grown);
assert.ok(grownArea > 0.97 * (16 * 16 - 4 * 9 + 4 * Math.PI * 9 / 4) && grownArea < 16 * 16, `grow(10 m square, 3 m) ≈ a rounded 16 m square (${grownArea.toFixed(1)} m²)`);
const cut = polygonClipping.difference([[square]], ...strips([[5, -1], [5, 11]], 0.6));
assert.equal(cut.length, 2, 'a fence across the square cuts it in two');
assert.equal(segmentPolygonDistance([20, 5], [30, 5], [square]), 10, 'segment to polygon distance');
assert.equal(segmentPolygonDistance([5, 5], [6, 6], [square]), 0, 'inside is 0');
assert.equal(segmentPolygonDistance([-5, 5], [15, 5], [square]), 0, 'crossing is 0');
const dense: [number, number][] = [[0, 0], [5, 0.01], [10, 0], [10, 10], [5, 10.01], [0, 10], [0, 0]];
assert.equal(simplifyRing(dense, 0.15).length, 5, 'simplify drops near-collinear vertices');

// The raster pipeline: a 10 m square with a 4 m hole, a fence across it, and a growth into a road beside it.
{
  const r = new Raster(-5, -5, 25, 15, 0.25);
  const plaza = new Uint8Array(r.size);
  fillPolygon(r, [square, [[3, 3], [3, 7], [7, 7], [7, 3], [3, 3]]], k => { plaza[k] = 1; });
  const cells = plaza.reduce((t, v) => t + v, 0) * 0.0625;
  assert.ok(Math.abs(cells - 84) < 1, `fill with a hole: ${cells} m² of 84`);
  const { labels, count } = components(r, plaza);
  assert.equal(count, 1);
  const traced = traceLabel(r, labels, 1);
  assert.equal(traced.length, 1, 'one outline');
  assert.equal(traced[0].length, 2, 'with its hole');
  assert.ok(Math.abs(polygonArea(traced[0]) - 84) < 1, `traced area ${polygonArea(traced[0])}`);
  const fenced = plaza.slice();
  markSegment(r, [1.6, -1], [1.6, 11], 0.3, k => { fenced[k] = 0; });
  assert.equal(components(r, fenced).count, 2, 'a 0.6 m fence splits the cells 4-connectedly');
  const diagonal = plaza.slice();
  markSegment(r, [-1, -1], [11, 11], 0.3, k => { diagonal[k] = 0; });
  assert.equal(components(r, diagonal).count, 2, 'and a diagonal fence too');
  const road = new Uint8Array(r.size);
  fillPolygon(r, [[[10, 0], [25, 0], [25, 10], [10, 10], [10, 0]]], k => { road[k] = 1; });
  const dist = distanceFrom(r, plaza);
  const reached = road.reduce((t, v, k) => t + (v && dist[k] <= 3 ? 1 : 0), 0) * 0.0625;
  assert.ok(Math.abs(reached - 30) < 2, `reach 3 m into the road: ${reached} m² of 30`);
}

// The plaza index: a polygon with a hole (a pand on a square), and the grid.
const ky = 111_320, kx = 111_320 * Math.cos(52.37 * Math.PI / 180);
const ll = (mx: number, my: number): [number, number] => [52.37 + my / ky, 4.9 + mx / kx];
const project = (lat: number, lon: number) => ({ x: (lon - 4.9) * kx * 3, y: -(lat - 52.37) * ky * 3 });
const feature: PlazaFeature = {
  name: 'BGT voetgangersgebied', source: 'bgt',
  polygons: [[
    [ll(0, 0), ll(40, 0), ll(40, 40), ll(0, 40), ll(0, 0)],
    [ll(15, 15), ll(25, 15), ll(25, 25), ll(15, 25), ll(15, 15)],
  ]],
};
const index = buildPlazaIndex([feature], project, 3, []);
const q = (mx: number, my: number) => { const [la, lo] = ll(mx, my); const p = project(la, lo); return plazaAt(index, p.x, p.y); };
assert.ok(q(5, 5), 'paving rides');
assert.equal(q(20, 20), null, 'the hole (a pand) does not');
assert.equal(q(14, 20), null, 'nor its inset edge');
assert.ok(q(12, 20), 'paving 3 m off the pand rides');
assert.equal(q(0.5, 20), null, 'the outline keeps its inset');
assert.equal(q(-5, 20), null, 'outside');
const small: PlazaFeature = { source: 'bgt', polygons: [[[ll(100, 100), ll(105, 100), ll(105, 105), ll(100, 105), ll(100, 100)]]] };
assert.equal(buildPlazaIndex([small], project, 3, []).plazas.length, 0, 'a 25 m² BGT sliver is not indexed');
const legacy = buildPlazaIndex([{ name: 'Test square', path: [ll(0, 0), ll(40, 0), ll(40, 40), ll(0, 40), ll(0, 0)] }], project, 3, []);
assert.equal(legacy.plazas[0].holes.length, 0, 'a squares.json ring has no holes');

console.log('bgt plazas: rule, flag, geometry and plaza index ok');

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { centreIsOff, centreOnPaths, clusterPaths, dropOutlyingPaths, pathLengthMetres, type LatLon } from './pathClusters.ts';

const line = (lat: number, lon: number, dLat: number, dLon: number, n: number): LatLon[] =>
  Array.from({ length: n }, (_, i) => [lat + dLat * i, lon + dLon * i] as LatLon);

test('a single piece is returned unchanged', () => {
  const p = [line(52.37, 4.89, 0.001, 0, 5)];
  const r = dropOutlyingPaths(p);
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.paths, p);
});

test('touching pieces form one cluster and nothing is dropped', () => {
  const a = line(52.37, 4.89, 0.001, 0, 10);
  const b = line(52.379, 4.89, 0.001, 0, 10); // starts where a ends
  const r = dropOutlyingPaths([a, b]);
  assert.equal(clusterPaths([a, b]).length, 1);
  assert.equal(r.dropped, 0);
});

test('a piece 18 km away is dropped, a separate stretch 2 km off is kept', () => {
  const main = line(52.37, 4.89, 0.001, 0, 20); // ~2.1 km
  const far = line(52.306, 5.038, 0.001, 0, 12); // ~1.3 km near Weesp
  const near = line(52.395, 4.89, 0.001, 0, 12); // ~1.3 km, 0.7 km north of main's end
  const r = dropOutlyingPaths([main, far, near]);
  assert.equal(r.dropped, 1);
  assert.deepEqual(r.paths, [main, near]);
});

test('the anchor is the longest cluster, and a box centre off the kept paths is re-placed on them', () => {
  const longOne = line(52.37, 4.89, 0.002, 0, 15); // ~3.1 km
  const stub = line(52.30, 5.03, 0.001, 0, 4); // ~0.3 km, 12 km away
  const r = dropOutlyingPaths([stub, longOne]);
  assert.deepEqual(r.paths, [longOne]);
  const boxCentre: LatLon = [52.35, 4.96]; // between the two, on neither
  assert.ok(centreIsOff(boxCentre, r.paths));
  const moved = centreOnPaths(r.paths)!;
  assert.ok(!centreIsOff(moved, r.paths));
  assert.ok(pathLengthMetres(longOne) > 3000);
});

test('the Amsterdam Singel loses its Weesp stubs and keeps the canal', () => {
  const water = JSON.parse(readFileSync(new URL('../../public/data/extracts/amsterdam/water.json', import.meta.url), 'utf8'));
  const list: Array<{ name: string; paths?: LatLon[][] }> = Array.isArray(water) ? water : water.features ?? water.items;
  const singel = list.find((f) => f.name === 'Singel');
  assert.ok(singel?.paths);
  const r = dropOutlyingPaths(singel.paths);
  assert.ok(r.dropped >= 4, `dropped ${r.dropped}`);
  for (const path of r.paths) for (const [, lon] of path) assert.ok(lon < 4.95, `kept a point at lon ${lon}`);
});

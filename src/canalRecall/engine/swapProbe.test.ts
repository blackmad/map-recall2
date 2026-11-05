import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxDistanceM, bucketOf, diffTriangles, drawnIn, triangleHashes, changedIds, countPids, decodePid, encodePid, lngLatBox, rangeHash, summariseSwaps, swapSummaryMarkdown, vertexPids, type SwapRecord } from './swapProbe.ts';

test('object ids round-trip through the RGB the id material writes', () => {
  for (const pid of [1, 255, 256, 65_535, 65_536, 1_234_567]) assert.equal(decodePid(...encodePid(pid)), pid);
  const rgba = new Uint8Array([...encodePid(3), 255, ...encodePid(3), 255, 0, 0, 0, 0, ...encodePid(300), 255]);
  assert.deepEqual([...countPids(rgba)], [[3, 2], [300, 1]]);
});

test('vertex ids mark only the swapped buildings\' ranges', () => {
  assert.deepEqual([...vertexPids(8, [{ start: 1, count: 2, pid: 1 }, { start: 6, count: 5, pid: 2 }])], [0, 1, 1, 0, 0, 0, 2, 2]);
});

test('a rebuilt chunk names only the buildings whose geometry changed', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 5, 5, 5, 6, 5, 5]), layers = new Float32Array([1, 1, 2, 2]);
  const before = new Map([['a', rangeHash([positions, layers], [3, 1], 0, 2)], ['b', rangeHash([positions, layers], [3, 1], 2, 2)]]);
  const moved = Float32Array.from(positions); moved[8] += 0.004; // under a centimetre: the same building
  const same = new Map([['a', rangeHash([moved, layers], [3, 1], 0, 2)], ['b', rangeHash([moved, layers], [3, 1], 2, 2)]]);
  assert.deepEqual(changedIds(before, same), []);
  const restyled = Float32Array.from(layers); restyled[3] = 7;
  const after = new Map([['a', rangeHash([positions, restyled], [3, 1], 0, 2)], ['b', rangeHash([positions, restyled], [3, 1], 2, 2)], ['c', 1]]);
  assert.deepEqual(changedIds(before, after), ['b', 'c']);
  assert.deepEqual(changedIds(after, new Map([['a', after.get('a')!]]), true), ['b', 'c']);
});

test('distance to a building box and buckets', () => {
  const box = lngLatBox({ coordinates: [[[4.9, 52.37], [4.901, 52.37], [4.901, 52.371]]] })!;
  assert.deepEqual(box, [4.9, 52.37, 4.901, 52.371]);
  assert.equal(boxDistanceM(box, [4.9005, 52.3705]), 0);
  assert.ok(Math.abs(boxDistanceM(box, [4.9005, 52.372]) - 110.54) < 0.01);
  assert.equal(bucketOf(0, [0, 30, Infinity]), 0);
  assert.equal(bucketOf(30, [0, 30, Infinity]), 1);
  assert.equal(bucketOf(-1, [0, 30, Infinity]), -1);
});

test('the gate counts swapped objects at least 400 px² within 120 m, never arrivals', () => {
  const records: SwapRecord[] = [
    { t: 1000, kind: 'shell→detail', key: 'near:1/2', objects: [{ id: 'a', distM: 50, areaPx: 5000 }, { id: 'b', distM: 150, areaPx: 9000 }, { id: 'c', distM: 10, areaPx: 399 }, { id: 'd', distM: 10, areaPx: 0 }] },
    { t: 2000, kind: 'shell-arrive', key: 'coarse:1/2', objects: [{ id: 'e', distM: 5, areaPx: 80_000 }] },
    { t: 3000, kind: 'trees', key: 'trees:3', objects: [{ id: 't', distM: 119, areaPx: 400 }] },
  ];
  const s = summariseSwaps(records);
  assert.equal(s.gate.failures, 2);
  assert.equal(s.byKind['shell→detail'].onScreen, 3);
  assert.equal(s.byKind['shell→detail'].gate, 1);
  assert.equal(s.byKind['shell-arrive'].gate, 0);
  assert.deepEqual(s.distance.byKind['shell→detail'], [1, 1, 0, 1, 0, 0]);
  assert.deepEqual(s.top.map(o => o.id), ['e', 'b', 'a', 't', 'c']);
  assert.equal(Object.keys(s.byKind)[0], 'shell-arrive');
  const md = swapSummaryMarkdown(s, 'test');
  assert.match(md, /Gate: swapped objects ≥ 400 px² within 120 m: \*\*2\*\*/);
  assert.match(md, /\| shell→detail \| 1 \| 4 \| 3 \| 1 \|/);
});

test('only what the frame drew is measured: attached to the scene, every ancestor visible', () => {
  const scene = { visible: true, parent: null }, group = { visible: true, parent: scene }, mesh = { visible: true, parent: group };
  assert.equal(drawnIn(mesh, scene), true);
  group.visible = false;
  assert.equal(drawnIn(mesh, scene), false);
  assert.equal(drawnIn({ visible: true, parent: null }, scene), false, 'a model not added yet');
});

test('a rebuild names the faces it added and lost, not the faces it rebuilt identically', () => {
  // Two quads (four triangles); the rebuild reorders the index, rotates one triangle's corners and replaces one face.
  const v = new Uint32Array([11, 12, 13, 14, 21, 22, 23, 24]);
  const before = triangleHashes(v, [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const w = Uint32Array.from(v); w[7] = 99; // one corner of the second quad moved
  const after = triangleHashes(w, [4, 5, 6, 2, 0, 1, 0, 2, 3, 4, 6, 7]);
  const d = diffTriangles(before, after);
  assert.deepEqual(d.added, [3]);
  assert.deepEqual(d.removed, [3]);
  assert.deepEqual(diffTriangles(before, before), { added: [], removed: [] });
});

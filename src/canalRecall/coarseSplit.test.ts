// coarseSplit.ts: runtime coarse shells keyed per z14 tile and world cell (feedback 748b1a8f). A top-up of a tile by a
// new world cell queues only that cell's shell; with ?coarseSplit=0 the whole tile rebuilds, as before.
// Run: node --import tsx --test src/canalRecall/coarseSplit.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CoarseTileIndex, coarseBoxOf, coarseCellOf, coarseKey, coarseSplitEnabled, coarseTileOf, tileBoxOf } from './coarseSplit.js';
import { chunkKeyDistanceM } from './chunkKeyDistance.js';
import { buildingCell, cellBounds } from './world/cellGrid.js';
import { ThreeBuildings } from './threeBuildingsBrowser.js';
import type { Feature } from './threeBuildingFeatures.js';

test('keys: split keys carry the world cell, and every reader gets the z14 tile back', () => {
  assert.equal(coarseKey('8414/5383', '-1_2', true), 'coarse:8414/5383~-1_2');
  assert.equal(coarseKey('8414/5383', '-1_2', false), 'coarse:8414/5383', 'flag off: the tile key, as before');
  assert.equal(coarseKey('8414/5383', null, true), 'coarse:8414/5383', 'no cell: the tile key');
  assert.equal(coarseTileOf('coarse:8414/5383~-1_2'), '8414/5383');
  assert.equal(coarseTileOf('coarse:8414/5383'), '8414/5383');
  assert.equal(coarseTileOf('near:67313/43072'), null);
  assert.equal(coarseCellOf('coarse:8414/5383~-1_2'), '-1_2');
  assert.equal(coarseCellOf('coarse:8414/5383'), null);
  // The settle hold's distance reads the tile of a split key.
  const at: [number, number] = [4.885, 52.375];
  assert.equal(chunkKeyDistanceM('coarse:8414/5383~-1_2', at), chunkKeyDistanceM('coarse:8414/5383', at));
});

test('box: a split key covers its tile cut to its cell', () => {
  const tile = tileBoxOf('8414/5383')!, cell = cellBounds(-1, 2), box = coarseBoxOf('coarse:8414/5383~-1_2')!;
  assert.deepEqual(coarseBoxOf('coarse:8414/5383'), tile);
  assert.ok(box[0] >= tile[0] && box[2] <= tile[2] && box[1] >= tile[1] && box[3] <= tile[3], 'inside the tile');
  assert.ok(box[0] >= cell[0] - 1e-12 && box[2] <= cell[2] + 1e-12 && box[1] >= cell[1] - 1e-12 && box[3] <= cell[3] + 1e-12, 'inside the cell');
  assert.deepEqual(coarseBoxOf('coarse:8414/5383~bad'), tile, 'a malformed cell falls back to the tile');
});

test('flag: desktop on, touch off, ?coarseSplit=0 off, ?coarseSplit=1 on', () => {
  const touch = { matchMedia: () => ({ matches: true }) }, desk = { matchMedia: () => ({ matches: false }) };
  assert.equal(coarseSplitEnabled('', desk), true);
  assert.equal(coarseSplitEnabled('', touch), false);
  assert.equal(coarseSplitEnabled('?coarseSplit=0', desk), false);
  assert.equal(coarseSplitEnabled('?coarseSplit=1', touch), true);
  assert.equal(coarseSplitEnabled('', { ...desk, __canalRecallCoarseSplit: false }), false);
});

test('index: tile questions see every shell of the tile', () => {
  const index = new CoarseTileIndex();
  index.add('coarse:8414/5383~-1_2'); index.add('coarse:8414/5383~-2_2'); index.add('near:1/2');
  assert.deepEqual([...index.keysOf('8414/5383')].sort(), ['coarse:8414/5383~-1_2', 'coarse:8414/5383~-2_2']);
  index.delete('coarse:8414/5383~-1_2'); index.delete('coarse:8414/5383~-2_2');
  assert.equal(index.keysOf('8414/5383').size, 0);
});

// Three small houses in one z14 tile: two in one world cell, the third (the top-up) in the cell to the north.
const box = (id: string, lng: number, lat: number): Feature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[lng, lat], [lng + 0.0001, lat], [lng + 0.0001, lat + 0.00008], [lng, lat + 0.00008], [lng, lat]]] },
  properties: { id, height: 12, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: 'canal' },
});
const a = box('bag:a', 4.8870, 52.3770), b = box('bag:b', 4.8876, 52.3772), c = box('bag:c', 4.8872, 52.3820);

function streamer(split: boolean): any {
  const map = { getZoom: () => 17, triggerRepaint() {}, getCanvas: () => ({}) } as never;
  const tb = new ThreeBuildings(map, {} as never, 'storybook', { detail: 'full' }) as any;
  tb.coarseSplit = split;
  return tb;
}
/** Pretend every queued chunk built and installed (the test has no three.js). */
function installAll(tb: any): void {
  for (const [key, source] of tb.sourceGroups) tb.chunks.set(key, { source, mesh: {}, info: {}, ranges: new Map() });
  tb.pending.clear();
}

test('a top-up by a new world cell queues only that cell’s shell under the split; the whole tile without it', () => {
  assert.notEqual(buildingCell(a.geometry as never), buildingCell(c.geometry as never), 'fixture: c is in another cell');
  assert.equal(buildingCell(a.geometry as never), buildingCell(b.geometry as never), 'fixture: a and b share a cell');
  const tileOf = (f: Feature) => { const [lng, lat] = (f.geometry as any).coordinates[0][0]; const n = 2 ** 14, r = lat * Math.PI / 180; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)}`; };
  assert.equal(tileOf(a), tileOf(c), 'fixture: one z14 tile');
  const tile = tileOf(a);

  const off = streamer(false);
  off.setFeatures([a, b]); installAll(off);
  off.setFeatures([a, b, c]);
  assert.deepEqual([...off.pending.keys()], [`coarse:${tile}`], 'flag off: the tile shell rebuilds with all three');

  const on = streamer(true);
  on.setFeatures([a, b]);
  const first = [...on.sourceGroups.keys()].filter((k: string) => k.startsWith('coarse:'));
  assert.deepEqual(first, [coarseKey(tile, buildingCell(a.geometry as never), true)], 'one shell for the first cell');
  installAll(on);
  on.setFeatures([a, b, c]);
  assert.deepEqual([...on.pending.keys()], [coarseKey(tile, buildingCell(c.geometry as never), true)], 'split: only the new cell builds');
  // Tile-level questions still see the tile drawn; the far tier asks per cell.
  assert.equal(on.drawsResidentCity([tile]), false, 'not ready (no atlas) in the test');
  assert.equal(on.coarseMeshIn(tile), true);
  assert.equal(on.tierAt(4.8871, 52.3771).owner, 'coarse');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createCityLook} from '../look/cityLook.ts';
import {coverUnion, pandOfFace, pandVertices, recipeTilesEnabled, RefCache, TileBuildings, wantedTiles, type IndexFile} from './runtime.ts';
import {mergeBuckets, mul, partHash, rotationY, splitRoles, toCanonical, transformBuckets, translation, type BucketMap} from './soup.ts';
import {writeBucketUnit, writeMeshTile} from './writeTile.ts';
import {fromFrame, tileFrame, tileId, tileOf} from './tiles.ts';
import type {MeshTileMeta} from './schema.ts';

const BILDER: [number, number] = [4.8712833, 52.3681674];

test('flag: ?recipeTiles=1 only', () => {
  assert.equal(recipeTilesEnabled('?recipeTiles=1'), true);
  assert.equal(recipeTilesEnabled('?recipeTiles=0'), false);
  assert.equal(recipeTilesEnabled(''), false);
});

test('wanted tiles: the 2x2 block around the centre, only published ones, held while near', () => {
  const t = tileOf(...BILDER, 16), f = tileFrame(t);
  const index: IndexFile = {version: 1, tiles: {[tileId(t)]: {bytes: 1, pands: 1, triangles: 1, units: []}, [`16/${t.x + 1}/${t.y}`]: {bytes: 1, pands: 1, triangles: 1, units: []}}, units: {}};
  const m = 1 / 2 ** 16 / f.units, at = (e: number, s: number) => { const [lng, lat] = fromFrame(f, e * m, s * m); return {lng, lat}; };
  const a = wantedTiles(index, at(0.45, 0.2), null);
  assert.deepEqual(a.tiles.sort(), [tileId(t), `16/${t.x + 1}/${t.y}`].sort());
  assert.notDeepEqual(wantedTiles(index, at(0.45, -0.1), null).block, a.block);
  const held = wantedTiles(index, at(0.45, -0.1), a.block);
  assert.deepEqual(held.block, a.block, 'a step across the tile edge keeps the block');
  assert.deepEqual(wantedTiles(index, at(-3, -3), null).tiles, [], 'nothing published there');
});

test('refcounts: one load per key, freed when the last tile lets go', async () => {
  const loads: string[] = [], freed: string[] = [];
  const cache = new RefCache<string>(async k => { loads.push(k); return `v:${k}`; }, (_v, k) => freed.push(k));
  assert.equal(await cache.acquire('u1'), 'v:u1');
  await cache.acquire('u1');
  await cache.acquire('u2');
  assert.deepEqual(loads, ['u1', 'u2']);
  cache.release('u1');
  assert.deepEqual(freed, []);
  cache.release('u1');
  assert.deepEqual(freed, ['u1']);
  assert.equal(cache.size, 1);
});

test('ranges: face → pand, pand → its own vertices; covers union is sorted and unique', () => {
  const ranges = [[0, 0, 2], [1, 2, 1]];
  assert.equal(pandOfFace(ranges, 1), 0);
  assert.equal(pandOfFace(ranges, 2), 1);
  assert.equal(pandOfFace(ranges, 3), -1);
  const verts = pandVertices([0, 1, 2, 0, 2, 3, 4, 5, 6], ranges);
  assert.deepEqual([...verts.get(0)!], [0, 1, 2, 3]);
  assert.deepEqual([...verts.get(1)!], [4, 5, 6]);
  const meta = (covers: string[][]) => ({covers} as MeshTileMeta);
  assert.deepEqual(coverUnion([meta([['b', 'a']]), meta([['a'], ['c']])]), ['a', 'b', 'c']);
});

function box(x0: number): BucketMap {
  const b: BucketMap = new Map(), q = (key: string, slot: string, p: number[][], n: number[]) => {
    let x = b.get(key); if (!x) b.set(key, x = {key, slot, tint: '#' + key.split('_')[0], surface: 'wall', positions: [], normals: [], uvs: []});
    for (const i of [0, 1, 2, 0, 2, 3]) { x.positions.push(...p[i]); x.normals.push(...n); x.uvs.push(p[i][0], p[i][1]); }
  };
  q('8a4a3a_brick', 'brick', [[x0, 4, 0], [x0 + 6, 4, 0], [x0 + 6, 14, 0], [x0, 14, 0]], [0, 0, 1]);
  q('2a3a42_door', 'door', [[x0, 0, 0], [x0 + 6, 0, 0], [x0 + 6, 4, 0], [x0, 4, 0]], [0, 0, 1]);
  q('555b66_slate', 'slate', [[x0, 14, 0], [x0 + 6, 14, 0], [x0 + 6, 14, -10], [x0, 14, -10]], [0, 1, 0]);
  return b;
}

test('TileBuildings: loads a tile and its unit, hides covers only once drawn, replaces specs, highlights per pand, frees on leave', async () => {
  // A tile with two houses whose bodies are one instanced unit, written by the real writer.
  const t = tileOf(...BILDER, 16), f = tileFrame(t), toTile = mul(translation(5, 0, 5), rotationY(0.3));
  const roles = [box(0), box(6)].map(b => splitRoles(b, {groundTopM: 4, eavesM: 14})), body = roles.map(r => partHash(r.get('body')!));
  const unit = await writeBucketUnit('ptest', toCanonical(roles[0].get('body')!, body[0].origin));
  const meta: MeshTileMeta = {version: 1, tile: [16, t.x, t.y], anchor: f.anchor, pands: ['0363100012000001', '0363100012000002'], covers: [['NL.IMBAG.Pand.0363100012000001'], ['NL.IMBAG.Pand.0363100012000002', 'w42']], specs: ['chunk-face-test'], units: [{hash: 'ptest', triangles: 2}], names: ['A 1', 'A 3']};
  const tile = await writeMeshTile(meta, roles.map((r, pand) => ({pand, buckets: transformBuckets(mergeBuckets(...[...r].filter(([k]) => k !== 'body').map(([, b]) => b)), toTile)})),
    [{hash: 'ptest', bounds: unit.bounds, items: body.map((b, pand) => ({matrix: mul(toTile, translation(...b.origin)), pand}))}]);
  const files: Record<string, Uint8Array> = {[`building-mesh/${tileId(t)}.glb`]: tile.bytes, 'units/ptest.glb': unit.bytes};
  const index: IndexFile = {version: 1, tiles: {[tileId(t)]: {bytes: tile.bytes.length, pands: 2, triangles: 0, units: ['ptest']}}, units: {ptest: {bytes: unit.bytes.length, triangles: 2}}};
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ok: true, json: async () => index})) as any;
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const hidden: string[][] = [], specs: Set<string>[] = [], registered: any[] = [];
  const tb = new TileBuildings({
    THREE, baseUrl: 'http://x/recipe-tiles/', lit: true, cityLook: createCityLook(THREE, {size: 4}),
    frame: {register: (id: string, p: any) => { registered.push({id, p}); return () => registered.splice(0); }, constructor: {setShadows() {}}},
    loadGltf: async (url: string) => { const key = url.replace('http://x/recipe-tiles/', ''), b = files[key]; if (!b) throw Error(`404 ${key}`); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, ''); },
    getCentre: () => ({lng: f.anchor[0], lat: f.anchor[1]}),
    setHidden: ids => { hidden.push(ids); return true; },
    setReplacedSpecs: ids => specs.push(ids),
    repaint() {},
  });
  try {
    await tb.start();
    assert.equal(registered[0].id, 'recipe-tiles');
    for (let i = 0; i < 100 && !tb.stats().ready; i++) await new Promise(r => setTimeout(r, 10));
    tb.update(true);
    const s = tb.stats();
    assert.equal(s.ready, 1);
    assert.equal(s.units, 1);
    assert.equal(s.instances, 2);
    assert.equal(s.draws, 2, 'one merged draw + one instanced unit');
    assert.deepEqual(hidden.at(-1), ['NL.IMBAG.Pand.0363100012000001', 'NL.IMBAG.Pand.0363100012000002', 'w42']);
    assert.deepEqual([...specs.at(-1)!], ['chunk-face-test']);
    // Every merged vertex carries the city-look attributes and the runtime's own hidden flag.
    const merged = tb.root.children[0].children.find((o: any) => o.isMesh && !o.isInstancedMesh);
    for (const name of ['layer', 'tint', 'hidden']) assert.ok(merged.geometry.getAttribute(name), name);
    assert.ok(merged.material.userData.cityLook);
    // Highlight pand 2 by an id it covers: its merged vertices go to 2, its instance becomes a highlighted copy.
    tb.setHighlighted(['w42']);
    const h = merged.geometry.getAttribute('hidden').array as Uint8Array;
    assert.ok(h.includes(2) && h.includes(0));
    assert.equal(tb.root.children[0].children.filter((o: any) => o.name === 'recipe-tile/highlight').length, 1);
    tb.setHighlighted([]);
    assert.equal(tb.root.children[0].children.filter((o: any) => o.name === 'recipe-tile/highlight').length, 0);
    // Leaving: the camera moves far away; the tile goes, its unit is freed, nothing stays hidden.
    (tb as any).host.getCentre = () => ({lng: 4.9, lat: 52.4});
    tb.update(true);
    assert.equal(tb.stats().tiles.length, 0);
    assert.equal(tb.stats().units, 0);
    tb.update(true);
    assert.deepEqual(hidden.at(-1), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

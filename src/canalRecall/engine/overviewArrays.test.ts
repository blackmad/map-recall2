import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { decodeOverview, type OverviewData } from '../ownMap/overviewFormat';
import { lineGeometry, polygonGeometry } from '../ownMap/layers';
import { buildOverview, overviewRecipes, railGroups } from '../ownMap/overviewArrays';
import { rawTiles } from '../rendererShared/tiledGeometry';
import { geometryOf, OverviewLayer, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES } from './overviewLayer';

const FILE = 'public/data/extracts/amsterdam/own-map-v1/overview.json.gz';
const have = existsSync(FILE);
const load = (): OverviewData => decodeOverview(JSON.parse(gunzipSync(readFileSync(FILE)).toString()));

const same = (a: ArrayLike<number> & { constructor: unknown }, b: ArrayLike<number> & { constructor: unknown }, what: string) => {
  assert.equal(a.constructor, b.constructor, `${what}: array type`);
  assert.equal(a.length, b.length, `${what}: length`);
  assert.ok(Buffer.compare(Buffer.from((a as Uint8Array).buffer, (a as Uint8Array).byteOffset, (a as Uint8Array).byteLength), Buffer.from((b as Uint8Array).buffer, (b as Uint8Array).byteOffset, (b as Uint8Array).byteLength)) === 0, `${what}: bytes`);
};
const sameGeometry = (g: THREE.BufferGeometry, ref: THREE.BufferGeometry, what: string) => {
  assert.deepEqual(Object.keys(g.attributes), Object.keys(ref.attributes), `${what}: attributes`);
  for (const k of Object.keys(ref.attributes)) {
    assert.equal(g.attributes[k].itemSize, ref.attributes[k].itemSize, `${what}.${k} itemSize`);
    same(g.attributes[k].array as Float32Array, ref.attributes[k].array as Float32Array, `${what}.${k}`);
  }
  same(g.index!.array as Uint32Array, ref.index!.array as Uint32Array, `${what}.index`);
  assert.deepEqual([...g.boundingSphere!.center.toArray(), g.boundingSphere!.radius], [...ref.boundingSphere!.center.toArray(), ref.boundingSphere!.radius], `${what}: bounding sphere`);
};

// #129: the overview geometry moved to the worker pool. Its arrays are byte-identical to what polygonGeometry /
// lineGeometry built on the main thread (the inputs below are the constructor's, as it was), and so are its tiles.
test('overview arrays: every geometry and its span tiles equal the main-thread build, byte for byte', { skip: !have }, () => {
  const data = load(), [x0, y0, x1, y1] = data.bounds, pad = 20_000;
  const reference: Record<string, () => THREE.BufferGeometry> = {
    land: () => polygonGeometry([[[[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]]]]),
    water: () => polygonGeometry(data.water),
    parks: () => polygonGeometry(data.parks.flatMap(p => p.rings.map(r => [r]))),
    piers: () => polygonGeometry(data.piers.map(r => [r])),
    pierLines: () => lineGeometry(data.pierLines),
  };
  for (const l of data.landuse) reference[`landuse:${l.cls}`] ??= () => polygonGeometry(data.landuse.filter(m => m.cls === l.cls).map(m => m.rings));
  for (const g of railGroups(data)) reference[`rail:${g.key}`] = () => lineGeometry(g.lines);
  for (const s of data.streets) reference[`street:${s.cls}`] ??= () => lineGeometry(data.streets.filter(t => t.cls === s.cls).map(t => t.points));
  const recipes = overviewRecipes(data), built = buildOverview(data, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES);
  assert.ok(recipes.length >= 10, `${recipes.length} geometries`);
  let tiled = 0;
  for (const [i, r] of recipes.entries()) {
    const make = reference[r.id];
    if (!make) { assert.equal(built[i].index.length, 0, `${r.id}: only an empty street class has no reference`); continue; }
    const ref = make(), g = geometryOf(built[i]);
    sameGeometry(g, ref, r.id);
    const tiles = rawTiles(ref, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES);
    assert.equal(!!built[i].tiles, !!tiles, `${r.id}: tiled`);
    if (tiles) {
      tiled++;
      assert.equal(built[i].tiles!.length, tiles.length);
      built[i].tiles!.forEach((t, k) => { same(t.indices, tiles[k].indices, `${r.id} tile ${k}`); assert.deepEqual([t.center, t.radius, t.cell], [tiles[k].center, tiles[k].radius, tiles[k].cell]); });
    }
  }
  assert.ok(tiled >= 3, `${tiled} geometries tiled`);
});

test('OverviewLayer: built from the pool\'s arrays (as transferred) draws the same meshes as built on the main thread', { skip: !have }, () => {
  const data = load(), view = { center: () => ({ lng: 4.89, lat: 52.37 }), zoom: () => 15 };
  const pooled = structuredClone(buildOverview(data, OVERVIEW_TILES, OVERVIEW_TILE_MIN_TRIANGLES));
  const a = new OverviewLayer(data, view), b = new OverviewLayer(data, view, pooled);
  const meshes = (l: OverviewLayer) => { const out: THREE.Mesh[] = []; l.root.traverse(o => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };
  const ma = meshes(a), mb = meshes(b);
  assert.equal(mb.length, ma.length);
  ma.forEach((m, i) => {
    assert.equal(mb[i].renderOrder, m.renderOrder);
    sameGeometry(mb[i].geometry, m.geometry, `mesh ${i}`);
    assert.deepEqual(JSON.stringify(mb[i].geometry.userData), JSON.stringify(m.geometry.userData), `mesh ${i} spans`);
  });
});

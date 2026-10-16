// The overview tiles (src/canalRecall/overviewTiles/): the flat map's colours are the own ground's, per class and per
// ground look; the published tileset is baked in the page's default palette; the tile maths and the rasteriser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { groundTokens } from './sunny.ts';
import { GROUND_LOOKS, GROUND_LOOK_DEFAULT, groundPalette } from '../ownGround/groundLook.ts';
import { GROUND_LAYERS, type BuiltCell, type GroundLayer } from '../ownGround/groundCell.ts';
import { basemapGroundColour } from '../ownGround/basemapPalette.ts';
import { flatLayerTones, overviewLayerColours, OVERVIEW_SKIPPED, toneRgb } from '../overviewTiles/layerColours.ts';
import { fillPolygons, layerId, layerOfId, rasterLayerIds, ROOF_ID } from '../overviewTiles/raster.ts';
import { footprintTone } from '../overviewTransition/basemapOverview.ts';
import { isEmptyTile, lngLatOfTile, parentTile, renderTile, tileOf, TILE_PX } from '../overviewTiles/tiles.ts';
import { overviewTilesBeforeId, overviewTilesPlan, tilesetMismatch, OVERVIEW_TILES_DIR, type OverviewTilesManifest } from '../overviewTiles/tileset.ts';

const same = (a: readonly number[] | undefined, b: readonly number[]) => assert.deepEqual([...(a ?? [])], [...b]);

test('every ground class takes the ground tokens in every ground look', () => {
  for (const look of GROUND_LOOKS) {
    const palette = groundPalette(look), T = groundTokens(palette), c = overviewLayerColours(palette, GROUND_LAYERS);
    same(c.water, toneRgb(T.water));
    same(c.land, toneRgb(T.land));
    same(c.asphalt, toneRgb(T.road));
    same(c.paving, toneRgb(T.pavement));
    same(c.park, toneRgb(T.park));
    same(c.cycle, toneRgb(T.cycle));
    same(c.klinker, toneRgb(T.klinker));
    same(c.lawn, palette.tones.lawn);
    same(c.pond, toneRgb(palette.tones.pond));
    // The tiles and the fading ground read one table: every flat tone the blend uses is the tile colour.
    const flat = flatLayerTones(palette);
    for (const layer of GROUND_LAYERS) {
      if (OVERVIEW_SKIPPED.has(layer)) { assert.equal(c[layer], undefined, `${layer} is left out of the raster`); continue; }
      const t = flat[layer];
      if (t && t !== 'vertex') same(c[layer], toneRgb(t));
      else assert.ok(c[layer], `${look}: ${layer} has a vertex tone`);
    }
  }
});

test('the basemap patches beyond the tiles wear the same land, water and park', () => {
  for (const look of GROUND_LOOKS) {
    const palette = groundPalette(look), c = overviewLayerColours(palette, GROUND_LAYERS);
    same(toneRgb(basemapGroundColour({ id: 'background', type: 'background' }, palette)!), c.land!);
    same(toneRgb(basemapGroundColour({ id: 'water', type: 'fill', 'source-layer': 'water' }, palette)!), c.water!);
    same(toneRgb(basemapGroundColour({ id: 'park', type: 'fill', 'source-layer': 'park' }, palette)!), c.park!);
  }
});

const manifestFor = (look: typeof GROUND_LOOK_DEFAULT): OverviewTilesManifest => ({
  version: 1, look, colours: overviewLayerColours(groundPalette(look), GROUND_LAYERS), roof: footprintTone(), minzoom: 11, maxzoom: 16,
  bounds: [4.7, 52.2, 5.1, 52.5], tiles: 1, bytes: 1, built: '', attribution: '',
});

test('tiles baked in one palette are refused under another', () => {
  assert.deepEqual(tilesetMismatch(manifestFor('bright'), 'bright'), []);
  assert.ok(tilesetMismatch(manifestFor('bright'), 'legacy-ish').includes('water'));
  assert.deepEqual(tilesetMismatch({ ...manifestFor('bright'), roof: [0, 0, 0] }, 'bright'), ['roof']);
  const plan = overviewTilesPlan(manifestFor('bright'), 'http://x/root', [], 'measured');
  assert.ok('skip' in plan);
  assert.ok('skip' in overviewTilesPlan(null, 'http://x/root', []));
  const ok = overviewTilesPlan(manifestFor('bright'), 'http://x/root', [], 'bright');
  assert.ok(!('skip' in ok) && (ok.source.tiles as string[])[0] === `http://x/root/${OVERVIEW_TILES_DIR}/{z}/{x}/{y}.png`);
});

test('the published tileset is baked in the default palette (re-run the generator after a palette change)', { skip: !fs.existsSync(`public/data/extracts/amsterdam/${OVERVIEW_TILES_DIR}/manifest.json`) }, () => {
  const m = JSON.parse(fs.readFileSync(`public/data/extracts/amsterdam/${OVERVIEW_TILES_DIR}/manifest.json`, 'utf8')) as OverviewTilesManifest;
  assert.equal(m.look, GROUND_LOOK_DEFAULT);
  assert.deepEqual(tilesetMismatch(m, GROUND_LOOK_DEFAULT), []);
});

test('the tiles sit above the basemap ground and flat footprints, below its 3D buildings and labels', () => {
  const layers = [
    { id: 'background', type: 'background' }, { id: 'park', type: 'fill', 'source-layer': 'park' }, { id: 'water', type: 'fill', 'source-layer': 'water' },
    { id: 'road_minor', type: 'line', 'source-layer': 'transportation' }, { id: 'building', type: 'fill', 'source-layer': 'building' },
    { id: 'cycle-tracks', type: 'line', source: 'cycle-tracks' }, { id: 'building-3d', type: 'fill-extrusion', 'source-layer': 'building' },
    { id: 'road_label', type: 'symbol', 'source-layer': 'transportation_name' },
  ];
  assert.equal(overviewTilesBeforeId(layers), 'cycle-tracks');
  assert.equal(overviewTilesBeforeId(layers.slice(0, 5)), undefined);
});

test('tile maths: a point lies in its tile; pyramids average by coverage', () => {
  const [x, y] = tileOf(4.88262, 52.37713, 16);
  const [w, n] = lngLatOfTile(x, y, 16), [e, s] = lngLatOfTile(x + 1, y + 1, 16);
  assert.ok(w <= 4.88262 && 4.88262 < e && s < 52.37713 && 52.37713 <= n);
  const full = renderTile(16, x, y, 2, () => [10, 20, 30]);
  assert.deepEqual([...full.slice(0, 4)], [10, 20, 30, 255]);
  const half = renderTile(16, x, y, 2, (lng) => (lng < (w + e) / 2 ? [200, 100, 0] : null));
  assert.deepEqual([...half.slice(0, 4)], [200, 100, 0, 255]);
  assert.equal(half[(TILE_PX - 1) * 4 + 3], 0);
  const p = parentTile([full, null, null, full]);
  assert.deepEqual([...p.slice(0, 4)], [10, 20, 30, 255]);
  assert.equal(p[(TILE_PX - 1) * 4 + 3], 0);
  assert.ok(isEmptyTile(parentTile([null, null, null, null])));
});

test('the rasteriser keeps the topmost layer, and the higher draw rank within 2 cm', () => {
  const quad = (z: number) => ({ positions: new Float32Array([0, 0, z, 10, 0, z, 10, 10, z, 0, 10, z]), normals: new Float32Array(12), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
  const cell = (layers: Partial<Record<GroundLayer, ReturnType<typeof quad>>>) => ({ key: 't', lod: 0, rect: [0, 0, 10, 10], layers, mask: null, stats: {} }) as unknown as BuiltCell;
  const at = (c: BuiltCell, skip?: Set<GroundLayer>) => layerOfId(rasterLayerIds([c], 0, 0, 10, 10, 1, skip)[55]);
  assert.equal(at(cell({ land: quad(0), asphalt: quad(0.01) })), 'asphalt');
  assert.equal(at(cell({ asphalt: quad(0.01), land: quad(0) })), 'asphalt');
  assert.equal(at(cell({ land: quad(0.5), asphalt: quad(0) })), 'land');
  assert.equal(at(cell({ land: quad(0), paint: quad(0.01) }), OVERVIEW_SKIPPED as Set<GroundLayer>), 'land');
  assert.equal(layerOfId(layerId('water')), 'water');
});

test('footprints fill by pixel centre, holes left open', () => {
  const out = new Uint8Array(100);
  // A 10 m square with a 4 m hole, 1 m pixels over [0, 10]².
  fillPolygons(out, [[[[0, 0], [10, 0], [10, 10], [0, 10]], [[3, 3], [7, 3], [7, 7], [3, 7]]]], 0, 0, 10, 10, 1, ROOF_ID);
  assert.equal(out[0], ROOF_ID);
  assert.equal(out[5 * 10 + 5], 0);
  assert.equal(out.filter(v => v === ROOF_ID).length, 100 - 16);
});

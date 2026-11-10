// Open ground (lane open-ground-look 2026-11-10): the BGT classifier, the open-ground-v1 extract and its named spots.
//   node --import tsx --test src/canalRecall/ownGround/groundSurface.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { BARE_GRASS_SHARE, ERF_GRASS_SHARE, GROUND_SURFACE_CLASSES, groundSurface, needsAerial, openGroundCellProblems, OPEN_GROUND_COVERS, OPEN_GROUND_EXTRACT, OPEN_GROUND_LAYER, OPEN_GROUND_TOTAL_BUDGET_GZ, type OpenGroundCell, type OpenGroundManifest } from './groundSurface';
import { OPEN_GROUND_SPOTS } from './openGroundRegressions';
import { decodeLine, inRings, PARK_LIFT } from './parks';
import { GroundStore, toLocal } from './groundStore';
import { buildCell, layersAt, GROUND_LAYERS, PARK_RANK, CUT_CHANNEL } from './groundCell';
import { gardenTone, groundPalette, GROUND_LOOK_DEFAULT, luma709 } from './groundLook';
import { flatLayerTones } from '../overviewTiles/layerColours';

const ROOT = 'public/data/extracts/amsterdam';
const DIR = `${ROOT}/${OPEN_GROUND_EXTRACT}`;
const haveExtract = existsSync(`${DIR}/cells.json`) && existsSync(`${ROOT}/own-ground-osm-v1/cells.json`);
const read = async (path: string) => { const b = readFileSync(`${ROOT}/${path}`); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const cellOf = (key: string): OpenGroundCell | null => existsSync(`${DIR}/cells/${key}.json.gz`) ? JSON.parse(gunzipSync(readFileSync(`${DIR}/cells/${key}.json.gz`)).toString()) as OpenGroundCell : null;

test('groundSurface: every BGT polygon is one of the seven classes, and only open ground has a cover', () => {
  const b = (fysiek_voorkomen: string, plus_fysiek_voorkomen: string | null = null) => ({ fysiek_voorkomen, plus_fysiek_voorkomen });
  const w = (functie: string) => ({ functie, fysiek_voorkomen: 'gesloten verharding' });
  assert.deepEqual(groundSurface('wegdeel', w('rijbaan lokale weg')), { cls: 'road', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('parkeervlak')), { cls: 'road', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('OV-baan')), { cls: 'road', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('plein')), { cls: 'paved-plaza', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('voetgangersgebied')), { cls: 'paved-plaza', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('voetpad')), { cls: 'path', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('fietspad')), { cls: 'path', cover: null });
  assert.deepEqual(groundSurface('wegdeel', w('spoorbaan')), { cls: 'other', cover: null });
  assert.deepEqual(groundSurface('ondersteunendwegdeel', { functie: 'berm', fysiek_voorkomen: 'groenvoorziening' }), { cls: 'verge', cover: null });
  assert.deepEqual(groundSurface('begroeidterreindeel', b('groenvoorziening')), { cls: 'grass', cover: 'meadow' });
  assert.deepEqual(groundSurface('begroeidterreindeel', b('grasland overig')), { cls: 'grass', cover: 'meadow' });
  assert.deepEqual(groundSurface('begroeidterreindeel', b('rietland')), { cls: 'grass', cover: 'meadow' });
  assert.deepEqual(groundSurface('begroeidterreindeel', b('groenvoorziening', 'heesters')), { cls: 'grass', cover: 'shrub' });
  assert.deepEqual(groundSurface('begroeidterreindeel', b('loofbos')), { cls: 'grass', cover: 'shrub' });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('zand')), { cls: 'bare', cover: 'sand' });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('onverhard')), { cls: 'bare', cover: 'bare' });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('half verhard')), { cls: 'bare', cover: 'bare' });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('gesloten verharding')), { cls: 'paved-plaza', cover: null });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('open verharding')), { cls: 'paved-plaza', cover: null });
  // A yard is grass only when the aerial shows it green; unknown or paved stays the land's paving grey.
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('erf')), { cls: 'other', cover: null });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('erf'), ERF_GRASS_SHARE - 0.01), { cls: 'other', cover: null });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('erf'), ERF_GRASS_SHARE), { cls: 'grass', cover: 'meadow' });
  // Bare ground the aerial shows grown over is meadow (Moermanskkade: BGT zand, meadow on the photo).
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('zand'), BARE_GRASS_SHARE), { cls: 'grass', cover: 'meadow' });
  assert.deepEqual(groundSurface('onbegroeidterreindeel', b('zand'), BARE_GRASS_SHARE - 0.01), { cls: 'bare', cover: 'sand' });
  assert.ok(needsAerial('onbegroeidterreindeel', 'erf') && needsAerial('onbegroeidterreindeel', 'zand') && !needsAerial('onbegroeidterreindeel', 'open verharding') && !needsAerial('begroeidterreindeel', 'groenvoorziening'));
  assert.equal(GROUND_SURFACE_CLASSES.length, 7);
});

test('groundSurface: each cover draws in a known ground layer that the water mask cuts and the overview tints', () => {
  const flat = flatLayerTones(groundPalette(GROUND_LOOK_DEFAULT));
  for (const k of OPEN_GROUND_COVERS) {
    const layer = OPEN_GROUND_LAYER[k];
    assert.ok(GROUND_LAYERS.includes(layer), `${k} → ${layer} is a ground layer`);
    assert.equal(CUT_CHANNEL[layer], 0, `${layer} is cut by the water channel`);
    assert.ok(PARK_RANK[layer] !== undefined, `${layer} has a draw rank between the areas and the streets`);
    assert.ok(flat[layer], `${layer} has an overview tone`);
  }
  // 'bare' is appended: the layer ids before it stay.
  assert.equal(GROUND_LAYERS[GROUND_LAYERS.length - 1], 'bare');
  assert.ok(PARK_LIFT.lawn <= 0.018 && PARK_LIFT.sand >= 0.022);
  // The meadow is the courtyard green: the orthophoto's sunlit open grass measured luma 125 (measure-open-ground-tones.ts).
  const G = groundPalette(GROUND_LOOK_DEFAULT).tones;
  assert.ok(Math.abs(luma709(gardenTone(G.lawn)) - 125) <= 3, `garden luma ${luma709(gardenTone(G.lawn)).toFixed(0)}`);
  // Open ground reads apart from the paving-grey land by luma (the user's complaint: lawns looked rideable).
  for (const tone of [gardenTone(G.lawn), G.bare.base]) assert.ok(luma709(G.land.base) - luma709(tone) >= 25, `${tone} vs land ${G.land.base}`);
});

test('open-ground-v1: the published cells are valid and within the budget', { skip: !haveExtract }, () => {
  const m = JSON.parse(readFileSync(`${DIR}/cells.json`, 'utf8')) as OpenGroundManifest;
  assert.equal(m.version, 1);
  let bytes = 0;
  for (const k of m.cells) {
    const raw = readFileSync(`${DIR}/cells/${k}.json.gz`);
    bytes += raw.length;
    const c = JSON.parse(gunzipSync(raw).toString());
    assert.deepEqual(openGroundCellProblems(c), [], k);
    assert.equal(c.key, k);
  }
  assert.ok(bytes <= OPEN_GROUND_TOTAL_BUDGET_GZ, `${(bytes / 1048576).toFixed(1)} MB`);
});

test('open-ground-v1: the named spots (feedback 637f346b, 4f47f105, 020e2132, 28ae61fb; Nieuwmarkt stays paving)', { skip: !haveExtract }, () => {
  for (const spot of OPEN_GROUND_SPOTS) {
    const cell = cellOf(spot.cell);
    for (const p of spot.probes) {
      const [x, y] = toLocal(p.lng, p.lat);
      const hits = (cell?.areas ?? []).filter(a => inRings(a.r.map(decodeLine), x, y)).map(a => a.k);
      assert.deepEqual(hits, p.expect ? [p.expect] : [], `${spot.name}: ${p.what}`);
    }
  }
});

test('regression (streamed cell): the open ground draws over the land, off it draws the land; an empty extract changes nothing', { skip: !haveExtract }, async () => {
  const on = new GroundStore(read, { roads: true }), off = new GroundStore(read, { roads: true, openGround: false });
  await on.init(); await off.init();
  for (const spot of OPEN_GROUND_SPOTS) for (const p of spot.probes) {
    const [x, y] = toLocal(p.lng, p.lat), key = on.cellAt(x, y);
    const [a, b] = [buildCell(await on.cellInput(key, 0)), buildCell(await off.cellInput(key, 0))];
    const top = layersAt(a, x, y).top, before = layersAt(b, x, y).top;
    if (p.expect) {
      assert.equal(top, OPEN_GROUND_LAYER[p.expect], `${spot.name}: ${p.what} (before: ${before})`);
      // The land quads wholly inside a ring are culled (a narrow strip keeps the land under it, as courtyards do).
      if (spot.name === 'moermanskkade') assert.ok(!layersAt(a, x, y).hits.some(h => h.layer === 'land'), `${spot.name}: the land under the lot is culled`);
    } else assert.equal(top, before, `${spot.name}: ${p.what} is unchanged`);
  }
  // A cell whose neighbourhood has no open ground builds byte-identical: an empty extract cell is the same build.
  const [x, y] = toLocal(4.9004, 52.37225), key = off.cellAt(x, y);
  const input = await off.cellInput(key, 0);
  assert.equal(input.openGround, undefined);
  const empty: OpenGroundCell = { version: 1, key, areas: [] };
  const plain = buildCell(input), withEmpty = buildCell({ ...input, openGround: empty, openGroundAround: [empty] });
  for (const layer of GROUND_LAYERS) {
    const m1 = plain.layers[layer], m2 = withEmpty.layers[layer];
    assert.equal(!!m1, !!m2, layer);
    if (m1 && m2) { assert.deepEqual(m2.positions, m1.positions, layer); assert.deepEqual(m2.indices, m1.indices, layer); }
  }
});

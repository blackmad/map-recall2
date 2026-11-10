import { test } from 'node:test';
import assert from 'node:assert/strict';

// Flag on: set before the modules load (the tall preset joins BAY_STYLES at import, as in the browser and worker).
(globalThis as { __canalRecallNewbuildFamily?: boolean }).__canalRecallNewbuildFamily = true;
const { BAY_ENTRIES, BAY_LAYER_COUNT, BAY_STYLES, bayLayer, bayLookFor, bayVariant } = await import('./bayLook.js');
const { SHOP_KINDS, bayTextures, releaseBayTextures } = await import('./bayTextures.js');
const { PROCEDURAL_RECIPE_LAYER_OFFSET } = await import('./streetFacadeRendering.js');
const { lookAtlasLayers } = await import('./look/paintLookAtlas.js');
const { createCanvas } = await import('@napi-rs/canvas');
const { createHash } = await import('node:crypto');
const { BAND_PRESET_INDEX, TALL_PRESET_INDEX, contemporaryLookFor, ownContemporaryWall } = await import('./contemporaryFamily.js');
const { buildFeatureChunk, meshBuildingFor, withSetbackCrown } = await import('./threeBuildingFeatures.js');
const { lightnessOfHex } = { lightnessOfHex: (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; } };

const HOUTHAVEN: [number, number] = [4.8775, 52.3935], IJBURG: [number, number] = [4.99, 52.356];
const ids = Array.from({ length: 400 }, (_, i) => `NL.IMBAG.Pand.03631000122${String(i).padStart(5, '0')}`);

test('on: the tall French-balcony and balcony-band presets are in the array', () => {
  assert.equal(BAY_STYLES.modern.length, 11);
  assert.equal(BAY_STYLES.modern[TALL_PRESET_INDEX].facadeAssembly, 'french-balcony');
  assert.equal(BAY_STYLES.modern[BAND_PRESET_INDEX].facadeAssembly, 'balcony-band');
  assert.ok(BAY_ENTRIES.some(e => e.archetype === 'modern' && e.style === TALL_PRESET_INDEX && e.kind === 'upper'));
  assert.ok(BAY_ENTRIES.some(e => e.archetype === 'modern' && e.style === BAND_PRESET_INDEX && e.kind === 'upper'));
});

test('on: the bay cells fit byte layer indices in every array (procedural: cells, roofs, bays, glass block)', () => {
  assert.ok(PROCEDURAL_RECIPE_LAYER_OFFSET + BAY_LAYER_COUNT + 1 <= 256, `procedural ${PROCEDURAL_RECIPE_LAYER_OFFSET + BAY_LAYER_COUNT + 1}`);
  for (const look of ['procedural', 'photo', 'storybook', 'cartoon'] as const) assert.ok(lookAtlasLayers(look, false).layers <= 256, look);
  assert.equal(BAY_LAYER_COUNT, 181, '191 off, + 6 preset cells, - 16 shared restrained shop cells');
});

test('on: restrained shop kinds sharing a cell paint the same pixels, colour and mask, in every look', () => {
  const g = globalThis as { document?: unknown }, previous = g.document;
  g.document = { createElement: () => createCanvas(1, 1) };
  try {
    for (const archetype of ['canal', 'c19', 'school', 'modern'] as const) {
      const byLayer = new Map<number, string[]>();
      for (const kind of SHOP_KINDS) { const l = bayLayer(archetype, 0, kind, true); byLayer.set(l, [...(byLayer.get(l) ?? []), kind]); }
      assert.equal(byLayer.size, 3, archetype);
      for (const [layer, kinds] of byLayer) {
        const entry = BAY_ENTRIES[layer];
        assert.ok(entry.restrainedShop && entry.archetype === archetype, `${archetype} layer ${layer}`);
        for (const look of ['photo', 'storybook', 'cartoon'] as const) {
          const digest = (kind: string) => { const t = bayTextures({ ...bayVariant(entry), kind: kind as never }, createCanvas(1, 1) as never, look); const h = createHash('sha1'); for (const c of [t.colour, t.mask] as never as { width: number; height: number; getContext(k: '2d'): { getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray } } }[]) h.update(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); return h.digest('hex'); };
          const want = digest(entry.kind);
          for (const kind of kinds) assert.equal(digest(kind), want, `${archetype} ${look} ${kind} vs ${entry.kind}`);
        }
      }
    }
  } finally { releaseBayTextures(); if (previous === undefined) delete g.document; else g.document = previous; }
});

test('on: storybook new builds are no longer white boxes (user 1c694c0d)', () => {
  const pale = (at: [number, number]) => ids.filter(id => lightnessOfHex(bayLookFor(id, 2018, 20, 'storybook', undefined, undefined, undefined, null, { footprintM2: 900, buildingType: null, at }).wallHex) >= 80).length / ids.length;
  assert.ok(pale(HOUTHAVEN) < 0.15, `Houthaven pale share ${pale(HOUTHAVEN)}`);
  assert.ok(pale(IJBURG) < 0.35, `IJburg pale share ${pale(IJBURG)}`);
});

test('on: window shape follows the area count (Houthaven wide, IJburg mostly tall)', () => {
  const tall = (at: [number, number]) => ids.filter(id => contemporaryLookFor({ id, year: 2012, heightM: 15, use: 'housing', at })?.style === 'tall').length / ids.length;
  assert.ok(tall(HOUTHAVEN) < 0.15);
  assert.ok(tall(IJBURG) > 0.4);
});

test('on: offices, pre-2005 and undated buildings keep their old picks', () => {
  for (const id of ids.slice(0, 100)) {
    assert.equal(contemporaryLookFor({ id, year: 2018, heightM: 20, use: 'office', at: HOUTHAVEN }), null);
    assert.equal(contemporaryLookFor({ id, year: 1999, heightM: 20, use: 'housing', at: HOUTHAVEN }), null);
    assert.equal(contemporaryLookFor({ id, year: null, heightM: 20, use: 'housing', at: HOUTHAVEN }), null);
  }
});

test('on: a marked block draws a set-back glazed top storey over a terrace', () => {
  const ring = [[4.8770, 52.3930], [4.8780, 52.3930], [4.8780, 52.3936], [4.8770, 52.3936], [4.8770, 52.3930]];
  const id = ids.find(i => contemporaryLookFor({ id: i, year: 2018, heightM: 20, use: 'housing', at: [4.877, 52.393] })?.setback)!;
  assert.ok(id, 'some id steps back');
  const f = { type: 'Feature' as const, properties: { id, height: 20, minHeight: 0, constructionYear: 2018, facade: 'modern|x', facadeStyle: 'modern' }, geometry: { type: 'Polygon', coordinates: [ring] } };
  const b = meshBuildingFor(f, 'storybook')!;
  assert.equal(b.setbackCrown, true);
  const [body, crown] = withSetbackCrown(b, 'storybook');
  assert.ok(crown, 'split');
  assert.ok(Math.abs(body.heightM - (20 - 3.1)) < 1e-9);
  assert.equal(crown.minHeightM, body.heightM);
  assert.equal(crown.heightM, 20);
  assert.equal(buildFeatureChunk([f], 'storybook').buildingCount, 2);
});

test('on: a pand with its own measured front draws it, not the area draw (round 2, houthaven-2018 and Zeeburgereiland strips)', () => {
  // houthaven-2018-dark: no T0 row, this lane's own sample (dark panel cladding) stands.
  const dark = contemporaryLookFor({ id: 'NL.IMBAG.Pand.0363100012247676', year: 2018, heightM: 17.6, use: 'housing', at: HOUTHAVEN })!;
  assert.equal(dark.wallSource, 'own');
  assert.equal(`${dark.painted ? 'p' : 'b'}${dark.wall.slice(1)}`, ownContemporaryWall('0363100012247676'));
  assert.ok(lightnessOfHex(dark.wall) < 45, `houthaven-2018 own wall ${dark.wall}`);
  assert.equal(dark.style, 'tall', 'tagged tall French windows');
  // Zeeburgereiland 2016: the T0 row (dark brick) outranks the lane sample, and the sheet shows balcony bands.
  const z = contemporaryLookFor({ id: 'NL.IMBAG.Pand.0363100012244416', year: 2016, heightM: 19.5, use: 'housing', at: [4.96, 52.37] })!;
  assert.equal(z.wallSource, 'own');
  assert.equal(z.style, 'band');
  assert.equal(z.styleIndex, BAND_PRESET_INDEX);
  assert.ok(lightnessOfHex(z.wall) < 40);
  // Unmeasured ids still draw from their area.
  assert.equal(contemporaryLookFor({ id: ids[0], year: 2018, heightM: 20, use: 'housing', at: HOUTHAVEN })!.wallSource, 'area');
});

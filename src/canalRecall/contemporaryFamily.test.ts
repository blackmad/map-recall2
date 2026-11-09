import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAY_LAYER_COUNT, BAY_STYLES, bayLookFor } from './bayLook.js';
import { contemporaryAreaAt, contemporaryLookFor, insetRing, newbuildFamilyEnabled } from './contemporaryFamily.js';
import { buildFeatureChunk, withSetbackCrown } from './threeBuildingFeatures.js';

// Flag off (the default): the family never fires, the tall preset is not in the array, chunks are unchanged.
const HOUTHAVEN: [number, number] = [4.8775, 52.3935];
const ids = Array.from({ length: 300 }, (_, i) => `NL.IMBAG.Pand.03631000122${String(i).padStart(5, '0')}`);

test('off by default: no contemporary look, no new layer, bayLookFor unchanged', () => {
  assert.equal(newbuildFamilyEnabled(), false);
  assert.equal(BAY_STYLES.modern.length, 9);
  assert.equal(BAY_LAYER_COUNT, 191);
  for (const id of ids) {
    assert.equal(contemporaryLookFor({ id, year: 2018, heightM: 20, use: 'housing', at: HOUTHAVEN }), null);
    for (const look of ['photo', 'storybook'] as const)
      assert.deepEqual(bayLookFor(id, 2018, 20, look, undefined, undefined, undefined, null, { footprintM2: 900, buildingType: null, at: HOUTHAVEN }), bayLookFor(id, 2018, 20, look, undefined, undefined, undefined, null, { footprintM2: 900, buildingType: null }));
  }
});

test('off: a marked building with no flag never splits, and a chunk ignores the at fact', () => {
  const ring = [[4.8770, 52.3930], [4.8780, 52.3930], [4.8780, 52.3936], [4.8770, 52.3936], [4.8770, 52.3930]];
  const f = { type: 'Feature' as const, properties: { id: ids[0], height: 20, minHeight: 0, constructionYear: 2018, facade: 'modern|x', facadeStyle: 'modern' }, geometry: { type: 'Polygon', coordinates: [ring] } };
  const chunk = buildFeatureChunk([f], 'storybook');
  assert.equal(chunk.buildingCount, 1);
});

test('areas: the Houthavens and IJburg resolve to their measured walls, far away pools them', () => {
  assert.equal(contemporaryAreaAt(...HOUTHAVEN), 'Houthaven');
  assert.equal(contemporaryAreaAt(4.99, 52.356), 'IJburg');
  assert.equal(contemporaryAreaAt(4.80, 52.30), null);
});

test('insetRing: a 68 x 67 m block steps in by 1.8 m on every side; a sliver refuses', () => {
  const ring = [[4.8770, 52.3930], [4.8780, 52.3930], [4.8780, 52.3936], [4.8770, 52.3936], [4.8770, 52.3930]];
  const inset = insetRing(ring, 1.8)!;
  assert.ok(inset);
  const kx = 111_320 * Math.cos(52.37 * Math.PI / 180), ky = 110_540;
  const w = (inset[1][0] - inset[0][0]) * kx, h = (inset[2][1] - inset[1][1]) * ky;
  assert.ok(Math.abs(w - (0.001 * kx - 3.6)) < 0.05, `width ${w}`);
  assert.ok(Math.abs(h - (0.0006 * ky - 3.6)) < 0.05, `depth ${h}`);
  // Clockwise input insets the same way.
  assert.ok(insetRing([...ring].reverse(), 1.8));
  assert.equal(insetRing([[4.877, 52.393], [4.878, 52.393], [4.878, 52.39302], [4.877, 52.39302], [4.877, 52.393]], 1.8), null, 'a 2 m deep sliver');
});

test('withSetbackCrown: unmarked buildings pass through', () => {
  const b = { id: 'x', polygons: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]], heightM: 20, minHeightM: 0, style: 'modern' as const, wallHex: '#aa5533', lid: { hex: '#888888', flatLayer: 1 }, layers: { upper: 1, ground: 2, door: 3 } };
  assert.deepEqual(withSetbackCrown(b, 'storybook'), [b]);
});

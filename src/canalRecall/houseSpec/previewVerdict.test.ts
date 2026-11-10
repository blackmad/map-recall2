import test from 'node:test';
import assert from 'node:assert/strict';
import { previewVerdict, blurRgb, PRE_BLUR_PX } from './previewVerdict.ts';
import type { FacadeMeasurement } from '../buildingRecipe/measureFacade.ts';

const m = (o: Partial<FacadeMeasurement> & { rgb?: [number, number, number] }): FacadeMeasurement => ({
  usableFraction: 0.9, foliageFraction: 0, washedOutFraction: 0, glazing: 0.3, columns: 3, windowColumns: 3, frontClass: 'punched',
  window: { w: 0.5, h: 0.6, sill: 0.9, aspect: 1.6, shape: 'tall' },
  ...o, wall: { raw: o.rgb ?? [140, 80, 60], normalised: o.rgb ?? [140, 80, 60], hex: '#000000', rawHex: '#000000', cells: 100 },
} as FacadeMeasurement);

test('alike fronts pass; a lighter wall, a glazing gap or another window shape fail; a column miss warns', () => {
  assert.equal(previewVerdict(m({}), m({})).verdict, 'PASS');
  assert.equal(previewVerdict(m({ rgb: [220, 200, 190] }), m({})).verdict, 'FAIL');
  assert.equal(previewVerdict(m({ rgb: [60, 80, 140] }), m({})).wall.pass, false); // hue
  assert.equal(previewVerdict(m({ glazing: 0.5 }), m({})).verdict, 'FAIL');
  assert.equal(previewVerdict(m({ glazing: 0.42 }), m({})).verdict, 'PASS');
  assert.equal(previewVerdict(m({ window: { w: 0.5, h: 0.6, sill: 0.9, aspect: 0.6, shape: 'wide' } }), m({})).verdict, 'FAIL');
  assert.equal(previewVerdict(m({ windowColumns: 5 }), m({})).verdict, 'WARN');
});

test('an unusable reference abstains', () => {
  const v = previewVerdict(m({}), m({ foliageFraction: 0.4 }));
  assert.equal(v.verdict, 'NO EVIDENCE');
  assert.match(v.reasons[0], /foliage/);
  assert.equal(previewVerdict(m({}), m({ washedOutFraction: 0.5 }), 'render').verdict, 'PASS');
});

test('blurRgb keeps a flat field and the mean, softens an edge, and is a copy at sigma 0', () => {
  const w = 9, h = 3, flat = new Uint8Array(w * h * 3).fill(120);
  assert.deepEqual([...blurRgb(flat, w, h)], [...flat]);
  const edge = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 5; x < w; x++) edge.fill(200, (y * w + x) * 3, (y * w + x) * 3 + 3);
  const b = blurRgb(edge, w, h, PRE_BLUR_PX);
  assert.ok(b[(w + 4) * 3] > 0 && b[(w + 4) * 3] < 200, 'the pixel left of the edge picks up light');
  assert.ok(b[(w + 5) * 3] < 200 && b[(w + 5) * 3] > 0, 'the pixel right of the edge loses some');
  assert.equal(b[(w + 0) * 3], 0);
  const copy = blurRgb(edge, w, h, 0);
  assert.notEqual(copy, edge); assert.deepEqual([...copy], [...edge]);
});

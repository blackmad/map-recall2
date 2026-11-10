import test from 'node:test';
import assert from 'node:assert/strict';
import { previewVerdict } from './previewVerdict.ts';
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
});

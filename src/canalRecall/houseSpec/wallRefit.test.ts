// The preview's re-fitted wall reference (lane H9g).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wallRefitOf, withWallRefit } from './wallRefit.ts';
import { previewVerdict } from './previewVerdict.ts';
import type { FacadeMeasurement } from '../buildingRecipe/measureFacade.ts';

const meas = (hex: string): FacadeMeasurement => {
  const rgb: [number, number, number] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  return { usableFraction: 1, foliageFraction: 0, washedOutFraction: 0, glazing: 0.3, columns: 3, windowColumns: 3, wall: { raw: rgb, normalised: rgb, hex, rawHex: hex, cells: 100 }, window: 'tall', storeyGlazing: [] } as unknown as FacadeMeasurement;
};

test('wallRefitOf: bare or full pand id, a valid hex and a source; else null', () => {
  const intent = { wallRefit: { '0363100012154359': { hex: '#42352e', source: 'pano-x' }, '1': { hex: 'red', source: 's' } } };
  assert.equal(wallRefitOf(intent, 'NL.IMBAG.Pand.0363100012154359')?.hex, '#42352e');
  assert.equal(wallRefitOf(intent, '0363100012154359')?.source, 'pano-x');
  assert.equal(wallRefitOf(intent, '1'), null);
  assert.equal(wallRefitOf({}, '0363100012154359'), null);
  assert.equal(wallRefitOf(null, '0363100012154359'), null);
});

test('withWallRefit: replaces only the wall; no refit = the same object; the verdict follows the refit', () => {
  const strip = meas('#9a7b64'), render = meas('#5f4d43');
  assert.equal(withWallRefit(strip, null), strip);
  const re = withWallRefit(strip, { hex: '#42352e', source: 'pano' });
  assert.equal(re.wall.hex, '#42352e');
  assert.equal(re.glazing, strip.glazing);
  assert.equal(previewVerdict(render, strip).wall.pass, false, 'the overexposed strip fails');
  assert.equal(previewVerdict(render, re).wall.pass, true, 'the panorama reading passes');
});

test('kinker-31-49 records a refit for 33-49 bricks it re-measured', () => {
  const intent = JSON.parse(fs.readFileSync('scripts/block-face/faces/kinker-31-49/intent.json', 'utf8'));
  for (const n of ['154359', '161457', '159384', '167106']) assert.equal(wallRefitOf(intent, `0363100012${n}`)?.source, 'pano-2021-12-30-kinker-154359', n);
});

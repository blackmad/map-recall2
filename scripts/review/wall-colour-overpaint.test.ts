/**
 * Regression for the colour/material review cases (case-08 / case-14).
 *
 * Elandsgracht 19 (case-14) was extracted with a whole-facade `accent`
 * material (`#ffffff`, bounds = the entire crop) over a correctly declared red
 * brick upper wall (`#8b4513`). The compiler faithfully painted the accent on
 * top, so the candidate rendered a white building for a red-brick source. A
 * trim region that spans the whole crop is not a localized accent, and this
 * pins that it can no longer overpaint the wall while a real band still can.
 *
 * Run: npx tsx scripts/review/wall-colour-overpaint.test.ts
 */
import assert from 'node:assert/strict';
import { compileSourceShapePreview } from './source-shape-preview.ts';

const compile = (features: any[]) =>
  compileSourceShapePreview({ width: 600, height: 500, cropSha256: 'a'.repeat(64), captureDate: '2025-01-01', features });
const materials = (features: any[]) =>
  compile(features).patches.filter((patch: any) => patch.featureKind === 'observed-material').map((patch: any) => patch.colour);

// case-14 shape: a red-brick wall plus a whole-facade white accent.
const wholeFacadeAccent = materials([
  { id: 'wall', kind: 'material', region: 'upper-wall', material: 'brick', colour: '#8b4513', bounds: [0, 0, 600, 500], disposition: 'agent-inspected' },
  { id: 'accent', kind: 'material', region: 'accent', material: 'paint', colour: '#ffffff', bounds: [0, 0, 600, 500], disposition: 'agent-inspected' },
]);
assert.ok(wholeFacadeAccent.includes('#8b4513'), 'the declared red-brick wall must still be painted');
assert.ok(!wholeFacadeAccent.includes('#ffffff'), 'a whole-facade accent must not overpaint the wall');

// A genuinely localized trim band is still a usable accent and must survive.
const localizedBand = materials([
  { id: 'wall', kind: 'material', region: 'upper-wall', material: 'brick', colour: '#8b4513', bounds: [0, 0, 600, 500], disposition: 'agent-inspected' },
  { id: 'band', kind: 'material', region: 'band', material: 'paint', colour: '#ffffff', bounds: [0, 430, 600, 470], disposition: 'agent-inspected' },
]);
assert.ok(localizedBand.includes('#ffffff'), 'a localized trim band must still be painted');

console.log('wall-colour overpaint regression passed: whole-facade accent skipped, localized band preserved.');

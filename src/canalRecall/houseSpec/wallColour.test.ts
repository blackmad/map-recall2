// The wall-colour rule (lane H9): measured hue and chroma kept, one monotone lightness lift, floor and ceiling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklab, oklabToHex, specWallDisplay, specWallsEnabled, wallColourFamily, SPEC_WALL_LIFT } from './wallColour.ts';

const L = (h: string) => hexToOklab(h)[0];
const hue = (h: string) => { const [, a, b] = hexToOklab(h); return Math.atan2(b, a) * 180 / Math.PI; };
const C = (h: string) => { const [, a, b] = hexToOklab(h); return Math.hypot(a, b); };

test('specWallsEnabled: default on, ?specWalls=0 and SPEC_WALLS=0 off, the query wins', () => {
  assert.equal(specWallsEnabled(null, null), true);
  assert.equal(specWallsEnabled('?world=live&specWalls=0', null), false);
  assert.equal(specWallsEnabled(null, '0'), false);
  assert.equal(specWallsEnabled('?specWalls=1', '0'), true);
});

test('OKLab round trip', () => {
  for (const h of ['#000000', '#ffffff', '#7a4a3a', '#343235', '#f1c18d']) assert.equal(oklabToHex(hexToOklab(h)), h);
});

test('the easy-houses readings keep their family; order holds; lighter but never black or paper white', () => {
  // measureFacade readings of the set's crops (scripts/house-specs/sets/easy-houses-20261110.json, 2026-11-10).
  const readings = { black167483: '#343235', dark182848: '#2d2a26', brown169116: '#665249', grey168136: '#717877', salmon182857: '#ceb8ae', buff180181: '#f1c18d' };
  const out = Object.fromEntries(Object.entries(readings).map(([k, v]) => [k, specWallDisplay(v)]));
  for (const [k, v] of Object.entries(readings)) {
    assert.ok(L(out[k]) >= L(v) - 1e-6, `${k} not darker`);
    assert.ok(L(out[k]) >= SPEC_WALL_LIFT.minL - 0.005 && L(out[k]) <= SPEC_WALL_LIFT.maxL + 0.005, `${k} in range`);
    if (C(v) > 0.02) assert.ok(Math.abs(hue(out[k]) - hue(v)) < 4, `${k} hue kept`);
  }
  const order = Object.keys(readings).sort((a, b) => L((readings as any)[a]) - L((readings as any)[b]));
  const after = [...order].sort((a, b) => L(out[a]) - L(out[b]));
  assert.deepEqual(after, order, 'lightness order of the walls holds');
  assert.equal(wallColourFamily(out.black167483).startsWith('neutral'), true, 'a black painted front stays neutral');
  assert.equal(wallColourFamily(out.brown169116), 'brick-brown');
  assert.equal(wallColourFamily(out.buff180181), 'brick-pale');
});

test('Kinkerstraat 244-332 strip readings come up (the brighter-palette constraint)', () => {
  // Overcast strip readings of three houses of the face (H1 extract): the lift raises each by at least 0.08 L.
  for (const h of ['#574434', '#4f463b', '#797c75']) assert.ok(L(specWallDisplay(h)) - L(h) >= 0.08, h);
});

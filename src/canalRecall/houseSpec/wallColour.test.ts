// The wall-colour rule (lane H9): measured hue (pulled half way from a yellow cast), lifted lightness and warm chroma, the trim-misread family tone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FAMILY_TONE, hexToOklab, nearestWallFamily, oklabToHex, specWallDisplay, specWallSource, specWallsEnabled, wallColourFamily, SPEC_WALL_LIFT } from './wallColour.ts';

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
    // Hue is kept up to the brown-tone pull (half of a yellow shift past 46 degrees, never past 46).
    if (C(v) > 0.02) assert.ok(hue(out[k]) <= hue(v) + 1.5 && hue(out[k]) >= Math.min(hue(v), SPEC_WALL_LIFT.hue.toward) - 1.5, `${k} hue kept or pulled towards brown`);
  }
  const order = Object.keys(readings).sort((a, b) => L((readings as any)[a]) - L((readings as any)[b]));
  const after = [...order].sort((a, b) => L(out[a]) - L(out[b]));
  assert.deepEqual(after, order, 'lightness order of the walls holds');
  assert.equal(wallColourFamily(out.black167483).startsWith('neutral'), true, 'a black painted front stays neutral');
  // A charcoal painted front (Herengracht 0363100012175321, #575351) stays darker than the brown brick beside it
  // (0363100012175320, #6a5f5a) after the rule, as in the photo.
  assert.ok(L(specWallDisplay('#575351')) < L(specWallDisplay('#6a5f5a')) - 0.05);
  assert.ok(Math.abs(L(specWallDisplay('#575351')) - L('#575351')) < 0.01, 'dark paint takes no lift');
  assert.equal(wallColourFamily(out.brown169116), 'brick-brown');
  assert.equal(wallColourFamily(out.buff180181), 'brick-pale');
});

test('Kinkerstraat 244-332 strip readings come up (the brighter-palette constraint)', () => {
  // Overcast strip readings of the face (H1 extract): dull brown brick rises by at least 0.08 L; the grey stucco
  // (a neutral, partly in the dark-paint band) never darkens.
  for (const h of ['#574434', '#4f463b', '#4c4033']) assert.ok(L(specWallDisplay(h)) - L(h) >= 0.08, h);
  for (const h of ['#797c75', '#2e302c', '#4f5148']) assert.ok(L(specWallDisplay(h)) >= L(h) - 1e-6, h);
});

test('chroma comes up with lightness on warm readings; neutrals and cool casts keep theirs; the cap stops ochre', () => {
  for (const h of ['#574434', '#665249', '#6c594b']) assert.ok(C(specWallDisplay(h)) >= 1.8 * C(h), `${h} chroma lifted`);
  for (const h of ['#717877', '#575351', '#343235']) assert.ok(C(specWallDisplay(h)) <= C(h) + 0.004, `${h} stays neutral`);
  // A blue-grey camera cast (Kinkerstraat area 0363100012167431 drew blue) gains no chroma.
  const cool = '#5d6270'; assert.ok(C(specWallDisplay(cool)) <= C(cool) + 0.002);
  // A yellowish brown never passes the yellow-brown cap.
  assert.ok(C(specWallDisplay('#6d5c42')) <= SPEC_WALL_LIFT.hue.capC[0] + 1e-6 && hue(specWallDisplay('#6d5c42')) < hue('#6d5c42'));
  // A family tone is drawn at its own chroma (lightness only).
  assert.ok(Math.abs(C(specWallDisplay(FAMILY_TONE.red, { fromPixel: false })) - C(FAMILY_TONE.red)) < 0.006);
});

test('trim misread: a reading lighter than its family tone draws the family tone (Nieuwmarkt 182857)', () => {
  // Red brick with white speklagen read #ceb8ae (pale pink-beige); the hand set says red.
  assert.deepEqual(specWallSource('#ceb8ae', { family: 'red', brick: true }), { hex: FAMILY_TONE.red, fromPixel: false, family: 'red' });
  // 182849: orange brick read as pale cream.
  assert.equal(specWallSource('#efd6b3', { family: 'orange', brick: true }).fromPixel, false);
  // A reading darker than its family tone keeps the pixel (171023 brown read near-black stays the pixel).
  assert.equal(specWallSource('#514b4d', { family: 'brown', brick: true }).fromPixel, true);
  // A brick finish without a reader family compares with the nearest brick family; a pale reading is trim.
  assert.equal(specWallSource('#e8dccb', { brick: true }).fromPixel, false);
  assert.equal(specWallSource('#584332', { brick: true }).fromPixel, true, 'Kinkerstraat brown keeps its pixel');
  // Stucco or paint without a reader family: the pixel stands.
  assert.deepEqual(specWallSource('#e8dccb', { brick: false }), { hex: '#e8dccb', fromPixel: true, family: null });
  // A reader family that agrees with a lighter pixel on a non-brick front keeps the pixel.
  assert.equal(specWallSource('#f0ede4', { family: 'white', brick: false }).fromPixel, true);
  assert.equal(nearestWallFamily('#2b2b2e'), 'dark');
});

// The wall-colour rule (lane H9): measured hue (pulled half way from a yellow cast), lifted lightness and warm chroma, the trim-misread family tone.
import test from 'node:test';
// These pins are the round-3 chroma rule; lane W1's measured-chroma default (`?wallChroma`) is off here and tested below.
process.env.WALL_CHROMA = '0';
import assert from 'node:assert/strict';
import { FAMILY_TONE, hexToOklab, nearestWallFamily, oklabToHex, specWallDisplay, specWallSource, specWallsEnabled, wallColourFamily, wallChromaTruthEnabled, resetWallChromaFlag, SPEC_WALL_LIFT, paleWarmHeld, paleWarmReading, heldBrickWall, heldTakesBrick } from './wallColour.ts';
import { houseSpecPatch, specWallGuarded, type HouseSpecView } from './decorate.ts';

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

test('Kinkerstraat 244-332 strip readings never darken; dark browns stay darker than red brick (round 3)', () => {
  // Overcast strip readings of the face (H1 extract) never darken; the grey stucco (a neutral, partly in the dark-paint
  // band) never darkens.
  for (const h of ['#574434', '#4f463b', '#4c4033']) assert.ok(L(specWallDisplay(h)) >= L(h) - 1e-6, h);
  // The ruling on round 2: Kinkerstraat dark brown (#5b4532, 0363100012158666) must draw darker than Evertsenstraat red
  // brick (#6e4b44, 0363100012132952) by more than the readings differ (the dark lift ramp widens the gap).
  assert.ok(L(specWallDisplay('#6e4b44')) - L(specWallDisplay('#5b4532')) > L('#6e4b44') - L('#5b4532'));
  // ...and keeps a brown hue instead of turning terracotta (no pull towards 40 degrees below the dark ramp).
  assert.ok(hue(specWallDisplay('#504030')) > 60);
  // Monotone: a fine sweep of one hue never reorders.
  let prev = -1; for (let v = 0.2; v <= 0.95; v += 0.01) { const c = oklabToHex([v, 0.03, 0.03]); const o = L(specWallDisplay(c)); assert.ok(o >= prev - 0.004, `monotone at ${v.toFixed(2)}`); prev = o; }
  // Pale fronts keep their own chroma and hue (beige stays beige: 0363100012156921 #cbad90).
  assert.ok(Math.abs(C(specWallDisplay('#cbad90')) - C('#cbad90')) < 0.004 && Math.abs(hue(specWallDisplay('#cbad90')) - hue('#cbad90')) < 2);
  for (const h of ['#797c75', '#2e302c', '#4f5148']) assert.ok(L(specWallDisplay(h)) >= L(h) - 1e-6, h);
});

test('chroma comes up with lightness on warm readings; neutrals and cool casts keep theirs; the cap stops ochre', () => {
  for (const h of ['#665249', '#6c594b']) assert.ok(C(specWallDisplay(h)) >= 1.8 * C(h), `${h} chroma lifted`);
  // A dark reading gains only part of it (round 3: dark brown is not raised into terracotta).
  assert.ok(C(specWallDisplay('#504030')) < 1.8 * C('#504030') && C(specWallDisplay('#504030')) >= C('#504030'));
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

const drawnOf = (view: HouseSpecView, p = {}) => (houseSpecPatch(view, p).specRecipe as { wallHex?: string } | undefined)?.wallHex;

test('pale-warm guard (H9f r2): a drawn peach/salmon/orange keeps the period colour (Kinkerstraat 154359 row)', () => {
  // The row's strip readings are pale and warm; drawn (lifted) they were peach where the photo is dark brown brick.
  for (const hex of ['#c9a080' /* 0363100012154359 */, '#c9a080' /* 0363100012161457 */, '#d0ab8d' /* 0363100012157926 */, '#a08265' /* 0363100012172620 */]) {
    const drawn = specWallDisplay(hex);
    assert.ok(paleWarmReading(drawn), `${hex} draws ${drawn}`);
    assert.equal(paleWarmHeld(drawn, { readingL: L(hex) }), true, hex);
    assert.equal(paleWarmHeld(drawn, { family: 'brown', readingL: L(hex) }), true, `${hex} stays held against a brick family`);
    assert.equal(drawnOf({ wallHex: hex, wallMaterial: 'brick', src: {} }), undefined, `${hex} writes no wall colour`);
    assert.equal(specWallGuarded({ wallHex: hex, src: {} }, {}), true);
  }
  // The rest stays live: dark brown (#5b4532), Singel 175320 (#6a5f5a), Kinkerstraat greys and browns, red brick.
  for (const hex of ['#5b4532', '#6a5f5a', '#584332', '#7a4a3a', '#6e4b44']) assert.ok(drawnOf({ wallHex: hex, wallMaterial: 'brick', src: {} }), `${hex} draws`);
  // A pale trim misread a reader's red family replaced with its tone draws that tone (Nieuwmarkt 182857).
  assert.ok(drawnOf({ wallHex: '#ceb8ae', wallMaterial: 'brick', wallFamily: 'red', src: {} }));
  // Not warm, not pale: no hold.
  assert.equal(paleWarmHeld(specWallDisplay('#717877'), {}), false);
  assert.equal(paleWarmReading('#8a5a44'), false);
});

test('pale-warm guard (H9f r2): the darkness inversion holds orange for dark brown outside the hue band', () => {
  // Drawn 0.15 lighter than the reading, hue below 35 (red-orange): rule 2 alone.
  const drawn = oklabToHex([0.62 - 0.0, 0.1, 0.03]);
  assert.equal(paleWarmReading(drawn), false);
  assert.equal(paleWarmHeld(drawn, { readingL: 0.45 }), true);
  assert.equal(paleWarmHeld(drawn, { readingL: 0.55 }), false);
  // The black floor is design, not an inversion: a near-black reading drawn at minL is not held.
  assert.equal(paleWarmHeld(specWallDisplay('#030403'), { readingL: L('#030403') }), false);
});

test('pale-warm guard (H9f r2): render and light families release the reading', () => {
  const drawn = specWallDisplay('#c9a080');
  // Release 1: a reader names the wall white, grey or buff (pale warm plaster is right).
  for (const family of ['white', 'grey', 'buff'] as const) assert.equal(paleWarmHeld(drawn, { family, readingL: L('#c9a080') }), false, family);
  assert.ok(drawnOf({ wallHex: '#e2c2af', wallFamily: 'white', wallMaterial: 'stucco', src: {} }));
  // Release 2: the register's light finish or a stucco wall material, no reader needed.
  assert.equal(specWallGuarded({ wallHex: '#d4b6a8', src: {} }, { registerFinish: 'light' }), false);
  assert.equal(specWallGuarded({ wallHex: '#d4b6a8', wallMaterial: 'stucco', src: {} }, {}), false);
  assert.ok(drawnOf({ wallHex: '#d4b6a8', wallMaterial: 'stucco', src: {} }));
  // Two agreeing capture dates would release it too; the spec view carries one date per pand, so none reaches here yet.
  assert.equal(paleWarmHeld(drawn, { agreeingDates: 2 }), false);
});

// H9 follow-up (reading miss, not fixed here): Brouwersgracht 0363100012168136 is black-painted brick with white frames in
// the photo, but the strip reads a grey-white stucco (#717877, family grey) and the game draws grey-white before and after
// the wall un-hold. The reading, not the lift, is wrong: the crop normalises to the white frames.
test.todo('Brouwersgracht 168136 draws near-black (black-painted brick, white frames), not grey-white');

// Lane H9g (#345): a held brick pand never falls back to grey; the fallback is family-aware.
const C19 = ['#b05a40', '#bd6a45', '#a24d38', '#c58b5e', '#d3b184', '#e2d5ba', '#9a5846'];
test('heldBrickWall: a grey or pale fallback takes a brick-family entry of the period palette, a brick one stays', () => {
  for (const grey of ['#6f6f6e', '#5d605a', '#e4ddcd', '#7e8082']) {
    const hex = heldBrickWall(grey, C19, 3);
    assert.ok(C19.includes(hex), hex);
    assert.ok(['brick-dark', 'brick-red', 'brick-brown'].includes(wallColourFamily(hex)), `${grey} -> ${hex}`);
  }
  assert.equal(heldBrickWall('#a24d38', C19, 5), '#a24d38', 'already brick: byte-identical');
  assert.equal(heldBrickWall('#6f6f6e', C19, 7), heldBrickWall('#6f6f6e', C19, 7), 'stable');
  assert.notEqual(heldBrickWall('#6f6f6e', C19, 0), heldBrickWall('#6f6f6e', C19, 1), 'the pick spreads a row over the entries');
  assert.equal(heldBrickWall('#6f6f6e', null, 1), '#6f6f6e', 'no palette: unchanged');
  assert.equal(heldBrickWall('#6f6f6e', ['#e2d5ba'], 1), '#6f6f6e', 'no brick entry: unchanged');
});

test('heldTakesBrick: unless the finish is stated light', () => {
  assert.equal(heldTakesBrick({ wallMaterial: 'brick' }), true);
  assert.equal(heldTakesBrick({}), true);
  assert.equal(heldTakesBrick({ registerFinish: 'brick' }), true);
  assert.equal(heldTakesBrick({ registerFinish: 'light' }), false);
  assert.equal(heldTakesBrick({ wallMaterial: 'stucco', registerFinish: 'brick' }), false);
  assert.equal(heldTakesBrick({ wallMaterial: 'painted-brick' }), false);
});

test('houseSpecPatch: a guarded brick wall marks heldBrick, a drawn wall and a light finish do not', () => {
  const held = houseSpecPatch({ wallHex: '#c9a080', src: {} }, {}).specRecipe as { heldBrick?: boolean; wallHex?: string } | undefined;
  assert.equal(held?.heldBrick, true);
  assert.equal(held?.wallHex, undefined);
  const dark = houseSpecPatch({ wallHex: '#42352e', wallMaterial: 'brick', src: {} }, {}).specRecipe as { heldBrick?: boolean; wallHex?: string } | undefined;
  assert.equal(dark?.heldBrick, undefined);
  assert.ok(dark?.wallHex);
  const light = houseSpecPatch({ wallHex: '#c9a080', src: {} }, { registerFinish: 'light' }).specRecipe as { heldBrick?: boolean } | undefined;
  assert.equal(light?.heldBrick, undefined);
});

test('wallChroma (lane W1, default on): a warm pixel reading keeps its chroma and hue, the lightness lift and the cool damping stay', () => {
  assert.equal(wallChromaTruthEnabled(null, null), true);
  assert.equal(wallChromaTruthEnabled('?wallChroma=0', null), false);
  assert.equal(wallChromaTruthEnabled(null, '0'), false);
  const prev = process.env.WALL_CHROMA;
  try {
    const old = ['#6e4b44', '#4e4336', '#5b4532', '#a57a5c', '#7a3e2c'].map(h => specWallDisplay(h));
    process.env.WALL_CHROMA = '1'; resetWallChromaFlag();
    for (const [i, h] of ['#6e4b44', '#4e4336', '#5b4532', '#a57a5c', '#7a3e2c'].entries()) {
      const [L, a, b] = hexToOklab(h), [L2, a2, b2] = hexToOklab(specWallDisplay(h)), [L0] = hexToOklab(old[i]);
      assert.ok(Math.abs(L2 - L0) < 0.006, `${h}: the lift is unchanged`);
      assert.ok(Math.abs(Math.hypot(a2, b2) - Math.hypot(a, b)) < 0.006, `${h}: chroma kept`);
      assert.ok(Math.abs(Math.atan2(b2, a2) - Math.atan2(b, a)) < 0.12, `${h}: hue kept`);
      assert.ok(L2 >= L - 1e-3);
    }
    // #6e4b44 drew #a35042 (orange-red) under the round-3 gain; now a muted red-brown.
    assert.ok(Math.hypot(...hexToOklab(specWallDisplay('#6e4b44')).slice(1) as [number, number]) < 0.06);
    // A cool cast is still damped, a family tone still takes lightness only.
    const [, ca, cb] = hexToOklab(specWallDisplay('#5a6470')), [, oa, ob] = hexToOklab('#5a6470');
    assert.ok(Math.hypot(ca, cb) < Math.hypot(oa, ob));
  } finally { if (prev === undefined) delete process.env.WALL_CHROMA; else process.env.WALL_CHROMA = prev; resetWallChromaFlag(); }
});

// node --import tsx --test src/canalRecall/look/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_LOOKS, CITY_ROOF, FLAT_ROOF_GREYS, LOOK_VARIANTS, PERIOD_FROM, PERIOD_PRIORS, PERIODS, PHOTO_WALL_CELL_MEAN, ROOF_TONES, cellSetOf, foliageDisplayHex, GROUND_TONES, hexToRgb, lookHex, periodForYear, rgbToHsl, roofTone, cityTint, cityWallTint, BRICK_CELL_MEAN, GLASS_TINT_CELL_H, GLASS_TINT_CELL_MEAN, GLASS_TINT_CELL_W, cityMeasuredGlassTint, glassTintCellValue, cityMeasuredStoneTint, cityStoneTint, isMeasuredTint, STONE_CELL_MEAN } from './palette.ts';
import { PARITY_TOLERANCE, faceNormal, lumaSpread, meanLuma } from './lookParityMath.ts';

test('one era scheme: 1860 / 1915 / 1945, a boundary belongs to the period it opens', () => {
  assert.deepEqual([PERIOD_FROM.c19, PERIOD_FROM.school, PERIOD_FROM.modern], [1860, 1915, 1945]);
  assert.deepEqual([1859, 1860, 1914, 1915, 1944, 1945, 2020].map(periodForYear), ['canal', 'c19', 'c19', 'school', 'school', 'modern', 'modern']);
  assert.equal(new Set(PERIODS.map(p => PERIOD_PRIORS[p].wall)).size, PERIODS.length, 'each period paints its own colour');
});

test('lookHex is the identity for the natural looks and keeps darks dark in cartoon', () => {
  for (const look of ['photo', 'procedural', 'untextured'] as const) assert.equal(lookHex('#A4523B', look), '#A4523B');
  // Values pinned from the pre-merge landmarkFronts.ts implementation.
  assert.equal(lookHex('#a4523b', 'storybook'), '#b84a37');
  assert.equal(lookHex('#a4523b', 'cartoon'), '#e23d0e');
  assert.equal(lookHex('#808080', 'storybook'), '#888888');
  // Iron and glass: lightness kept (below 0.35), only saturation pushed.
  assert.equal(lookHex('#1f2121', 'cartoon'), '#1c2424');
});

test('roof tones: one table, photo is the city table, tone picks within range', () => {
  assert.deepEqual(CITY_ROOF.tile, ROOF_TONES.photo.tile);
  assert.equal(CITY_ROOF.flat, FLAT_ROOF_GREYS);
  assert.equal(roofTone('photo', 'tile', 0), ROOF_TONES.photo.tile[0]);
  assert.equal(roofTone('photo', 'tile', 1), ROOF_TONES.photo.tile.at(-1));
  assert.equal(roofTone('cartoon', 'slate', 0.5), ROOF_TONES.cartoon.slate[1]);
});

test('every look is a complete parameter set', () => {
  for (const look of BUILDING_LOOKS) {
    const v = LOOK_VARIANTS[look];
    assert.ok(v.cells && Number.isFinite(v.shadeBands) && Number.isFinite(v.litWallGain), look);
    assert.equal(cellSetOf(look), look === 'untextured' ? 'procedural' : look);
  }
  assert.ok(Math.abs(LOOK_VARIANTS.photo.litWallGain * PHOTO_WALL_CELL_MEAN - 255) < 1e-9, 'lit photo walls show their tint');
});

test('parity maths: magenta clear is excluded, spread is relative to the mean', () => {
  const size = 4, px = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set(i < 4 ? [255, 0, 255, 255] : [100, 100, 100, 255], i * 4);
  assert.equal(meanLuma(px, size, 0), 100);
  assert.deepEqual(faceNormal('south'), [0, -1, 0]);
  const r = { hex: '#808080', rig: {}, walls: { 'a/south': 100, 'b/south': 105, 'c/south': 95 } };
  const s = lumaSpread(r, ['a', 'b', 'c'], 'south');
  assert.ok(Math.abs(s.spread - 0.1) < 1e-9);
  assert.ok(PARITY_TOLERANCE > 0 && PARITY_TOLERANCE < 0.2);
});

test('mood: foliage turns from olive toward green, purple leaves and bark keep their colour', () => {
  const tilia = rgbToHsl(hexToRgb('#789655')), shown = rgbToHsl(hexToRgb(foliageDisplayHex('#789655')));
  assert.ok(shown[0] > tilia[0] + 6 && shown[1] > tilia[1], 'greener and a little richer');
  assert.ok(Math.abs(shown[2] - tilia[2]) < 0.01, 'same lightness');
  assert.equal(foliageDisplayHex('#694653'), '#694653', 'prunus nigra stays purple');
  assert.equal(foliageDisplayHex('#665741'), '#665741', 'bark is not foliage');
});

test('mood: own-ground water is no longer teal-black, pavers are lighter than wet concrete', () => {
  assert.ok(rgbToHsl(hexToRgb(GROUND_TONES.water))[2] > 0.3, 'water lightness');
  const luma = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  assert.ok(luma(GROUND_TONES.land.base) > 150 && luma(GROUND_TONES.paving.base) > luma(GROUND_TONES.land.base));
});

test('measured walls bypass the brick clamp: cell mean x tint lands on the authored lightness', () => {
  const L = (hex: string) => rgbToHsl(hexToRgb(hex))[2];
  const afterCell = (hex: string) => { const [r, g, b] = hexToRgb(hex).map(v => Math.round(v * BRICK_CELL_MEAN)); return L('#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')); };
  for (const hex of ['#3a2a28', '#8a3e2e', '#d8d2c4', '#6a6a70']) {
    // Unmeasured: byte-identical to the clamped mapping, with or without the (absent) source.
    assert.equal(cityTint('brick', hex), cityWallTint(hex));
    assert.equal(cityTint('brick', hex, null), cityWallTint(hex));
    assert.equal(cityTint('accent', hex, undefined), cityWallTint(hex));
    const measured = cityTint('brick', hex, 'measured');
    assert.ok(Math.abs(afterCell(measured) - L(hex)) <= 0.02, `${hex}: ${measured} -> ${afterCell(measured)} vs ${L(hex)}`);
  }
  // The clamp would have lifted the dark wall to L 0.3 and tanned the pale one; measured does neither.
  assert.ok(L(cityWallTint('#3a2a28')) >= 0.3 - 1e-9 && afterCell(cityTint('brick', '#3a2a28', 'measured')) < 0.25);
  assert.ok(L(cityWallTint('#d8d2c4')) <= 0.6 + 1e-9 && afterCell(cityTint('brick', '#d8d2c4', 'measured')) > 0.75);
  // Only brick/accent (and glass, painted stone and the flat roof, their own tests) are touched; every other slot ignores the source.
  for (const slot of ['stucco', 'frame', 'door', 'paint', 'roofTile', 'slate'] as const) assert.equal(cityTint(slot, '#8a7656', 'measured'), cityTint(slot, '#8a7656'), slot);
  // Below L 0.18 the floor holds.
  assert.ok(afterCell(cityTint('brick', '#0a0808', 'measured')) >= 0.17);
});

test('measured glass keeps the sky: the stock pane in grey x tint draws the measured hue at L >= 0.40; unmeasured glass stays white-tinted', () => {
  // The pane cell: the stock pane's gradient and streak at full strength (head 255 with the streak, sill ~103).
  let lo = 255, hi = 0;
  for (let y = 0; y < GLASS_TINT_CELL_H; y++) for (let x = 0; x < GLASS_TINT_CELL_W; x++) { const v = glassTintCellValue(x, y); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.equal(hi, 255);
  assert.ok(lo > 95 && lo < 110, String(lo));
  assert.ok(GLASS_TINT_CELL_MEAN > 150 && GLASS_TINT_CELL_MEAN < 165, String(GLASS_TINT_CELL_MEAN));
  assert.ok(glassTintCellValue(8, 4) > glassTintCellValue(28, 4), 'the sky streak crosses the upper pane');
  // The stock pane's contrast: head over sill luma of #8aa1b0 / #3c474e.
  assert.ok(Math.abs(glassTintCellValue(28, 0) / glassTintCellValue(28, GLASS_TINT_CELL_H - 1) - 157.19 / 69.17) < 0.03);
  const onCell = (hex: string) => hexToRgb(hex).map(v => Math.round(v * GLASS_TINT_CELL_MEAN / 255)) as [number, number, number];
  // Dark (Waagdragerhof, Apollohal) and grey-blue reflective (Houthavenkade 26) glass, the hexes lane C sampled.
  for (const hex of ['#1e262c', '#2a3a42', '#3a4650', '#46545c', '#6c7f8a', '#8e9ea4']) {
    assert.equal(cityTint('glass', hex), '#ffffff', 'unmeasured glass: unchanged');
    assert.equal(cityTint('glass', hex, null), '#ffffff');
    const tint = cityMeasuredGlassTint(hex), [h, s, l] = rgbToHsl(hexToRgb(hex)), [dh, ds, dl] = rgbToHsl(onCell(tint));
    assert.equal(cityTint('glass', hex, 'measured'), tint);
    // Lightness floored at the stock pane's (0.40); above it the glass keeps its own (the palest, #8e9ea4 at 0.60,
    // is scaled down to the cell's reach, within 0.025).
    assert.ok(Math.abs(dl - Math.max(l, 0.40)) <= 0.025, `${hex} L ${dl} vs ${Math.max(l, 0.40)}`);
    // The measured hue and saturation hold.
    assert.ok(Math.min(Math.abs(dh - h), 360 - Math.abs(dh - h)) <= 4, `${hex} hue ${dh} vs ${h}`);
    assert.ok(Math.abs(ds - s) <= 0.04, `${hex} sat ${ds} vs ${s}`);
  }
  // Above the floor and inside the cell's reach, cell x tint lands on the authored hex.
  onCell(cityMeasuredGlassTint('#6c7f8a')).forEach((v, i) => assert.ok(Math.abs(v - hexToRgb('#6c7f8a')[i]) <= 1.5, `channel ${i}: ${v}`));
  // Overcast-dark measured glass (the user's Waagdragerhof #3a4650) draws as light as the stock pane, in its own hue.
  assert.ok(Math.abs(rgbToHsl(onCell(cityMeasuredGlassTint('#3a4650')))[2] - 0.40) < 0.01);
  // Dark and reflective glass still draw different panes.
  assert.notEqual(cityTint('glass', '#1e262c', 'measured'), cityTint('glass', '#8e9ea4', 'measured'));
});


test('measured stone (painted white stucco dressings) keeps its paint: cell mean x tint lands on it, capped at white; unmeasured stone is untouched', () => {
  for (const hex of ['#eae7dc', '#c5c8b1', '#8a7656']) {
    const t = cityMeasuredStoneTint(hex), back = hexToRgb(t).map(v => Math.round(v * STONE_CELL_MEAN)), want = hexToRgb(hex);
    for (const k of [0, 1, 2]) assert.ok(back[k] <= want[k] + 1 && (hexToRgb(t)[k] === 255 || Math.abs(back[k] - want[k]) <= 1), `${hex} channel ${k}: ${back[k]} vs ${want[k]}`);
    assert.equal(cityTint('stone', hex, 'measured'), t);
    assert.equal(cityTint('stone', hex), cityStoneTint(hex), 'unmeasured: the sandstone mix');
  }
  assert.ok(isMeasuredTint('stone', 'measured') && !isMeasuredTint('stone', null));
});

test('a measured flat roof (roof-facts colour) is kept by the city tint; unmeasured flat roofs keep their prior', () => {
  assert.ok(isMeasuredTint('bitumen', 'measured') && !isMeasuredTint('bitumen', null));
  for (const hex of ['#87898d', '#56585e', '#d9d9d3']) assert.equal(cityTint('bitumen', hex, 'measured'), hex);
  assert.ok(FLAT_ROOF_GREYS.includes(cityTint('bitumen', '#6a6c6c')), 'unmeasured: one of the flat-roof priors');
});

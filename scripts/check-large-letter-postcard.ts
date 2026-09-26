/**
 * Layout for the classic large-letter postcard — fit, path glyphs, caption,
 * style presets — without painting. Paint stays in Storybook / vision loop.
 */
import assert from 'node:assert/strict';
import {
  LARGE_LETTER_HEIGHT,
  LARGE_LETTER_WIDTH,
  measureLargeLetterPostcard,
  splitNameForTwoLines,
} from '../src/canalRecall/largeLetterPostcard.ts';
import {
  baselinePathOffset,
  POSTCARD_STYLES,
} from '../src/canalRecall/largeLetterPostcardStyles.ts';

const stub = (text: string, font: string) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
  // Approx Barlow Condensed advance (was 0.5 — too wide, starved billboard size).
  return text.length * size * 0.38;
};

// --- Defaults (linen-arch) --------------------------------------------------
{
  const card = measureLargeLetterPostcard({ name: 'Jordaan' }, stub);
  assert.equal(card.width, LARGE_LETTER_WIDTH);
  assert.equal(card.height, LARGE_LETTER_HEIGHT);
  assert.equal(card.style.id, 'linen-arch');
  assert.equal(card.greeting, 'Greetings from');
  assert.deepEqual(card.nameLines, ['JORDAAN']);
  assert.equal(card.caption, 'Amsterdam');
  assert.equal(card.imageStripCount, 0);
  assert.ok(
    card.nameFontSize >= Math.round(LARGE_LETTER_HEIGHT * 0.28)
      && card.nameFontSize <= Math.round(LARGE_LETTER_HEIGHT * 0.78),
    `billboard font ${card.nameFontSize}px outside expected band`,
  );
  assert.ok(
    card.horizontalScale >= 0.68 && card.horizontalScale <= 1.7,
    `horizontalScale ${card.horizontalScale} outside stretch/fill band`,
  );
  assert.equal(card.glyphs.length, 7, 'one glyph per letter in JORDAAN');
  assert.ok(card.archAmount > 0, 'arch path is non-zero');
  const mid = card.glyphs[3];
  const end = card.glyphs[0];
  assert.ok(mid.baselineY < end.baselineY, 'arch peaks in the middle');
}

// --- Style presets change path + palette -----------------------------------
{
  const flat = measureLargeLetterPostcard({ name: 'Noord', style: 'flat-block' }, stub);
  assert.equal(flat.style.id, 'flat-block');
  assert.equal(flat.style.path, 'flat');
  assert.equal(flat.archAmount, 0);
  assert.equal(flat.glyphs[0].baselineY, flat.glyphs[flat.glyphs.length - 1].baselineY,
    'flat path keeps a level baseline');

  const rise = measureLargeLetterPostcard({ name: 'IJburg', style: 'rise-coastal' }, stub);
  assert.equal(rise.style.path, 'rise');
  assert.ok(rise.archAmount > 0);
  assert.ok(rise.glyphs[0].baselineY > rise.glyphs[rise.glyphs.length - 1].baselineY,
    'rise climbs left → right (higher = smaller y)');
  assert.ok(rise.style.greetingTiltDeg < 0);

  const desert = measureLargeLetterPostcard({ name: 'Oud-West', style: 'desert-warm' }, stub);
  assert.equal(desert.style.id, 'desert-warm');
  assert.ok(desert.style.extrusionBands[0].color.startsWith('#e'));
}

// --- Path helper ------------------------------------------------------------
{
  assert.equal(baselinePathOffset('flat', 40, 0.5), 0);
  assert.ok(baselinePathOffset('arch', 40, 0.5) < baselinePathOffset('arch', 40, 0));
  assert.ok(baselinePathOffset('rise', 40, 1) < baselinePathOffset('rise', 40, 0));
}

// --- Every preset resolves --------------------------------------------------
{
  for (const id of Object.keys(POSTCARD_STYLES) as Array<keyof typeof POSTCARD_STYLES>) {
    const card = measureLargeLetterPostcard({ name: 'Jordaan', style: id }, stub);
    assert.equal(card.style.id, id);
    assert.ok(card.glyphs.length > 0);
  }
}

// --- Caption + greeting overrides ------------------------------------------
{
  const card = measureLargeLetterPostcard({
    name: 'De Pijp',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    greeting: 'Groeten uit',
    imageCount: 1,
  }, stub);
  assert.equal(card.caption, 'Amsterdam · Noord-Holland');
  assert.equal(card.greeting, 'Groeten uit');
  assert.equal(card.imageStripCount, 1);
  assert.deepEqual(card.nameLines, ['DE', 'PIJP']);
}

// --- Short name keeps a large size; long name shrinks ----------------------
{
  const short = measureLargeLetterPostcard({ name: 'Jordaan' }, stub);
  const long = measureLargeLetterPostcard({ name: 'Grachtengordel' }, stub);
  assert.ok(short.nameFontSize >= long.nameFontSize,
    `short ${short.nameFontSize} should be >= long ${long.nameFontSize}`);
  assert.ok(long.nameFontSize >= 48, 'never below the readable floor');
}

// --- Very long names split or scale instead of overflowing -----------------
{
  const card = measureLargeLetterPostcard({ name: 'Sloterdijk-Centrum' }, stub);
  assert.ok(card.nameLines.length >= 1 && card.nameLines.length <= 2);
  const band = card.letterBand.width;
  if (card.glyphs.length) {
    const left = card.glyphs[0].x;
    const last = card.glyphs[card.glyphs.length - 1];
    const right = last.x + last.width;
    assert.ok(left >= card.letterBand.x - 2, 'glyphs start in band');
    assert.ok(right <= card.letterBand.x + band + 2, 'glyphs end in band');
  }
}

// --- Split helper prefers hyphen / space / soft hyphen near the middle -----
{
  assert.deepEqual(splitNameForTwoLines('Sloterdijk-Centrum'), ['Sloterdijk', 'Centrum']);
  assert.deepEqual(splitNameForTwoLines('De Pijp West'), ['De Pijp', 'West']);
  assert.deepEqual(splitNameForTwoLines('DE PIJP'), ['DE', 'PIJP']);
  const gracht = splitNameForTwoLines('GRACHTENGORDEL');
  assert.equal(gracht[0], 'GRACHTEN-');
  assert.equal(gracht[1], 'GORDEL');
  const [a, b] = splitNameForTwoLines('Grachtengordel');
  assert.ok(a.replace(/-$/, '').length >= 4 && b.length >= 4);
}

// --- Spaced short names prefer two-line billboard ---------------------------
{
  const card = measureLargeLetterPostcard({ name: 'De Pijp' }, stub);
  assert.deepEqual(card.nameLines, ['DE', 'PIJP']);
  assert.ok(card.glyphs.filter((g) => g.char !== ' ').length >= 6);
}

// --- Letter band sits inside the card --------------------------------------
{
  const card = measureLargeLetterPostcard({ name: 'Jordaan', imageCount: 3 }, stub);
  assert.equal(card.imageStripCount, 3);
  assert.ok(card.letterBand.x >= 0);
  assert.ok(card.letterBand.y > 0);
  assert.ok(card.letterBand.x + card.letterBand.width <= card.width);
  assert.ok(card.captionY > card.letterBand.y);
  assert.equal(card.nameBaselineYs.length, card.nameLines.length);
  assert.ok(card.borderInset >= 4 && card.borderInset <= 8,
    `borderInset ${card.borderInset} should be a linen hairline (4–8)`);
  assert.ok(card.style.greetingTiltDeg !== 0 || card.style.id !== 'linen-arch');
}

// --- coverCropFocus pans per letter ------------------------------------------------
{
  // Imported indirectly: measure still works with multi imageCount.
  const card = measureLargeLetterPostcard({ name: 'Jordaan', imageCount: 7 }, stub);
  assert.equal(card.glyphs.length, 7);
  assert.equal(card.imageStripCount, 7);
}

process.stdout.write('Large-letter postcard checks passed.\n');

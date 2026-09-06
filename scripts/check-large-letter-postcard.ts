/**
 * Layout for the classic large-letter postcard — fit, two-line split, caption,
 * and image-strip mode — without painting. Paint stays in Storybook.
 */
import assert from 'node:assert/strict';
import {
  LARGE_LETTER_HEIGHT,
  LARGE_LETTER_WIDTH,
  measureLargeLetterPostcard,
  splitNameForTwoLines,
} from '../src/canalRecall/largeLetterPostcard.ts';

const stub = (text: string, font: string) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
  // Condensed faces read closer to 0.5em than full monospace 0.6em.
  return text.length * size * 0.52;
};

// --- Defaults ---------------------------------------------------------------
{
  const card = measureLargeLetterPostcard({ name: 'Jordaan' }, stub);
  assert.equal(card.width, LARGE_LETTER_WIDTH);
  assert.equal(card.height, LARGE_LETTER_HEIGHT);
  assert.equal(card.greeting, 'Greetings from');
  assert.deepEqual(card.nameLines, ['JORDAAN']);
  assert.equal(card.caption, 'Amsterdam');
  assert.equal(card.imageStripCount, 0);
  assert.equal(card.horizontalScale, 1);
  assert.ok(card.nameFontSize >= 42 && card.nameFontSize <= 118);
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
  assert.deepEqual(card.nameLines, ['DE PIJP']);
}

// --- Short name keeps a large size; long name shrinks ----------------------
{
  const short = measureLargeLetterPostcard({ name: 'Jordaan' }, stub);
  const long = measureLargeLetterPostcard({ name: 'Grachtengordel' }, stub);
  assert.ok(short.nameFontSize >= long.nameFontSize,
    `short ${short.nameFontSize} should be >= long ${long.nameFontSize}`);
  assert.ok(long.nameFontSize >= 42, 'never below the readable floor');
}

// --- Very long names split or scale instead of overflowing -----------------
{
  const card = measureLargeLetterPostcard({ name: 'Sloterdijk-Centrum' }, stub);
  assert.ok(card.nameLines.length >= 1 && card.nameLines.length <= 2);
  const band = card.letterBand.width;
  for (const line of card.nameLines) {
    const raw = stub(line, card.nameFont) * card.horizontalScale;
    assert.ok(raw <= band + 1,
      `line ${JSON.stringify(line)} at scale ${card.horizontalScale} overflows (${raw} > ${band})`);
  }
  if (card.nameLines.length === 2) {
    assert.ok(card.nameLines[0].includes('SLOTERDIJK') || card.nameLines[0].endsWith('-'));
  }
}

// --- Split helper prefers hyphen / space near the middle -------------------
{
  assert.deepEqual(splitNameForTwoLines('Sloterdijk-Centrum'), ['Sloterdijk-', 'Centrum']);
  assert.deepEqual(splitNameForTwoLines('De Pijp West'), ['De Pijp', 'West']);
  const [a, b] = splitNameForTwoLines('Grachtengordel');
  assert.ok(a.length > 0 && b.length > 0);
  assert.equal(a + b, 'Grachtengordel');
}

// --- Letter band sits inside the card --------------------------------------
{
  const card = measureLargeLetterPostcard({ name: 'Jordaan', imageCount: 3 }, stub);
  assert.equal(card.imageStripCount, 3);
  assert.ok(card.letterBand.x >= 0);
  assert.ok(card.letterBand.y > 0);
  assert.ok(card.letterBand.x + card.letterBand.width <= card.width);
  assert.ok(card.letterBand.y + card.letterBand.height <= card.height);
  assert.ok(card.greetingY < card.letterBand.y);
  assert.ok(card.captionY > card.letterBand.y);
  assert.equal(card.nameBaselineYs.length, card.nameLines.length);
}

// --- Empty name still lays out ---------------------------------------------
{
  const card = measureLargeLetterPostcard({ name: '' }, stub);
  assert.equal(card.nameLines.length, 1);
  assert.ok(card.nameFontSize >= 42);
}

process.stdout.write('Large-letter postcard checks passed.\n');

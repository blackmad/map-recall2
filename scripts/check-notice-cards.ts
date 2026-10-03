/**
 * The bottom-band cards, measured rather than looked at.
 *
 * Wrapping, elision, the shrink-to-fit postcard name and the card's own height
 * used to be interleaved with canvas calls inside game.js, so the only way to
 * check that a long Dutch name fit was to drive to it. The measure pass is pure
 * now and takes a text measurer, so this runs it with a monospace stub and
 * asserts what the player would actually read.
 */
import assert from 'node:assert/strict';
import {
  coverCrop, measureLandmarkCard, measurePostcard, placeOnlyDetail, wrapToLines,
} from '../src/canalRecall/noticeCards';

/** Monospace is a fair stand-in: width is proportional to character count. */
const stub = (text: string, font: string) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
  return text.length * size * 0.6;
};

// --- The card sizes itself to what it holds ---------------------------------
{
  const bare = measureLandmarkCard({ name: 'Nes', body: '' }, stub);
  const text = measureLandmarkCard({ name: 'Nes', body: 'A street in the centre.' }, stub);
  const photo = measureLandmarkCard({ name: 'Nes', body: 'A street.', hasImage: true }, stub);
  assert.ok(bare.height >= 40 && bare.height <= 60, `a card with nothing to say stays short, got ${bare.height}`);
  assert.ok(text.height > bare.height, 'body text grows the plate');
  assert.equal(photo.height, 134, 'a photo plus its insets sets the floor');
  assert.equal(bare.imageWidth, 0);
  assert.equal(text.textLeft, 16, 'bare cards keep side padding');
  assert.ok(photo.textLeft > bare.textLeft, 'text clears the photo');

  const street = measureLandmarkCard({
    name: 'Singelgracht',
    category: 'STREET',
    hasArticle: true,
    body: 'The Singelgracht (Dutch pronunciation: [ˈsɪŋəlˌɣrɑxt]) is a semi-circular '
      + 'waterway that borders the entire city centre of Amsterdam along the canals.',
  }, stub);
  assert.equal(street.lines.length, 3, 'street cards show three body lines');
  assert.ok(street.height >= 80, `chips + three lines need air, got ${street.height}`);
  assert.equal(street.textLeft, 16);
}

// --- Body text is wrapped and cut to a budget -------------------------------
{
  const long = 'The Grachtengordel is a neighborhood in Amsterdam, Netherlands, '
    + 'located in the centre and known in English as the Canal District, and it '
    + 'goes on considerably longer than any card could hold, with still more '
    + 'about the rings of canals, the merchant houses, and the UNESCO listing '
    + 'that a glance at the bottom of the screen is never meant to replace.';
  const bare = measureLandmarkCard({ name: 'Grachtengordel', body: long }, stub);
  const photo = measureLandmarkCard({ name: 'Grachtengordel', body: long, hasImage: true }, stub);
  assert.equal(bare.lines.length, 3, 'a bare card gets three lines');
  assert.equal(photo.lines.length, 4, 'a card with a photo is taller and gets four');
  for (const line of [...bare.lines, ...photo.lines]) {
    assert.ok(line.length > 0 && !line.startsWith(' '), `bad line: ${JSON.stringify(line)}`);
  }
  assert.ok(long.startsWith(bare.lines[0]), 'wrapping preserves the text in order');
  assert.equal(bare.truncated, true, 'a body cut to three lines says so');
  assert.equal(photo.truncated, true, 'even four lines cannot hold this body');
  assert.ok(bare.lines[bare.lines.length - 1].endsWith('…'), 'a cut with no sentence end in reach ends on a word with …');
}

// --- A cut card ends on a sentence, never mid-clause ------------------------
{
  // Magere Brug on a phone ended "…officially called the Kerkstraatbrug,".
  const body = 'Around 1670, a ferry bridge was built over the Amstel, which was so narrow '
    + 'that it was only suitable for pedestrians. Although this bridge was officially called '
    + 'the Kerkstraatbrug, it soon became known as the Magere Brug, and the name stuck for good.';
  const card = measureLandmarkCard({ name: 'Magere Brug', body }, stub);
  assert.equal(card.truncated, true);
  assert.ok(card.lines[card.lines.length - 1].endsWith('pedestrians.'), JSON.stringify(card.lines));
}

// --- Only a cut card advertises the expanded panel --------------------------
{
  const fits = measureLandmarkCard({ name: 'Nes', body: 'A street in the centre.' }, stub);
  assert.equal(fits.truncated, false, 'a body that fits is not truncated');
  assert.equal(fits.badges.some((b) => b.kind === 'more'), false,
    'nothing more to read means no MORE badge');

  const empty = measureLandmarkCard({ name: 'Nes', body: '' }, stub);
  assert.equal(empty.truncated, false, 'an empty body is not a cut body');

  const long = measureLandmarkCard(
    { name: 'Oude Kerk', category: 'CHURCH', hasArticle: true, hasImage: true,
      body: 'The Oude Kerk is Amsterdam\'s oldest building and oldest parish church, '
        + 'founded in 1213 and consecrated in 1306, standing on the Oudekerksplein in '
        + 'De Wallen, and its long history runs well past what any four lines can hold.' },
    stub);
  assert.equal(long.truncated, true);
  assert.deepEqual(long.badges.map((b) => b.kind), ['category', 'article', 'more'],
    'MORE comes last, after the badges that describe the content');
  const more = long.badges[long.badges.length - 1];
  assert.ok(more.x + more.width < long.width, 'the MORE badge stays inside the card');
}

// --- Every card has a close "×", clear of MORE and the name (2026-10-03) -----
{
  for (const props of [
    { name: 'Nes', body: '' },
    { name: 'Oude Kerk', category: 'CHURCH', hasArticle: true, hasImage: true, body: 'The Oude Kerk is Amsterdam\'s oldest building and oldest parish church, founded in 1213 and consecrated in 1306, standing on the Oudekerksplein in De Wallen, and its long history runs well past what any four lines can hold.' },
    { name: 'Nederlandse Film en Televisie Academie Amsterdam Centrum', body: 'A school.', category: 'COLLEGE' },
  ]) {
    for (const width of [480, 340]) {
      const card = measureLandmarkCard(props, stub, width);
      assert.ok(card.close.x + card.close.width <= card.width - 8, `${props.name}: the close sits inside the card`);
      const more = card.badges.find((b) => b.kind === 'more');
      if (more) assert.ok(more.x + more.width < card.close.x, `${props.name}: MORE ends before the close`);
      for (const badge of card.badges) assert.ok(badge.x + badge.width < card.close.x, `${props.name}: badges end before the close`);
      if (card.headerInline) assert.ok(card.nameX + stub(card.displayName.toUpperCase(), '') <= card.close.x, `${props.name}: an inline name ends before the close`);
      assert.ok(card.closeHit.x <= card.close.x && card.closeHit.y <= card.close.y
        && card.closeHit.x + card.closeHit.width >= card.close.x + card.close.width, `${props.name}: the tap region covers the glyph`);
    }
  }
}

// --- A name too long to fit is elided, not overflowed -----------------------
{
  const short = measureLandmarkCard({ name: 'Nes', body: '' }, stub);
  assert.equal(short.displayName, 'Nes', 'a short name is untouched');
  const long = measureLandmarkCard(
    { name: 'Nederlandse Film en Televisie Academie Amsterdam Centrum', body: '', hasImage: true },
    stub);
  assert.ok(long.displayName.endsWith('…'), 'a long name is elided');
  assert.ok(long.displayName.length < 'Nederlandse Film en Televisie Academie Amsterdam Centrum'.length);
}

// --- Badges are laid out left to right without overlapping ------------------
{
  const card = measureLandmarkCard(
    { name: 'Fatih Mosque', body: 'A mosque.', category: 'LANDMARK', extractLang: 'nl', hasArticle: true },
    stub);
  assert.deepEqual(card.badges.map((b) => b.kind), ['category', 'lang', 'article']);
  for (let i = 1; i < card.badges.length; i++) {
    assert.ok(card.badges[i].x >= card.badges[i - 1].x + card.badges[i - 1].width,
      'badges must not overlap');
  }
  const last = card.badges[card.badges.length - 1];
  assert.ok(last.x + last.width < card.width, 'badges stay inside the card');
}

// A language chip is a claim about body text, so it needs body text.
{
  const card = measureLandmarkCard({ name: 'X', body: '', category: 'BRIDGE', extractLang: 'nl' }, stub);
  assert.deepEqual(card.badges.map((b) => b.kind), ['category'],
    'no blurb means no language chip to make a claim about');
}

// --- A landmark with no article still says something ------------------------
{
  assert.equal(placeOnlyDetail('library', 'Bos en Lommer'),
    'A library in Bos en Lommer. No encyclopedia article yet.');
  assert.equal(placeOnlyDetail('arts_centre', undefined),
    'An arts centre in Amsterdam. No encyclopedia article yet.',
    'the article agrees with the vowel, and the tag underscore is not shown');
}

// --- The postcard name shrinks to fit, within limits ------------------------
{
  const short = measurePostcard({ name: 'Jordaan', hasImage: true }, stub);
  const long = measurePostcard({ name: 'Sloterdijk-Centrum-Noord', hasImage: true }, stub);
  assert.equal(short.nameFontSize, 24, 'a short name keeps the full size');
  assert.ok(long.nameFontSize < short.nameFontSize, 'a long name shrinks');
  assert.ok(long.nameFontSize >= 16, 'but never below the readable floor');
  assert.equal(short.heading, 'ENTERING NEIGHBORHOOD');
  assert.equal(measurePostcard({ name: 'De Pijp', kind: 'quarter' }, stub).heading, 'ENTERING QUARTER');
  assert.ok(short.textLeft >= short.photoWidth,
    'the name starts at or past the photo edge, never under it');
}

// A borrowed photo is credited to the district it was actually taken in.
{
  assert.equal(measurePostcard({ name: 'X', imageArea: 'Zuid' }, stub).caption,
    'Photo: Zuid · Amsterdam');
  assert.equal(measurePostcard({ name: 'X' }, stub).caption, 'Amsterdam',
    'without a province the caption is just the city');
  assert.equal(
    measurePostcard({ name: 'X', provinceCaption: 'Noord-Holland' }, stub).caption,
    'Amsterdam · Noord-Holland',
  );
}

// --- Cover-crop never distorts ---------------------------------------------
{
  const wide = coverCrop(2000, 1000, 100, 100);
  assert.equal(wide.sh, 1000, 'a wide source is cropped horizontally, not squashed');
  assert.ok(Math.abs(wide.sw - 1000) < 0.001);
  assert.ok(wide.sx > 0 && wide.sy === 0, 'and centred');
  const tall = coverCrop(1000, 2000, 100, 100);
  assert.equal(tall.sw, 1000);
  assert.ok(tall.sy > 0 && tall.sx === 0);
}

// --- Chips fit the text column on a narrow phone ---------------------------
{
  // A 320-wide phone gives the touch card ~300 px; CATEGORY + WIKIPEDIA + MORE
  // overflowed it and clipped "+ MORE", the one chip saying there is more.
  const long = 'The Oude Kerk is the oldest building in Amsterdam, consecrated in 1306 and extended over three centuries into a cruciform basilica. '.repeat(12);
  const props = { name: 'Oude Kerk', body: long, category: 'CHURCH', factKind: 'history', hasArticle: true, hasImage: true };
  const narrow = measureLandmarkCard(props, stub, 300);
  const right = narrow.width - 16; // PAD_RIGHT
  const last = narrow.badges[narrow.badges.length - 1];
  assert.ok(last.x + last.width <= right + 0.001, `chips end at ${last.x + last.width}, column at ${right}`);
  assert.equal(last.kind, 'more', 'the MORE chip survives');
  const wide = measureLandmarkCard(props, stub, 900);
  assert.deepEqual(wide.badges.map(badge => badge.kind), ['category', 'fact', 'article', 'more'], 'a wide card keeps them all');
  assert.equal(wide.badges.find(badge => badge.kind === 'article')?.label, 'W  WIKIPEDIA');
}

// --- A street card is compact: chip and name on one row, "more" a link -----
{
  // User report 2026-10-02: the Prinsengracht card stretched to 480 px with a
  // "+ MORE" pill beside STREET, the name jammed under the chips, and a band
  // of empty paper below and to the right of two body lines.
  const body = "After 'the princely title', meaning that of the Princes of Orange. The canal is one "
    + 'of the three main canals, and the plainest in the character of its buildings. Its houses '
    + 'were built for merchants and artisans rather than the richest families of the Golden Age.';
  const card = measureLandmarkCard({ name: 'Prinsengracht', category: 'STREET', body }, stub);
  assert.equal(card.truncated, true);
  assert.equal(card.headerInline, true, 'STREET and PRINSENGRACHT share the header row');
  const chip = card.badges.find(b => b.kind === 'category')!;
  const more = card.badges.find(b => b.kind === 'more')!;
  assert.equal(more.label, 'MORE ›', 'more reads as an action, not a tag');
  assert.ok(card.nameX >= chip.x + chip.width + 8, 'the name clears the chip');
  assert.ok(more.x + more.width <= card.width - 16 + 0.001, 'more stays inside the right padding');
  assert.ok(more.x >= card.nameX + 13 * 16 * 0.6 + 12, 'more does not crowd the name');
  assert.ok(card.width <= 440, `the card is sized to its content, got ${card.width}`);
  assert.ok(card.height <= 100, `three lines and a header stay compact, got ${card.height}`);
  const lastBaseline = card.bodyBaseline + (card.lines.length - 1) * card.lineStep;
  const bottomAir = card.height - lastBaseline;
  assert.ok(card.headerTop >= 12 && bottomAir >= 14 && bottomAir <= 20,
    `padding is even top and bottom: top ${card.headerTop}, bottom ${bottomAir}`);

  // A short card shrinks rather than sitting in a 480 px plate.
  const short = measureLandmarkCard({ name: 'Nes', category: 'STREET', body: 'A street in the centre.' }, stub);
  assert.ok(short.width < 300, `a short card is narrow, got ${short.width}`);
  assert.equal(short.badges.some(b => b.kind === 'more'), false);

  // A name too long to share the row drops below the chips instead of eliding.
  const long = measureLandmarkCard(
    { name: 'Nieuwe Herengracht Oostelijke Eilanden', category: 'STREET', factKind: 'history', hasArticle: true, body }, stub, 330);
  assert.equal(long.headerInline, false);
  assert.ok(long.nameBaseline > long.headerTop + long.badgeHeight, 'a stacked name sits below the chips');
  assert.ok(long.bodyBaseline > long.nameBaseline + 12, 'and the body below the name');
}

// --- Wrapping degenerate input ----------------------------------------------
{
  assert.deepEqual(wrapToLines('', 100, 2, stub, '10px monospace'), []);
  const single = wrapToLines('Supercalifragilisticexpialidocious', 10, 2, stub, '10px monospace');
  assert.equal(single.length, 1, 'a single unbreakable word is kept rather than dropped');
}

process.stdout.write('Notice card checks passed.\n');

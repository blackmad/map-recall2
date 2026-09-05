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
  assert.ok(bare.height >= 50 && bare.height <= 60, 'a card with nothing to say stays short');
  assert.ok(text.height > bare.height, 'body text grows the plate');
  assert.equal(photo.height, 136, 'a photo sets the floor');
  assert.equal(bare.imageWidth, 0);
  assert.equal(text.textLeft, 20, 'bare cards keep side padding');
  assert.ok(photo.textLeft > bare.textLeft, 'text clears the photo');

  const street = measureLandmarkCard({
    name: 'Singelgracht',
    category: 'STREET',
    hasArticle: true,
    body: 'The Singelgracht (Dutch pronunciation: [ˈsɪŋəlˌɣrɑxt]) is a semi-circular '
      + 'waterway that borders the entire city centre of Amsterdam along the canals.',
  }, stub);
  assert.equal(street.lines.length, 3, 'street cards show three body lines');
  assert.ok(street.height >= 100, `badges + three lines need air, got ${street.height}`);
  assert.equal(street.textLeft, 20);
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
  assert.equal(measurePostcard({ name: 'X' }, stub).caption, 'Amsterdam · Noord-Holland');
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

// --- Wrapping degenerate input ----------------------------------------------
{
  assert.deepEqual(wrapToLines('', 100, 2, stub, '10px monospace'), []);
  const single = wrapToLines('Supercalifragilisticexpialidocious', 10, 2, stub, '10px monospace');
  assert.equal(single.length, 1, 'a single unbreakable word is kept rather than dropped');
}

process.stdout.write('Notice card checks passed.\n');

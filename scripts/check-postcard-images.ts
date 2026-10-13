/**
 * Map Recall's layered postcard and folded answer card. User report 2026-10-02: the postcard popped
 * in late (composed at reveal after all eight photographs loaded) and the card hid the
 * neighbourhood it named. The card is now drawn with transparent letter faces
 * (`photoWindows`) over plain images placed by `largeLetterPhotoWindows`.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import {
  largeLetterPhotoWindows, letterPhotoRuns, letterRunSizes, measureLargeLetterPostcard, photoFilterMode, photoToneFromPixels, PHOTO_TONE_GRID, type OtFont,
} from '../src/canalRecall/largeLetterPostcard.ts';
import { postcardPhotosFor } from '../src/mapRecall/postcardPhotos.ts';
import { answerTeaser } from '../src/mapRecall/answerSummary.ts';
import type { PlacePhoto } from '../src/types.ts';

const photo = (imageUrl: string): { name: string; photo: PlacePhoto } => ({
  name: imageUrl, photo: { imageUrl, imageAttribution: 'test', sourceUrl: imageUrl } as PlacePhoto,
});

// --- Which photographs a postcard is cut from --------------------------------
{
  const area = { type: 'neighborhood' as const, wikipediaImageUrl: 'lede.jpg', areaPhotos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map(photo) };
  assert.deepEqual(postcardPhotosFor(area), ['lede.jpg', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], 'own image first, eight at most');
  assert.deepEqual(postcardPhotosFor({ ...area, areaPhotos: [] }), ['lede.jpg'], 'one photograph can fill the postcard');
  assert.deepEqual(postcardPhotosFor({ ...area, type: 'street' }), [], 'only neighbourhoods get postcards');
}

// --- Photo windows match what the canvas paints into each letter -----------
{
  const buffer = readFileSync('public/canal-drive/fonts/Anton-Regular.ttf');
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)) as unknown as OtFont;
  const stub = (text: string, spec: string) => text.length * Number(/(\d+(?:\.\d+)?)px/.exec(spec)?.[1] ?? 12) * 0.62;
  const pathXs = (d: string) => [...d.matchAll(/[MLCQ]([-\d.]+) ([-\d.]+)/g)].map((m) => Number(m[1]));
  for (const name of ['Nieuwmarktbuurt', 'Jordaan', 'Oud-West']) {
    const layout = measureLargeLetterPostcard({ name, cityName: 'Amsterdam', imageCount: 8, width: 640, height: 400 }, stub, { font, pathWarp: true });
    const letters = name.replace(/[\s-]/g, '').length;
    // The original card: one photograph per letter (still available as windowsPerPhoto: 'letter').
    const perLetter = largeLetterPhotoWindows(layout, 8, font, { windowsPerPhoto: 'letter' });
    assert.equal(perLetter.windows.length, letters, `${name}: one window per letter`);
    for (const window of perLetter.windows) {
      assert.match(window.d, /^M[-\d.]+ [-\d.]+/, `${name}: window path`);
      assert.ok(window.box.width > 4 && window.box.height > 4, `${name}: window box`);
      assert.ok(window.imageIndex >= 0 && window.imageIndex < 8);
      assert.equal(window.letters.length, 1);
      // The path is relative to its box: its points sit near the box, not at card coordinates.
      const xs = pathXs(window.d);
      assert.ok(Math.min(...xs) > -window.box.width && Math.max(...xs) < window.box.width * 2, `${name}: path in box space`);
    }
    // The first photograph is the backdrop; the letters start from the second (drawLargeLetterPostcard rotates them).
    const byLetter = [...perLetter.windows].sort((a, b) => a.letters[0] - b.letters[0]).map((window) => window.imageIndex);
    assert.equal(byLetter[0], 1, `${name}: first letter gets the second photograph`);
    assert.ok(perLetter.matrix.every(Number.isFinite));
    assert.ok(perLetter.clip.width > 600 && perLetter.clip.height > 360, `${name}: photos clipped to the printed border`);

    // Review 2026-10-13: eight photographs gave each letter a ~60 px crop, unrecognisable at quiz
    // sizes. Default runs: one photograph across 2-4 adjacent letters, 3-5 distinct photographs.
    const { windows } = largeLetterPhotoWindows(layout, 8, font);
    const covered = windows.flatMap((window) => window.letters).sort((a, b) => a - b);
    assert.deepEqual(covered, Array.from({ length: letters }, (_, i) => i), `${name}: every letter in exactly one run`);
    const distinct = new Set(windows.map((window) => window.imageIndex)).size;
    assert.ok(distinct >= 3 && distinct <= 5, `${name}: ${distinct} photographs, want 3-5`);
    for (const window of windows) {
      assert.ok(window.letters.length >= 2 && window.letters.length <= 4, `${name}: run of ${window.letters.length}`);
      assert.ok(window.letters.every((letter, k) => k === 0 || letter === window.letters[k - 1] + 1), `${name}: runs are adjacent letters`);
      assert.equal((window.d.match(/M/g) ?? []).length >= window.letters.length, true, `${name}: a subpath per letter`);
      const xs = pathXs(window.d);
      assert.ok(Math.min(...xs) > -8 && Math.max(...xs) < window.box.width + 8, `${name}: run path inside its box`);
      assert.equal(window.filterMode, 'poster', 'unmeasured photographs keep the poster filter');
    }
    const first = windows.find((window) => window.letters[0] === 0)!;
    assert.equal(first.imageIndex, 1, `${name}: the first run gets the second photograph`);
  }
  // Runs follow words and lines, and never cross a hyphen: OUD-WEST is OUD | WE | ST.
  {
    const layout = measureLargeLetterPostcard({ name: 'Oud-West', imageCount: 8 }, stub, { font, pathWarp: true });
    const runs = letterPhotoRuns(layout, 8);
    assert.deepEqual(runs.map((run) => run.letters.length), [3, 2, 2]);
  }
  assert.deepEqual(letterRunSizes([7]), [3, 2, 2], 'JORDAAN: three runs');
  assert.deepEqual(letterRunSizes([9, 10]), [3, 3, 3, 4, 3, 3], 'HOOFDDORP / PLEINBUURT: 2-4 letters each');
  assert.deepEqual(letterRunSizes([2, 4]), [2, 2, 2], 'DE PIJP: DE | PI | JP');
  assert.deepEqual(letterRunSizes([3]), [3], 'a three-letter name stays one run');
  const single = measureLargeLetterPostcard({ name: 'Jordaan', imageCount: 1 }, stub, { font, pathWarp: true });
  assert.ok(largeLetterPhotoWindows(single, 1, font).windows.every((window) => window.imageIndex === 0), 'one photograph fills every letter');
  // Two photographs: the backdrop is reused in a run rather than leaving a window empty.
  assert.deepEqual(largeLetterPhotoWindows(single, 2, font).windows.map((window) => window.imageIndex).sort(), [0, 1, 1]);

  // A measured busy/brick photograph gets the soft filter in its window.
  const brick = { saturation: 0.4, hue: 20, brick: 0.9, busy: 0.04 };
  const tones = [null, brick];
  const soft = largeLetterPhotoWindows(single, 8, font, { photoTones: tones }).windows.find((window) => window.imageIndex === 1)!;
  assert.equal(soft.filterMode, 'soft');
  assert.ok(!soft.filter.includes('url('), 'soft windows skip the posterise filter');
}

// --- Poster or soft: the tone gate ------------------------------------------
{
  const grid = (rgb: (x: number, y: number) => [number, number, number]) => {
    const n = 32;
    const data = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const [r, g, b] = rgb(x, y);
      data.set([r, g, b, 255], (y * n + x) * 4);
    }
    return photoToneFromPixels(data, n, n);
  };
  const canal = grid((_x, y) => (y < 14 ? [150, 185, 225] : [70, 95, 110]));
  assert.equal(photoFilterMode(canal), 'poster', `canal and sky keep the poster (${JSON.stringify(canal)})`);
  const brickWall = grid((x, y) => ((y % 4 === 0 || (x + (y >> 2) * 3) % 8 === 0) ? [190, 185, 175] : [150, 70, 45]));
  assert.equal(photoFilterMode(brickWall), 'soft', `a brick wall goes soft (${JSON.stringify(brickWall)})`);
  const busy = grid((x, y) => ((x + y) % 2 ? [30, 30, 30] : [220, 220, 220]));
  assert.equal(photoFilterMode(busy), 'soft', 'a busy grey texture goes soft');
  assert.equal(photoFilterMode(null), 'poster', 'an unreadable photograph keeps the poster');
}

// --- Real Commons photographs (only when fetched to /tmp; never committed) ---
// Fetch: see LARGE_LETTER_CRAFT.md round 5. Pins the thresholds on the Helmersbuurt brick wall and
// the Da Costabuurt canal named in the 2026-10-13 review.
{
  const manifestPath = '/tmp/mr-postcard/photos/manifest.json';
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, Array<{ file: string; url: string }>>;
    const sharp = (await import('sharp')).default;
    const toneOf = async (file: string) => {
      const { data } = await sharp(file).resize(PHOTO_TONE_GRID, PHOTO_TONE_GRID, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return photoToneFromPixels(data, PHOTO_TONE_GRID, PHOTO_TONE_GRID);
    };
    const expect: Array<[string, RegExp, 'poster' | 'soft']> = [
      ['Helmersbuurt', /Unsplash_vKAJB9KnB64/, 'soft'],
      ['Helmersbuurt', /Toilet_/, 'soft'],
      ['Helmersbuurt', /Amsterdam_Canal\.\.JPG/, 'poster'],
      ['Da Costabuurt', /Elisabeth_Wolffstraat/, 'soft'],
      ['Da Costabuurt', /De_Liefde/, 'soft'],
      ['Da Costabuurt', /Da-Costagracht_Canal/, 'poster'],
      ['Da Costabuurt', /Hugo_de_Grootgracht/, 'poster'],
    ];
    let checked = 0;
    for (const [area, pattern, mode] of expect) {
      const entry = manifest[area]?.find((photo) => pattern.test(photo.url));
      if (!entry || !existsSync(entry.file)) continue;
      const tone = await toneOf(entry.file);
      assert.equal(photoFilterMode(tone), mode, `${area} ${pattern}: ${JSON.stringify(tone)}`);
      checked += 1;
    }
    console.log(`postcard images: ${checked} fetched Commons photographs classified`);
  }
}

// --- The folded card's opening line ------------------------------------------
{
  const origin = { text: 'Named after the tanners.', sourceUrl: 'u', sourceLabel: 'Wikipedia' };
  assert.equal(answerTeaser({ nameOrigin: origin, wikipediaExtract: 'An area.' }), origin.text, 'why it is called this comes first');
  assert.equal(answerTeaser({ wikipediaExtract: 'An area in the east.' }), 'An area in the east.');
  assert.equal(answerTeaser({ history: { ...origin, text: 'Built in 1900.' } }), 'Built in 1900.');
  assert.equal(answerTeaser({ localFact: { ...origin, text: 'The Jewish quarter today.' }, nameOrigin: origin }), origin.text, 'name meaning remains visible ahead of local trivia');
  assert.equal(answerTeaser({ neighborhoodTopFacts: [{ ...origin, text: 'A local story.' }], nameOrigin: origin }), origin.text, 'stories do not hide the name meaning');
  assert.equal(answerTeaser({}), undefined);
}

console.log('postcard images: ok');

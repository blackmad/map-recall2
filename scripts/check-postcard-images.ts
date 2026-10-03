/**
 * Map Recall's layered postcard and folded answer card. User report 2026-10-02: the postcard popped
 * in late (composed at reveal after all eight photographs loaded) and the card hid the
 * neighbourhood it named. The card is now drawn with transparent letter faces
 * (`photoWindows`) over plain images placed by `largeLetterPhotoWindows`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { largeLetterPhotoWindows, measureLargeLetterPostcard, type OtFont } from '../src/canalRecall/largeLetterPostcard.ts';
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
  assert.deepEqual(postcardPhotosFor({ ...area, areaPhotos: [] }), [], 'one photograph is a thumbnail, not a postcard');
  assert.deepEqual(postcardPhotosFor({ ...area, type: 'street' }), [], 'only neighbourhoods get postcards');
}

// --- Photo windows match what the canvas used to paint into each letter -----
{
  const buffer = readFileSync('public/canal-drive/fonts/Anton-Regular.ttf');
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)) as unknown as OtFont;
  const stub = (text: string, spec: string) => text.length * Number(/(\d+(?:\.\d+)?)px/.exec(spec)?.[1] ?? 12) * 0.62;
  for (const name of ['Nieuwmarktbuurt', 'Jordaan', 'Oud-West']) {
    const layout = measureLargeLetterPostcard({ name, cityName: 'Amsterdam', imageCount: 8, width: 640, height: 400 }, stub, { font, pathWarp: true });
    const { windows, matrix, clip } = largeLetterPhotoWindows(layout, 8, font);
    const letters = name.replace(/[\s-]/g, '').length;
    assert.equal(windows.length, letters, `${name}: one window per letter`);
    for (const window of windows) {
      assert.match(window.d, /^M[-\d.]+ [-\d.]+/, `${name}: window path`);
      assert.ok(window.box.width > 4 && window.box.height > 4, `${name}: window box`);
      assert.ok(window.imageIndex >= 0 && window.imageIndex < 8);
      // The path is relative to its box: its points sit near the box, not at card coordinates.
      const xs = [...window.d.matchAll(/[MLCQ]([-\d.]+) ([-\d.]+)/g)].map((m) => Number(m[1]));
      assert.ok(Math.min(...xs) > -window.box.width && Math.max(...xs) < window.box.width * 2, `${name}: path in box space`);
    }
    // The first photograph is the backdrop; the letters start from the second (drawLargeLetterPostcard rotates them).
    const byLetter = [...windows].sort((a, b) => a.focusX - b.focusX).map((window) => window.imageIndex);
    assert.equal(byLetter[0], 1, `${name}: first letter gets the second photograph`);
    assert.ok(matrix.every(Number.isFinite));
    assert.ok(clip.width > 600 && clip.height > 360, `${name}: photos clipped to the printed border`);
  }
  const single = measureLargeLetterPostcard({ name: 'Jordaan', imageCount: 1 }, stub, { font, pathWarp: true });
  assert.ok(largeLetterPhotoWindows(single, 1, font).windows.every((window) => window.imageIndex === 0), 'one photograph fills every letter');
}

// --- The folded card's opening line ------------------------------------------
{
  const origin = { text: 'Named after the tanners.', sourceUrl: 'u', sourceLabel: 'Wikipedia' };
  assert.equal(answerTeaser({ nameOrigin: origin, wikipediaExtract: 'An area.' }), origin.text, 'why it is called this comes first');
  assert.equal(answerTeaser({ wikipediaExtract: 'An area in the east.' }), 'An area in the east.');
  assert.equal(answerTeaser({ history: { ...origin, text: 'Built in 1900.' } }), 'Built in 1900.');
  assert.equal(answerTeaser({ localFact: { ...origin, text: 'The Jewish quarter today.' }, nameOrigin: origin }), 'The Jewish quarter today.', 'the reviewed local fact leads, as on the full card');
  assert.equal(answerTeaser({}), undefined);
}

console.log('postcard images: ok');

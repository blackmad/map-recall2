import assert from 'node:assert/strict';
import test from 'node:test';
import { ELLIPSIS, fitPillText, PILL_MAX_CHARS } from './pillText';

test('a pill shows the whole name when it fits', () => {
  assert.equal(fitPillText('Hortus Botanicus greenhouses'), 'Hortus Botanicus greenhouses');
  assert.equal(fitPillText('  Westerkerk  '), 'Westerkerk');
});

test('a long name ends with an ellipsis after a whole word, within the cap', () => {
  const t = fitPillText('Canal Ring Area of Amsterdam inside the Singelgracht');
  assert.equal(t, `Canal Ring Area of Amsterdam inside${ELLIPSIS}`);
  assert.ok(t.length <= PILL_MAX_CHARS);
  const m = fitPillText('Nationaal Monument op de Dam en het Koninklijk Paleis');
  assert.ok(m.endsWith(ELLIPSIS) && m.length <= PILL_MAX_CHARS, m);
  const head = m.slice(0, -1);
  assert.ok('Nationaal Monument op de Dam en het Koninklijk Paleis'.startsWith(`${head} `), `cut mid-word: ${m}`);
});

test('the pixel cap binds when it is the tighter one', () => {
  const measure = (s: string) => s.length * 10; // 10 px per character
  const t = fitPillText('Hortus Botanicus greenhouses', { measure, maxPx: 200 });
  assert.equal(t, `Hortus Botanicus${ELLIPSIS}`);
  assert.ok(measure(t) <= 200);
});

test('no trailing punctuation before the ellipsis', () => {
  assert.equal(fitPillText('Museum Het Schip, Amsterdamse School', { maxChars: 18 }), `Museum Het Schip${ELLIPSIS}`);
});

test('a single word longer than the cap is the only mid-word cut', () => {
  const t = fitPillText('Rijksmonumentenregisterinschrijving', { maxChars: 12 });
  assert.equal(t.length, 12);
  assert.ok(t.endsWith(ELLIPSIS));
});

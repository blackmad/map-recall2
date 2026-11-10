import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitFinishTitle, wrapWords } from './finishTitle';

/** A fake canvas: every character is `size * 0.6` px wide at the current font. */
function fakeCtx() {
  return {
    font: '800 26px system-ui, sans-serif',
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(this.font)![1]);
      return { width: text.length * size * 0.6 };
    },
  };
}

test('a short name keeps the roomiest size on one line', () => {
  const layout = fitFinishTitle(fakeCtx(), 'Dam', 354);
  assert.deepEqual(layout, { size: 26, lineHeight: 30, lines: ['Dam'] });
});

test('a name a little too long steps the size down before wrapping', () => {
  // 27 characters: 421 px at 26, 324 px at 20; the 354 px phone line fits it at 20... or a larger step.
  const layout = fitFinishTitle(fakeCtx(), 'Vondelpark Open Air Theater', 354);
  assert.equal(layout.lines.length, 1);
  assert.equal(layout.lines[0], 'Vondelpark Open Air Theater');
  assert.ok(layout.size < 26);
});

test('a long name wraps to two whole lines at the smallest size, never "…"', () => {
  const name = 'Rijksmuseum en Museumplein hoofdingang';
  const layout = fitFinishTitle(fakeCtx(), name, 354);
  assert.equal(layout.size, 20);
  assert.equal(layout.lines.length, 2);
  assert.equal(layout.lines.join(' '), name);
});

test('only a name too long for two lines ends in an ellipsis', () => {
  const name = 'Rijksmuseum en Museumplein (hoofdingang aan de Museumstraat) en nog veel meer';
  const layout = fitFinishTitle(fakeCtx(), name, 354);
  assert.equal(layout.lines.length, 2);
  assert.ok(layout.lines[1].endsWith('…'));
  for (const line of layout.lines) assert.ok(line.length * 12 <= 354, line);
});

test('the font is restored after measuring', () => {
  const ctx = fakeCtx();
  ctx.font = '13px serif';
  fitFinishTitle(ctx, 'Vondelpark Open Air Theater', 200);
  assert.equal(ctx.font, '13px serif');
});

test('wrapWords never splits a word that fits a line', () => {
  assert.deepEqual(wrapWords(t => t.length, 'aa bb cc', 5, 2), ['aa bb', 'cc']);
});

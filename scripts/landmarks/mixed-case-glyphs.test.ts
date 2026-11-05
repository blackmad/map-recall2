import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GL} from './nearbar-kit';
import {MIXED_CASE_EXTRA, MIXED_CASE_GLYPHS, glyphRuns} from './mixed-case-glyphs';

test('extra glyphs are 5 x 7 and never redefine a GL glyph', () => {
  for (const [ch, rows] of Object.entries(MIXED_CASE_EXTRA)) {
    assert.equal(rows.length, 7, ch);
    for (const r of rows) assert.match(r, /^[01]{5}$/, `${ch}: ${r}`);
    assert.ok(!(ch in GL), `${ch} already in GL: the extra table must not shadow it`);
  }
  for (const ch of Object.keys(GL)) assert.deepEqual(MIXED_CASE_GLYPHS[ch], GL[ch]);
});

test('the Filmacademie lettering has every glyph, and runs tile the pixel grid', () => {
  const text = 'Nederlandse Filmacademie', px = 0.13;
  const {runs, width} = glyphRuns(text, px);
  assert.ok(Math.abs(width - ([...text].length * 6 - 1) * px) < 1e-9);
  const pixels = [...text].reduce((s, ch) => s + MIXED_CASE_GLYPHS[ch].join('').split('').filter(c => c === '1').length, 0);
  const covered = runs.reduce((s, r) => s + Math.round((r.t1 - r.t0) / px), 0);
  assert.equal(covered, pixels);
  for (const r of runs) { assert.ok(r.y0 >= 0 && r.y1 <= 7 * px + 1e-9); assert.ok(r.t1 <= width + 1e-9); }
});

test('an unknown character throws instead of drawing nothing', () => {
  assert.throws(() => glyphRuns('Q?', 0.1));
});

test('the Tetterode frieze has every glyph (the slash from the extra table)', () => {
  const text = "LETTERGIETERIJ 'AMSTERDAM' V/H N.TETTERODE", px = 0.07;
  const {width} = glyphRuns(text, px);
  assert.ok(Math.abs(width - ([...text].length * 6 - 1) * px) < 1e-9);
  assert.ok(!('/' in GL) && "'" in GL);
});

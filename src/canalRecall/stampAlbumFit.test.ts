// G5 gate: every buurt in the catalogue fits its square stamp. No glyph's
// advance box or painted ink (face + extrusion, after the paint transform)
// touches the stamp's inner frame, measured with the real outline font.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measurePaintedFaceBounds, measurePaintedLetterBounds, SQUARE_CARD_ASPECT } from './largeLetterPostcard.ts';
import * as opentype from 'opentype.js';
import { STAMP_ART_SIZE, stampLayout } from './stampAlbumStamp.ts';
import type { OtFont } from './largeLetterGlyphPaths.ts';
import { BUURT_KIND_RANKS } from './knowledgeMap.ts';

const root = new URL('../../', import.meta.url);
const fontBytes = readFileSync(new URL('public/canal-drive/fonts/Anton-Regular.ttf', root));
const ot = ((opentype as unknown as { default?: typeof opentype }).default ?? opentype);
const font = ot.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength)) as unknown as OtFont;
const boundaries = JSON.parse(readFileSync(new URL('public/data/extracts/amsterdam/boundaries.json', root), 'utf8')) as Array<{ name: string; kind: string }>;
const NAMES = [...new Set(boundaries.filter(b => BUURT_KIND_RANKS[b.kind]).map(b => b.name))].sort();
// Greeting/caption text only; the name is measured from the outline font.
const measure = (text: string, spec: string) => text.length * Number(/(\d+(?:\.\d+)?)px/.exec(spec)?.[1] ?? 12) * 0.55;

test('the catalogue is the album: every ranked buurt', () => {
  assert.equal(NAMES.length, 89);
});

test('every buurt name fits its square stamp, no glyph touching the inner frame', () => {
  const failures: string[] = [];
  for (const name of NAMES) {
    for (const size of [STAMP_ART_SIZE, 208]) {
      const layout = stampLayout(name, size, measure, font);
      const lo = layout.borderInset;
      const hi = layout.width - layout.borderInset;
      const glyphs = layout.glyphs.filter(g => g.char !== ' ' && g.char !== '-');
      const boxMin = Math.min(...glyphs.map(g => g.x));
      const boxMax = Math.max(...glyphs.map(g => g.x + g.width));
      const face = measurePaintedFaceBounds(layout);
      const ink = measurePaintedLetterBounds(layout);
      const worst = Math.max(lo - boxMin, boxMax - hi, lo - face.minX, face.maxX - hi, lo - ink.minX, ink.maxX - hi, lo - ink.minY, ink.maxY - (layout.height - lo));
      if (worst > 0) failures.push(`${name}@${size}: ${worst.toFixed(1)} px over (${layout.nameLines.join(' / ')})`);
    }
  }
  assert.deepEqual(failures, []);
});

test('long single words split at the buurt seam', () => {
  const lines = (name: string) => stampLayout(name, STAMP_ART_SIZE, measure, font).nameLines.map(line => line.replace(/-$/, ''));
  assert.deepEqual(lines('Vondelparkbuurt'), ['VONDELPARK', 'BUURT']);
  assert.deepEqual(lines('Staatsliedenbuurt'), ['STAATSLIEDEN', 'BUURT']);
  assert.deepEqual(lines('Spaarndammerbuurt'), ['SPAARNDAMMER', 'BUURT']);
  assert.deepEqual(lines('Nieuwmarktbuurt'), ['NIEUWMARKT', 'BUURT']);
  assert.deepEqual(lines('Grachtengordel'), ['GRACHTEN', 'GORDEL']);
});

test('only square cards take the square fit', () => {
  // The landscape cards (640×400, 1280×800) sit well below the threshold, so
  // their layouts stay byte-identical.
  assert.ok(400 / 640 < SQUARE_CARD_ASPECT && 800 / 1280 < SQUARE_CARD_ASPECT);
});

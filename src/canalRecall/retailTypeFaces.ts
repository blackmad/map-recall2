// Fascia lettering faces for independents (lane retail-real-20261115; David 2026-11-15: no pixel font, "proper
// typefaces, a small set of styles per shop type"). Three open (SIL OFL) faces beside round 3c's bold sans:
//   serif      Abril Fatface: the gold-leaf or painted serif of traditional shops, cafés, cheese and bookshops
//   condensed  Bebas Neue: the tall condensed caps of takeaways, phone shops, exchanges
//   script     Lobster: the joined script of bakeries, florists, gelato and waffle shops
// scripts/retail-real/build-type-pages.ts renders each face's glyphs, shelf-packed by advance, onto its own 512 px page
// (public/canal-drive/materials/retail-logos/type-<face>.png) and writes their rects to retailTypeMetrics.gen.ts. A
// letter is one quad over its advance box (side bearings included), so neighbouring quads abut and never overlap: the
// script's joins meet at the box edge. paintLookAtlas turns a page into the mask channels the bold-sans cell uses
// (coverage in the tint, the rest in the accent), so one quad takes the letters' and the board's colours.
import { TYPE_METRICS } from './retailTypeMetrics.gen.js';

export const TYPE_FACES = ['serif', 'condensed', 'script'] as const;
export type TypeFace = (typeof TYPE_FACES)[number];
/** The characters each page holds; an accented letter not on it draws its base letter (NFD), others advance as a space.
 *  Lane shopfront-feedback-20261123 (note fd607d78, 'Café Bonjour' lettered 'CAF BONJOUR'): the accented letters of
 *  Dutch, French and Turkish shop names appended after the original set, so every earlier glyph keeps its place. */
export const TYPE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&'.-" + 'ÉÈËÊÖÔÜÏÁÀÄÇéèëêöôüïáàäç';
/** Page geometry (px at the 512 px publish): rows of ROW_PX, the font at FONT_PX, its baseline BASE_PX down a row. */
export const TYPE_PAGE = { size: 512, rowPx: 84, fontPx: 64, basePx: 62, gapPx: 4 } as const;
/** A face's cap height as a share of the quad's height (measured by the builder; for the letter-size rule). */
export const capShare = (face: TypeFace): number => TYPE_METRICS[face]?.cap ?? 0.55;

export type TypeQuad = { ch: string; a0: number; a1: number; rect: [number, number, number, number] };
/**
 * The text laid out in units of the quad's height: one quad per known character (uv rect, v up) and the width.
 * `caps` uppercases first (Bebas has no lower case; the serif reads as a sign in capitals).
 */
export function typeLayout(face: TypeFace, text: string): { quads: TypeQuad[]; width: number } {
  const m = TYPE_METRICS[face], quads: TypeQuad[] = [];
  if (!m) return { quads, width: 0 };
  const P = TYPE_PAGE.size, rowH = TYPE_PAGE.rowPx;
  let x = 0;
  for (const ch of face === 'script' ? text : text.toUpperCase()) {
    const g = m.glyphs[ch] ?? m.glyphs[ch.normalize('NFD')[0]];
    if (!g) { x += m.space; continue; }
    const [gx, row, adv] = g, w = adv / rowH, y0 = row * rowH;
    quads.push({ ch, a0: x, a1: x + w, rect: [gx / P, 1 - (y0 + rowH) / P, (gx + adv) / P, 1 - y0 / P] });
    x += w;
  }
  return { quads, width: x };
}
/** Script names read in title case (bakkerij Vlaamsch Broodhuys -> Vlaamsch Broodhuys); a staged word is in capitals. */
export function titleCase(word: string): string {
  return word.toLowerCase().replace(/(^|[\s'&.-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

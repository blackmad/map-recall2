import {GL} from './nearbar-kit';

/**
 * Mixed-case 5 x 7 pixel glyphs the shared table (`GL`, nearbar-kit.ts) lacks, kept in their own table so every model
 * that letters with `GL` exports byte-identically (a glyph missing from `GL` draws nothing; adding it there would
 * change any builder whose text already holds that character). Lane #202, for the "Nederlandse Filmacademie" lettering
 * on the Markenplein front (Wikimedia Commons, FaceMePLS 2014; 2021 city panorama): the shared table has no `F`, `a`,
 * `d`, `r` or `s`. Lowercase glyphs keep GL's x-height (rows 2-6) and ascender rows (0-1).
 */
export const MIXED_CASE_EXTRA: Readonly<Record<string, readonly string[]>> = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  d: ['00001', '00001', '01101', '10011', '10001', '10011', '01101'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  f: ['00110', '01000', '01000', '11110', '01000', '01000', '01000'],
  t: ['01000', '01000', '11110', '01000', '01000', '01001', '00110'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
};

/** GL plus the extra glyphs; GL wins where both define a character, so nothing GL already draws changes. */
export const MIXED_CASE_GLYPHS: Readonly<Record<string, readonly string[]>> = {...MIXED_CASE_EXTRA, ...GL};

/** One horizontal pixel run of a glyph: [t0, t1] along the text line (metres from its start), row bottom y and height. */
export type GlyphRun = {t0: number; t1: number; y0: number; y1: number};

/**
 * Pixel runs of `text` set from t = 0 with `px` metre pixels, a 1-pixel letter gap and baseline y = 0 (the bottom of
 * row 6). Returns the runs and the total width. Throws on a character neither table has, so a sign never ships with a
 * silently missing letter.
 */
export function glyphRuns(text: string, px: number, table: Readonly<Record<string, readonly string[]>> = MIXED_CASE_GLYPHS) {
  const runs: GlyphRun[] = [];
  let u = 0;
  for (const ch of text) {
    const rows = table[ch];
    if (!rows) throw new Error(`glyphRuns: no glyph for ${JSON.stringify(ch)}`);
    rows.forEach((row, j) => {
      let k = 0;
      while (k < row.length) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < row.length && row[e] === '1') e++;
        runs.push({t0: u + k * px, t1: u + e * px, y0: (6 - j) * px, y1: (7 - j) * px});
        k = e;
      }
    });
    u += 6 * px;
  }
  return {runs, width: Math.max(0, u - px)};
}

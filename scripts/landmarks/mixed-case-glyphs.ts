import {GL} from './nearbar-kit';

/**
 * Mixed-case 5 x 7 pixel glyphs the shared table (`GL`, nearbar-kit.ts) lacks, kept in their own table so every model
 * that letters with `GL` exports byte-identically (a glyph missing from `GL` draws nothing; adding it there would
 * change any builder whose text already holds that character). Lane #202, for the "Nederlandse Filmacademie" lettering
 * on the Markenplein front (Wikimedia Commons, FaceMePLS 2014; 2021 city panorama): the shared table has no `F`, `a`,
 * `d`, `r` or `s`. Lowercase glyphs keep GL's x-height (rows 2-6) and ascender rows (0-1).
 */
export const MIXED_CASE_EXTRA: Readonly<Record<string, readonly string[]>> = {
  // F moved into GL with Sameplace (clubs-b, 2026-11-14); letters() throws on a missing glyph, so no GL text held an F before.
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  d: ['00001', '00001', '01101', '10011', '10001', '10011', '01101'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  f: ['00110', '01000', '01000', '11110', '01000', '01000', '01000'],
  t: ['01000', '01000', '11110', '01000', '01000', '01001', '00110'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  // Tetterode type foundry (Da Costakade 146 lane, 2026-11-02): the 1909 Da Costakade frieze reads
  // LETTERGIETERIJ 'AMSTERDAM' V/H N.TETTERODE (w02-67 panorama 2020, Commons "Lettergieterij (Tetterode).JPG"); GL has the apostrophe, not the slash.
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  // Quarter Plaza, Transformatorweg 38-104 (#236, 2026-11-07): the "quarter plaza" name on the south front's parapet
  // (w04-179 panorama 2025-07-01) needs a lowercase q and u. q keeps the x-height; its stem ends on the baseline (7 rows).
  q: ['00000', '00000', '01111', '10001', '01111', '00001', '00001'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  // De Nieuwe Liefde, Da Costakade 102 (venues-ring lane, 2026-11-14): the dark "De Nieuwe Liefde" lettering over the
  // entrance (recording_2025-07-31_10-53-44_00617) needs a lowercase w; GL draws m in the same three-stem style.
  w: ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
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

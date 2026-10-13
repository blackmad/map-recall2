/**
 * Tiny 5 x 7 block font for lettering on monuments and plaques (landmark builders): glyph rows are merged into horizontal runs, so a
 * word is a handful of boxes. Only the glyphs the landmarks need are defined; unknown characters throw.
 */
const G: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

export interface TextBox {x: number; y: number; w: number; h: number}

/** Width of `text` in metres at `pixel` m per cell (glyph + one blank column spacing). */
export function textWidth(text: string, pixel: number): number {
  let cols = 0;
  for (const ch of text) { const g = G[ch]; if (!g) throw Error(`pixel-font: no glyph for ${ch}`); cols += g[0].length + 1; }
  return (cols - 1) * pixel;
}

/** Boxes of the lettering: x from the left edge (0) rightwards, y from the baseline (0) upwards, one box per horizontal run. */
export function textBoxes(text: string, pixel: number): TextBox[] {
  const out: TextBox[] = [];
  let x0 = 0;
  for (const ch of text) {
    const g = G[ch]; if (!g) throw Error(`pixel-font: no glyph for ${ch}`);
    g.forEach((row, j) => {
      let k = 0;
      while (k < row.length) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < row.length && row[e] === '1') e++;
        out.push({x: x0 + k * pixel, y: (6 - j) * pixel, w: (e - k) * pixel, h: pixel});
        k = e;
      }
    });
    x0 += (g[0].length + 1) * pixel;
  }
  return out;
}

// A 5 x 7 pixel font for shop signs, drawn as merged horizontal runs.
//
// Lettering is what makes a storefront read as *that* business from the street, and a
// low-poly world wants it blocky rather than smooth. Each glyph row is merged into runs, so a
// letter costs a handful of flat quads; `textRuns` lays a string out in a box.

const G: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#', "'": '#|#|.|.|.|.|.', '!': '#|#|#|#|#|.|#', '.': '.|.|.|.|.|.|#',
  '-': '...|...|...|###|...|...|...', ':': '.|.|#|.|#|.|.', '#': '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....',
  'Ö': '#...#|.###.|#...#|#...#|#...#|#...#|.###.', 'É': '..#..|#####|#....|####.|#....|#....|#####',
};
const ACCENTS: Record<string, string> = { 'À': 'A', 'Á': 'A', 'Â': 'A', 'Ä': 'A', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Ì': 'I', 'Í': 'I', 'Ï': 'I', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Ù': 'U', 'Ú': 'U', 'Ü': 'U', 'Ç': 'C', 'Ñ': 'N' };

const glyph = (c: string) => (G[c] ?? G[ACCENTS[c] ?? ''] ?? null)?.split('|') ?? null;

/** One lit run of pixels: columns [c0, c1) of row r (0 = top), in pixel units from the string's top-left. */
export type TextRun = { c0: number; c1: number; r: number };

/** A string as pixel runs, with its width in pixels (7 high); unknown characters become spaces. */
export function textPixels(text: string): { runs: TextRun[]; width: number } {
  const runs: TextRun[] = [];
  let x = 0;
  for (const ch of text.toUpperCase()) {
    const g = ch === ' ' ? null : glyph(ch);
    if (!g) { x += 3; continue; }
    g.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '#') continue;
        let e = c; while (e < row.length && row[e] === '#') e++;
        runs.push({ c0: x + c, c1: x + e, r }); c = e;
      }
    });
    x += g[0].length + 1;
  }
  return { runs, width: Math.max(0, x - 1) };
}

/**
 * Lay `text` out in the box [x0, x1] x [z0, z1] (metres along the wall and up): as tall as the
 * box allows unless that overflows its width, centred (or aligned). Returns rectangles in metres.
 */
export function textRects(text: string, x0: number, x1: number, z0: number, z1: number, align: 'left' | 'centre' | 'right' = 'centre'): { x0: number; x1: number; z0: number; z1: number }[] {
  const { runs, width } = textPixels(text);
  if (!width) return [];
  const px = Math.min((z1 - z0) / 7, (x1 - x0) / width), w = width * px;
  const left = align === 'left' ? x0 : align === 'right' ? x1 - w : (x0 + x1) / 2 - w / 2, top = (z0 + z1) / 2 + 3.5 * px;
  return runs.map(({ c0, c1, r }) => ({ x0: left + c0 * px, x1: left + c1 * px, z0: top - (r + 1) * px, z1: top - r * px }));
}

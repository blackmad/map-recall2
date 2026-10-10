// Blocky 5 x 7 capitals for a shop's brand word on its fascia: each letter is a few
// horizontal runs, so a word is a handful of flat quads. Only the letters the supermarket
// chains' words need (shopfronts.ts SUPERMARKET_CHAINS) plus the rest of A-Z, 0-9 and & ' - . for
// recipe shop signs (buildingRecipe/fit.ts signDecals); any other character is a space.

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  // Full sign set (block-face shop signs): the remaining capitals, digits and & ' - .
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.###.'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
};

/** A run of lit cells: columns [c0, c1) on row `row` (0 = top), in cell units from the word's left. */
export type LetterRun = { c0: number; c1: number; row: number };

/** The word as horizontal runs, letters 5 cells wide with a 1-cell gap; `width` in cells. */
export function wordRuns(word: string): { runs: LetterRun[]; width: number } {
  const runs: LetterRun[] = [];
  const chars = [...word.toUpperCase()];
  chars.forEach((ch, i) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    glyph.forEach((line, row) => {
      for (let c = 0; c < line.length; c++) {
        if (line[c] !== '#') continue;
        let end = c; while (end < line.length && line[end] === '#') end++;
        runs.push({ c0: i * 6 + c, c1: i * 6 + end, row });
        c = end;
      }
    });
  });
  return { runs, width: Math.max(0, chars.length * 6 - 1) };
}

/** A lit rectangle: columns [c0, c1), rows [row0, row1) (0 = top), in cell units. */
export type LetterRect = { c0: number; c1: number; row0: number; row1: number };

/** The word as rectangles: `wordRuns` with identical runs on consecutive rows merged (stems become one quad). */
export function wordRects(word: string): { rects: LetterRect[]; width: number } {
  const { runs, width } = wordRuns(word);
  const open = new Map<string, LetterRect>(), rects: LetterRect[] = [];
  for (const r of [...runs].sort((a, b) => a.row - b.row || a.c0 - b.c0)) {
    const key = `${r.c0},${r.c1}`, cur = open.get(key);
    if (cur && cur.row1 === r.row) { cur.row1 = r.row + 1; continue; }
    const rect = { c0: r.c0, c1: r.c1, row0: r.row, row1: r.row + 1 };
    open.set(key, rect); rects.push(rect);
  }
  return { rects, width };
}

// Blocky 5 x 7 capitals for a shop's brand word on its fascia: each letter is a few
// horizontal runs, so a word is a handful of flat quads. Only the letters the supermarket
// chains' words need (shopfronts.ts SUPERMARKET_CHAINS); any other character is a space.

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

/**
 * One colour per round on the game-over review map, so a player can tell which
 * line, pin and connector belong together. Eight hues, all dark enough to read
 * (>= 3:1) on CARTO light paper (#f2f0eb), spread around the wheel and kept
 * clear of the enamel plaque blue (#0b3a8c) that carries the names.
 */
export const ROUND_PALETTE = [
  '#c2352b', // vermilion
  '#1b78a8', // cerulean
  '#2f7d3a', // leaf
  '#8c3fa6', // violet
  '#c45a00', // amber
  '#00807a', // teal
  '#a8326e', // magenta
  '#7a6200', // olive gold
] as const;

/** CARTO light basemap paper, what the colours must stand out against. */
export const CARTO_LIGHT_PAPER = '#f2f0eb';

export function roundColor(index: number): string {
  const n = ROUND_PALETTE.length;
  return ROUND_PALETTE[((index % n) + n) % n];
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Sign positions are centered. Reserve a facade panel width before emitting glyph boxes. */
export function fittedSignLayout(text: string, glyphs: Record<string, string[]>, pixel: number, maxWidth = Infinity) {
  if (!Number.isFinite(pixel) || pixel <= 0 || !(maxWidth > 0)) throw new Error('Invalid sign dimensions');
  const columns = [...text].reduce((n, ch) => n + (glyphs[ch]?.[0].length ?? 3) + 1, 0);
  const fittedPixel = columns ? Math.min(pixel, maxWidth / columns) : pixel;
  const width = columns * fittedPixel;
  return { pixel: fittedPixel, width, start: -width / 2 };
}

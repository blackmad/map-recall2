// The facade atlas's tint mask on the GPU (#129, iPhone texture budget). Painted, cached and published as RG bytes
// (R the wall tint, G the accent tint, look/paintLookAtlas.ts); the colour array's alpha was always 255 and no
// shader reads it. At upload the accent moves into the colour's alpha, stored as 255 − G, and the mask goes up as one
// R8 channel: a third less atlas (208 layers at 128 px: 27.2 → 22.7 MB with mips), the same 8 bits, filtering
// and mips per channel, no extra texture fetch.
//
// Shaders read the accent as `mask.g + 1.0 − colour.a` (ACCENT_GLSL): an RG mask with opaque colour gives G, an R8 mask
// (whose .g reads 0) with packed colour gives G again, so either upload draws the same. `?maskFormat=rg` (or
// `__canalRecallMaskFormat = 'rg'` before load) keeps the RG upload, as the A/B.

/** The accent from a colour sample `c` (vec4) and a mask sample `m` (vec2 or more), as GLSL. */
export const accentGlsl = (m: string, c: string): string => `(${m}.g + 1.0 - ${c}.a)`;

export type MaskFormat = 'r8' | 'rg';

export function maskFormatFlag(): MaskFormat {
  const g = globalThis as { __canalRecallMaskFormat?: string; location?: { search?: string } };
  const asked = g.__canalRecallMaskFormat ?? new URLSearchParams(g.location?.search ?? '').get('maskFormat');
  return asked === 'rg' ? 'rg' : 'r8';
}

/**
 * The arrays as uploaded: `r8` writes 255 − G into `colour`'s alpha (in place) and returns the R channel alone;
 * `rg` sets the alpha to 255 and returns `mask` as it is. `colour` is RGBA, `mask` RG, over the same texels.
 */
export function packMask(colour: Uint8Array, mask: Uint8Array, format: MaskFormat = maskFormatFlag()): { colour: Uint8Array; mask: Uint8Array; channels: 1 | 2 } {
  const n = mask.length >> 1;
  if (colour.length !== n * 4) throw new Error(`packMask: ${colour.length} colour bytes for ${n} mask texels`);
  if (format === 'rg') {
    for (let i = 0; i < n; i++) colour[i * 4 + 3] = 255;
    return { colour, mask, channels: 2 };
  }
  const red = new Uint8Array(n);
  for (let i = 0; i < n; i++) { red[i] = mask[i * 2]; colour[i * 4 + 3] = 255 - mask[i * 2 + 1]; }
  return { colour, mask: red, channels: 1 };
}

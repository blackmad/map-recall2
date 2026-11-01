// The ground's grain textures (gameGround.ts makeMaterials: gravel, park, lawn, sand, bark, ...): one random grey
// offset per `grain`-px block over a base tone. They were painted one fillRect per block with a CSS colour string,
// ~16 k string builds and colour parses per 256 px texture and a dozen textures at boot (#129 boot owners: the
// largest single main-thread owner before submit). `paintNoise` writes the same pixels into one ImageData instead.
//
// Exact: a block's colour is what the canvas makes of `rgb(r, g, b)` with fractional components, which is each
// component rounded to the nearest integer and clamped to 0..255; the random sequence is consumed in the same
// order (rows of blocks, left to right), so the texture and every later draw that shares the generator are
// unchanged. scripts/check-ground-noise.ts paints both versions in Chrome and compares every pixel.

/** The CSS colour rounding of one `rgb()` component. */
const component = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/** One random offset per block over `base`, as the fillRect painter drew it; fully opaque. */
export function paintNoise(g: CanvasRenderingContext2D, s: number, base: readonly number[], spread: number, grain: number, rnd: () => number): void {
  const img = g.createImageData(s, s), data = img.data;
  for (let y = 0; y < s; y += grain) for (let x = 0; x < s; x += grain) {
    const v = (rnd() - 0.5) * spread;
    const r = component(base[0] + v), gr = component(base[1] + v), b = component(base[2] + v);
    for (let yy = y, y1 = Math.min(s, y + grain); yy < y1; yy++) for (let xx = x, x1 = Math.min(s, x + grain); xx < x1; xx++) {
      const at = (yy * s + xx) * 4;
      data[at] = r; data[at + 1] = gr; data[at + 2] = b; data[at + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/** The original painter (the reference scripts/check-ground-noise.ts compares against). */
export function paintNoiseReference(g: CanvasRenderingContext2D, s: number, base: readonly number[], spread: number, grain: number, rnd: () => number): void {
  for (let y = 0; y < s; y += grain) for (let x = 0; x < s; x += grain) {
    const v = (rnd() - 0.5) * spread;
    g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(x, y, grain, grain);
  }
}
